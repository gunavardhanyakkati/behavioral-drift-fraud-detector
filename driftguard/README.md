# DriftGuard — Behavioral-Drift Fraud Detection Console

An interactive web UI (React + FastAPI) that visualizes the `behavioral-drift-fraud-detector`
project end to end: data → bank silos → live federated training → behavioral profiles →
scoring → evaluation.

**The project's own code is untouched.** DriftGuard lives in the repo's `driftguard/` folder, and
its backend imports the modules from `../src` read-only. Generated data goes to
`driftguard/backend/workspace/`, never into the project's own `data/` folder.

## Run it (demo day)

```bat
start-driftguard.bat
```

This opens <http://localhost:8000>. On first launch it builds the UI if needed. The model trains for
about 5 seconds when the server starts; the sidebar shows **Global model ready** when it's done.

Requirements: Python 3.10+ with the project's requirements, plus Node 18+ (only for the first build).

```bat
pip install -r backend\requirements.txt
```

### Developer mode (hot reload)

```bat
cd backend  &&  python -m uvicorn app.main:app --port 8000 --reload
cd frontend &&  npm run dev        # http://localhost:5173, proxies /api to :8000
```

## Suggested 5-minute walkthrough

Use **← / →** to move between steps.

| Step | Show | Say |
|---|---|---|
| Overview | Animated architecture | "Two opinions: a model shared across banks, and a personal baseline per customer, fused into one score." |
| 1 · Data & Banks | Split into 3 banks, fraud-type cards | "60% of fraud is *personalized*: it looks normal globally and abnormal only for that customer." |
| 2 · Federated Training | Press **Run federated training** (Presentation speed) | Point at the packets: weights go out, ΔW comes back, FedAvg. Counter: **0 raw rows transmitted**. |
| 3 · Behavioral Profiles | U001 (User A) | "Built inside Bank A from legitimate history only, and never shared." |
| 4 · Live Analyzer | Preset **User A · ₹10,000 electronics** | The global model alone says LEGITIMATE (0.453); drift pushes it to **FRAUD** (0.505). Drag α live. |
| 5 · User A vs User B | Same ₹10,000 | Identical P for both; drift 0.625 vs 0.238, so FRAUD vs LEGITIMATE. Drag the amount slider. |
| 6 · Results | Model cards, α sweep, decision space | Measured on 1,201 held-out transactions. |

## Numbers you'll see (seed 42, 3 rounds × 3 epochs)

| | Precision | Recall | F1 | False alarms |
|---|---|---|---|---|
| Local-only (each bank alone) | 77.5% | 58.5% | 0.667 | 9 |
| Federated (global model) | 75.0% | 67.9% | 0.713 | 12 |
| Federated + drift (α = 0.7) | 81.8% | 67.9% | 0.742 | 8 |

- Training is seeded (`seed=42`), so these numbers reproduce on every restart. The project's own
  `demo.py` doesn't seed PyTorch, so its numbers vary from run to run.
- The User A ₹10,000 case scores **0.505**, just over the 0.50 threshold. If you change rounds or
  epochs on the training page, that verdict can flip. Restart the server (or run 3 × 3 again) to restore it.
- The "Local-only" baseline is actually trained and measured here. `compare_behavior.py` prints a
  hard-coded "~88.5% / ~65%".
- Lower α (more weight on drift) scores better on this data: the best F1 is about 0.88 at α ≈ 0.3.
  The Results page shows this as the README's "tune α" future-work item.

## How it works

```
frontend/ (React, Vite, Tailwind, Recharts, Framer Motion)
   │  REST + Server-Sent Events
backend/app/main.py      FastAPI routes; serves frontend/dist in production
backend/app/engine.py    bridge to the project's src/ modules
   └── imports: generate_dataset, partition_banks, TransactionPreprocessor, FraudClassifierNN,
                BankClient, fedavg_aggregate, LocalBehavioralProfileManager,
                BehavioralDriftCalculator, BehavioralDriftPredictor
```

The only re-implemented piece is the federated round loop. It mirrors
`src/federated/server.py::run_federated_training` call for call (same clients, split, and FedAvg)
and emits progress events so the UI can animate each step. Inference goes straight through the
project's `BehavioralDriftPredictor`.

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | model readiness and training history |
| `GET /api/pipeline/run` | runs the full pipeline and streams events (SSE) |
| `GET /api/overview` | dataset and bank statistics |
| `GET /api/users`, `GET /api/profile/{id}` | customers and behavioral profiles |
| `POST /api/predict` | score one transaction (with α and threshold) |
| `POST /api/sweep` | final score versus amount for several users |
| `GET /api/evaluation` | held-out metrics, α sweep, decision-space points |
