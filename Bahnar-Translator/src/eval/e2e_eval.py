"""Đánh giá end-to-end pipeline (Phase 5.3).

    python -m src.eval.e2e_eval --splits cuong06_val            # val: sinh scores để tune τ
    python -m src.eval.e2e_eval --splits test_book test_radio test_source tourism_test --tts

Chạy pipeline với τ = 0 (không chặn) để có đủ output, rồi mô phỏng chặn bằng τ trong config.
"""
from __future__ import annotations

import argparse
import copy
import json

import pandas as pd

from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.eval.bootstrap import mean_ci
from src.eval.mt_metrics import corpus_scores, comet_scores
from src.pipeline.s2st import BahnarS2ST, load_audio_bytes
from src.utils import get_logger, git_commit, load_config, resolve_path, write_jsonl

log = get_logger("e2e")


def iter_audio(split: str, data_cfg: dict, raw_dir: str, max_n: int | None):
    if split == "tourism_test":
        p = resolve_path(data_cfg["paths"]["tourism"]) / "tourism_eval.csv"
        df = pd.read_csv(p)
        if "use" in df:
            df = df[df["use"] == "test"]
        for r in df.head(max_n or len(df)).itertuples():
            ap = resolve_path(data_cfg["paths"]["tourism"]) / r.audio_path
            yield r.id, load_audio_bytes(ap.read_bytes()), r.vi, getattr(r, "ba", "")
        return
    df = load_split_df(split, data_cfg)
    from src.data.export_audio import split_audio_file

    ds = build_hf_dataset(df, raw_dir, max_samples=max_n, audio_parquet=split_audio_file(split, data_cfg))
    vi = dict(zip(df.uid, df.vi))
    for r in ds:
        yield r["uid"], decode_audio(r["audio"]), vi[r["uid"]], r["text"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="pipeline.yaml")
    ap.add_argument("--asr_config", default="asr_w2vbert.yaml")
    ap.add_argument("--splits", nargs="+", required=True)
    ap.add_argument("--max_n", type=int, default=None)
    ap.add_argument("--tts", action="store_true", help="tổng hợp giọng + ASR-chrF/ASR-BLEU qua PhoWhisper")
    ap.add_argument("--out_dir", default="outputs/e2e")
    args = ap.parse_args()
    cfg = load_config(args.config)
    acfg = load_config(args.asr_config)
    data_cfg = load_config(acfg["data_config"])
    run_cfg = copy.deepcopy(cfg)
    run_cfg["confidence"]["tau_asr"] = 0.0
    run_cfg["confidence"]["tau_mt"] = 0.0
    pipe = BahnarS2ST(run_cfg, load_tts=args.tts)
    rt = None
    if args.tts:
        from src.eval.tts_metrics import RoundTripASR

        rt = RoundTripASR("vinai/PhoWhisper-large")
    out_dir = resolve_path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {}
    for split in args.splits:
        rows = []
        for uid, wave, ref_vi, ref_ba in iter_audio(split, data_cfg, acfg["data"]["raw_dir"], args.max_n):
            res = pipe(wave, synthesize=args.tts)
            row = {"uid": uid, "ref_vi": ref_vi, "ref_ba": ref_ba, "hyp_ba": res.transcript_bdq,
                   "hyp_vi": res.translation_vi, "asr_conf": res.confidence.get("asr", 0.0),
                   "mt_conf": res.confidence.get("mt", 0.0), "audio_sec": len(wave) / 16000, **{
                       f"lat_{k}": v for k, v in res.latency_ms.items()}}
            if rt is not None and res.audio_vi:
                import io

                import soundfile as sf

                y, sr = sf.read(io.BytesIO(res.audio_vi), dtype="float32")
                row["tts_asr_vi"] = rt(y, sr)
            rows.append(row)
        df = pd.DataFrame(rows)
        if df.empty:
            continue
        df["comet"] = comet_scores(df.hyp_ba.tolist(), df.hyp_vi.tolist(), df.ref_vi.tolist())
        write_jsonl(out_dir / f"{split}.scores.jsonl", df.to_dict(orient="records"))
        s = corpus_scores(df.hyp_vi.tolist(), df.ref_vi.tolist())
        s["comet"], *s["comet_ci"] = mean_ci(df.comet)
        if "tts_asr_vi" in df:
            a = corpus_scores(df.tts_asr_vi.fillna("").tolist(), df.ref_vi.tolist())
            s["asr_bleu"], s["asr_chrf++"] = a["bleu"], a["chrf++"]
        tau = cfg["confidence"]["tau_asr"]
        rej = df.asr_conf < tau
        s["rejection_rate"] = float(rej.mean())
        s["comet_kept"] = float(df.comet[~rej].mean()) if (~rej).any() else float("nan")
        lat = df.get("lat_first_audio", df.get("lat_total"))
        s["latency_p50_ms"], s["latency_p95_ms"] = float(lat.quantile(0.5)), float(lat.quantile(0.95))
        five = df[(df.audio_sec >= 4) & (df.audio_sec <= 6)]
        if len(five):
            l5 = five.get("lat_first_audio", five.get("lat_total"))
            s["latency_p95_ms_5s"] = float(l5.quantile(0.95))
        summary[split] = s
        log.info("%s: chrF++=%.2f COMET=%.4f reject=%.2f p95=%.0fms", split, s["chrf++"], s["comet"],
                 s["rejection_rate"], s["latency_p95_ms"])
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=1, default=float), encoding="utf-8")
    append_results(summary, cfg)


def append_results(summary: dict, cfg: dict) -> None:
    p = resolve_path("docs/results.md")
    lines = []
    for split, s in summary.items():
        lines.append(f"| {pd.Timestamp.now():%Y-%m-%d} | 5 (e2e) | ASR+MT+TTS | — | {cfg['asr']['model_dir']} + "
                     f"{cfg['mt']['model_dir']} | {split} | — | — | {s['bleu']:.2f} | {s['chrf++']:.2f} | "
                     f"{s['comet']:.4f} | pipeline.yaml | {git_commit()} |")
    with open(p, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
