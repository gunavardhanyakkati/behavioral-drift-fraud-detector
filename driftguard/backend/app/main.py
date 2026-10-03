import asyncio
import json
import os
import threading
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .engine import engine, FEATURED_USERS

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))


@asynccontextmanager
async def lifespan(_app):
    threading.Thread(target=engine.bootstrap, daemon=True).start()
    yield


app = FastAPI(title="DriftGuard — Behavioral-Drift Fraud Detection API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Transaction(BaseModel):
    user_id: str = "U001"
    bank_id: Optional[str] = None
    amount: float = Field(10000.0, gt=0)
    hour: int = Field(14, ge=0, le=23)
    day_of_week: int = Field(2, ge=0, le=6)
    merchant_category: str = "Electronics"
    location: str = "Hyderabad"
    transaction_type: str = "POS"
    device_type: str = "POS_Terminal"


class PredictRequest(BaseModel):
    txn: Transaction
    alpha: float = Field(0.7, ge=0, le=1)
    threshold: float = Field(0.5, ge=0, le=1)


class SweepRequest(PredictRequest):
    user_ids: List[str] = ["U001", "U002"]


def _guard(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown user {exc}")


@app.get("/api/status")
def status():
    return engine.status_info()


@app.get("/api/overview")
def overview():
    return _guard(engine.overview)


@app.get("/api/users")
def users():
    return {"banks": _guard(engine.users), "featured": FEATURED_USERS}


@app.get("/api/profile/{user_id}")
def profile(user_id: str):
    return _guard(engine.profile, user_id)


@app.post("/api/predict")
def predict(req: PredictRequest):
    return _guard(engine.predict, req.txn.model_dump(), req.alpha, req.threshold)


@app.post("/api/sweep")
def sweep(req: SweepRequest):
    return _guard(engine.amount_sweep, req.txn.model_dump(), req.user_ids, req.alpha, req.threshold)


@app.get("/api/evaluation")
def evaluation():
    st = _guard(engine.require_state)
    return st.evaluation


@app.get("/api/pipeline/run")
async def run_pipeline(
    rounds: int = Query(3, ge=1, le=10),
    epochs: int = Query(3, ge=1, le=10),
    seed: int = 42,
    pace: float = Query(1.0, ge=0, le=3),
):
    """Runs the whole pipeline and streams every step as Server-Sent Events."""
    if engine.run_lock.locked():
        raise HTTPException(status_code=409, detail="A pipeline run is already in progress.")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def emit(kind, data):
        loop.call_soon_threadsafe(queue.put_nowait, {"type": kind, **(data or {})})

    def worker():
        try:
            engine.run_pipeline(num_rounds=rounds, local_epochs=epochs, seed=seed, pace=pace, emit=emit)
        except Exception as exc:
            emit("error", {"message": f"{type(exc).__name__}: {exc}"})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    threading.Thread(target=worker, daemon=True).start()

    async def stream():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# Serve the built React app (frontend/dist) when it exists, so one server runs the whole demo.
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = os.path.join(FRONTEND_DIST, path)
        if path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
