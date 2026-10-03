import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

CATEGORICAL_VOCAB = {
    'merchant_category': ['Grocery', 'Fuel', 'Dining', 'Online_Retail', 'Electronics', 'Travel', 'Jewelry', 'Luxury_Goods'],
    'location': ['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Overseas_Unknown'],
    'transaction_type': ['POS', 'Online', 'ATM_Withdrawal', 'Transfer'],
    'device_type': ['Mobile_App', 'Web_Browser', 'POS_Terminal', 'ATM']
}

class TransactionPreprocessor:
    def __init__ (self):
        self.scaler = StandardScaler()
        self.fitted = False
        self.feature_names = []

    def _build_feature_names(self):
        names = ['amount_log', 'hour_norm', 'day_of_week_norm']
        for col, values in CATEGORICAL_VOCAB.items():
            for val in values:
                names.append(f"{col}_{val}")
        return names

    def fit(self, df: pd.DataFrame):
        num_feats = self._extract_numerical(df)
        self.scaler.fit(num_feats)
        self.feature_names = self._build_feature_names()
        self.fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        num_feats = self._extract_numerical(df)
        if self.fitted:
            num_scaled = self.scaler.transform(num_feats)
        else:
            num_scaled = self.scaler.fit_transform(num_feats)
            self.fitted = True

        cat_feats = self._extract_categorical_onehot(df)
        X = np.hstack([num_scaled, cat_feats]).astype(np.float32)
        return X

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        self.fit(df)
        return self.transform(df)

    def transform_single(self, txn_dict: dict) -> np.ndarray:
        df = pd.DataFrame([txn_dict])
        return self.transform(df)

    def _extract_numerical(self, df: pd.DataFrame) -> np.ndarray:
        amounts = np.log1p(df['amount'].values.reshape(-1, 1))
        hours = (df['hour'].values.reshape(-1, 1)) / 23.0
        days = (df['day_of_week'].values.reshape(-1, 1)) / 6.0
        return np.hstack([amounts, hours, days])

    def _extract_categorical_onehot(self, df: pd.DataFrame) -> np.ndarray:
        onehots = []
        for col, vocab in CATEGORICAL_VOCAB.items():
            col_vals = df[col].astype(str).values if col in df.columns else np.array([''] * len(df))
            for v in vocab:
                onehots.append((col_vals == v).astype(np.float32).reshape(-1, 1))
        return np.hstack(onehots)

    @property
    def num_features(self) -> int:
        # 3 numerical + total categorical options
        tot_cat = sum(len(v) for v in CATEGORICAL_VOCAB.values())
        return 3 + tot_cat
