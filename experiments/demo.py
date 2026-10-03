import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.generate_dataset import generate_synthetic_transactions
from src.data.partition_banks import partition_data_by_bank
from src.federated.server import run_federated_training
from src.behavioral.profile import LocalBehavioralProfileManager
from src.inference.predict import BehavioralDriftPredictor

def plot_experiment_results(history, res_user_a, res_user_b, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    # Plot 1: Federated Training Metrics
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5))

    rounds = history['rounds']
    ax1.plot(rounds, history['round_losses'], marker='o', color='#d62728', linewidth=2)
    ax1.set_title('Federated Global Model Loss by Round', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Federated Round')
    ax1.set_ylabel('Loss (BCE)')
    ax1.grid(True, linestyle='--', alpha=0.6)

    ax2.plot(rounds, [a * 100 for a in history['round_accuracies']], marker='s', color='#1f77b4', linewidth=2)
    ax2.set_title('Federated Global Accuracy by Round (%)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Federated Round')
    ax2.set_ylabel('Accuracy (%)')
    ax2.grid(True, linestyle='--', alpha=0.6)

    plt.tight_layout()
    plot1_path = os.path.join(out_dir, 'fl_training_metrics.png')
    plt.savefig(plot1_path, dpi=300)
    plt.close()

    # Plot 2: User A vs User B Comparison
    fig, ax = plt.subplots(figsize=(8, 5))
    categories = ['Global Prob', 'Behavioral Drift', 'Final Fraud Score']
    vals_a = [res_user_a['global_fraud_probability'], res_user_a['behavioral_drift_score'], res_user_a['final_fraud_score']]
    vals_b = [res_user_b['global_fraud_probability'], res_user_b['behavioral_drift_score'], res_user_b['final_fraud_score']]

    x = np.arange(len(categories))
    width = 0.35

    ax.bar(x - width/2, vals_a, width, label='User A (Normal: ₹300–₹800)', color='#e74c3c')
    ax.bar(x + width/2, vals_b, width, label='User B (Normal: ₹8k–₹15k)', color='#2ecc71')

    ax.set_ylabel('Score / Probability')
    ax.set_title('Identical ₹10,000 Transaction Evaluation: User A vs User B', fontsize=12, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontweight='bold')
    ax.axhline(0.50, color='black', linestyle=':', label='Threshold (0.50)')
    ax.set_ylim(0, 1.05)
    ax.legend()
    ax.grid(axis='y', linestyle='--', alpha=0.5)

    for i in range(len(categories)):
        ax.text(x[i] - width/2, vals_a[i] + 0.02, f"{vals_a[i]:.2f}", ha='center', fontsize=9, fontweight='bold')
        ax.text(x[i] + width/2, vals_b[i] + 0.02, f"{vals_b[i]:.2f}", ha='center', fontsize=9, fontweight='bold')

    plt.tight_layout()
    plot2_path = os.path.join(out_dir, 'user_a_vs_user_b_drift.png')
    plt.savefig(plot2_path, dpi=300)
    plt.close()

    print(f"[OK] Visualizations saved to:\n    - {plot1_path}\n    - {plot2_path}\n")

def run_master_demo():
    print("\n" + "="*60)
    print("  BEHAVIORAL-DRIFT FRAUD DETECTOR — MASTER EXPERIMENT DEMO")
    print("="*60 + "\n")

    base_data_dir = os.path.join(PROJECT_ROOT, 'data')
    raw_csv = os.path.join(base_data_dir, 'raw/transactions_raw.csv')

    # STEP 1: Dataset Creation & Partitioning
    print("[1/5] Generating synthetic dataset and partitioning across 3 banks...")
    os.makedirs(os.path.dirname(raw_csv), exist_ok=True)
    df_raw = generate_synthetic_transactions(num_transactions=6000, seed=42)
    df_raw.to_csv(raw_csv, index=False)
    partition_summary = partition_data_by_bank(raw_csv, base_data_dir)

    # STEP 2: Federated Learning Training Simulation
    print("\n[2/5] Initiating Federated Learning (Flower + PyTorch)...")
    global_model, preprocessor, history, clients = run_federated_training(
        data_dir=base_data_dir,
        num_rounds=3,
        local_epochs=3,
        batch_size=64
    )

    # STEP 3: Build Local Bank Behavioral Profiles
    print("[3/5] Building local user behavioral profiles inside each bank...")
    profile_managers = {}
    for bank_name in ['Bank A', 'Bank B', 'Bank C']:
        folder = os.path.join(base_data_dir, bank_name.lower().replace(' ', '_'))
        csv_p = os.path.join(folder, 'transactions.csv')
        df_b = pd.read_csv(csv_p)

        mgr = LocalBehavioralProfileManager(bank_id=bank_name)
        mgr.build_profiles(df_b)
        profile_managers[bank_name] = mgr
        print(f"  [OK] {bank_name}: Built {len(mgr.profiles)} local user profiles.")

    # Instantiate Predictor
    predictor = BehavioralDriftPredictor(
        global_model=global_model,
        preprocessor=preprocessor,
        profile_managers=profile_managers,
        alpha=0.7,
        threshold=0.50
    )

    # STEP 4: PHASE 8 DEMO — User A vs User B identical transaction evaluation
    print("\n" + "="*60)
    print("  PHASE 8 DEMO: PERSONALIZED BEHAVIORAL DRIFT EVALUATION")
    print("="*60)

    # Identical transaction details
    txn_identical = {
        'transaction_id': 'TXN_TEST_1000',
        'bank_id': 'Bank A',
        'amount': 10000.0, # ₹10,000
        'hour': 14,
        'day_of_week': 2,
        'merchant_category': 'Electronics',
        'location': 'Hyderabad',
        'transaction_type': 'POS',
        'device_type': 'POS_Terminal'
    }

    # Evaluate for User A (U001: Low spender ₹300–₹800)
    txn_user_a = dict(txn_identical, user_id='U001')
    res_a = predictor.predict_transaction(txn_user_a)

    # Evaluate for User B (U002: High spender ₹8,000–₹15,000)
    txn_user_b = dict(txn_identical, user_id='U002')
    res_b = predictor.predict_transaction(txn_user_b)

    print("\nIDENTICAL TRANSACTION UNDER EVALUATION:")
    print(f"  Amount: RS 10,000.00 | Merchant: Electronics | Location: Hyderabad | Hour: 14:00")
    print("-" * 60)

    print("\nUSER A EVALUATION (Low Spender Profile):")
    prof_a = res_a['user_profile']
    print(f"  Profile History  : Avg Amount = {prof_a['average_amount']}, Std = {prof_a['amount_std']}, Common = {prof_a['common_merchants']}")
    print(f"  Global Fraud Prob: {res_a['global_fraud_probability']:.4f}")
    print(f"  Behavioral Drift : {res_a['behavioral_drift_score']:.4f} (Amount Drift: {res_a['breakdown']['amount_drift']:.2f}, Z-score: {res_a['breakdown']['z_amount']})")
    print(f"  Final Fraud Score: {res_a['final_fraud_score']:.4f}")
    print(f"  Decision         : {res_a['decision']}")
    print(f"  Explanation      : {res_a['explanation']}")

    print("\nUSER B EVALUATION (High Spender Profile):")
    prof_b = res_b['user_profile']
    print(f"  Profile History  : Avg Amount = {prof_b['average_amount']}, Std = {prof_b['amount_std']}, Common = {prof_b['common_merchants']}")
    print(f"  Global Fraud Prob: {res_b['global_fraud_probability']:.4f}")
    print(f"  Behavioral Drift : {res_b['behavioral_drift_score']:.4f} (Amount Drift: {res_b['breakdown']['amount_drift']:.2f}, Z-score: {res_b['breakdown']['z_amount']})")
    print(f"  Final Fraud Score: {res_b['final_fraud_score']:.4f}")
    print(f"  Decision         : {res_b['decision']}")
    print(f"  Explanation      : {res_b['explanation']}")

    # STEP 5: PHASE 9 DEMO — Highly Suspicious & Unusual Transaction
    print("\n" + "="*60)
    print("  PHASE 9 DEMO: GLOBALLY SUSPICIOUS & PERSONALLY UNUSUAL TXN")
    print("="*60)

    txn_anomalous = {
        'transaction_id': 'TXN_TEST_2000',
        'user_id': 'U001',
        'bank_id': 'Bank A',
        'amount': 15000.0,
        'hour': 2, # 2 AM
        'day_of_week': 4,
        'merchant_category': 'Luxury_Goods',
        'location': 'Overseas_Unknown',
        'transaction_type': 'Online',
        'device_type': 'Web_Browser'
    }

    res_anom = predictor.predict_transaction(txn_anomalous)

    print("\nSUSPICIOUS TRANSACTION DETAILS:")
    print("  Amount: RS 15,000.00 | Time: 02:00 AM | Merchant: Luxury_Goods | Location: Overseas_Unknown")
    print("-" * 60)
    print(f"  Global Fraud Probability : {res_anom['global_fraud_probability']:.4f}")
    print(f"  Behavioral Drift Score   : {res_anom['behavioral_drift_score']:.4f}")
    print(f"  Final Fraud Score        : {res_anom['final_fraud_score']:.4f}")
    print(f"  Decision                 : {res_anom['decision']}")
    print(f"  Explanation              :\n  \"{res_anom['explanation']}\"\n")

    # STEP 6: Plot generation
    out_plots = os.path.join(PROJECT_ROOT, 'experiments/plots')
    plot_experiment_results(history, res_a, res_b, out_plots)

    # FINAL FACULTY CONSOLE SUMMARY
    print("="*60)
    print("BEHAVIORAL-DRIFT FRAUD DETECTOR -- FACULTY REVIEW SUMMARY")
    print("="*60)
    print("Federated Training Summary:")
    for r, l, a in zip(history['rounds'], history['round_losses'], history['round_accuracies']):
        print(f"  Round {r}: Bank A [OK] Bank B [OK] Bank C [OK] | FedAvg Loss: {l:.4f}, Accuracy: {a*100:.2f}%")
    print("Global model federated training complete.\n")

    print(f"USER BEHAVIORAL PROFILE DEMO:")
    print(f"User ID        : U001 (Bank A)")
    print(f"Average Amount : {prof_a['average_amount']}")
    print(f"Amount Std     : {prof_a['amount_std']}")
    print(f"Common Merchant: {prof_a['common_merchants']}")
    print(f"Typical Hours  : {prof_a['typical_hours']}")
    print(f"Common Location: {prof_a['common_locations']}\n")

    print("TEST TRANSACTION RESULT:")
    print("Amount: RS 15,000 | Merchant: Luxury_Goods | Location: Overseas_Unknown | Time: 02:00 AM")
    print(f"Global Fraud Probability: {res_anom['global_fraud_probability']:.4f}")
    print(f"Behavioral Drift Score  : {res_anom['behavioral_drift_score']:.4f}")
    print(f"Final Fraud Score       : {res_anom['final_fraud_score']:.4f}")
    print(f"Decision                : {res_anom['decision']}")
    print(f"Explanation: {res_anom['explanation']}")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_master_demo()
