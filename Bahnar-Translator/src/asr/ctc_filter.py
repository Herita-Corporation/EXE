"""Vòng 2 lọc align (Phase 0.4): tính CTC loss/ký tự của từng câu train bằng model Phase 1,
ghi id có loss cao bất thường (> percentile) → `data.exclude_ids_file` rồi train lại.

    python -m src.asr.ctc_filter --model outputs/asr_w2vbert/best --percentile 98
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import torch

from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.asr.decode import ASRModel
from src.utils import get_logger, load_config, resolve_path

log = get_logger("asr.ctc_filter")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", default="asr_w2vbert.yaml")
    ap.add_argument("--percentile", type=float, default=98.0)
    ap.add_argument("--out", default="data/processed/asr/high_ctc_loss_ids.txt")
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg = load_config(cfg["data_config"])
    m = ASRModel(args.model)
    tok = m.processor.tokenizer
    ds = build_hf_dataset(load_split_df(cfg["data"]["train_split"], data_cfg), cfg["data"]["raw_dir"])
    uids, losses = [], []
    for r in ds:
        logp = torch.from_numpy(m.logits(decode_audio(r["audio"])))
        target = torch.tensor(tok(r["text"]).input_ids)
        if len(target) == 0:
            continue
        loss = torch.nn.functional.ctc_loss(logp[:, None, :], target[None], torch.tensor([logp.shape[0]]),
                                            torch.tensor([len(target)]), blank=m.blank_id, reduction="sum",
                                            zero_infinity=True)
        uids.append(r["uid"])
        losses.append(float(loss) / len(target))
    losses = np.asarray(losses)
    thr = float(np.percentile(losses, args.percentile))
    bad = [u for u, l in zip(uids, losses) if l > thr]
    out = resolve_path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(bad), encoding="utf-8")
    (out.with_suffix(".stats.json")).write_text(json.dumps({"threshold": thr, "n_bad": len(bad), "n": len(uids),
                                                            "pct": _pct(losses)}, indent=1), encoding="utf-8")
    log.info("%d/%d câu có CTC loss/ký tự > %.3f -> %s", len(bad), len(uids), thr, out)


def _pct(x):
    return {f"p{q}": float(np.percentile(x, q)) for q in (50, 90, 95, 98, 99)}


if __name__ == "__main__":
    main()
