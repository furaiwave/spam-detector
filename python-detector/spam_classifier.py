from __future__ import annotations

from pathlib import Path
from typing import Final

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from schemas import SpamCategory, SpamLabel, SpamSeverity, RawFeatures
from lstm_model import SpamLSTM
from feature_extractor import FeatureExtractor, TextCleaner

LSTM_WEIGHT:  Final[float] = 0.65
TFIDF_WEIGHT: Final[float] = 0.35

SPAM_THRESHOLD:       Final[float] = 0.75
SUSPICIOUS_THRESHOLD: Final[float] = 0.45
REVIEW_THRESHOLD:     Final[float] = 0.30

CRITICAL_THRESHOLD: Final[float] = 0.92
HIGH_THRESHOLD:     Final[float] = 0.80
MEDIUM_THRESHOLD:   Final[float] = 0.60

import re
_COMMERCIAL_RE = re.compile(r"\b(buy|cheap|free|win|prize|click)\b", re.IGNORECASE)
_HATE_RE       = re.compile(r"\b(hate|kill|die|terrorist)\b", re.IGNORECASE)


class SpamClassifier:
    def __init__(self) -> None:
        self._lstm      = SpamLSTM()
        self._extractor = FeatureExtractor()
        self._cleaner   = TextCleaner()
        self._logreg    = LogisticRegression(
            C=1.0, max_iter=1000, class_weight="balanced",
            solver="lbfgs",
        )
        self._scaler    = StandardScaler()
        self._is_ready  = False

    def predict(
        self, text: str, language: str
    ) -> tuple[SpamLabel, float, SpamSeverity | None, list[SpamCategory]]:
        if not self._is_ready:
            raise RuntimeError("Classifier not fitted. Call fit() or load().")

        from schemas import Language
        lang    = Language(language)
        cleaned = self._cleaner.clean(text, lang)
        features = self._extractor.extract(cleaned)

        tfidf_vec        = np.array(features.tfidf_scores).reshape(1, -1)
        tfidf_scaled     = self._scaler.transform(tfidf_vec)
        tfidf_proba      = self._logreg.predict_proba(tfidf_scaled)[0]
        spam_idx         = np.where(self._logreg.classes_ == 3)[0]
        tfidf_spam_prob  = float(tfidf_proba[spam_idx[0]]) if len(spam_idx) else 0.0

        lstm_spam_prob, _ = self._lstm.predict_proba(cleaned.cleaned)

        ensemble_prob = LSTM_WEIGHT * lstm_spam_prob + TFIDF_WEIGHT * tfidf_spam_prob

        label    = self._assign_label(ensemble_prob)
        severity = self._assign_severity(label, ensemble_prob)
        reasons  = self._detect_reasons(text, features)

        return label, ensemble_prob, severity, reasons

    @staticmethod
    def _assign_label(prob: float) -> SpamLabel:
        if prob >= SPAM_THRESHOLD:       return SpamLabel.SPAM
        if prob >= SUSPICIOUS_THRESHOLD: return SpamLabel.SUSPICIOUS
        if prob >= REVIEW_THRESHOLD:     return SpamLabel.NEEDS_REVIEW
        return SpamLabel.NOT_SPAM

    @staticmethod
    def _assign_severity(label: SpamLabel, prob: float) -> SpamSeverity | None:
        if label not in (SpamLabel.SPAM, SpamLabel.SUSPICIOUS):
            return None
        if prob >= CRITICAL_THRESHOLD: return SpamSeverity.CRITICAL
        if prob >= HIGH_THRESHOLD:     return SpamSeverity.HIGH
        if prob >= MEDIUM_THRESHOLD:   return SpamSeverity.MEDIUM
        return SpamSeverity.LOW

    @staticmethod
    def _detect_reasons(text: str, features: RawFeatures) -> list[SpamCategory]:
        reasons: list[SpamCategory] = []
        if features.url_count >= 3:
            reasons.append(SpamCategory.PHISHING)
        if features.exclamation_count >= 5 and features.capital_ratio > 0.4:
            reasons.append(SpamCategory.COMMERCIAL)
        if features.repeated_char_ratio > 0.2:
            reasons.append(SpamCategory.REPETITIVE_CONTENT)
        if features.has_phone_number or features.has_email:
            reasons.append(SpamCategory.COMMERCIAL)
        if _COMMERCIAL_RE.search(text):
            reasons.append(SpamCategory.COMMERCIAL)
        if _HATE_RE.search(text):
            reasons.append(SpamCategory.HATE_SPEECH)
        return list(dict.fromkeys(reasons))

    def fit(self, texts: list[str], labels: list[int]) -> None:
        from schemas import Language
        self._extractor.fit(texts)
        self._lstm.prepare_tokenizer(texts)
        self._lstm.build()

        tfidf_features = []
        for text in texts:
            cleaned = self._cleaner.clean(text, Language.EN)
            feats   = self._extractor.extract(cleaned)
            tfidf_features.append(feats.tfidf_scores)

        X        = np.array(tfidf_features)
        X_scaled = self._scaler.fit_transform(X)
        self._logreg.fit(X_scaled, labels)
        self._is_ready = True

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        self._lstm.save(path)
        joblib.dump(self._logreg,                path / "logreg.pkl")
        joblib.dump(self._scaler,                path / "scaler.pkl")
        joblib.dump(self._extractor._vectorizer, path / "tfidf.pkl")

    def load(self, path: Path) -> None:
        self._lstm.build()
        self._lstm.load(path)
        self._logreg                        = joblib.load(path / "logreg.pkl")
        self._scaler                        = joblib.load(path / "scaler.pkl")
        self._extractor._vectorizer         = joblib.load(path / "tfidf.pkl")
        self._extractor._is_fitted          = True
        self._is_ready                      = True