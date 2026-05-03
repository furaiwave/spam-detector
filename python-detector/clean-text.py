from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Final

# ── Патерни ───────────────────────────────────────────────────────────────
URL_RE:        Final[re.Pattern[str]] = re.compile(r"https?://\S+|www\.\S+")
WHITESPACE_RE: Final[re.Pattern[str]] = re.compile(r"\s+")
HTML_TAG_RE:   Final[re.Pattern[str]] = re.compile(r"<[^>]+>")
EMOJI_RE:      Final[re.Pattern[str]] = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)


@dataclass(frozen=True)
class CleanResult:
    original:    str
    cleaned:     str
    urls:        tuple[str, ...]
    emoji_count: int
    html_found:  bool


class TextCleaner:
    """
    Stateless text cleaner.
    Зберігає сигнальні ознаки (urls, emoji) замість просто видалення.
    """

    @classmethod
    def clean(
        cls,
        text:          str,
        remove_urls:   bool = False,   # False = замінюємо на токен URL
        remove_emojis: bool = False,
        normalize_unicode: bool = True,
    ) -> CleanResult:
        urls        = tuple(URL_RE.findall(text))
        emoji_count = len(EMOJI_RE.findall(text))
        html_found  = bool(HTML_TAG_RE.search(text))

        result = text

        # HTML tags
        result = HTML_TAG_RE.sub(" ", result)

        # Unicode normalization
        if normalize_unicode:
            result = unicodedata.normalize("NFKC", result)

        # URLs
        result = URL_RE.sub("" if remove_urls else " URL ", result)

        # Emojis
        if remove_emojis:
            result = EMOJI_RE.sub(" ", result)

        # Whitespace collapse
        result = WHITESPACE_RE.sub(" ", result).strip()

        return CleanResult(
            original=text,
            cleaned=result,
            urls=urls,
            emoji_count=emoji_count,
            html_found=html_found,
        )

    @staticmethod
    def normalize_repeated_chars(text: str, max_repeat: int = 3) -> str:
        """
        "Hellooooo!!!" → "Hellooo!!!"
        Зберігає до max_repeat повторень одного символу.
        """
        pattern = re.compile(r"(.)\1{" + str(max_repeat) + r",}")
        return pattern.sub(r"\1" * max_repeat, text)

    @staticmethod
    def remove_accents(text: str) -> str:
        """Видаляє діакритику для нормалізації (корисно для TF-IDF)"""
        nfkd = unicodedata.normalize("NFKD", text)
        return "".join(c for c in nfkd if not unicodedata.combining(c))