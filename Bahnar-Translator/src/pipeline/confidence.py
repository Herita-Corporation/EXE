"""Tune ngưỡng confidence τ trên VAL sao cho câu bị chặn là câu có COMET thấp nhất (Phase 5.1).

Đầu vào: jsonl với {asr_conf, mt_conf, comet} theo câu (sinh bởi src.eval.e2e_eval trên split val).
    python -m src.pipeline.confidence --scores outputs/e2e/cuong06_val.scores.jsonl --max_reject 0.15
"""
from __future__ import annotations

import argparse
import json

import numpy as np

from src.utils import read_jsonl


def spearman(x, y) -> float:
    rx, ry = np.argsort(np.argsort(x)), np.argsort(np.argsort(y))
    return float(np.corrcoef(rx, ry)[0, 1]) if len(x) > 2 else float("nan")


def sweep(conf: np.ndarray, quality: np.ndarray, max_reject: float, steps: int = 40) -> list[dict]:
    out = []
    for r in np.linspace(0, max_reject, steps + 1)[1:]:
        tau = float(np.quantile(conf, r))
        rej = conf < tau
        if rej.sum() == 0 or (~rej).sum() == 0:
            continue
        out.append({"tau": tau, "reject_rate": float(rej.mean()), "comet_rejected": float(quality[rej].mean()),
                    "comet_kept": float(quality[~rej].mean()), "gain": float(quality[~rej].mean() - quality.mean())})
    return out


def choose(rows: list[dict], min_gain_per_reject: float = 0.0) -> dict | None:
    """Chọn τ tối đa hóa (COMET phần giữ − COMET toàn bộ) / tỷ lệ chặn — tránh chặn quá tay."""
    best = None
    for r in rows:
        eff = r["gain"] / r["reject_rate"]
        if eff > min_gain_per_reject and (best is None or eff > best["gain"] / best["reject_rate"]):
            best = r
    return best


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", required=True)
    ap.add_argument("--max_reject", type=float, default=0.15)
    args = ap.parse_args()
    rows = list(read_jsonl(args.scores))
    q = np.array([r["comet"] for r in rows])
    res = {}
    for key in ("asr_conf", "mt_conf"):
        c = np.array([r[key] for r in rows])
        grid = sweep(c, q, args.max_reject)
        res[key] = {"spearman_with_comet": spearman(c, q), "chosen": choose(grid), "grid": grid}
    print(json.dumps({k: {"spearman": v["spearman_with_comet"], "chosen": v["chosen"]} for k, v in res.items()},
                     indent=1))


if __name__ == "__main__":
    main()
