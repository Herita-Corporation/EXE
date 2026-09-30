"""Sinh cặp (ASR_output, text_vi) để MT chịu được lỗi ASR (Phase 2.1).

Dùng checkpoint ASR SỚM (hoặc k-fold: model không thấy phần audio đang giải mã) để có lỗi thật.
    python -m src.mt.asr_noise --model outputs/asr_w2vbert/checkpoint-5000 --max_hours 100
"""
from __future__ import annotations

import argparse

from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.asr.decode import ASRModel
from src.utils import get_logger, load_config, resolve_path, write_jsonl

log = get_logger("mt.asr_noise")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", default="asr_w2vbert.yaml")
    ap.add_argument("--split", default="cuong06_train")
    ap.add_argument("--max_hours", type=float, default=100.0)
    ap.add_argument("--out", default="data/processed/mt/asr_noise.jsonl")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg = load_config(cfg["data_config"])
    df = load_split_df(args.split, data_cfg)
    df = df[df.mt_ok.fillna(False).astype(bool)].sample(frac=1, random_state=args.seed)
    df = df[df.duration.cumsum() <= args.max_hours * 3600]
    ds = build_hf_dataset(df, cfg["data"]["raw_dir"])
    meta = df.set_index("uid")
    m = ASRModel(args.model)
    rows = []
    for r in ds:
        hyp = m.greedy(m.logits(decode_audio(r["audio"])))
        mr = meta.loc[r["uid"]]
        rows.append({"uid": r["uid"], "ba": hyp, "vi": mr.vi, "dialect": mr.dialect, "domain": mr.domain,
                     "ref_ba": mr.ba})
    n = write_jsonl(resolve_path(args.out), rows)
    log.info("ASR-noise: %d cặp -> %s", n, args.out)


if __name__ == "__main__":
    main()
