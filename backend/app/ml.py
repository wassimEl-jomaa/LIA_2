import os
import joblib
from pathlib import Path
from typing import Tuple, Dict, Any

MODELS_DIR = Path("models")

def _load_latest(prefix: str) -> Any:
    # loads models/<prefix>_latest.joblib
    p = MODELS_DIR / f"{prefix}_latest.joblib"
    if not p.exists():
        raise FileNotFoundError(f"Missing model file: {p}. Run train_model.py first.")
    return joblib.load(p)

def load_bundle():
    clf = _load_latest("category_classifier")
    vectorizer = _load_latest("vectorizer")
    le = _load_latest("label_encoder")
    return clf, vectorizer, le

def predict_category(text: str) -> Tuple[str, float, Dict[str, float]]:
    clf, vectorizer, le = load_bundle()
    X = vectorizer.transform([text])
    probs = clf.predict_proba(X)[0]
    classes = le.classes_

    best_idx = int(probs.argmax())
    pred = str(classes[best_idx])
    conf = float(probs[best_idx])

    all_probs = {str(classes[i]): float(probs[i]) for i in range(len(classes))}
    return pred, conf, all_probs
