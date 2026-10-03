"""
Bridge between the web app and the original `behavioral-drift-fraud-detector` project.

The original project is used read-only: its modules are imported as-is and nothing in
its folder is written to. Datasets are produced by the project's own generator and
partitioner, but into this app's `workspace/` folder.

The only re-implemented piece is the federated round loop, which mirrors
`src/federated/server.py::run_federated_training` call-for-call (same clients, same
split, same FedAvg) and additionally emits progress events so the UI can animate it.
"""
import os
import sys
import time
import threading
import contextlib
import io

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split

APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.environ.get(
    "FRAUD_PROJECT_ROOT",
    os.path.abspath(os.path.join(APP_DIR, "..", "..", "..")),
)
WORKSPACE_DATA = os.path.abspath(os.path.join(APP_DIR, "..", "workspace", "data"))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# The project tracks its __pycache__/*.pyc in git; don't rewrite them on import.
sys.dont_write_bytecode = True

from src.data.generate_dataset import generate_synthetic_transactions  # noqa: E402
from src.data.partition_banks import partition_data_by_bank  # noqa: E402
from src.model.preprocessing import TransactionPreprocessor, CATEGORICAL_VOCAB  # noqa: E402
from src.model.fraud_model import FraudClassifierNN  # noqa: E402
from src.federated.client import BankClient  # noqa: E402
from src.federated.strategy import fedavg_aggregate  # noqa: E402
from src.behavioral.profile import LocalBehavioralProfileManager  # noqa: E402
from src.behavioral.drift import BehavioralDriftCalculator  # noqa: E402
from src.inference.predict import BehavioralDriftPredictor  # noqa: E402

# Tiny MLP: multi-threaded BLAS only adds overhead (single thread is ~4x faster here).
torch.set_num_threads(1)

BANKS = ["Bank A", "Bank B", "Bank C"]
NUM_TRANSACTIONS = 6000
DATA_SEED = 42
FEATURED_USERS = {
    "U001": "User A · low spender (₹300–₹800)",
    "U002": "User B · high spender (₹8k–₹15k)",
}


def bank_folder(data_dir, bank):
    return os.path.join(data_dir, bank.lower().replace(" ", "_"))


def bank_csv(data_dir, bank):
    return os.path.join(bank_folder(data_dir, bank), "transactions.csv")


def to_py(obj):
    """Recursively convert numpy / pandas scalars into JSON-safe Python types."""
    if isinstance(obj, dict):
        return {str(k): to_py(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_py(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return to_py(obj.tolist())
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def _quiet(fn, *args, **kwargs):
    """Run an original-project function while swallowing its console prints."""
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args, **kwargs)


def _metrics(y_true, y_pred):
    y_true = np.asarray(y_true).astype(int)
    y_pred = np.asarray(y_pred).astype(int)
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())
    n = max(1, len(y_true))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "accuracy": round((tp + tn) / n, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def _layer_activations(model, x_np):
    """Hidden-layer activations of the original FraudClassifierNN for one input row."""
    model.eval()
    acts = []
    with torch.no_grad():
        h = torch.tensor(x_np, dtype=torch.float32)
        if h.ndim == 1:
            h = h.unsqueeze(0)
        for layer in model.net:
            h = layer(h)
            if isinstance(layer, torch.nn.ReLU):
                acts.append(h[0].cpu().numpy())
    return acts


class ModelState:
    """Everything produced by one full pipeline run."""

    def __init__(self):
        self.global_model = None
        self.preprocessor = None
        self.profile_managers = {}
        self.history = None
        self.round_details = []
        self.config = {}
        self.evaluation = None
        self.trained_at = None
        self.payload_bytes = 0
        self.num_params = 0


class Engine:
    def __init__(self, data_dir=WORKSPACE_DATA):
        self.data_dir = data_dir
        self.state = None
        self.status = "starting"
        self.status_detail = ""
        self.lock = threading.Lock()
        self.run_lock = threading.Lock()
        self._frames = {}
        self._user_bank = {}

    # ------------------------------------------------------------------ data

    @property
    def raw_csv(self):
        return os.path.join(self.data_dir, "raw", "transactions_raw.csv")

    def data_ready(self):
        return os.path.exists(self.raw_csv) and all(os.path.exists(bank_csv(self.data_dir, b)) for b in BANKS)

    def generate_data(self):
        os.makedirs(os.path.dirname(self.raw_csv), exist_ok=True)
        df_raw = generate_synthetic_transactions(num_transactions=NUM_TRANSACTIONS, seed=DATA_SEED)
        df_raw.to_csv(self.raw_csv, index=False)
        summary = _quiet(partition_data_by_bank, self.raw_csv, self.data_dir)
        self._load_frames()
        return df_raw, summary

    def _load_frames(self):
        frames = {"raw": pd.read_csv(self.raw_csv)}
        for b in BANKS:
            frames[b] = pd.read_csv(bank_csv(self.data_dir, b))
        self._frames = frames
        self._user_bank = dict(zip(frames["raw"]["user_id"], frames["raw"]["bank_id"]))

    def frames(self):
        if not self._frames:
            self._load_frames()
        return self._frames

    def bank_of(self, user_id):
        self.frames()
        return self._user_bank.get(user_id)

    def held_out(self):
        """Exactly the 20% validation rows each bank keeps out of training (same split as server.py)."""
        parts = []
        for b in BANKS:
            df = self.frames()[b]
            y = df["is_fraud"].values.astype(np.float32)
            _, te = train_test_split(df, test_size=0.2, random_state=42, stratify=y)
            parts.append(te)
        return pd.concat(parts, ignore_index=True)

    # -------------------------------------------------------------- pipeline

    def run_pipeline(self, num_rounds=3, local_epochs=3, batch_size=64, seed=42, pace=0.0, emit=None):
        """Full end-to-end run: data -> partition -> federated training -> profiles -> evaluation."""
        emit = emit or (lambda *_: None)
        if not self.run_lock.acquire(blocking=False):
            raise RuntimeError("A pipeline run is already in progress.")
        try:
            self.status = "training"
            t0 = time.time()

            def hold(since, secs):
                left = secs - (time.time() - since)
                if left > 0:
                    time.sleep(left)

            # 1. Synthetic data generation (original generator)
            s = time.time()
            emit("stage", {"stage": "generate", "status": "running"})
            df_raw, summary = self.generate_data()
            emit("dataset", {
                "total": len(df_raw),
                "fraud": int(df_raw["is_fraud"].sum()),
                "users": int(df_raw["user_id"].nunique()),
                "columns": list(df_raw.columns),
                "size_kb": round(os.path.getsize(self.raw_csv) / 1024, 1),
            })
            hold(s, pace * 1.2)
            emit("stage", {"stage": "generate", "status": "done"})

            # 2. Partition into isolated banks (original partitioner)
            s = time.time()
            emit("stage", {"stage": "partition", "status": "running"})
            hold(s, pace * 0.6)
            emit("partition", {
                b: {
                    "total_txns": int(v["total_txns"]),
                    "unique_users": int(v["unique_users"]),
                    "fraud_txns": int(v["fraud_txns"]),
                    "size_kb": round(os.path.getsize(v["file"]) / 1024, 1),
                }
                for b, v in summary.items()
            })
            hold(s, pace * 1.4)
            emit("stage", {"stage": "partition", "status": "done"})

            # 3. Federated training
            emit("stage", {"stage": "federated", "status": "running"})
            state = self._train_federated(num_rounds, local_epochs, batch_size, seed, pace, emit)
            emit("stage", {"stage": "federated", "status": "done"})

            # 4. Local behavioral profiles (original profile manager, per bank)
            s = time.time()
            emit("stage", {"stage": "profiles", "status": "running"})
            for b in BANKS:
                mgr = LocalBehavioralProfileManager(bank_id=b)
                mgr.build_profiles(self.frames()[b])
                state.profile_managers[b] = mgr
                emit("profiles", {"bank": b, "count": len(mgr.profiles)})
                hold(s, pace * 0.5)
                s = time.time()
            emit("stage", {"stage": "profiles", "status": "done"})

            # 5. Evaluation on held-out rows
            s = time.time()
            emit("stage", {"stage": "evaluate", "status": "running"})
            state.evaluation = self._evaluate(state, seed)
            hold(s, pace)
            ev = state.evaluation
            emit("evaluation", {k: ev["models"][k] for k in ev["models"]} | {"test_size": ev["test_size"]})
            emit("stage", {"stage": "evaluate", "status": "done"})

            state.trained_at = time.time()
            with self.lock:
                self.state = state
            self.status = "ready"
            emit("done", {"seconds": round(time.time() - t0, 2)})
            return state
        except Exception:
            self.status = "ready" if self.state else "error"
            raise
        finally:
            self.run_lock.release()

    def _train_federated(self, num_rounds, local_epochs, batch_size, seed, pace, emit):
        """Mirrors src/federated/server.py::run_federated_training, emitting UI events."""
        torch.manual_seed(seed)
        np.random.seed(seed)

        bank_dfs = {b: pd.read_csv(bank_csv(self.data_dir, b)) for b in BANKS}
        combined_df = pd.concat(list(bank_dfs.values()), ignore_index=True)

        preprocessor = TransactionPreprocessor()
        preprocessor.fit(combined_df)
        in_features = preprocessor.num_features

        clients = {}
        for bname, df_bank in bank_dfs.items():
            X = preprocessor.transform(df_bank)
            y = df_bank["is_fraud"].values.astype(np.float32)
            X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
            clients[bname] = BankClient(
                bank_name=bname, X_train=X_tr, y_train=y_tr, X_test=X_te, y_test=y_te,
                batch_size=batch_size, in_features=in_features,
            )

        global_model = FraudClassifierNN(in_features=in_features)
        global_weights = global_model.get_weights()
        payload_bytes = int(sum(w.nbytes for w in global_weights))
        num_params = int(sum(w.size for w in global_weights))

        emit("fl_init", {
            "in_features": in_features,
            "num_params": num_params,
            "payload_bytes": payload_bytes,
            "layers": [f"Linear({in_features}→64)", "BatchNorm(64)", "ReLU", "Dropout(0.2)",
                       "Linear(64→32)", "ReLU", "Dropout(0.1)", "Linear(32→1)", "Sigmoid"],
            "rounds": num_rounds,
            "local_epochs": local_epochs,
            "clients": {b: {"train": c.train_size, "test": c.test_size} for b, c in clients.items()},
        })

        history = {"rounds": [], "round_losses": [], "round_accuracies": []}
        round_details = []
        fit_config = {"epochs": local_epochs}

        for r in range(1, num_rounds + 1):
            emit("round_start", {"round": r})
            s = time.time()
            emit("broadcast", {"round": r, "payload_bytes": payload_bytes})
            time.sleep(pace * 0.9)

            client_updates, val_losses, val_accs, bank_detail = [], [], [], {}
            for bname, client in clients.items():
                s = time.time()
                emit("client_training", {"round": r, "bank": bname, "samples": client.train_size, "epochs": local_epochs})
                updated_weights, num_samples, metrics = client.fit(global_weights, config=fit_config)
                client_updates.append((updated_weights, num_samples))
                _, _, val_metrics = client.evaluate(updated_weights)
                val_losses.append(val_metrics["val_loss"])
                val_accs.append(val_metrics["val_acc"])

                delta = float(np.sqrt(sum(
                    float(np.sum((np.asarray(u, dtype=np.float64) - np.asarray(g, dtype=np.float64)) ** 2))
                    for u, g in zip(updated_weights, global_weights) if np.asarray(g).ndim > 0
                )))
                detail = {
                    "train_loss": round(float(metrics["train_loss"]), 4),
                    "train_acc": round(float(metrics["train_acc"]), 4),
                    "val_loss": round(float(val_metrics["val_loss"]), 4),
                    "val_acc": round(float(val_metrics["val_acc"]), 4),
                    "samples": int(num_samples),
                    "update_norm": round(delta, 4),
                }
                bank_detail[bname] = detail
                hold_left = pace * 1.3 - (time.time() - s)
                if hold_left > 0:
                    time.sleep(hold_left)
                emit("client_done", {"round": r, "bank": bname, **detail, "payload_bytes": payload_bytes})

            s = time.time()
            total = sum(n for _, n in client_updates)
            shares = {b: round(n / total, 4) for b, (_, n) in zip(clients.keys(), client_updates)}
            emit("aggregating", {"round": r, "shares": shares})
            global_weights = fedavg_aggregate(client_updates)
            global_model.set_weights(global_weights)

            avg_loss = float(np.mean(val_losses))
            avg_acc = float(np.mean(val_accs))
            history["rounds"].append(r)
            history["round_losses"].append(avg_loss)
            history["round_accuracies"].append(avg_acc)
            round_details.append({
                "round": r, "global_loss": round(avg_loss, 4), "global_acc": round(avg_acc, 4),
                "shares": shares, "banks": bank_detail,
            })
            left = pace * 1.0 - (time.time() - s)
            if left > 0:
                time.sleep(left)
            emit("aggregate", {"round": r, "global_loss": round(avg_loss, 4), "global_acc": round(avg_acc, 4), "shares": shares})

        state = ModelState()
        state.global_model = global_model
        state.preprocessor = preprocessor
        state.history = history
        state.round_details = round_details
        state.payload_bytes = payload_bytes
        state.num_params = num_params
        state.config = {"rounds": num_rounds, "local_epochs": local_epochs, "batch_size": batch_size, "seed": seed}
        return state

    # ------------------------------------------------------------ evaluation

    def _evaluate(self, state, seed, alpha=0.7, threshold=0.5):
        """
        Scores the held-out 20% of every bank (never used for training) three ways:
        local-only models, the federated global model, and federated + behavioral drift.
        """
        test_df = self.held_out()
        y = test_df["is_fraud"].values.astype(int)
        X_te = state.preprocessor.transform(test_df)

        P = state.global_model.predict_proba(X_te)
        calc = BehavioralDriftCalculator()
        records = test_df.to_dict("records")
        drift = [calc.compute_drift(t, state.profile_managers[t["bank_id"]].get_profile(t["user_id"])) for t in records]
        S = np.array([d["behavioral_drift_score"] for d in drift])

        # Local-only baseline: each bank trains the same network alone, same total epochs, no FedAvg.
        torch.manual_seed(seed)
        P_local = np.zeros(len(test_df))
        for b in BANKS:
            df_b = self.frames()[b]
            Xb = state.preprocessor.transform(df_b)
            yb = df_b["is_fraud"].values.astype(np.float32)
            X_tr, X_tb, y_tr, y_tb = train_test_split(Xb, yb, test_size=0.2, random_state=42, stratify=yb)
            client = BankClient(b, X_tr, y_tr, X_tb, y_tb, state.config["batch_size"], state.preprocessor.num_features)
            w = client.get_parameters()
            for _ in range(state.config["rounds"]):
                w, _, _ = client.fit(w, config={"epochs": state.config["local_epochs"]})
            local_model = FraudClassifierNN(state.preprocessor.num_features)
            local_model.set_weights(w)
            mask = (test_df["bank_id"] == b).values
            P_local[mask] = local_model.predict_proba(state.preprocessor.transform(test_df[mask]))

        fused = alpha * P + (1 - alpha) * S
        models = {
            "local": _metrics(y, P_local >= threshold),
            "federated": _metrics(y, P >= threshold),
            "fused": _metrics(y, fused >= threshold),
        }

        sweep = []
        for a in np.round(np.linspace(0, 1, 21), 2):
            m = _metrics(y, (a * P + (1 - a) * S) >= threshold)
            sweep.append({"alpha": float(a), **m})

        # Fraud flavours injected by the generator: large night-time "global" anomalies
        # vs. "personalized" anomalies at normal hours and globally normal amounts.
        obvious = (test_df["amount"].values >= 25000) & (test_df["hour"].values <= 4)
        fraud = y == 1
        def recall_on(mask, pred):
            n = int(mask.sum())
            return {"caught": int((pred & mask).sum()), "total": n}
        by_type = {
            "global_anomaly": {
                "local": recall_on(fraud & obvious, P_local >= threshold),
                "federated": recall_on(fraud & obvious, P >= threshold),
                "fused": recall_on(fraud & obvious, fused >= threshold),
                "drift_only": recall_on(fraud & obvious, S >= threshold),
            },
            "personalized_anomaly": {
                "local": recall_on(fraud & ~obvious, P_local >= threshold),
                "federated": recall_on(fraud & ~obvious, P >= threshold),
                "fused": recall_on(fraud & ~obvious, fused >= threshold),
                "drift_only": recall_on(fraud & ~obvious, S >= threshold),
            },
        }

        points = [
            {
                "p": round(float(P[i]), 4), "s": round(float(S[i]), 4), "y": int(y[i]),
                "user": records[i]["user_id"], "bank": records[i]["bank_id"],
                "amount": float(records[i]["amount"]), "hour": int(records[i]["hour"]),
                "merchant": records[i]["merchant_category"], "location": records[i]["location"],
            }
            for i in range(len(records))
        ]

        return to_py({
            "test_size": int(len(test_df)),
            "fraud_count": int(fraud.sum()),
            "alpha": alpha,
            "threshold": threshold,
            "models": models,
            "alpha_sweep": sweep,
            "by_type": by_type,
            "points": points,
        })

    # ------------------------------------------------------------- inference

    def require_state(self):
        with self.lock:
            st = self.state
        if st is None:
            raise RuntimeError("Model is still warming up — try again in a few seconds.")
        return st

    def predict(self, txn, alpha=0.7, threshold=0.5):
        st = self.require_state()
        txn = dict(txn)
        txn["bank_id"] = txn.get("bank_id") or self.bank_of(txn["user_id"]) or "Bank A"
        txn.setdefault("transaction_id", "TXN_LIVE")

        predictor = BehavioralDriftPredictor(
            global_model=st.global_model, preprocessor=st.preprocessor,
            profile_managers=st.profile_managers, alpha=alpha, threshold=threshold,
        )
        result = predictor.predict_transaction(txn)

        x = st.preprocessor.transform_single(txn)[0]
        names = st.preprocessor.feature_names or st.preprocessor._build_feature_names()
        acts = _layer_activations(st.global_model, x)
        profile = st.profile_managers[txn["bank_id"]].get_profile(txn["user_id"])
        weights = predictor.drift_calculator.weights
        b = result["breakdown"]
        comp_keys = {"amount": "amount_drift", "time": "time_drift", "merchant": "merchant_drift",
                     "location": "location_drift", "tx_type": "tx_type_drift"}

        result["txn"] = txn
        result["features"] = [{"name": n, "value": round(float(v), 4)} for n, v in zip(names, x)]
        result["activations"] = [[round(float(a), 4) for a in layer] for layer in acts]
        result["drift_components"] = [
            {"key": k, "score": b[v], "weight": weights[k], "contribution": round(b[v] * weights[k], 4)}
            for k, v in comp_keys.items()
        ]
        result["profile_stats"] = self._profile_stats(profile, txn)
        result["known_user"] = txn["user_id"] in st.profile_managers[txn["bank_id"]].profiles
        return to_py(result)

    def _profile_stats(self, profile, txn=None):
        tot_m = sum(profile.merchant_counts.values()) or 1
        tot_l = sum(profile.location_counts.values()) or 1
        tot_t = sum(profile.tx_type_counts.values()) or 1
        out = {
            "amount_mean": round(profile.amount_mean, 2),
            "amount_std": round(profile.amount_std, 2),
            "amount_median": round(profile.amount_median, 2),
            "hour_mean": round(profile.hour_mean, 2),
            "hour_std": round(profile.hour_std, 2),
            "total_txns": profile.total_txns,
        }
        if txn is not None:
            out["merchant_freq"] = round(profile.merchant_counts.get(txn.get("merchant_category"), 0) / tot_m, 4)
            out["location_freq"] = round(profile.location_counts.get(txn.get("location"), 0) / tot_l, 4)
            out["tx_type_freq"] = round(profile.tx_type_counts.get(txn.get("transaction_type"), 0) / tot_t, 4)
        return out

    def amount_sweep(self, txn, user_ids, alpha=0.7, threshold=0.5, amounts=None):
        if amounts is None:
            amounts = [round(float(a), -1) for a in np.geomspace(100, 80000, 48)]
        out = {}
        for uid in user_ids:
            pts, flag_at = [], None
            for a in amounts:
                r = self.predict(dict(txn, user_id=uid, bank_id=None, amount=float(a)), alpha, threshold)
                pts.append({"amount": a, "p": r["global_fraud_probability"], "s": r["behavioral_drift_score"],
                            "final": r["final_fraud_score"]})
                if flag_at is None and r["final_fraud_score"] >= threshold:
                    flag_at = a
            out[uid] = {"points": pts, "flag_at": flag_at, "bank": self.bank_of(uid)}
        return out

    # ---------------------------------------------------------- data views

    def overview(self):
        f = self.frames()
        raw = f["raw"]
        st = self.state
        bins = [0, 250, 500, 1000, 2000, 5000, 10000, 20000, 40000, 80000]
        labels = ["<250", "250–500", "500–1k", "1k–2k", "2k–5k", "5k–10k", "10k–20k", "20k–40k", "40k+"]
        cut = pd.cut(raw["amount"], bins=bins + [np.inf], labels=labels + ["_"], right=False)
        amount_dist = []
        for lab in labels:
            m = (cut == lab).values
            amount_dist.append({"bin": lab, "legit": int((m & (raw["is_fraud"] == 0)).sum()),
                                "fraud": int((m & (raw["is_fraud"] == 1)).sum())})
        amount_dist[-1]["legit"] += int(((cut == "_") & (raw["is_fraud"] == 0)).sum())
        amount_dist[-1]["fraud"] += int(((cut == "_") & (raw["is_fraud"] == 1)).sum())

        hourly = [{"hour": h, "legit": int(((raw["hour"] == h) & (raw["is_fraud"] == 0)).sum()),
                   "fraud": int(((raw["hour"] == h) & (raw["is_fraud"] == 1)).sum())} for h in range(24)]
        merchants = [{"name": m, "legit": int(((raw["merchant_category"] == m) & (raw["is_fraud"] == 0)).sum()),
                      "fraud": int(((raw["merchant_category"] == m) & (raw["is_fraud"] == 1)).sum())}
                     for m in CATEGORICAL_VOCAB["merchant_category"]]
        banks = {}
        for b in BANKS:
            df = f[b]
            banks[b] = {
                "total_txns": int(len(df)), "unique_users": int(df["user_id"].nunique()),
                "fraud_txns": int(df["is_fraud"].sum()), "avg_amount": round(float(df["amount"].mean()), 2),
                "size_kb": round(os.path.getsize(bank_csv(self.data_dir, b)) / 1024, 1),
                "top_locations": df["location"].value_counts().head(3).index.tolist(),
            }
        sample = pd.concat([raw[raw["is_fraud"] == 0].head(9), raw[raw["is_fraud"] == 1].head(4)]).sort_values("transaction_id")

        return to_py({
            "total": int(len(raw)), "fraud": int(raw["is_fraud"].sum()), "users": int(raw["user_id"].nunique()),
            "fraud_rate": round(float(raw["is_fraud"].mean()), 4),
            "raw_size_kb": round(os.path.getsize(self.raw_csv) / 1024, 1),
            "banks": banks, "amount_dist": amount_dist, "hourly": hourly, "merchants": merchants,
            "sample": sample.to_dict("records"), "vocab": CATEGORICAL_VOCAB,
            "model": None if st is None else {
                "num_params": st.num_params, "payload_bytes": st.payload_bytes,
                "history": st.history, "round_details": st.round_details, "config": st.config,
            },
        })

    def users(self):
        out = {}
        for b in BANKS:
            df = self.frames()[b]
            g = df.groupby("user_id").agg(txns=("amount", "size"), frauds=("is_fraud", "sum"))
            # same basis as the behavioral profile: legitimate history only
            legit_avg = df[df["is_fraud"] == 0].groupby("user_id")["amount"].mean()
            rows = [{"user_id": uid, "txns": int(r.txns), "avg_amount": round(float(legit_avg.get(uid, 0.0)), 2),
                     "frauds": int(r.frauds), "label": FEATURED_USERS.get(uid)} for uid, r in g.iterrows()]
            rows.sort(key=lambda r: (r["label"] is None, r["user_id"]))
            out[b] = rows
        return out

    def profile(self, user_id):
        st = self.require_state()
        bank = self.bank_of(user_id)
        if bank is None:
            raise KeyError(user_id)
        prof = st.profile_managers[bank].get_profile(user_id)
        df_u = self.frames()[bank]
        df_u = df_u[df_u["user_id"] == user_id].sort_values("timestamp")
        return to_py({
            "user_id": user_id, "bank_id": bank, "label": FEATURED_USERS.get(user_id),
            "summary": prof.to_dict(),
            "stats": self._profile_stats(prof),
            "amount_history": [round(float(a), 2) for a in prof.amount_history],
            "hour_history": [int(h) for h in prof.hour_history],
            "merchant_counts": dict(prof.merchant_counts.most_common()),
            "location_counts": dict(prof.location_counts.most_common()),
            "tx_type_counts": dict(prof.tx_type_counts.most_common()),
            "device_counts": dict(prof.device_counts.most_common()),
            "transactions": df_u.tail(40).iloc[::-1].to_dict("records"),
        })

    def status_info(self):
        st = self.state
        return to_py({
            "status": self.status,
            "detail": self.status_detail,
            "busy": self.run_lock.locked(),
            "project_root": PROJECT_ROOT,
            "model": None if st is None else {
                "config": st.config, "history": st.history, "num_params": st.num_params,
                "payload_bytes": st.payload_bytes, "trained_at": st.trained_at,
                "final_accuracy": st.history["round_accuracies"][-1] if st.history["round_accuracies"] else None,
            },
        })

    def bootstrap(self):
        """Warm start on server boot so every screen works before anyone presses a button."""
        try:
            self.status = "warming"
            self.status_detail = "Generating data and training the federated global model"
            self.run_pipeline(pace=0.0)
            self.status_detail = ""
        except Exception as exc:  # surfaced through /api/status
            self.status = "error"
            self.status_detail = f"{type(exc).__name__}: {exc}"
            raise


engine = Engine()
