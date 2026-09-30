"""Thống kê từ vựng giữa các nguồn Ba Na — quyết định mức độ cần tag phương ngữ.

* OOV (token & type) của nguồn A so với vocab nguồn B (cả hai chiều).
* Top từ chỉ xuất hiện ở một nguồn (tần suất cao nhất).
KHÔNG tự sửa chính tả giữa phương ngữ — chỉ đề xuất, chờ người dùng duyệt.
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

from src.text.bahnar_normalizer import normalize_for_asr


def word_counts(texts: Iterable[str]) -> Counter:
    c: Counter = Counter()
    for t in texts:
        c.update(w for w in normalize_for_asr(t).split() if not any(ch.isdigit() for ch in w))
    return c


def oov(a: Counter, b: Counter) -> dict:
    tok_total = sum(a.values())
    tok_oov = sum(n for w, n in a.items() if w not in b)
    return {
        "token_oov": tok_oov / tok_total if tok_total else 0.0,
        "type_oov": sum(1 for w in a if w not in b) / len(a) if a else 0.0,
        "types": len(a), "tokens": tok_total,
    }


def exclusive_top(a: Counter, b: Counter, k: int = 50) -> list[tuple[str, int]]:
    return [(w, n) for w, n in a.most_common() if w not in b][:k]


def compare_sources(sources: dict[str, Iterable[str]], k: int = 50) -> dict:
    counts = {name: word_counts(texts) for name, texts in sources.items()}
    out = {"oov": {}, "exclusive_top": {}}
    names = list(counts)
    for a in names:
        for b in names:
            if a != b:
                out["oov"][f"{a}_vs_{b}"] = oov(counts[a], counts[b])
        others = Counter()
        for b in names:
            if b != a:
                others.update(counts[b])
        out["exclusive_top"][a] = exclusive_top(counts[a], others, k)
    return out
