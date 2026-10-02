"""SacreBLEU (in signature), chrF++, COMET (Unbabel/wmt22-comet-da, reference-based) + CI.

Lưu ý: COMET không hiểu tiếng Ba Na ở phía source — điểm chủ yếu phản ánh độ gần hyp↔ref tiếng Việt.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Sequence

import numpy as np

from src.eval.bootstrap import bootstrap_ci, paired_bootstrap


def _metric(name: str, tokenize: str | None = None):
    from sacrebleu.metrics import BLEU, CHRF

    if name == "bleu":
        return BLEU(tokenize=tokenize or "13a")
    if name == "chrf++":
        return CHRF(word_order=2)
    raise ValueError(name)


def _stats(metric, hyps: Sequence[str], refs: Sequence[str]) -> np.ndarray:
    return np.asarray(metric._extract_corpus_statistics(list(hyps), [list(refs)]), dtype=float)


def _score_from(metric, stats: np.ndarray) -> float:
    return float(metric._compute_score_from_stats(stats.sum(axis=0).tolist()).score)


def corpus_scores(hyps: Sequence[str], refs: Sequence[str], bleu_tokenize: str | None = None,
                  n_boot: int = 1000, seed: int = 0) -> dict:
    out = {"n": len(hyps)}
    for name in ("bleu", "chrf++"):
        m = _metric(name, bleu_tokenize)
        st = _stats(m, hyps, refs)
        point, lo, hi = bootstrap_ci(lambda ix: _score_from(m, st[ix]), len(hyps), n_boot=n_boot, seed=seed)
        out[name] = point
        out[f"{name}_ci"] = [lo, hi]
        out[f"{name}_signature"] = str(m.get_signature())
    return out


@lru_cache(maxsize=1)
def _comet_model(name: str):
    from comet import download_model, load_from_checkpoint

    return load_from_checkpoint(download_model(name))


def comet_scores(srcs: Sequence[str], hyps: Sequence[str], refs: Sequence[str],
                 model: str = "Unbabel/wmt22-comet-da", batch_size: int = 32, gpus: int | None = None) -> list[float]:
    import torch

    m = _comet_model(model)
    data = [{"src": s, "mt": h, "ref": r} for s, h, r in zip(srcs, hyps, refs)]
    gpus = (1 if torch.cuda.is_available() else 0) if gpus is None else gpus
    return list(m.predict(data, batch_size=batch_size, gpus=gpus, progress_bar=False).scores)


def mt_report(srcs, hyps, refs, with_comet: bool = True, bleu_tokenize: str | None = None,
              n_boot: int = 1000, seed: int = 0) -> dict:
    out = corpus_scores(hyps, refs, bleu_tokenize, n_boot, seed)
    if with_comet:
        sc = np.asarray(comet_scores(srcs, hyps, refs))
        p, lo, hi = bootstrap_ci(lambda ix: sc[ix].mean(), len(sc), n_boot=n_boot, seed=seed)
        out.update({"comet": p, "comet_ci": [lo, hi], "comet_per_sentence": sc.tolist()})
    return out


def compare_mt(hyps_a, hyps_b, refs, metric: str = "chrf++", comet_a=None, comet_b=None,
               n_boot: int = 1000, seed: int = 0) -> dict:
    """Paired bootstrap giữa hai hệ trên cùng test (quy tắc giữ/bỏ nguồn dữ liệu trong ablation)."""
    if metric == "comet":
        a, b = np.asarray(comet_a), np.asarray(comet_b)
        return paired_bootstrap(lambda ix: a[ix].mean(), lambda ix: b[ix].mean(), len(a), n_boot, seed)
    m = _metric(metric)
    sa, sb = _stats(m, hyps_a, refs), _stats(m, hyps_b, refs)
    return paired_bootstrap(lambda ix: _score_from(m, sa[ix]), lambda ix: _score_from(m, sb[ix]),
                            len(refs), n_boot, seed)
