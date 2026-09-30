"""Decode ASR: greedy / beam + KenLM (pyctcdecode) + hotword, confidence mỗi câu, tune alpha/beta/λ trên val.

    # 1) cache logits cho val + test
    python -m src.asr.decode logits --model outputs/asr_w2vbert/best --splits cuong06_val test_book test_radio test_source
    # 2) tune alpha/beta (và chọn LM) trên val — KHÔNG trên test
    python -m src.asr.decode tune --model outputs/asr_w2vbert/best --lms LM_cuong LM_mix_l10 LM_mix_l20
    # 3) đánh giá (ablation greedy → +LM_cuong → +LM nội suy), ghi docs/ablations.md & results.md
    python -m src.asr.decode eval --model outputs/asr_w2vbert/best
"""
from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path

import numpy as np

from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.asr.augment import rms_normalize
from src.eval.asr_metrics import asr_report, compare_asr, top_errors, wer_cer
from src.utils import get_logger, git_commit, load_config, resolve_path

log = get_logger("asr.decode")


class ASRModel:
    """Bọc model CTC + processor; dùng chung cho decode offline và pipeline online."""

    def __init__(self, model_dir: str | Path, device: str | None = None, target_lang: str | None = None):
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        kw = {"target_lang": target_lang} if target_lang else {}
        self.processor = AutoProcessor.from_pretrained(str(model_dir), **kw)
        if target_lang:  # MMS: chọn adapter + vocab của ngôn ngữ
            self.processor.tokenizer.set_target_lang(target_lang)
            self.model = AutoModelForCTC.from_pretrained(str(model_dir), target_lang=target_lang,
                                                         ignore_mismatched_sizes=True)
        else:
            self.model = AutoModelForCTC.from_pretrained(str(model_dir))
        self.model = self.model.to(self.device).eval()
        vocab = self.processor.tokenizer.get_vocab()
        self.labels = [t for t, _ in sorted(vocab.items(), key=lambda kv: kv[1])]
        self.blank_id = self.processor.tokenizer.pad_token_id

    def logits(self, wave: np.ndarray) -> np.ndarray:
        import torch

        feats = self.processor.feature_extractor(rms_normalize(wave), sampling_rate=16000, return_tensors="pt")
        feats = {k: v.to(self.device) for k, v in feats.items()}
        with torch.inference_mode():
            out = self.model(**feats).logits[0].float()
        return torch.log_softmax(out, dim=-1).cpu().numpy()

    def greedy(self, logp: np.ndarray) -> str:
        return self.processor.tokenizer.decode(logp.argmax(-1))


def greedy_confidence(logp: np.ndarray, blank_id: int) -> float:
    """Trung bình xác suất max trên các frame không phải blank (0..1)."""
    best = logp.argmax(-1)
    keep = best != blank_id
    if not keep.any():
        return 0.0
    return float(np.exp(logp.max(-1)[keep]).mean())


def build_decoder(labels: list[str], blank_label: str, lm_path: str | None, unigrams: list[str] | None,
                  alpha: float, beta: float):
    from pyctcdecode import build_ctcdecoder

    labs = ["" if l == blank_label else (" " if l == "|" else l) for l in labels]
    # token đặc biệt không bao giờ được sinh: thay bằng ký tự riêng để pyctcdecode không gộp nhầm
    labs = [f"⁇{i}" if l in ("<s>", "</s>", "<unk>") else l for i, l in enumerate(labs)]
    return build_ctcdecoder(labs, kenlm_model_path=lm_path, unigrams=unigrams, alpha=alpha, beta=beta)


def beam_decode(decoder, logp: np.ndarray, beam: int, hotwords: list[str] | None = None,
                hotword_weight: float = 8.0) -> tuple[str, float]:
    beams = decoder.decode_beams(logp, beam_width=beam, hotwords=hotwords, hotword_weight=hotword_weight)
    text, _, _, logit_score, lm_score = beams[0][:5]
    # confidence: xác suất trung bình theo frame của beam tốt nhất (acoustic)
    conf = float(np.exp(logit_score / max(len(logp), 1)))
    return text.replace("⁇", "").strip(), conf


# ------------------------------------------------------------------ cache logits
def cache_logits(model: ASRModel, split: str, data_cfg: dict, raw_dir: str, out_dir: Path) -> Path:
    from src.data.export_audio import split_audio_file

    df = load_split_df(split, data_cfg)
    ds = build_hf_dataset(df, raw_dir, audio_parquet=split_audio_file(split, data_cfg))
    out = out_dir / f"{split}.npz"
    arrs, uids, refs = {}, [], []
    for r in ds:
        arrs[r["uid"]] = model.logits(decode_audio(r["audio"])).astype(np.float16)
        uids.append(r["uid"])
        refs.append(r["text"])
    np.savez_compressed(out, **arrs)
    (out_dir / f"{split}.refs.json").write_text(json.dumps({"uids": uids, "refs": refs}, ensure_ascii=False),
                                                encoding="utf-8")
    return out


def load_cached(out_dir: Path, split: str):
    meta = json.loads((out_dir / f"{split}.refs.json").read_text(encoding="utf-8"))
    z = np.load(out_dir / f"{split}.npz")
    return meta["uids"], meta["refs"], [z[u].astype(np.float32) for u in meta["uids"]]


def decode_split(labels, blank, logps, lm_path, unigrams, alpha, beta, beam, hotwords, hw):
    dec = build_decoder(labels, blank, lm_path, unigrams, alpha, beta)
    res = [beam_decode(dec, lp, beam, hotwords, hw) for lp in logps]
    return [r[0] for r in res], [r[1] for r in res]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["logits", "tune", "eval"])
    ap.add_argument("--model", required=True)
    ap.add_argument("--asr_config", default="asr_w2vbert.yaml")
    ap.add_argument("--lm_config", default="lm.yaml")
    ap.add_argument("--splits", nargs="*", default=None)
    ap.add_argument("--lms", nargs="*", default=["LM_cuong"])
    ap.add_argument("--n_boot", type=int, default=1000)
    ap.add_argument("--tune_max_n", type=int, default=None, help="tune α/β trên tối đa N câu val (nhanh hơn)")
    ap.add_argument("--alpha_grid", type=float, nargs="*", default=None)
    ap.add_argument("--beta_grid", type=float, nargs="*", default=None)
    ap.add_argument("--beam", type=int, default=None)
    args = ap.parse_args()
    acfg, lcfg = load_config(args.asr_config), load_config(args.lm_config)
    data_cfg = load_config(acfg["data_config"])
    cache = resolve_path(args.model) / "logits_cache"
    cache.mkdir(parents=True, exist_ok=True)
    lm_dir = resolve_path(lcfg["out_dir"])
    dcfg = lcfg["decode"]
    tune_split = dcfg["tune_split"]
    splits = args.splits or [tune_split] + acfg["data"]["test_splits"]

    if args.alpha_grid:
        dcfg["alpha_grid"] = args.alpha_grid
    if args.beta_grid:
        dcfg["beta_grid"] = args.beta_grid
    if args.beam:
        dcfg["beam_width"] = args.beam
    # logits cần model (GPU); tune/eval chỉ cần tokenizer → chạy được trên máy CPU với logits đã lưu.
    if args.cmd == "logits":
        model = ASRModel(args.model)
        tokenizer = model.processor.tokenizer
    else:
        from transformers import AutoProcessor

        model = None
        tokenizer = AutoProcessor.from_pretrained(str(resolve_path(args.model))).tokenizer
    labels = [t for t, _ in sorted(tokenizer.get_vocab().items(), key=lambda kv: kv[1])]
    blank = tokenizer.pad_token
    unigrams = (lm_dir / "unigrams.txt").read_text(encoding="utf-8").split() if (lm_dir / "unigrams.txt").exists() else None
    hw_file = resolve_path(dcfg["hotwords_file"])
    hotwords = [l.strip() for l in hw_file.read_text(encoding="utf-8").splitlines() if l.strip()] if hw_file.exists() else None

    if args.cmd == "logits":
        for s in splits:
            cache_logits(model, s, data_cfg, acfg["data"]["raw_dir"], cache)
        return

    best_path = cache / "best_decode.json"
    if args.cmd == "tune":
        _, refs, logps = load_cached(cache, tune_split)
        if args.tune_max_n and len(refs) > args.tune_max_n:
            idx = np.random.default_rng(0).choice(len(refs), args.tune_max_n, replace=False)
            refs, logps = [refs[i] for i in idx], [logps[i] for i in idx]
        log.info("Tune trên %d câu %s, %d LM × %d α × %d β", len(refs), tune_split, len(args.lms),
                 len(dcfg["alpha_grid"]), len(dcfg["beta_grid"]))
        results = []
        for lm in args.lms:
            lm_path = str(lm_dir / f"{lm}.bin")
            for a, b in itertools.product(dcfg["alpha_grid"], dcfg["beta_grid"]):
                hyps, _ = decode_split(labels, blank, logps, lm_path, unigrams, a, b, dcfg["beam_width"],
                                       hotwords, dcfg["hotword_weight"])
                r = wer_cer(refs, hyps)
                results.append({"lm": lm, "alpha": a, "beta": b, **r})
                log.info("%s α=%.2f β=%.2f WER=%.4f", lm, a, b, r["wer"])
        best_per_lm = {}
        for r in results:
            if r["lm"] not in best_per_lm or r["wer"] < best_per_lm[r["lm"]]["wer"]:
                best_per_lm[r["lm"]] = r
        best_path.write_text(json.dumps({"tuned_on": tune_split, "best_per_lm": best_per_lm, "grid": results},
                                        indent=1), encoding="utf-8")
        return

    # eval: greedy → từng LM với alpha/beta đã tune trên val
    tuned = json.loads(best_path.read_text(encoding="utf-8"))["best_per_lm"] if best_path.exists() else {}
    report = {"model": args.model, "commit": git_commit(), "tuned_on": tune_split, "rows": []}
    for s in splits:
        uids, refs, logps = load_cached(cache, s)
        systems = {"greedy": ([tokenizer.decode(lp.argmax(-1)) for lp in logps],
                              [greedy_confidence(lp, tokenizer.pad_token_id) for lp in logps])}
        for lm, t in tuned.items():
            systems[f"+{lm}"] = decode_split(labels, blank, logps, str(lm_dir / f"{lm}.bin"), unigrams, t["alpha"],
                                             t["beta"], dcfg["beam_width"], hotwords, dcfg["hotword_weight"])
        base_hyps = systems["greedy"][0]
        for name, (hyps, confs) in systems.items():
            r = asr_report(refs, hyps, n_boot=args.n_boot)
            r.update({"split": s, "system": name, "mean_conf": float(np.mean(confs))})
            if name != "greedy":
                r["vs_greedy"] = compare_asr(refs, base_hyps, hyps, n_boot=args.n_boot)
            report["rows"].append(r)
            out = cache / f"{s}.{name.strip('+')}.hyp.jsonl"
            with open(out, "w", encoding="utf-8") as f:
                for u, ref, h, c in zip(uids, refs, hyps, confs):
                    f.write(json.dumps({"uid": u, "ref": ref, "hyp": h, "conf": c}, ensure_ascii=False) + "\n")
            if name == list(systems)[-1]:
                report.setdefault("top_errors", {})[s] = top_errors(refs, hyps, 50)
    (cache / "eval_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in report["rows"]:
        print(f"{r['split']:12s} {r['system']:16s} WER={r['wer']:.4f} [{r['wer_ci'][0]:.4f},{r['wer_ci'][1]:.4f}] "
              f"CER={r['cer']:.4f} conf={r['mean_conf']:.3f}")


if __name__ == "__main__":
    main()
