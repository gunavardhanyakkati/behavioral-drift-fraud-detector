import flwr as fl
import torch
import numpy as np
from torch.utils.data import TensorDataset, DataLoader
from src.model.fraud_model import FraudClassifierNN, train_one_epoch, evaluate_model

class BankClient(fl.client.NumPyClient):
    """
    Flower NumPyClient representing an isolated bank node.
    Performs local model training and validation on the bank's local dataset.
    Raw transaction records never leave this client.
    """
    def __init__(self, bank_name, X_train, y_train, X_test, y_test, batch_size=64, in_features=28):
        self.bank_name = bank_name
        self.in_features = in_features

        # PyTorch DataLoaders
        train_ds = TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.float32))
        test_ds = TensorDataset(torch.tensor(X_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.float32))

        self.train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
        self.test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

        self.train_size = len(train_ds)
        self.test_size = len(test_ds)

        # Local model instance
        self.model = FraudClassifierNN(in_features=in_features)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=0.003, weight_decay=1e-4)
        self.criterion = torch.nn.BCELoss()

    def get_parameters(self, config=None):
        return self.model.get_weights()

    def fit(self, parameters, config=None):
        # Update local model weights with global weights from server
        self.model.set_weights(parameters)

        epochs = config.get("epochs", 3) if config else 3
        for _ in range(epochs):
            train_one_epoch(self.model, self.train_loader, self.optimizer, self.criterion)

        # Evaluate on local training data after training
        loss, acc, _, _ = evaluate_model(self.model, self.train_loader, self.criterion)

        updated_weights = self.model.get_weights()
        metrics = {
            "bank_name": self.bank_name,
            "train_loss": float(loss),
            "train_acc": float(acc)
        }
        return updated_weights, self.train_size, metrics

    def evaluate(self, parameters, config=None):
        self.model.set_weights(parameters)
        loss, acc, _, _ = evaluate_model(self.model, self.test_loader, self.criterion)
        metrics = {
            "bank_name": self.bank_name,
            "val_loss": float(loss),
            "val_acc": float(acc)
        }
        return float(loss), self.test_size, metrics
