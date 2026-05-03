from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

# Додаємо ml-service root до path щоб імпорти працювали
sys.path.insert(0, str(Path(__file__).parent.parent))

from spam_classifier import SpamClassifier
from schemas import SpamLabel

MODEL_PATH:  Final[Path]  = Path("artifacts/model")
TEST_SIZE:   Final[float] = 0.2
RANDOM_SEED: Final[int]   = 42

LABEL_TO_IDX: Final[dict[str, int]] = {
    SpamLabel.NOT_SPAM:     0,
    SpamLabel.SUSPICIOUS:   1,
    SpamLabel.NEEDS_REVIEW: 2,
    SpamLabel.SPAM:         3,
}
IDX_TO_LABEL = {v: k for k, v in LABEL_TO_IDX.items()}


def load_dataset(csv_path: Path) -> tuple[list[str], list[int]]:
    df = pd.read_csv(csv_path, encoding="utf-8")
    if not {"text", "label"}.issubset(df.columns):
        raise ValueError(f"CSV must have 'text' and 'label' columns, got: {df.columns.tolist()}")

    invalid = set(df["label"].unique()) - set(LABEL_TO_IDX.keys())
    if invalid:
        raise ValueError(f"Unknown labels: {invalid}")

    texts:  list[str] = df["text"].fillna("").tolist()
    labels: list[int] = [LABEL_TO_IDX[lbl] for lbl in df["label"]]
    return texts, labels


def train(csv_path: Path) -> None:
    print(f"Loading dataset from {csv_path}...")
    texts, labels = load_dataset(csv_path)
    print(f"Total: {len(texts)} samples")
    for lbl, idx in LABEL_TO_IDX.items():
        count = labels.count(idx)
        print(f"  {lbl}: {count} ({count / len(labels) * 100:.1f}%)")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=labels,
    )

    print("\nTraining ensemble classifier...")
    clf = SpamClassifier()
    clf.fit(X_train, y_train)

    print("\nEvaluating on test set...")
    y_pred = []
    for text in X_test:
        label, _, _, _ = clf.predict(text, "en")
        y_pred.append(LABEL_TO_IDX[label.value])

    report = classification_report(
        y_test, y_pred,
        target_names=list(LABEL_TO_IDX.keys()),
        digits=4,
    )
    print(report)
    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(cm)

    print(f"\nSaving model to {MODEL_PATH}...")
    clf.save(MODEL_PATH)
    (MODEL_PATH / "metrics.json").write_text(
        json.dumps({"test_samples": len(X_test), "report": report}, indent=2)
    )
    print("Done!")


if __name__ == "__main__":
    csv = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/spam_dataset.csv")
    train(csv)