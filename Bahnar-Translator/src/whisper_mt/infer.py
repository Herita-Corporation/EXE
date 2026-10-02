"""Suy luận + đánh giá Whisper đa nhiệm trên ĐÚNG test set của kiến trúc A, có chặn hallucination.

    python -m src.whisper_mt.infer --model outputs/whisper_multitask/best --splits test_book test_radio
"""
from __future__ import annotations

import argparse
import json
import zlib

import numpy as np

from src.asr.augment import rms_normalize
from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.eval.asr_metrics import asr_report
from src.eval.mt_metrics import mt_report
from src.utils import get_logger, load_config, resolve_path

log = get_logger("whisper.infer")


def compression_ratio(text: str) -> float:
    b = text.encode("utf-8")
    return len(b) / max(len(zlib.compress(b)), 1)


class WhisperMT:
    def __init__(self, model_dir, gen_cfg: dict, device: str | None = None):
        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = WhisperProcessor.from_pretrained(str(model_dir))
        self.model = WhisperForConditionalGeneration.from_pretrained(str(model_dir)).to(self.device).eval()
        self.g = gen_cfg

    def run(self, wave: np.ndarray, lang_tok: str) -> dict:
        import torch

        if len(wave) > 30 * 16000:
            raise ValueError("Audio > 30s: Whisper sẽ cắt cụt — cắt đoạn bằng VAD trước")
        tok = self.processor.tokenizer
        feats = self.processor.feature_extractor(rms_normalize(wave), sampling_rate=16000, return_tensors="pt")
        prompt = tok.convert_tokens_to_ids(["<|startoftranscript|>", lang_tok, "<|transcribe|>", "<|notimestamps|>"])
        with torch.inference_mode():
            out = self.model.generate(
                input_features=feats.input_features.to(self.device, self.model.dtype),
                decoder_input_ids=torch.tensor([prompt], device=self.device), num_beams=self.g["num_beams"],
                no_repeat_ngram_size=self.g["no_repeat_ngram_size"], max_new_tokens=self.g["max_new_tokens"],
                output_scores=True, return_dict_in_generate=True)
        text = tok.decode(out.sequences[0], skip_special_tokens=True).strip()
        n_new = out.sequences.shape[1] - len(prompt)
        avg_lp = float(out.sequences_scores[0]) if getattr(out, "sequences_scores", None) is not None else 0.0
        cr = compression_ratio(text)
        suspicious = cr > self.g["compression_ratio_threshold"] or avg_lp < self.g["logprob_threshold"]
        return {"text": "" if suspicious else text, "raw": text, "avg_logprob": avg_lp, "compression_ratio": cr,
                "suspicious": suspicious, "n_tokens": int(n_new)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", default="whisper_multitask.yaml")
    ap.add_argument("--splits", nargs="+", default=None)
    ap.add_argument("--no_comet", action="store_true")
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg, acfg = load_config(cfg["data_config"]), load_config(cfg["asr_config"])
    splits = args.splits or acfg["data"]["test_splits"]
    m = WhisperMT(resolve_path(args.model), cfg["generate"])
    report = {}
    for s in splits:
        df = load_split_df(s, data_cfg)
        df = df[df.duration <= 30]
        from src.data.export_audio import split_audio_file

        ds = build_hf_dataset(df, acfg["data"]["raw_dir"], audio_parquet=split_audio_file(s, data_cfg))
        vi_ref = dict(zip(df.uid, df.vi))
        refs_b, hyps_b, refs_v, hyps_v, n_susp = [], [], [], [], 0
        for r in ds:
            w = decode_audio(r["audio"])
            b, v = m.run(w, cfg["model"]["new_lang_token"]), m.run(w, "<|vi|>")
            n_susp += int(b["suspicious"]) + int(v["suspicious"])
            refs_b.append(r["text"]), hyps_b.append(b["text"])
            refs_v.append(vi_ref[r["uid"]]), hyps_v.append(v["text"])
        report[s] = {"asr": asr_report(refs_b, hyps_b),
                     "st": {k: v for k, v in mt_report(hyps_b, hyps_v, refs_v, with_comet=not args.no_comet).items()
                            if k != "comet_per_sentence"},
                     "suspicious_frac": n_susp / max(2 * len(refs_b), 1), "hyps_vi": hyps_v}
        log.info("%s: WER=%.4f chrF++=%.2f", s, report[s]["asr"]["wer"], report[s]["st"]["chrf++"])
    out = resolve_path(args.model) / "eval_whisper.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
