from src.behavioral.drift import BehavioralDriftCalculator
from src.fusion.score_fusion import ScoreFusionEngine

class BehavioralDriftPredictor:
    """
    End-to-End Inference Pipeline:
    1. Global FL Model -> Predicts P(global_fraud)
    2. Local Bank Profile -> Calculates Behavioral Drift Score S(drift)
    3. Score Fusion -> Computes Final Fraud Score & Decision
    """
    def __init__(self, global_model, preprocessor, profile_managers, alpha=0.7, threshold=0.50):
        self.global_model = global_model
        self.preprocessor = preprocessor
        self.profile_managers = profile_managers # dict of bank_id -> LocalBehavioralProfileManager
        self.drift_calculator = BehavioralDriftCalculator()
        self.fusion_engine = ScoreFusionEngine(alpha=alpha, threshold=threshold)

    def predict_transaction(self, txn: dict) -> dict:
        user_id = txn['user_id']
        bank_id = txn['bank_id']

        # 1. Global Model Prediction
        X_proc = self.preprocessor.transform_single(txn)
        global_prob = float(self.global_model.predict_proba(X_proc)[0])

        # 2. Local Bank Profile Retrieval & Behavioral Drift Calculation
        profile_mgr = self.profile_managers.get(bank_id)
        if profile_mgr is None:
            raise ValueError(f"Unknown bank ID: {bank_id}")

        user_profile = profile_mgr.get_profile(user_id)
        drift_metrics = self.drift_calculator.compute_drift(txn, user_profile)

        # 3. Score Fusion
        result = self.fusion_engine.fuse(
            global_prob=global_prob,
            drift_metrics=drift_metrics,
            txn=txn,
            profile_dict=user_profile.to_dict()
        )

        result['user_profile'] = user_profile.to_dict()
        return result
