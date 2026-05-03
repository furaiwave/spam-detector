from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import pandas as pd

from schemas import SpamLabel

LABEL_TO_IDX: Final[dict[str, int]] = {
    SpamLabel.NOT_SPAM:     0,
    SpamLabel.SUSPICIOUS:   1,
    SpamLabel.NEEDS_REVIEW: 2,
    SpamLabel.SPAM:         3,
}

IDX_TO_LABEL: Final[dict[int, str]] = {v: k for k, v in LABEL_TO_IDX.items()}

# Мінімальна довжина тексту — фільтруємо сміттєві рядки
MIN_TEXT_LEN: Final[int] = 5


@dataclass(frozen=True)
class SpamDataset:
    texts:  list[str]
    labels: list[int]   # 0..3 відповідно до LABEL_TO_IDX

    def __len__(self) -> int:
        return len(self.texts)

    def label_distribution(self) -> dict[str, int]:
        dist: dict[str, int] = {}
        for idx in self.labels:
            label = IDX_TO_LABEL[idx]
            dist[label] = dist.get(label, 0) + 1
        return dist


def load_csv(path: Path) -> SpamDataset:
    """
    Завантажує CSV з колонками: text, label
    label — один із SpamLabel values (рядок)
    """
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path, encoding="utf-8")

    required = {"text", "label"}
    if not required.issubset(df.columns):
        raise ValueError(
            f"CSV must have columns {required}, got: {df.columns.tolist()}"
        )

    # Базова очистка
    df = df.dropna(subset=["text", "label"])
    df["text"]  = df["text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip()

    # Фільтруємо занадто короткі тексти
    df = df[df["text"].str.len() >= MIN_TEXT_LEN]

    # Валідуємо labels
    valid   = set(LABEL_TO_IDX.keys())
    invalid = set(df["label"].unique()) - valid
    if invalid:
        raise ValueError(f"Unknown labels in dataset: {invalid}. Valid: {valid}")

    texts:  list[str] = df["text"].tolist()
    labels: list[int] = [LABEL_TO_IDX[lbl] for lbl in df["label"]]

    return SpamDataset(texts=texts, labels=labels)


def generate_demo_csv(path: Path, n_per_class: int = 50) -> None:
    """
    Генерує демо-датасет для швидкого тесту без реальних даних.
    НЕ для продакшну — тільки щоб перевірити pipeline.
    """
    import random
    random.seed(42)

    samples: list[dict[str, str]] = []

    spam_templates = [
        "BUY NOW!!! Cheap {item} click here http://spam.com http://free.com!!!",
        "WIN $1000 FREE!!! Call +380 99 999 9999 or email spam@win.com!!!",
        "URGENT: Your account suspended click http://phish.com immediately!!!",
        "FREE {item}!!! Limited offer!!! CLICK NOW!!! http://cheap.biz",
        "Congratulations!!! You won prize!!! Send details to scam@free.com!!!",
    ]
    not_spam_templates = [
        "Hey, how are you doing today? Hope everything is fine.",
        "The meeting is scheduled for tomorrow at 10am in room 3.",
        "Thanks for your message, I will get back to you soon.",
        "Can you please review the attached document when you have time?",
        "Looking forward to our discussion about the project next week.",
    ]
    suspicious_templates = [
        "Check this out, might interest you: http://deal.biz — seems legit?",
        "Someone told me about a good investment opportunity, want details?",
        "This product helped me lose 10kg in a week, try it yourself.",
        "My friend made $500 last week doing this, info at http://earn.net",
        "Not sure about this offer but it looks interesting: http://promo.co",
    ]
    review_templates = [
        "This service is okay I guess, not great not terrible.",
        "I have mixed feelings about this product.",
        "The offer seems unusual but I cannot tell for sure.",
        "Please review this content, I am not certain about it.",
        "This message might need a second look from the team.",
    ]

    items = ["meds", "watches", "loans", "pills", "software"]

    for tmpl in spam_templates * (n_per_class // len(spam_templates) + 1):
        samples.append({
            "text":  tmpl.format(item=random.choice(items)),
            "label": SpamLabel.SPAM,
        })

    for tmpl in not_spam_templates * (n_per_class // len(not_spam_templates) + 1):
        samples.append({"text": tmpl, "label": SpamLabel.NOT_SPAM})

    for tmpl in suspicious_templates * (n_per_class // len(suspicious_templates) + 1):
        samples.append({"text": tmpl, "label": SpamLabel.SUSPICIOUS})

    for tmpl in review_templates * (n_per_class // len(review_templates) + 1):
        samples.append({"text": tmpl, "label": SpamLabel.NEEDS_REVIEW})

    # Обрізаємо до n_per_class кожного класу
    from itertools import groupby
    result: list[dict[str, str]] = []
    key_fn = lambda x: x["label"]
    for _, group in groupby(sorted(samples, key=key_fn), key=key_fn):
        result.extend(list(group)[:n_per_class])

    random.shuffle(result)

    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(result).to_csv(path, index=False, encoding="utf-8")
    print(f"Demo dataset saved to {path} ({len(result)} samples)")


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/spam_dataset.csv")
    generate_demo_csv(out)