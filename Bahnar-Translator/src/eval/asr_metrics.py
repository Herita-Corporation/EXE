"""WER/CER + CI + phân tích lỗi cho ASR Ba Na. Ref và hyp đều qua ``normalize_for_asr``."""
from __future__ import annotations

from collections import Counter
from typing import Sequence

from src.eval.bootstrap import paired_bootstrap, rate_ci
from src.text.bahnar_normalizer import normalize_for_asr

try:
    from rapidfuzz.distance import Levenshtein as _Lev

    def edit_distance(a: Sequence, b: Sequence) -> int:
        return _Lev.distance(a, b)
except ImportError:  # pragma: no cover
    def edit_distance(a: Sequence, b: Sequence) -> int:
        prev = list(range(len(b) + 1))
        for i, x in enumerate(a, 1):
            cur = [i] + [0] * len(b)
            for j, y in enumerate(b, 1):
                cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y))
            prev = cur
        return prev[-1]


def per_utt_counts(refs: Sequence[str], hyps: Sequence[str]) -> dict[str, list[int]]:
    out = {"w_err": [], "w_len": [], "c_err": [], "c_len": []}
    for r, h in zip(refs, hyps):
        r, h = normalize_for_asr(r), normalize_for_asr(h)
        rw, hw = r.split(), h.split()
        out["w_err"].append(edit_distance(rw, hw))
        out["w_len"].append(len(rw))
        rc, hc = r.replace(" ", ""), h.replace(" ", "")
        out["c_err"].append(edit_distance(rc, hc))
        out["c_len"].append(len(rc))
    return out


def wer_cer(refs: Sequence[str], hyps: Sequence[str]) -> dict[str, float]:
    c = per_utt_counts(refs, hyps)
    return {"wer": sum(c["w_err"]) / max(sum(c["w_len"]), 1), "cer": sum(c["c_err"]) / max(sum(c["c_len"]), 1)}


def asr_report(refs: Sequence[str], hyps: Sequence[str], n_boot: int = 1000, seed: int = 0) -> dict:
    c = per_utt_counts(refs, hyps)
    wer = rate_ci(c["w_err"], c["w_len"], n_boot=n_boot, seed=seed)
    cer = rate_ci(c["c_err"], c["c_len"], n_boot=n_boot, seed=seed)
    return {"n": len(refs), "wer": wer[0], "wer_ci": [wer[1], wer[2]], "cer": cer[0], "cer_ci": [cer[1], cer[2]]}


def compare_asr(refs, hyps_a, hyps_b, n_boot: int = 1000, seed: int = 0) -> dict:
    """Paired bootstrap WER giữa hai hệ (dùng cho bảng ablation)."""
    import numpy as np

    a, b = per_utt_counts(refs, hyps_a), per_utt_counts(refs, hyps_b)
    ea, eb, l = map(lambda x: np.asarray(x, float), (a["w_err"], b["w_err"], a["w_len"]))
    return paired_bootstrap(lambda ix: ea[ix].sum() / l[ix].sum(), lambda ix: eb[ix].sum() / l[ix].sum(),
                            len(refs), n_boot=n_boot, seed=seed, higher_is_better=False)


def top_errors(refs: Sequence[str], hyps: Sequence[str], k: int = 50) -> list[tuple[str, int]]:
    """Top-k cặp thay thế/xóa/chèn ở mức từ (để phân tích top-50 lỗi — DoD Phase 1)."""
    import difflib

    c: Counter = Counter()
    for r, h in zip(refs, hyps):
        rw, hw = normalize_for_asr(r).split(), normalize_for_asr(h).split()
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=rw, b=hw, autojunk=False).get_opcodes():
            if op == "replace":
                c[f"{' '.join(rw[i1:i2])} → {' '.join(hw[j1:j2])}"] += 1
            elif op == "delete":
                c[f"{' '.join(rw[i1:i2])} → ∅"] += 1
            elif op == "insert":
                c[f"∅ → {' '.join(hw[j1:j2])}"] += 1
    return c.most_common(k)
