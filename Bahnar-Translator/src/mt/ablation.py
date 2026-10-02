"""Tổng hợp ablation M1..M6 (Phase 2.4) → docs/ablations.md.

Quy tắc giữ nguồn/kỹ thuật: run sau chỉ được giữ nếu cải thiện chrF++ hoặc COMET trên val HỘI THOẠI
có ý nghĩa (paired bootstrap, CI của delta không chứa 0) VÀ không giảm có ý nghĩa trên val IN-DOMAIN.

    python -m src.mt.ablation --config mt_bartpho.yaml --models_root outputs/mt_bartpho
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.eval.mt_metrics import compare_mt
from src.utils import load_config, resolve_path

ORDER = ["M1", "M2", "M3", "M4", "M5", "M6"]


def _load(models_root: Path, run: str, split: str) -> dict | None:
    for stage in ("stage2", "stage1"):
        p = models_root / run / stage / "best" / "eval" / f"{split}.json"
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            d["_stage"] = stage
            return d
    return None


def _refs(cfg: dict, split: str) -> dict[str, str]:
    p = resolve_path(cfg["corpus"]["out_dir"]) / "eval" / f"{split}.jsonl"
    return {json.loads(l)["uid"]: json.loads(l)["tgt"] for l in p.read_text(encoding="utf-8").splitlines() if l}


def decide(prev: dict, cur: dict, prev_in: dict, cur_in: dict, refs_conv, refs_in) -> dict:
    def cmp(a, b, refs, metric):
        ref = [refs[u] for u in a["uids"]]
        if metric == "comet":
            if "comet_per_sentence" not in a or "comet_per_sentence" not in b:
                return None
            return compare_mt(None, None, ref, "comet", a["comet_per_sentence"], b["comet_per_sentence"])
        return compare_mt(a["hyps"], b["hyps"], ref, metric)

    conv = {m: cmp(prev, cur, refs_conv, m) for m in ("chrf++", "comet")}
    indom = {m: cmp(prev_in, cur_in, refs_in, m) for m in ("chrf++", "comet")}
    improves = any(r and r["significant"] and r["delta"] > 0 for r in conv.values())
    hurts = any(r and r["ci"][1] < 0 for r in indom.values())
    return {"conv": conv, "indomain": indom, "keep": bool(improves and not hurts)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="mt_bartpho.yaml")
    ap.add_argument("--models_root", required=True)
    ap.add_argument("--out", default="docs/ablations.md")
    args = ap.parse_args()
    cfg = load_config(args.config)
    root = resolve_path(args.models_root)
    vc, vi = cfg["corpus"]["val_conv"], cfg["corpus"]["val_indomain"]
    refs_c, refs_i = _refs(cfg, vc), _refs(cfg, vi)
    lines = [f"\n## MT ablation — {cfg['model']['name']}\n",
             f"Val hội thoại: `{vc}`; val in-domain: `{vi}`. CI 95% bootstrap (1000 mẫu).\n",
             "| Run | Dữ liệu | Stage | chrF++ conv | COMET conv | chrF++ in-dom | COMET in-dom | Δ chrF++ conv vs run trước (CI) | Giữ? |",
             "|---|---|---|---|---|---|---|---|---|"]
    kept_chain = None
    for run in ORDER:
        c, i = _load(root, run, vc), _load(root, run, vi)
        if not c or not i:
            lines.append(f"| {run} | {cfg['runs'].get(run, {}).get('sources')} | — | _chưa chạy_ | | | | | |")
            continue
        fmt = lambda d, k: f"{d[k]:.2f} [{d[k + '_ci'][0]:.2f},{d[k + '_ci'][1]:.2f}]" if k in d else "—"
        delta, keep = "—", "baseline"
        # so sánh với run được giữ gần nhất trong chuỗi M3→M6 (M1, M2 là baseline độc lập)
        if run in ("M4", "M5", "M6") and kept_chain:
            pc, pi = kept_chain
            d = decide(pc, c, pi, i, refs_c, refs_i)
            r = d["conv"]["chrf++"]
            delta = f"{r['delta']:+.2f} [{r['ci'][0]:+.2f},{r['ci'][1]:+.2f}]"
            keep = "✅" if d["keep"] else "❌"
            if d["keep"]:
                kept_chain = (c, i)
        elif run == "M3":
            kept_chain = (c, i)
            m1c = _load(root, "M1", vc)
            if m1c:
                r = compare_mt(m1c["hyps"], c["hyps"], [refs_c[u] for u in c["uids"]], "chrf++")
                delta = f"vs M1: {r['delta']:+.2f} [{r['ci'][0]:+.2f},{r['ci'][1]:+.2f}]"
        lines.append(f"| {run} | {', '.join(cfg['runs'][run]['sources'])}{' +tag' if cfg['runs'][run]['tags'] else ''} "
                     f"| {c['_stage']} | {fmt(c, 'chrf++')} | {fmt(c, 'comet')} | {fmt(i, 'chrf++')} | {fmt(i, 'comet')} "
                     f"| {delta} | {keep} |")
    out = resolve_path(args.out)
    old = out.read_text(encoding="utf-8") if out.exists() else "# Ablations\n"
    out.write_text(old.rstrip() + "\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
