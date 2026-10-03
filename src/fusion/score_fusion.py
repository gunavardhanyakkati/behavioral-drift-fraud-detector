class ScoreFusionEngine:
    """
    Combines Global Federated Fraud Probability and Local Behavioral Drift Score
    using a configurable weighted linear fusion schema:

      final_score = alpha * P(global_fraud) + (1 - alpha) * S(drift)

    Note: This is a prototype weighted fusion layer. The weighting parameter (alpha)
    and decision threshold can be further optimized on validation datasets.
    """
    def __init__(self, alpha=0.7, threshold=0.50):
        self.alpha = alpha
        self.threshold = threshold

    def fuse(self, global_prob: float, drift_metrics: dict, txn: dict, profile_dict: dict) -> dict:
        drift_score = drift_metrics['behavioral_drift_score']

        final_score = self.alpha * global_prob + (1.0 - self.alpha) * drift_score
        final_score = float(round(final_score, 4))
        decision = "FRAUD" if final_score >= self.threshold else "LEGITIMATE"

        explanation = self._generate_explanation(global_prob, drift_metrics, final_score, decision, txn, profile_dict)

        return {
            'global_fraud_probability': float(round(global_prob, 4)),
            'behavioral_drift_score': float(round(drift_score, 4)),
            'final_fraud_score': final_score,
            'decision': decision,
            'alpha': self.alpha,
            'threshold': self.threshold,
            'explanation': explanation,
            'breakdown': drift_metrics
        }

    def _generate_explanation(self, global_prob, drift, final_score, decision, txn, profile):
        if decision == "FRAUD":
            reasons = []
            if drift['amount_drift'] > 0.6:
                reasons.append(f"amount (RS {txn['amount']:,.2f}) deviates significantly from historical average ({profile.get('average_amount', 'N/A')})")
            if drift['time_drift'] > 0.6:
                reasons.append(f"transaction occurred at {txn.get('hour', 0):02d}:00, outside normal window ({profile.get('typical_hours', 'N/A')})")
            if drift['merchant_drift'] > 0.6:
                reasons.append(f"merchant category '{txn.get('merchant_category')}' is uncommon for this user")
            if drift['location_drift'] > 0.6:
                reasons.append(f"location '{txn.get('location')}' is novel compared to typical location ({profile.get('common_locations', 'N/A')})")

            if reasons:
                exp = "Transaction flagged as FRAUD because: " + "; ".join(reasons) + "."
            else:
                exp = "Transaction flagged as FRAUD due to elevated global risk and behavioral drift."
        else:
            exp = "Transaction evaluated as LEGITIMATE. Transaction parameters closely align with user historical profile and global baseline."

        return exp
