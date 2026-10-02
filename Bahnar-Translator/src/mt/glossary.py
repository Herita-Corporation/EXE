"""Glossary thuật ngữ cố định (địa danh, lễ hội) bảo vệ bằng placeholder ``<g0>``..``<g9>``.

* Lúc build corpus: với xác suất p, thay cặp thuật ngữ xuất hiện ở CẢ hai phía bằng cùng placeholder
  → model học chép placeholder.
* Lúc inference: thay thuật ngữ nguồn bằng placeholder, dịch, rồi khôi phục thuật ngữ đích.
File glossary: TSV ``ba<TAB>vi`` (người dùng bổ sung).
"""
from __future__ import annotations

import random
from pathlib import Path

import regex

N_PLACEHOLDERS = 10
PLACEHOLDERS = [f"<g{i}>" for i in range(N_PLACEHOLDERS)]


def load_glossary(path: str | Path | None) -> list[tuple[str, str]]:
    if not path or not Path(path).exists():
        return []
    out = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#") and "\t" in line:
            ba, vi = line.split("\t", 1)
            out.append((ba.strip(), vi.strip()))
    # thuật ngữ dài trước để không bị thuật ngữ con "ăn" mất
    return sorted(out, key=lambda x: -len(x[0]))


def _pattern(term: str) -> regex.Pattern:
    return regex.compile(rf"(?<![\p{{L}}\p{{M}}]){regex.escape(term)}(?![\p{{L}}\p{{M}}])", regex.IGNORECASE)


class Glossary:
    def __init__(self, entries: list[tuple[str, str]]):
        self.entries = [(ba, vi, _pattern(ba), _pattern(vi)) for ba, vi in entries]

    def __len__(self) -> int:
        return len(self.entries)

    def protect(self, src: str) -> tuple[str, dict[str, str]]:
        """Thay thuật ngữ nguồn bằng placeholder. Trả (src mới, {placeholder: thuật ngữ đích})."""
        mapping: dict[str, str] = {}
        for ba, vi, pba, _ in self.entries:
            if len(mapping) >= N_PLACEHOLDERS:
                break
            if pba.search(src):
                ph = PLACEHOLDERS[len(mapping)]
                src = pba.sub(f" {ph} ", src)
                mapping[ph] = vi
        return regex.sub(r"\s+", " ", src).strip(), mapping

    @staticmethod
    def restore(tgt: str, mapping: dict[str, str]) -> str:
        for ph, vi in mapping.items():
            tgt = tgt.replace(ph, vi)
        return regex.sub(r"\s+", " ", regex.sub(r"<g\d>", "", tgt)).strip()

    def inject(self, src: str, tgt: str, p: float, rng: random.Random) -> tuple[str, str]:
        """Augmentation lúc train: thay các cặp có ở cả hai phía bằng placeholder."""
        if not self.entries or rng.random() >= p:
            return src, tgt
        k = 0
        for ba, vi, pba, pvi in self.entries:
            if k >= N_PLACEHOLDERS:
                break
            if pba.search(src) and pvi.search(tgt):
                ph = PLACEHOLDERS[k]
                src, tgt = pba.sub(f" {ph} ", src), pvi.sub(f" {ph} ", tgt)
                k += 1
        clean = lambda s: regex.sub(r"\s+", " ", s).strip()
        return clean(src), clean(tgt)
