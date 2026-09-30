"""Export model cho serving (Phase 5.2).

    python -m src.serve.export asr-onnx --model outputs/asr_w2vbert/best --check_split cuong06_val
    python -m src.serve.export mt-ct2  --model outputs/mt_bartpho/M6/stage2/best

ASR: ONNX + quantize int8 động; kiểm tra WER không tăng > 0.5 điểm so với PyTorch (greedy, trên val).
MT : CTranslate2 int8.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys

import numpy as np

from src.utils import get_logger, load_config, resolve_path

log = get_logger("serve.export")


def export_asr_onnx(model_dir, out_dir) -> tuple:
    import torch
    from transformers import AutoFeatureExtractor, AutoModelForCTC

    out_dir.mkdir(parents=True, exist_ok=True)
    model = AutoModelForCTC.from_pretrained(str(model_dir)).eval()
    fe = AutoFeatureExtractor.from_pretrained(str(model_dir))
    dummy = fe(np.random.randn(16000 * 3).astype(np.float32) * 0.1, sampling_rate=16000, return_tensors="pt",
               return_attention_mask=True)
    in_key = "input_features" if "input_features" in dummy else "input_values"
    names = [in_key, "attention_mask"]
    fp32 = out_dir / "asr_fp32.onnx"

    class Wrap(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, x, mask):
            return self.m(**{in_key: x, "attention_mask": mask}).logits

    torch.onnx.export(Wrap(model), (dummy[in_key], dummy["attention_mask"]), str(fp32), input_names=names,
                      output_names=["logits"], opset_version=17,
                      dynamic_axes={in_key: {0: "b", 1: "t"}, "attention_mask": {0: "b", 1: "t"},
                                    "logits": {0: "b", 1: "t"}})
    from onnxruntime.quantization import QuantType, quantize_dynamic

    int8 = out_dir / "asr_int8.onnx"
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8)
    log.info("ONNX: %s, %s", fp32, int8)
    return fp32, int8


def check_asr(model_dir, onnx_path, split: str, n: int = 300) -> dict:
    from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
    from src.asr.decode import ASRModel
    from src.eval.asr_metrics import wer_cer
    from src.serve.runtime import ONNXASRModel

    acfg = load_config("asr_w2vbert.yaml")
    ds = build_hf_dataset(load_split_df(split, load_config(acfg["data_config"])), acfg["data"]["raw_dir"],
                          max_samples=n)
    pt, ox = ASRModel(model_dir, device="cpu"), ONNXASRModel(onnx_path, model_dir)
    refs, h_pt, h_ox = [], [], []
    for r in ds:
        w = decode_audio(r["audio"])
        refs.append(r["text"])
        h_pt.append(pt.greedy(pt.logits(w)))
        h_ox.append(ox.greedy(ox.logits(w)))
    a, b = wer_cer(refs, h_pt), wer_cer(refs, h_ox)
    res = {"torch": a, "onnx_int8": b, "wer_increase_points": 100 * (b["wer"] - a["wer"])}
    res["ok"] = res["wer_increase_points"] <= 0.5
    return res


def export_mt_ct2(model_dir, out_dir, quantization: str = "int8") -> None:
    cmd = [sys.executable, "-m", "ctranslate2.converters.transformers", "--model", str(model_dir),
           "--output_dir", str(out_dir), "--quantization", quantization, "--force"]
    subprocess.run(cmd, check=True)
    log.info("CTranslate2: %s", out_dir)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["asr-onnx", "mt-ct2"])
    ap.add_argument("--model", required=True)
    ap.add_argument("--out_dir", default="outputs/serve")
    ap.add_argument("--check_split", default=None)
    args = ap.parse_args()
    model_dir, out_dir = resolve_path(args.model), resolve_path(args.out_dir)
    if args.cmd == "asr-onnx":
        _, int8 = export_asr_onnx(model_dir, out_dir)
        if args.check_split:
            res = check_asr(model_dir, int8, args.check_split)
            (out_dir / "asr_onnx_check.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
            log.info("WER torch=%.4f onnx=%.4f (+%.2f điểm) %s", res["torch"]["wer"], res["onnx_int8"]["wer"],
                     res["wer_increase_points"], "OK" if res["ok"] else "VƯỢT NGƯỠNG 0.5")
    else:
        export_mt_ct2(model_dir, out_dir / "mt_ct2_int8")
        (out_dir / "mt_ct2_int8" / "hf_dir.txt").write_text(str(model_dir), encoding="utf-8")


if __name__ == "__main__":
    main()
