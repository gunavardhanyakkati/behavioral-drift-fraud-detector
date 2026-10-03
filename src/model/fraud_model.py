import torch
import torch.nn as nn
import numpy as np

class FraudClassifierNN(nn.Module):
    def __init__(self, in_features=28):
        super(FraudClassifierNN, self).__init__()
        self.in_features = in_features
        self.net = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x)

    def predict_proba(self, X_np: np.ndarray) -> np.ndarray:
        self.eval()
        with torch.no_grad():
            tensor_x = torch.tensor(X_np, dtype=torch.float32)
            if tensor_x.ndim == 1:
                tensor_x = tensor_x.unsqueeze(0)
            probs = self.forward(tensor_x).cpu().numpy().flatten()
        return probs

    def get_weights(self):
        """Extract model parameters as a list of NumPy ndarrays (for Flower FL)."""
        return [val.cpu().numpy() for val in self.state_dict().values()]

    def set_weights(self, weights):
        """Set model parameters from a list of NumPy ndarrays."""
        state_dict = self.state_dict()
        for k, w in zip(state_dict.keys(), weights):
            state_dict[k] = torch.tensor(w)
        self.load_state_dict(state_dict)

def train_one_epoch(model, dataloader, optimizer, criterion, device="cpu"):
    model.train()
    running_loss = 0.0
    for X_batch, y_batch in dataloader:
        X_batch, y_batch = X_batch.to(device), y_batch.to(device)
        optimizer.zero_grad()
        preds = model(X_batch).squeeze(-1)
        loss = criterion(preds, y_batch)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * len(y_batch)
    return running_loss / len(dataloader.dataset)

def evaluate_model(model, dataloader, criterion, device="cpu"):
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for X_batch, y_batch in dataloader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            preds = model(X_batch).squeeze(-1)
            loss = criterion(preds, y_batch)
            running_loss += loss.item() * len(y_batch)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(y_batch.cpu().numpy())

    total_loss = running_loss / len(dataloader.dataset)
    binary_preds = [1 if p >= 0.5 else 0 for p in all_preds]
    correct = sum(p == t for p, t in zip(binary_preds, all_targets))
    accuracy = correct / len(all_targets) if len(all_targets) > 0 else 0.0

    return total_loss, accuracy, np.array(all_preds), np.array(all_targets)
