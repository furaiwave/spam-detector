from __future__ import annotations

import io
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from schemas import (
    AnalyzeRequest, AnalyzeResponse,
    SpamLabel, SpamSeverity, SpamCategory, Language,
)
from spam_classifier import SpamClassifier

MODEL_PATH: Final[Path] = Path(os.getenv("MODEL_PATH", "artifacts/model"))

LABEL_TO_IDX: Final[dict[str, int]] = {
    SpamLabel.NOT_SPAM.value:     0,
    SpamLabel.SUSPICIOUS.value:   1,
    SpamLabel.NEEDS_REVIEW.value: 2,
    SpamLabel.SPAM.value:         3,
}


class SpamAnalysisService:
    def __init__(self) -> None:
        self._classifier = SpamClassifier()
        self._loaded     = False

    def load_model(self) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model artifacts not found at {MODEL_PATH}. "
                "Run: python train.py data/spam_dataset.csv"
            )
        self._classifier.load(MODEL_PATH)
        self._loaded = True
        print(f"[SpamAnalysisService] Model loaded from {MODEL_PATH}")

    def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        if not self._loaded:
            raise RuntimeError("Model not loaded")

        label, confidence, severity, reasons = self._classifier.predict(
            text=request.content,
            language=request.language.value,
        )

        return AnalyzeResponse(
            label=label,
            confidence=confidence,
            severity=severity,
            reasons=reasons,
            processed_at=datetime.now(timezone.utc),
        )

    def train_from_csv(self, csv_bytes: bytes) -> dict[str, object]:
        df, text_col, label_col = self._parse_csv(csv_bytes)
        df = df[[text_col, label_col]].rename(columns={text_col: "text", label_col: "label"})

        df["label"] = df["label"].astype(str).str.strip().str.lower().map(self._normalize_label)
        df = df.dropna(subset=["label"])

        invalid = set(df["label"].unique()) - set(LABEL_TO_IDX.keys())
        if invalid:
            raise ValueError(
                f"Unknown labels after normalization: {sorted(invalid)}. "
                f"Allowed: {sorted(LABEL_TO_IDX.keys())} (or aliases: ham, 0, 1)"
            )

        texts:  list[str] = df["text"].fillna("").astype(str).tolist()
        labels: list[int] = [LABEL_TO_IDX[lbl] for lbl in df["label"]]

        if len(texts) < 8:
            raise ValueError(f"Need at least 8 samples for train/test split, got {len(texts)}")

        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels,
            test_size=0.2,
            random_state=42,
            stratify=labels if len(set(labels)) > 1 else None,
        )

        classifier = SpamClassifier()
        classifier.fit(X_train, y_train)

        # Швидка оцінка: тільки LogReg на TF-IDF (LSTM в .fit() не тренується,
        # тому її predict — шум, окремий запуск через model.predict для 1k+ семплів
        # на CPU займав ~хвилину без додаткової інформації).
        cleaned_test = [classifier._cleaner.clean(t, Language.EN) for t in X_test]
        tfidf_test   = np.array([classifier._extractor.extract(c).tfidf_scores for c in cleaned_test])
        scaled_test  = classifier._scaler.transform(tfidf_test)
        y_pred       = classifier._logreg.predict(scaled_test).tolist()

        accuracy = float(accuracy_score(y_test, y_pred))

        MODEL_PATH.mkdir(parents=True, exist_ok=True)
        classifier.save(MODEL_PATH)

        self._classifier = classifier
        self._loaded     = True

        label_counts = {
            lbl: int((df["label"] == lbl).sum())
            for lbl in LABEL_TO_IDX.keys()
        }

        return {
            "samples":       len(texts),
            "test_accuracy": round(accuracy, 4),
            "label_counts":  label_counts,
        }

    @staticmethod
    def _parse_csv(csv_bytes: bytes) -> tuple[pd.DataFrame, str, str]:
        HEADER_WORDS = {
            "text", "label", "message", "class", "category", "target",
            "v1", "v2", "sms", "spam", "content", "body",
        }
        TEXT_ALIASES  = ("text", "message", "content", "body", "v2", "sms")
        LABEL_ALIASES = ("label", "class", "category", "target", "spam", "v1")

        df: pd.DataFrame | None = None
        last_err: Exception | None = None
        for kwargs in (
            {"sep": "\t", "engine": "c",      "encoding": "utf-8-sig", "header": None},
            {"sep": ",",  "engine": "c",      "encoding": "utf-8-sig", "header": None},
            {"sep": None, "engine": "python", "encoding": "utf-8-sig", "header": None},
            {"sep": None, "engine": "python", "encoding": "utf-8-sig", "header": None,
             "on_bad_lines": "skip", "quoting": 0},
        ):
            try:
                candidate = pd.read_csv(io.BytesIO(csv_bytes), **kwargs)  # type: ignore[arg-type]
                if candidate.shape[1] >= 2 and len(candidate) > 0:
                    df = candidate
                    break
            except Exception as e:
                last_err = e
                continue
        if df is None:
            raise ValueError(
                f"Could not parse CSV — tried tab/comma/auto-detect. Last error: {last_err}"
            )

        first_row = df.iloc[0].astype(str).str.strip().str.lower().tolist()
        if any(cell in HEADER_WORDS for cell in first_row):
            df.columns = [str(c).strip().lower() for c in first_row]
            df = df.iloc[1:].reset_index(drop=True)
            text_col  = next((c for c in TEXT_ALIASES  if c in df.columns), None)
            label_col = next((c for c in LABEL_ALIASES if c in df.columns), None)
            if text_col and label_col:
                return df, text_col, label_col

        df.columns = [f"col_{i}" for i in range(df.shape[1])]
        uniques = sorted(((df[c].nunique(dropna=True), c) for c in df.columns))
        label_col = uniques[0][1]
        text_col  = uniques[-1][1]
        if label_col == text_col:
            raise ValueError(f"Could not distinguish text vs label columns from {df.columns.tolist()}")
        return df, text_col, label_col

    @staticmethod
    def _normalize_label(raw: str) -> str | None:
        ALIAS = {
            "ham":   SpamLabel.NOT_SPAM.value,
            "0":     SpamLabel.NOT_SPAM.value,
            "false": SpamLabel.NOT_SPAM.value,
            "no":    SpamLabel.NOT_SPAM.value,
            "1":     SpamLabel.SPAM.value,
            "true":  SpamLabel.SPAM.value,
            "yes":   SpamLabel.SPAM.value,
        }
        if raw in LABEL_TO_IDX:
            return raw
        return ALIAS.get(raw)


# Module-level singleton
_service: SpamAnalysisService | None = None


def get_analysis_service() -> SpamAnalysisService:
    global _service
    if _service is None:
        _service = SpamAnalysisService()
    return _service