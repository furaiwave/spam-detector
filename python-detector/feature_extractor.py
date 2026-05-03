from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Final

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from schemas import Language, RawFeatures

MAX_TFIDF_FEATURES: Final[int] = 5000

URL_PATTERN:   Final[re.Pattern[str]] = re.compile(r"https?://\S+|www\.\S+")
PHONE_PATTERN: Final[re.Pattern[str]] = re.compile(r"(\+?\d[\d\s\-\(\)]{7,}\d)")
EMAIL_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)


@dataclass(frozen=True)
class CleanedText:
    original: str
    cleaned:  str
    urls:     tuple[str, ...]
    language: Language


class TextCleaner:
    @staticmethod
    def clean(text: str, language: Language) -> CleanedText:
        urls       = tuple(URL_PATTERN.findall(text))
        normalized = unicodedata.normalize("NFKC", text)
        no_urls    = URL_PATTERN.sub(" URL ", normalized)
        cleaned    = re.sub(r"\s+", " ", no_urls).strip()
        return CleanedText(original=text, cleaned=cleaned, urls=urls, language=language)


class FeatureExtractor:
    def __init__(self, max_features: int = MAX_TFIDF_FEATURES) -> None:
        self._vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=(1, 3),
            sublinear_tf=True,
            strip_accents="unicode",
            analyzer="word",
            min_df=2,
        )
        self._is_fitted: bool = False

    def fit(self, texts: list[str]) -> None:
        self._vectorizer.fit(texts)
        self._is_fitted = True

    def extract(self, cleaned: CleanedText) -> RawFeatures:
        if not self._is_fitted:
            raise RuntimeError("Call fit() before extract()")

        text         = cleaned.cleaned
        tfidf_matrix = self._vectorizer.transform([text])
        tfidf_scores = tfidf_matrix.toarray()[0].tolist()

        return RawFeatures(
            tfidf_scores=tfidf_scores,
            lstm_hidden=[],
            text_length=len(text),
            url_count=len(cleaned.urls),
            exclamation_count=text.count("!"),
            capital_ratio=self._capital_ratio(text),
            repeated_char_ratio=self._repeated_char_ratio(text),
            has_phone_number=bool(PHONE_PATTERN.search(cleaned.original)),
            has_email=bool(EMAIL_PATTERN.search(cleaned.original)),
            language_confidence=self._language_confidence(text, cleaned.language),  # type: ignore[arg-type]
        )

    @staticmethod
    def _capital_ratio(text: str) -> float:
        letters = [c for c in text if c.isalpha()]
        return sum(1 for c in letters if c.isupper()) / len(letters) if letters else 0.0

    @staticmethod
    def _repeated_char_ratio(text: str) -> float:
        if len(text) < 2:
            return 0.0
        return sum(1 for i in range(1, len(text)) if text[i] == text[i - 1]) / (len(text) - 1)

    @staticmethod
    def _language_confidence(text: str, expected: Language) -> float:
        cyrillic = sum(1 for c in text if "\u0400" <= c <= "\u04FF")
        latin    = sum(1 for c in text if c.isascii() and c.isalpha())
        total    = cyrillic + latin or 1
        if expected == Language.UK:
            return min(cyrillic / total + 0.1, 1.0)
        return min(latin / total + 0.1, 1.0)