import numpy as np
from src.behavioral.profile import UserProfile

class BehavioralDriftCalculator:
    """
    Computes component-wise normalized deviations and aggregates them into
    a single Behavioral Drift Score in [0, 1].
    """
    def __init__(self, weights=None):
        if weights is None:
            self.weights = {
                'amount': 0.40,
                'time': 0.20,
                'merchant': 0.20,
                'location': 0.10,
                'tx_type': 0.10
            }
        else:
            self.weights = weights

    def compute_drift(self, txn: dict, profile: UserProfile) -> dict:
        """
        Calculates individual deviations and total drift score.
        """
        amount = float(txn['amount'])
        hour = int(txn.get('hour', 12))
        merchant = str(txn.get('merchant_category', ''))
        location = str(txn.get('location', ''))
        tx_type = str(txn.get('transaction_type', ''))

        # 1. Amount Deviation (Normalized Z-score mapping to [0, 1])
        std_safe = max(profile.amount_std, 50.0)
        z_amt = abs(amount - profile.amount_mean) / std_safe
        # Soft saturation curve for z-score mapping
        amount_drift = min(1.0, float(1.0 - np.exp(-0.5 * z_amt)))

        # 2. Time-of-day Deviation
        # Angular difference in 24-hour clock
        hour_diff = min(abs(hour - profile.hour_mean), 24.0 - abs(hour - profile.hour_mean))
        hour_std_safe = max(profile.hour_std, 1.5)
        z_time = hour_diff / hour_std_safe
        time_drift = min(1.0, float(1.0 - np.exp(-0.6 * z_time)))

        # 3. Merchant Novelty Score
        tot_merchants = sum(profile.merchant_counts.values())
        if tot_merchants == 0:
            merchant_drift = 0.5
        else:
            m_freq = profile.merchant_counts.get(merchant, 0) / tot_merchants
            if m_freq >= 0.15:
                merchant_drift = 0.0 # Common merchant
            elif m_freq > 0:
                merchant_drift = 0.4 # Less common
            else:
                merchant_drift = 1.0 # Completely novel merchant for user

        # 4. Location Novelty Score
        tot_locations = sum(profile.location_counts.values())
        if tot_locations == 0:
            location_drift = 0.5
        else:
            loc_freq = profile.location_counts.get(location, 0) / tot_locations
            if loc_freq >= 0.20:
                location_drift = 0.0 # Frequent home location
            elif loc_freq > 0:
                location_drift = 0.5
            else:
                location_drift = 0.95 # Novel location

        # 5. Transaction Type Novelty Score
        tot_types = sum(profile.tx_type_counts.values())
        if tot_types == 0:
            tx_type_drift = 0.0
        else:
            t_freq = profile.tx_type_counts.get(tx_type, 0) / tot_types
            tx_type_drift = 0.0 if t_freq >= 0.20 else (0.5 if t_freq > 0 else 0.8)

        # Weighted composite score
        total_drift = (
            self.weights['amount'] * amount_drift +
            self.weights['time'] * time_drift +
            self.weights['merchant'] * merchant_drift +
            self.weights['location'] * location_drift +
            self.weights['tx_type'] * tx_type_drift
        )
        total_drift = float(np.clip(total_drift, 0.0, 1.0))

        return {
            'behavioral_drift_score': round(total_drift, 4),
            'amount_drift': round(amount_drift, 4),
            'time_drift': round(time_drift, 4),
            'merchant_drift': round(merchant_drift, 4),
            'location_drift': round(location_drift, 4),
            'tx_type_drift': round(tx_type_drift, 4),
            'z_amount': round(z_amt, 2)
        }
