from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from schemas import Language

# Unicode блоки для евристики
CYRILLIC_RANGE: Final[tuple[str, str]] = ("\u0400", "\u04FF")
LATIN_RANGE:    Final[tuple[str, str]] = ("A", "z")

# Специфічні символи для мов
UA_SPECIFIC: Final[frozenset[str]] = frozenset("іїєґІЇЄҐ")
RU_SPECIFIC: Final[frozenset[str]] = frozenset("ёъЁЪ")
DE_SPECIFIC: Final[frozenset[str]] = frozenset("äöüßÄÖÜ")
PL_SPECIFIC: Final[frozenset[str]] = frozenset("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ")
FR_SPECIFIC: Final[frozenset[str]] = frozenset("àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ")


@dataclass(frozen=True)
class DetectionResult:
    detected:   Language
    confidence: float          # 0..1
    scores:     dict[str, float]  # всі мови з їх score


class LanguageDetector:
    """
    Евристичний детектор мови на основі unicode block analysis.
    Не потребує зовнішніх бібліотек — достатньо для попередньої фільтрації.
    Для продакшну краще використати langdetect або fastText.
    """

    @classmethod
    def detect(cls, text: str) -> DetectionResult:
        if not text.strip():
            return DetectionResult(
                detected=Language.EN,
                confidence=0.0,
                scores={lang.value: 0.0 for lang in Language},
            )

        chars = [c for c in text if c.isalpha()]
        if not chars:
            return DetectionResult(
                detected=Language.EN,
                confidence=0.5,
                scores={lang.value: 0.0 for lang in Language},
            )

        total     = len(chars)
        cyrillic  = sum(1 for c in chars if CYRILLIC_RANGE[0] <= c <= CYRILLIC_RANGE[1])
        latin     = total - cyrillic

        scores: dict[str, float] = {}

        if cyrillic > latin:
            # Слов'янська мова — розрізняємо UK vs RU
            ua_score = sum(1 for c in text if c in UA_SPECIFIC) / max(cyrillic, 1)
            ru_score = sum(1 for c in text if c in RU_SPECIFIC) / max(cyrillic, 1)

            scores[Language.UK.value] = cyrillic / total * (0.5 + ua_score)
            scores[Language.RU.value] = cyrillic / total * (0.5 + ru_score)
            scores[Language.EN.value] = latin / total * 0.3
            scores[Language.DE.value] = 0.0
            scores[Language.FR.value] = 0.0
            scores[Language.PL.value] = 0.0
        else:
            # Latin-based — розрізняємо EN / DE / FR / PL
            de_score = sum(1 for c in text if c in DE_SPECIFIC) / max(latin, 1)
            pl_score = sum(1 for c in text if c in PL_SPECIFIC) / max(latin, 1)
            fr_score = sum(1 for c in text if c in FR_SPECIFIC) / max(latin, 1)
            en_score = 1.0 - de_score - pl_score - fr_score

            scores[Language.EN.value] = max(en_score * latin / total, 0.0)
            scores[Language.DE.value] = de_score * latin / total
            scores[Language.FR.value] = fr_score * latin / total
            scores[Language.PL.value] = pl_score * latin / total
            scores[Language.UK.value] = 0.0
            scores[Language.RU.value] = 0.0

        # Normalize scores до суми 1.0
        total_score = sum(scores.values()) or 1.0
        scores      = {k: v / total_score for k, v in scores.items()}

        best_lang_str = max(scores, key=lambda k: scores[k])
        best_lang     = Language(best_lang_str)
        confidence    = scores[best_lang_str]

        return DetectionResult(
            detected=best_lang,
            confidence=round(confidence, 4),
            scores=scores,
        )

    @classmethod
    def is_cyrillic(cls, text: str) -> bool:
        chars = [c for c in text if c.isalpha()]
        if not chars:
            return False
        cyrillic = sum(1 for c in chars if CYRILLIC_RANGE[0] <= c <= CYRILLIC_RANGE[1])
        return cyrillic / len(chars) > 0.5

    @classmethod
    def validate_language(cls, text: str, declared: Language) -> float:
        """
        Перевіряє чи оголошена мова відповідає тексту.
        Повертає confidence що текст написаний на declared мові.
        """
        result = cls.detect(text)
        return result.scores.get(declared.value, 0.0)