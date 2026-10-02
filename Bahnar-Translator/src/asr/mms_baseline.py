"""Kiểm tra nhanh facebook/mms-1b-all (Phase 1.1): có adapter `bdq` không → zero-shot baseline.

Đã xác minh (26/09/2026): repo có `adapter.bdq.safetensors` và `vocabs/bdq.txt`; vocab bdq của MMS
chứa U+0306 như token riêng (cùng thiết kế với vocab của dự án).

    python -m src.asr.mms_baseline --splits test_book test_radio test_source --max_samples 500
"""
from __future__ import annotations

import argparse
import json

from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.eval.asr_metrics import asr_report
from src.utils import get_logger, load_config, resolve_path

log = get_logger("asr.mms")
MMS = "facebook/mms-1b-all"


def has_bdq_adapter(repo: str = MMS) -> bool:
    from huggingface_hub import HfApi

    files = {s.rfilename for s in HfApi().model_info(repo).siblings}
    return "adapter.bdq.safetensors" in files or "adapter.bdq.bin" in files


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="asr_w2vbert.yaml")
    ap.add_argument("--splits", nargs="+", default=["test_book", "test_radio", "test_source"])
    ap.add_argument("--max_samples", type=int, default=None)
    ap.add_argument("--out", default="outputs/mms_zeroshot.json")
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg = load_config(cfg["data_config"])
    if not has_bdq_adapter():
        log.error("mms-1b-all KHÔNG có adapter bdq → bỏ qua baseline MMS")
        return
    from src.asr.decode import ASRModel

    model = ASRModel(MMS, target_lang="bdq")
    report = {}
    for s in args.splits:
        from src.data.export_audio import split_audio_file

        ds = build_hf_dataset(load_split_df(s, data_cfg), cfg["data"]["raw_dir"], max_samples=args.max_samples,
                              audio_parquet=split_audio_file(s, data_cfg))
        refs, hyps = [], []
        for r in ds:
            hyps.append(model.greedy(model.logits(decode_audio(r["audio"]))))
            refs.append(r["text"])
        report[s] = asr_report(refs, hyps)
        log.info("%s: WER=%.4f CER=%.4f (n=%d)", s, report[s]["wer"], report[s]["cer"], len(refs))
    out = resolve_path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
