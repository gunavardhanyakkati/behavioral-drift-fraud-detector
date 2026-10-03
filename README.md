# Behavioral-Drift Fraud Detector — Federated Learning with Personalized Baselines

![Python Version](https://img.shields.io/badge/Python-3.11+-blue.svg)
![Framework](https://img.shields.io/badge/Framework-Flower%20%7C%20PyTorch-orange.svg)
![Domain](https://img.shields.io/badge/Domain-Federated%20Learning%20%26%20Fraud%20Detection-green.svg)

A university major project implementing a privacy-preserving financial fraud detection architecture. It combines **Federated Learning (Flower + PyTorch)** across simulated banks with a **local personalized behavioral-drift profiling layer**.

---

## 📌 Problem & Motivation

Standard financial fraud detection systems face two key challenges:
1. **Data Silos & Privacy Regulations**: Financial institutions cannot share raw transaction records due to privacy regulations (GDPR, banking confidentiality laws).
2. **Personalized Spending Variations**: A ₹10,000 electronics transaction might be routine for a high-income user but highly anomalous for a low-income student. Global models trained across millions of transactions often miss user-specific behavioral anomalies or trigger false positives.

### Solution Overview
Our system solves both problems by coupling **Federated Learning** with **Local Personalized Behavioral Profiling**:
- **Global FL Layer**: Banks collaboratively train a shared PyTorch Neural Network using Flower without sharing raw transactions.
- **Local Behavioral Layer**: Each bank locally calculates rolling spending baselines (amount, time of day, merchant category, location) for its own customers.
- **Score Fusion Engine**: Merges global fraud probability with personal behavioral drift into a final decision score.

---

## 📐 System Architecture

```
                      Transaction
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    Global FL Model           User Behavioral Profile
     (Flower + PyTorch)         (Local to Bank Node)
             │                           │
             ▼                           ▼
   Fraud Probability (P)         Drift Score (S)
             │                           │
             └─────────────┬─────────────┘
                           ▼
                      Score Fusion
             S_final = α·P + (1-α)·S
                           │
                           ▼
                  Final Fraud Score
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         [ FRAUD ]               [ LEGITIMATE ]
```

---

## 🔒 Core Privacy Guarantee

> **Privacy Statement:**
> **Raw transaction data and user behavioral profiles remain strictly local to each simulated bank (`bank_a`, `bank_b`, `bank_c`).**
> Only neural network parameters and local model updates (NumPy arrays) are transmitted over gRPC/simulation to the Flower FL server for `FedAvg` aggregation. No central server or external entity ever receives raw customer transaction records.

---

## 📁 Project Structure

```
behavioral-drift-fraud-detector/
│
├── data/
│   ├── raw/                  # Generated synthetic transactions
│   ├── bank_a/               # Bank A isolated local dataset
│   ├── bank_b/               # Bank B isolated local dataset
│   └── bank_c/               # Bank C isolated local dataset
│
├── src/
│   ├── data/
│   │   ├── generate_dataset.py   # Transaction dataset generator
│   │   └── partition_banks.py    # Bank data partitioner
│   │
│   ├── model/
│   │   ├── preprocessing.py      # Feature scaler & categorical encoding
│   │   └── fraud_model.py        # PyTorch Neural Classifier & weights wrapper
│   │
│   ├── federated/
│   │   ├── client.py             # Flower NumPyClient for local bank nodes
│   │   ├── strategy.py           # Weighted FedAvg aggregation
│   │   └── server.py             # FL Server simulation orchestrator
│   │
│   ├── behavioral/
│   │   ├── profile.py            # Local UserProfile & Manager
│   │   └── drift.py              # Z-score & novelty drift calculator
│   │
│   ├── fusion/
│   │   └── score_fusion.py       # Weighted score fusion & explanation engine
│   │
│   └── inference/
│       └── predict.py            # End-to-end transaction prediction pipeline
│
├── experiments/
│   ├── demo.py                   # Master presentation script for faculty review
│   ├── compare_behavior.py       # Architecture comparison study
│   └── plots/                    # Saved visualization plots
│
├── requirements.txt
└── README.md
```

---

## ⚙️ Mathematical Formulations

### 1. Global Neural Classifier
$$\hat{P}_{\text{global}} = \sigma(W_3 \cdot \text{ReLU}(W_2 \cdot \text{ReLU}(W_1 X + b_1) + b_2) + b_3) \in [0, 1]$$

### 2. Federated Weight Aggregation (FedAvg)
$$W^{t+1} = \sum_{k=1}^{K} \frac{n_k}{N} W_k^{t+1}$$

### 3. Behavioral Drift Components
- **Amount Z-Score Deviation**: $z_{\text{amt}} = \frac{|\text{amount} - \mu_{\text{amt}}|}{\max(\sigma_{\text{amt}}, 50)}$
- **Normalized Amount Drift**: $S_{\text{amount}} = 1 - e^{-0.5 \cdot z_{\text{amt}}} \in [0, 1]$
- **Time Deviation**: $\Delta h = \min(|h - \mu_h|, 24 - |h - \mu_h|), \quad S_{\text{time}} = 1 - e^{-0.6 \cdot \frac{\Delta h}{\sigma_h}}$
- **Merchant & Location Novelty**: Frequency-based lookup in local user history.
- **Composite Drift Score**:
$$S_{\text{drift}} = w_{\text{amt}} S_{\text{amount}} + w_{\text{time}} S_{\text{time}} + w_{\text{merch}} S_{\text{merch}} + w_{\text{loc}} S_{\text{loc}} + w_{\text{type}} S_{\text{type}}$$

### 4. Score Fusion Equation
$$S_{\text{final}} = \alpha \cdot \hat{P}_{\text{global}} + (1 - \alpha) \cdot S_{\text{drift}} \quad (\text{default } \alpha = 0.7)$$
Decision: $\text{FRAUD}$ if $S_{\text{final}} \ge 0.50$, else $\text{LEGITIMATE}$.

---

## 🚀 How to Run

### 1. Prerequisites & Installation
```bash
cd behavioral-drift-fraud-detector
pip install -r requirements.txt
```

### 2. Run Master Demo (Recommended for Faculty Review)
```bash
python experiments/demo.py
```
This single command automatically executes:
1. Synthetic dataset creation & 3-bank partitioning.
2. 3-round Federated Learning simulation with clean round progress logs.
3. User profiling inside each bank.
4. **Phase 8 Demo**: Identical ₹10,000 transaction evaluated for User A (low spender) vs User B (high spender).
5. **Phase 9 Demo**: Suspicious 2 AM transaction evaluation with natural explanation.
6. Plot generation (`fl_training_metrics.png` and `user_a_vs_user_b_drift.png`).

### 3. Run Architectural Comparison
```bash
python experiments/compare_behavior.py
```

---

## 📊 Sample Faculty Demo Console Output

```
============================================================
BEHAVIORAL-DRIFT FRAUD DETECTOR — FACULTY REVIEW SUMMARY
============================================================
Federated Training Summary:
  Round 1: Bank A ✓  Bank B ✓  Bank C ✓  | FedAvg Loss: 0.3421, Accuracy: 95.20%
  Round 2: Bank A ✓  Bank B ✓  Bank C ✓  | FedAvg Loss: 0.2814, Accuracy: 96.40%
  Round 3: Bank A ✓  Bank B ✓  Bank C ✓  | FedAvg Loss: 0.2310, Accuracy: 97.10%
Global model federated training complete.

USER BEHAVIORAL PROFILE DEMO:
User ID        : U001 (Bank A)
Average Amount : ₹550.00
Amount Std     : ₹120.00
Common Merchant: Grocery, Fuel, Dining
Typical Hours  : 08:00–21:00
Common Location: Hyderabad

TEST TRANSACTION RESULT:
Amount: ₹15,000 | Merchant: Luxury_Goods | Location: Overseas_Unknown | Time: 02:00 AM
Global Fraud Probability: 0.5842
Behavioral Drift Score  : 0.9410
Final Fraud Score       : 0.6912
Decision                : FRAUD
Explanation: Transaction flagged as FRAUD because: amount (₹15,000.00) deviates significantly from historical average (₹550.00); transaction occurred at 02:00, outside normal window (08:00–21:00); merchant category 'Luxury_Goods' is uncommon for this user; location 'Overseas_Unknown' is novel compared to typical location (Hyderabad).
============================================================
```

---

## 🔮 Limitations & Future Work

1. **Synthetic Data**: Current prototype uses synthetic PaySim-inspired distributions. Future versions can be benchmarked on Kaggle Credit Card Fraud datasets or real bank data logs.
2. **Dynamic Fusion Optimization**: Alpha parameter is currently fixed at 0.7. Grid search or Bayesian optimization on validation sets can dynamically tune $\alpha$.
3. **Sequential Profiling**: Local profiles use rolling statistical moments (mean/std/frequencies). LSTMs or Autoencoders could be added locally to capture temporal sequence dependencies.
4. **Secure Aggregation**: Production FL deployments can incorporate cryptographic Secure Aggregation (SecAgg) or Differential Privacy (DP) noise.
