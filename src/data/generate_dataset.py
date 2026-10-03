import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_synthetic_transactions(num_transactions=6000, seed=42):
    """
    Generates a synthetic financial dataset with persistent user IDs,
    user-specific behavioral distributions, bank assignments, and fraud flags.
    """
    np.random.seed(seed)
    random.seed(seed)

    banks = ['Bank A', 'Bank B', 'Bank C']
    merchants = ['Grocery', 'Fuel', 'Dining', 'Online_Retail', 'Electronics', 'Travel', 'Jewelry', 'Luxury_Goods']
    locations = ['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Overseas_Unknown']
    tx_types = ['POS', 'Online', 'ATM_Withdrawal', 'Transfer']
    devices = ['Mobile_App', 'Web_Browser', 'POS_Terminal', 'ATM']

    # Assign 150 persistent users across 3 banks (50 users per bank)
    user_pool = {}
    for i in range(1, 151):
        uid = f"U{i:03d}"
        if uid == 'U001': # Low spender (User A)
            assigned_bank = 'Bank A'
            mean_amt, std_amt = 550.0, 120.0
            home_loc = 'Hyderabad'
            top_merchants = ['Grocery', 'Fuel', 'Dining']
            active_hours = (8, 21)
        elif uid == 'U002': # High spender (User B)
            assigned_bank = 'Bank A'
            mean_amt, std_amt = 11500.0, 2200.0
            home_loc = 'Bengaluru'
            top_merchants = ['Electronics', 'Travel', 'Luxury_Goods']
            active_hours = (9, 23)
        else: # Random profile
            assigned_bank = banks[(i - 1) % 3]
            mean_amt = float(np.random.choice([400, 1200, 3500, 9000]))
            std_amt = mean_amt * float(np.random.uniform(0.15, 0.30))
            home_loc = str(np.random.choice(locations[:-1]))
            top_merchants = list(np.random.choice(merchants, size=3, replace=False))
            active_hours = (int(np.random.randint(6, 10)), int(np.random.randint(20, 24)))

        user_pool[uid] = {
            'bank_id': assigned_bank,
            'mean_amt': mean_amt,
            'std_amt': std_amt,
            'home_loc': home_loc,
            'top_merchants': top_merchants,
            'active_hours': active_hours
        }

    records = []
    start_time = datetime(2026, 1, 1, 0, 0, 0)
    user_ids = list(user_pool.keys())

    for idx in range(num_transactions):
        txn_id = f"TXN{idx+100001}"
        uid = random.choice(user_ids)
        uinfo = user_pool[uid]
        bank_id = uinfo['bank_id']

        # Determine if this transaction will be an injected fraud attempt (approx 5% overall)
        is_fraud = 1 if np.random.rand() < 0.05 else 0

        if is_fraud == 0:
            # Normal legitimate behavior following user profile
            amount = round(float(np.random.normal(uinfo['mean_amt'], uinfo['std_amt'])), 2)
            amount = max(50.0, amount)

            days_offset = np.random.randint(0, 90)
            hour = np.random.randint(uinfo['active_hours'][0], uinfo['active_hours'][1])
            minute = np.random.randint(0, 60)
            dt = start_time + timedelta(days=int(days_offset), hours=int(hour), minutes=int(minute))

            merchant = np.random.choice(uinfo['top_merchants']) if np.random.rand() < 0.85 else np.random.choice(merchants)
            location = uinfo['home_loc'] if np.random.rand() < 0.90 else np.random.choice(locations)
            tx_type = np.random.choice(['POS', 'Online', 'Transfer'])
            device = np.random.choice(['Mobile_App', 'Web_Browser', 'POS_Terminal'])
        else:
            # Fraudulent transactions:
            # 40% globally obvious (large amount / extreme night hour)
            # 60% subtle personalized anomalies (amounts within normal global range ₹2,000 - ₹12,000,
            #     normal hours, but 5x-10x higher than THIS specific user's baseline!)
            fraud_type = np.random.choice(['global_anomaly', 'personalized_anomaly'], p=[0.4, 0.6])

            if fraud_type == 'global_anomaly':
                amount = round(float(np.random.uniform(25000, 75000)), 2)
                hour = np.random.choice([1, 2, 3, 4])
                merchant = np.random.choice(['Jewelry', 'Luxury_Goods', 'Electronics'])
                location = np.random.choice(['Overseas_Unknown', 'Delhi', 'Kolkata'])
                tx_type = np.random.choice(['Online', 'Transfer'])
                device = np.random.choice(['Web_Browser', 'ATM'])
            else:
                # Subtle anomaly: Amount looks standard globally (e.g. ₹4,000 - ₹10,000)
                # But for a low-spending user (mean ₹550), it is a massive personal fraud!
                amount = round(uinfo['mean_amt'] * float(np.random.uniform(4.0, 8.0)), 2)
                # Normal business hours & common merchant so global model thinks it's low risk
                hour = np.random.randint(10, 18)
                merchant = np.random.choice(['Electronics', 'Online_Retail', 'Dining'])
                location = uinfo['home_loc'] if np.random.rand() < 0.70 else np.random.choice(locations[:-1])
                tx_type = np.random.choice(['POS', 'Online'])
                device = np.random.choice(['Mobile_App', 'POS_Terminal'])

            days_offset = np.random.randint(0, 90)
            minute = np.random.randint(0, 60)
            dt = start_time + timedelta(days=int(days_offset), hours=int(hour), minutes=int(minute))

        records.append({
            'transaction_id': txn_id,
            'user_id': uid,
            'bank_id': bank_id,
            'amount': amount,
            'timestamp': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'hour': dt.hour,
            'day_of_week': dt.weekday(),
            'merchant_category': merchant,
            'location': location,
            'transaction_type': tx_type,
            'device_type': device,
            'is_fraud': is_fraud
        })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    raw_dir = os.path.join(os.path.dirname(__file__), '../../data/raw')
    os.makedirs(raw_dir, exist_ok=True)
    out_path = os.path.join(raw_dir, 'transactions_raw.csv')
    df = generate_synthetic_transactions(num_transactions=6000)
    df.to_csv(out_path, index=False)
    print(f"[OK] Generated {len(df)} synthetic transactions at: {out_path}")
    print(f"    Fraud count: {df['is_fraud'].sum()} ({df['is_fraud'].mean()*100:.2f}%)")
    print(f"    Banks breakdown:\n{df['bank_id'].value_counts()}")
