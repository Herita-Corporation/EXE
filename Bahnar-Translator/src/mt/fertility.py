"""Đo tokenizer fertility trên text Ba Na của từng nguồn (Phase 2.2).

    python -m src.mt.fertility --configs mt_bartpho.yaml mt_nllb.yaml
"""
from __future__ import annotations

import argparse
import json

import pandas as pd

from src.mt.modeling import fertility, load_tokenizer
from src.utils import get_logger, load_config, resolve_path

log = get_logger("mt.fertility")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--configs", nargs="+", default=["mt_bartpho.yaml", "mt_nllb.yaml"])
    ap.add_argument("--n", type=int, default=5000)
    ap.add_argument("--out", default="docs/fertility.json")
    args = ap.parse_args()
    res = {}
    for c in args.configs:
        cfg = load_config(c)
        data_cfg = load_config(cfg["data_config"])
        sp = resolve_path(data_cfg["paths"]["splits"])
        tok = load_tokenizer(cfg)
        res[cfg["model"]["name"]] = {}
        for name in ("cuong06_train", "eaai24_train"):
            p = sp / f"{name}.jsonl"
            if not p.exists():
                continue
            df = pd.read_json(p, lines=True).sample(frac=1, random_state=0).head(args.n)
            res[cfg["model"]["name"]][name] = {
                "bahnar": fertility(tok, df.ba), "vietnamese": fertility(tok, df.vi)}
            f = res[cfg["model"]["name"]][name]
            log.info("%s | %s: Ba Na fert=%.2f unk=%.4f | Việt fert=%.2f unk=%.4f", cfg["model"]["name"], name,
                     f["bahnar"]["fertility"], f["bahnar"]["unk_rate"], f["vietnamese"]["fertility"],
                     f["vietnamese"]["unk_rate"])
    out = resolve_path(args.out)
    out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
