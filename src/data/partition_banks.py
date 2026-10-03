import os
import pandas as pd

def partition_data_by_bank(raw_csv_path, base_data_dir):
    """
    Partitions the global raw dataset into 3 strictly isolated local bank datasets.
    Each bank receives ONLY its own customer transactions.
    """
    if not os.path.exists(raw_csv_path):
        raise FileNotFoundError(f"Raw file missing at: {raw_csv_path}")

    df = pd.read_csv(raw_csv_path)

    bank_folders = {
        'Bank A': os.path.join(base_data_dir, 'bank_a'),
        'Bank B': os.path.join(base_data_dir, 'bank_b'),
        'Bank C': os.path.join(base_data_dir, 'bank_c')
    }

    partition_summary = {}
    for bank_name, folder_path in bank_folders.items():
        os.makedirs(folder_path, exist_ok=True)
        bank_df = df[df['bank_id'] == bank_name].copy()

        csv_out = os.path.join(folder_path, 'transactions.csv')
        bank_df.to_csv(csv_out, index=False)
        partition_summary[bank_name] = {
            'file': csv_out,
            'total_txns': len(bank_df),
            'unique_users': bank_df['user_id'].nunique(),
            'fraud_txns': int(bank_df['is_fraud'].sum())
        }
        print(f"[OK] Partitioned {len(bank_df)} transactions for {bank_name} -> {csv_out}")

    return partition_summary

if __name__ == "__main__":
    base_dir = os.path.join(os.path.dirname(__file__), '../../data')
    raw_path = os.path.join(base_dir, 'raw/transactions_raw.csv')
    partition_data_by_bank(raw_path, base_dir)
