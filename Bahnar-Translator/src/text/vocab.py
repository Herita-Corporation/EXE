"""Vocab ký tự cho CTC.

Đơn vị là CODEPOINT sau NFC (không phải grapheme): nhờ vậy U+0306 là một token riêng và
``ơ̆`` = ``ơ`` + ``̆`` luôn biểu diễn được — cùng thiết kế với vocab ``bdq`` của MMS.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Iterable

from src.text.bahnar_normalizer import has_non_latin, normalize_for_asr

WORD_DELIM = "|"
SPECIAL = ["<pad>", "<s>", "</s>", "<unk>"]


def char_counts(texts: Iterable[str], already_normalized: bool = False) -> Counter:
    c: Counter = Counter()
    for t in texts:
        t = t if already_normalized else normalize_for_asr(t)
        c.update(t)
    return c


def build_ctc_vocab(texts: Iterable[str], min_count: int = 1, allow_digits: bool = False) -> dict[str, int]:
    counts = char_counts(texts)
    chars = sorted(
        ch for ch, n in counts.items()
        if n >= min_count and ch != " " and (allow_digits or not ch.isdigit()) and not has_non_latin(ch)
    )
    vocab = {tok: i for i, tok in enumerate(SPECIAL)}
    vocab[WORD_DELIM] = len(vocab)
    for ch in chars:
        vocab.setdefault(ch, len(vocab))
    return vocab


def save_vocab(vocab: dict[str, int], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(vocab, ensure_ascii=False, indent=1), encoding="utf-8")


def load_vocab(path: str | Path) -> dict[str, int]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def text_to_ctc_chars(text: str) -> list[str]:
    """Văn bản ASR đã chuẩn hóa -> dãy token (khoảng trắng -> ``|``)."""
    return [WORD_DELIM if ch == " " else ch for ch in text]


def unk_rate(texts: Iterable[str], vocab: dict[str, int]) -> tuple[float, Counter]:
    """Tỷ lệ ký tự ngoài vocab (phải = 0 trên val — DoD Phase 1)."""
    total, unk = 0, Counter()
    for t in texts:
        for ch in text_to_ctc_chars(normalize_for_asr(t)):
            total += 1
            if ch not in vocab:
                unk[ch] += 1
    return (sum(unk.values()) / total if total else 0.0), unk
