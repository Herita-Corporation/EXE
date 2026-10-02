"""Bootstrap 95% CI và paired bootstrap cho ablation.

Mọi metric corpus-level được tính từ SUFFICIENT STATISTICS theo câu nên resample nhanh:
* WER/CER : (số lỗi, độ dài ref) theo câu.
* BLEU/chrF++: thống kê theo câu của sacrebleu.
* COMET   : điểm theo câu (trung bình).
"""
from __future__ import annotations

from typing import Callable, Sequence

import numpy as np


def _indices(n: int, n_boot: int, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, n, size=(n_boot, n))


def bootstrap_ci(stat: Callable[[np.ndarray], float], n: int, n_boot: int = 1000, seed: int = 0,
                 alpha: float = 0.05) -> tuple[float, float, float]:
    """``stat(idx)`` tính metric trên tập chỉ số ``idx``. Trả (điểm, lo, hi)."""
    point = stat(np.arange(n))
    samples = np.array([stat(ix) for ix in _indices(n, n_boot, seed)])
    lo, hi = np.percentile(samples, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(point), float(lo), float(hi)


def rate_ci(errors: Sequence[float], lengths: Sequence[float], **kw) -> tuple[float, float, float]:
    """CI cho WER/CER corpus-level = sum(errors)/sum(lengths)."""
    e, l = np.asarray(errors, float), np.asarray(lengths, float)
    return bootstrap_ci(lambda ix: e[ix].sum() / max(l[ix].sum(), 1.0), len(e), **kw)


def mean_ci(scores: Sequence[float], **kw) -> tuple[float, float, float]:
    s = np.asarray(scores, float)
    return bootstrap_ci(lambda ix: s[ix].mean(), len(s), **kw)


def paired_bootstrap(stat_a: Callable[[np.ndarray], float], stat_b: Callable[[np.ndarray], float], n: int,
                     n_boot: int = 1000, seed: int = 0, higher_is_better: bool = True) -> dict:
    """So sánh hệ B với hệ A trên CÙNG mẫu resample (Koehn 2004).

    Trả delta = B - A, CI 95% của delta và p-value một phía (tỷ lệ resample B không tốt hơn A).
    """
    idx = _indices(n, n_boot, seed)
    full = np.arange(n)
    delta = stat_b(full) - stat_a(full)
    ds = np.array([stat_b(ix) - stat_a(ix) for ix in idx])
    if not higher_is_better:
        ds_better = -ds
    else:
        ds_better = ds
    lo, hi = np.percentile(ds, [2.5, 97.5])
    return {"delta": float(delta), "ci": [float(lo), float(hi)],
            "p_value": float((ds_better <= 0).mean()),
            "significant": bool((lo > 0 or hi < 0) and ((delta > 0) == higher_is_better))}
