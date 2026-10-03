import pandas as pd
import numpy as np
from collections import Counter

class UserProfile:
    """
    Stores and updates user-specific historical behavioral metrics locally inside a bank.
    No profile data is shared across banks or transmitted to the FL server.
    """
    def __init__(self, user_id, bank_id):
        self.user_id = user_id
        self.bank_id = bank_id
        self.total_txns = 0

        # Amount statistics
        self.amount_mean = 0.0
        self.amount_std = 1.0
        self.amount_median = 0.0
        self.amount_history = []

        # Time statistics
        self.hour_mean = 12.0
        self.hour_std = 4.0
        self.hour_history = []

        # Categorical frequency distributions
        self.merchant_counts = Counter()
        self.location_counts = Counter()
        self.tx_type_counts = Counter()
        self.device_counts = Counter()

    def update_from_dataframe(self, df_user: pd.DataFrame):
        """Fit user profile from historical legitimate transaction records."""
        if 'is_fraud' in df_user.columns:
            df_user = df_user[df_user['is_fraud'] == 0]

        if len(df_user) == 0:
            return

        amounts = df_user['amount'].values
        hours = df_user['hour'].values

        self.total_txns = len(df_user)
        self.amount_history = list(amounts)
        self.amount_mean = float(np.mean(amounts))
        self.amount_std = float(np.std(amounts)) if len(amounts) > 1 else max(1.0, self.amount_mean * 0.2)
        self.amount_median = float(np.median(amounts))

        self.hour_history = list(hours)
        self.hour_mean = float(np.mean(hours))
        self.hour_std = float(np.std(hours)) if len(hours) > 1 else 3.0

        self.merchant_counts = Counter(df_user['merchant_category'].values)
        self.location_counts = Counter(df_user['location'].values)
        self.tx_type_counts = Counter(df_user['transaction_type'].values)
        self.device_counts = Counter(df_user['device_type'].values)

    def to_dict(self):
        """Returns readable summary of the user's local profile."""
        top_merchants = [m for m, _ in self.merchant_counts.most_common(3)]
        top_locations = [l for l, _ in self.location_counts.most_common(2)]
        return {
            "user_id": self.user_id,
            "bank_id": self.bank_id,
            "total_txns": self.total_txns,
            "average_amount": f"RS {self.amount_mean:.2f}",
            "amount_std": f"RS {self.amount_std:.2f}",
            "median_amount": f"RS {self.amount_median:.2f}",
            "typical_hours": f"{int(self.hour_mean - self.hour_std)%24:02d}:00–{int(self.hour_mean + self.hour_std)%24:02d}:00",
            "common_merchants": ", ".join(top_merchants),
            "common_locations": ", ".join(top_locations)
        }

class LocalBehavioralProfileManager:
    """
    Manages local user profiles within a single bank environment.
    """
    def __init__(self, bank_id):
        self.bank_id = bank_id
        self.profiles = {}

    def build_profiles(self, df_bank: pd.DataFrame):
        for uid, df_user in df_bank.groupby('user_id'):
            profile = UserProfile(user_id=uid, bank_id=self.bank_id)
            profile.update_from_dataframe(df_user)
            self.profiles[uid] = profile
        return self

    def get_profile(self, user_id: str) -> UserProfile:
        if user_id in self.profiles:
            return self.profiles[user_id]
        # Return generic default profile for unseen users
        default_p = UserProfile(user_id=user_id, bank_id=self.bank_id)
        default_p.amount_mean = 1000.0
        default_p.amount_std = 500.0
        return default_p
