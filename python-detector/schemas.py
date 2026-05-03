from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic.functional_validators import AfterValidator
import uuid
from datetime import datetime, timezone


class Platform(str, Enum):
    TWITTER   = "twitter"
    FACEBOOK  = "facebook"
    INSTAGRAM = "instagram"
    TELEGRAM  = "telegram"
    REDDIT    = "reddit"
    BLUESKY   = "bluesky"


class Language(str, Enum):
    UK = "uk"
    EN = "en"
    DE = "de"
    FR = "fr"
    PL = "pl"


class SpamLabel(str, Enum):
    SPAM         = "spam"
    NOT_SPAM     = "not_spam"
    SUSPICIOUS   = "suspicious"
    NEEDS_REVIEW = "needs_review"


class SpamSeverity(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


class SpamCategory(str, Enum):
    PHISHING           = "spam:phishing"
    COMMERCIAL         = "spam:commercial"
    BOT_ACTIVITY       = "spam:bot_activity"
    HATE_SPEECH        = "spam:hate_speech"
    MISINFORMATION     = "spam:misinformation"
    REPETITIVE_CONTENT = "spam:repetitive_content"


def _validate_confidence(v: float) -> float:
    if not (0.0 <= v <= 1.0):
        raise ValueError(f"Confidence must be in [0, 1], got {v}")
    return round(v, 6)


Confidence = Annotated[float, AfterValidator(_validate_confidence)]


class AnalyzeRequest(BaseModel):
    model_config = {"str_strip_whitespace": True, "frozen": True}

    content:  Annotated[str, Field(min_length=1, max_length=10_000)]
    language: Language = Language.EN
    platform: Platform

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content cannot be blank after stripping whitespace")
        return v


# ── Discriminated response union ──────────────────────────────────────────
class SpamResult(BaseModel):
    model_config = {"frozen": True}
    label:      Literal[SpamLabel.SPAM]
    confidence: Confidence
    severity:   SpamSeverity
    reasons:    list[SpamCategory]
    flagged_at: datetime


class SuspiciousResult(BaseModel):
    model_config = {"frozen": True}
    label:      Literal[SpamLabel.SUSPICIOUS]
    confidence: Confidence
    severity:   SpamSeverity
    reasons:    list[SpamCategory]
    flagged_at: datetime


class NeedsReviewResult(BaseModel):
    model_config = {"frozen": True}
    label:       Literal[SpamLabel.NEEDS_REVIEW]
    confidence:  Confidence
    review_note: str = "Manual review required"
    flagged_at:  datetime


class NotSpamResult(BaseModel):
    model_config = {"frozen": True}
    label:      Literal[SpamLabel.NOT_SPAM]
    confidence: Confidence
    flagged_at: datetime


AnalysisResult = Annotated[
    Union[SpamResult, SuspiciousResult, NeedsReviewResult, NotSpamResult],
    Field(discriminator="label"),
]


class AnalyzeResponse(BaseModel):
    model_config = {"frozen": True}

    analysis_id:  str          = Field(default_factory=lambda: str(uuid.uuid4()))
    label:        SpamLabel
    confidence:   Confidence
    severity:     SpamSeverity | None = None
    reasons:      list[SpamCategory]  = Field(default_factory=list)
    review_note:  str | None          = None
    processed_at: datetime            = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @model_validator(mode="after")
    def validate_severity_consistency(self) -> "AnalyzeResponse":
        if self.label in (SpamLabel.SPAM, SpamLabel.SUSPICIOUS):
            if self.severity is None:
                raise ValueError(
                    f"severity is required when label is '{self.label}'"
                )
        return self


class RawFeatures(BaseModel):
    model_config = {"frozen": True}
    tfidf_scores:          list[float]
    lstm_hidden:           list[float]
    text_length:           int
    url_count:             int
    exclamation_count:     int
    capital_ratio:         float
    repeated_char_ratio:   float
    has_phone_number:      bool
    has_email:             bool
    language_confidence:   Confidence