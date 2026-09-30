"""Chống rò rỉ: exact + near-duplicate (MinHash char n-gram + LSH, xác nhận bằng Jaccard thật).

Chỉ xóa khỏi TRAIN, không bao giờ xóa khỏi test. So khớp cả phía Ba Na và phía Việt:
một câu train trùng test ở BẤT KỲ phía nào đều bị loại.
"""
from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
import regex

from src.text.bahnar_normalizer import normalize_for_asr

_MERSENNE = np.uint64((1 << 61) - 1)
_MAX32 = np.uint64(0xFFFFFFFF)


def dedupe_key(text: str) -> str:
    """Khóa so khớp: lowercase, bỏ dấu câu, gộp khoảng trắng (dùng chung cho Ba Na và Việt)."""
    return normalize_for_asr(text or "")


def shingles(text: str, n: int) -> set[str]:
    t = regex.sub(r"\s+", " ", text)
    if len(t) <= n:
        return {t} if t else set()
    return {t[i:i + n] for i in range(len(t) - n + 1)}


def _hash32(s: str) -> int:
    return int.from_bytes(hashlib.blake2b(s.encode("utf-8"), digest_size=4).digest(), "little")


class MinHasher:
    def __init__(self, num_perm: int = 128, seed: int = 1):
        rng = np.random.default_rng(seed)
        self.a = rng.integers(1, (1 << 32) - 1, size=num_perm, dtype=np.uint64)
        self.b = rng.integers(0, (1 << 32) - 1, size=num_perm, dtype=np.uint64)
        self.num_perm = num_perm

    def signature(self, sh: set[str]) -> np.ndarray:
        if not sh:
            return np.full(self.num_perm, _MAX32, dtype=np.uint64)
        h = np.fromiter((_hash32(s) for s in sh), dtype=np.uint64, count=len(sh))
        # (a*h + b) mod p, giữ trong 64 bit: a,h < 2^32 nên a*h < 2^64
        phv = ((h[:, None] * self.a[None, :] + self.b[None, :]) % _MERSENNE) & _MAX32
        return phv.min(axis=0)


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


@dataclass
class ProtectedIndex:
    """Chỉ mục các câu được bảo vệ (test/val). Truy vấn bằng câu train."""
    ngram: int = 5
    num_perm: int = 128
    bands: int = 32
    threshold: float = 0.9
    hasher: MinHasher = field(init=False)
    exact: dict[str, str] = field(default_factory=dict)
    buckets: dict = field(default_factory=lambda: defaultdict(list))
    items: list[tuple[str, set[str]]] = field(default_factory=list)

    def __post_init__(self):
        assert self.num_perm % self.bands == 0
        self.rows = self.num_perm // self.bands
        self.hasher = MinHasher(self.num_perm)

    def _band_keys(self, sig: np.ndarray):
        for b in range(self.bands):
            yield b, sig[b * self.rows:(b + 1) * self.rows].tobytes()

    def add(self, text: str, tag: str) -> None:
        k = dedupe_key(text)
        if not k:
            return
        self.exact.setdefault(k, tag)
        sh = shingles(k, self.ngram)
        idx = len(self.items)
        self.items.append((tag, sh))
        for key in self._band_keys(self.hasher.signature(sh)):
            self.buckets[key].append(idx)

    def query(self, text: str) -> tuple[str, str, float] | None:
        """Trả về (kiểu, tag test, jaccard) nếu trùng, ngược lại None."""
        k = dedupe_key(text)
        if not k:
            return None
        if k in self.exact:
            return ("exact", self.exact[k], 1.0)
        sh = shingles(k, self.ngram)
        cands: set[int] = set()
        for key in self._band_keys(self.hasher.signature(sh)):
            cands.update(self.buckets.get(key, ()))
        best = None
        for i in cands:
            tag, other = self.items[i]
            j = jaccard(sh, other)
            if j >= self.threshold and (best is None or j > best[2]):
                best = ("near", tag, j)
        return best


def find_leaks(protected: dict[str, list[str]], train_texts: list[str], cfg: dict) -> list[tuple | None]:
    """``protected``: {tên test set: [câu]}. Trả về cho mỗi câu train: None hoặc (kiểu, test set, jaccard)."""
    idx = ProtectedIndex(ngram=cfg["ngram"], num_perm=cfg["num_perm"], bands=cfg["bands"],
                         threshold=cfg["jaccard"])
    for name, texts in protected.items():
        for t in texts:
            idx.add(t, name)
    return [idx.query(t) for t in train_texts]
