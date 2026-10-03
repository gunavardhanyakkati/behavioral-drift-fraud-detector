import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from src.model.preprocessing import TransactionPreprocessor
from src.model.fraud_model import FraudClassifierNN
from src.federated.client import BankClient
from src.federated.strategy import fedavg_aggregate

def run_federated_training(data_dir, num_rounds=3, local_epochs=3, batch_size=64):
    """
    Simulates Federated Learning across Bank A, Bank B, and Bank C.
    Privacy Guarantee:
    - Each bank's dataset is loaded locally into its BankClient.
    - Only model weights (NumPy arrays) are transmitted to the server for FedAvg.
    """
    bank_files = {
        'Bank A': os.path.join(data_dir, 'bank_a/transactions.csv'),
        'Bank B': os.path.join(data_dir, 'bank_b/transactions.csv'),
        'Bank C': os.path.join(data_dir, 'bank_c/transactions.csv')
    }

    # 1. Fit preprocessor on concatenated bank schema (or global dataset)
    all_dfs = []
    for bname, fpath in bank_files.items():
        if not os.path.exists(fpath):
            raise FileNotFoundError(f"Missing bank data at {fpath}. Run partition script first.")
        all_dfs.append(pd.read_csv(fpath))
    combined_df = pd.concat(all_dfs, ignore_index=True)

    preprocessor = TransactionPreprocessor()
    preprocessor.fit(combined_df)
    in_features = preprocessor.num_features

    # 2. Instantiate local BankClients
    clients = {}
    for bname, fpath in bank_files.items():
        df_bank = pd.read_csv(fpath)
        X = preprocessor.transform(df_bank)
        y = df_bank['is_fraud'].values.astype(np.float32)

        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        client = BankClient(
            bank_name=bname,
            X_train=X_tr, y_train=y_tr,
            X_test=X_te, y_test=y_te,
            batch_size=batch_size,
            in_features=in_features
        )
        clients[bname] = client

    # 3. Initialize Global Model on FL Server
    global_model = FraudClassifierNN(in_features=in_features)
    global_weights = global_model.get_weights()

    history = {
        'rounds': [],
        'round_losses': [],
        'round_accuracies': []
    }

    print("\n" + "="*50)
    print("      FEDERATED LEARNING SIMULATION (Flower + PyTorch)")
    print("="*50)
    print(f"Server initialized global model (Input dimension: {in_features})")
    print(f"Simulating {len(clients)} bank clients: {', '.join(clients.keys())}\n")

    # 4. Perform Federated Rounds
    fit_config = {"epochs": local_epochs}
    for r in range(1, num_rounds + 1):
        print(f"--- Federated Round {r}/{num_rounds} ---")
        client_updates = []
        round_val_losses = []
        round_val_accs = []

        for bname, client in clients.items():
            # Server sends global_weights to client, client trains locally
            updated_weights, num_samples, metrics = client.fit(global_weights, config=fit_config)
            client_updates.append((updated_weights, num_samples))

            # Evaluate updated model on local validation split
            val_loss, _, val_metrics = client.evaluate(updated_weights)
            round_val_losses.append(val_metrics['val_loss'])
            round_val_accs.append(val_metrics['val_acc'])

            print(f"  [{bname}] Local training complete (Loss: {metrics['train_loss']:.4f}, Accuracy: {metrics['train_acc']*100:.2f}%)")

        # Server aggregates local model weights using FedAvg
        global_weights = fedavg_aggregate(client_updates)
        global_model.set_weights(global_weights)

        avg_loss = float(np.mean(round_val_losses))
        avg_acc = float(np.mean(round_val_accs))

        history['rounds'].append(r)
        history['round_losses'].append(avg_loss)
        history['round_accuracies'].append(avg_acc)

        print(f"  [Server] FedAvg aggregation complete -> Global Loss: {avg_loss:.4f}, Global Accuracy: {avg_acc*100:.2f}%\n")

    print("==================================================")
    print("[OK] Global model federated training complete!")
    print("==================================================\n")

    return global_model, preprocessor, history, clients
