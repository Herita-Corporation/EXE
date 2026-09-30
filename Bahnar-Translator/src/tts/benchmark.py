"""Benchmark TTS tiếng Việt (Phase 4) — tự đo trên máy deploy, không tin số trong README.

    python -m src.tts.benchmark testset                 # tạo bộ 200 câu (100 MT + 100 du lịch)
    python -m src.tts.benchmark run --engines vieneu_int8 mms_vie
    python -m src.tts.benchmark report                  # docs/tts_benchmark.md + phiếu MOS nghe mù

Thứ tự chọn: CER round-trip ≤ 5% → tỷ lệ lỗi < 1% → MOS cao nhất → RTF CPU < 0.5.
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
import soundfile as sf

from src.eval.bootstrap import mean_ci, rate_ci
from src.eval.tts_metrics import RoundTripASR, edit_ops, norm_vi_for_cer, stability_flags, utmos
from src.text.vi_normalizer import normalize_vi
from src.tts.base import build_tts
from src.utils import get_logger, load_config, resolve_path

log = get_logger("tts.benchmark")
HAS_SPECIAL = r"\d|km|kg|°C|%|đ\b|VND|USD|h\d|UBND|SĐT|TP\."


def make_testset(cfg: dict) -> Path:
    tc = cfg["testset"]
    tour = pd.read_csv(resolve_path(tc["tourism_prompts"]))
    special = tour[tour.vi.str.contains(HAS_SPECIAL, regex=True)]
    rest = tour.drop(special.index).sample(frac=1, random_state=cfg["seed"])
    tour_sel = pd.concat([special, rest]).head(tc["n_tourism"])
    rows = [{"id": r.id, "kind": "tourism", "text": r.vi} for r in tour_sel.itertuples()]
    if tc.get("mt_hyps") and resolve_path(tc["mt_hyps"]).exists():
        hyps = json.loads(resolve_path(tc["mt_hyps"]).read_text(encoding="utf-8"))["hyps"]
        hyps = [h for h in hyps if 3 <= len(h.split()) <= 40]
        random.Random(cfg["seed"]).shuffle(hyps)
        rows += [{"id": f"MT{i:03d}", "kind": "mt_output", "text": h} for i, h in enumerate(hyps[: tc["n_mt"]])]
    else:
        log.warning("Chưa có output MT thật (testset.mt_hyps) → bộ test chỉ có %d câu du lịch. "
                    "Chạy lại sau Phase 2.", len(rows))
    df = pd.DataFrame(rows)
    df["has_number"] = df.text.str.contains(r"\d", regex=True)
    df["text_norm"] = df.text.map(normalize_vi)
    out = resolve_path(tc["file"])
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False, encoding="utf-8")
    log.info("Bộ test TTS: %d câu (%d có số) -> %s", len(df), int(df.has_number.sum()), out)
    return out


def run_engine(name: str, ecfg: dict, df: pd.DataFrame, out_dir: Path) -> pd.DataFrame:
    tts = build_tts(ecfg)
    d = out_dir / name
    d.mkdir(parents=True, exist_ok=True)
    tts.synthesize("Xin chào.")  # warm-up, không tính giờ
    rows = []
    for r in df.itertuples():
        t0 = time.perf_counter()
        ttfa = None
        if hasattr(tts, "synthesize_stream"):
            chunks = []
            for ch in tts.synthesize_stream(r.text_norm):
                if ttfa is None:
                    ttfa = time.perf_counter() - t0
                chunks.append(ch)
            wav = np.concatenate(chunks) if chunks else np.zeros(1, np.float32)
        else:
            wav = tts.synthesize(r.text_norm)
        el = time.perf_counter() - t0
        sf.write(d / f"{r.id}.wav", wav, tts.sample_rate)
        dur = len(wav) / tts.sample_rate
        rows.append({"id": r.id, "engine": name, "sr": tts.sample_rate, "synth_sec": el, "audio_sec": dur,
                     "rtf": el / dur if dur > 0 else float("inf"), "ttfa_sec": ttfa if ttfa is not None else el})
    res = pd.DataFrame(rows)
    res.to_csv(d / "timing.csv", index=False)
    return res


def score_engine(name: str, df: pd.DataFrame, out_dir: Path, mcfg: dict, asr: RoundTripASR) -> pd.DataFrame:
    d = out_dir / name
    timing = pd.read_csv(d / "timing.csv").set_index("id")
    rows = []
    for r in df.itertuples():
        wav, sr = sf.read(d / f"{r.id}.wav", dtype="float32")
        hyp = asr(wav, sr)
        ref_n, hyp_n = norm_vi_for_cer(r.text_norm), norm_vi_for_cer(hyp)
        ops = edit_ops(ref_n, hyp_n)
        flags = stability_flags(wav, sr, r.text_norm, ops, mcfg)
        row = {"id": r.id, "kind": r.kind, "has_number": r.has_number, "hyp": hyp,
               "char_err": ops["replace"] + ops["delete"] + ops["insert"], "char_len": ops["len"], **flags,
               **timing.loc[r.id].to_dict()}
        if mcfg.get("utmos"):
            row["utmos"] = utmos(wav, sr)
        rows.append(row)
    s = pd.DataFrame(rows)
    s.to_csv(d / "scores.csv", index=False, encoding="utf-8")
    return s


def summarize(s: pd.DataFrame) -> dict:
    cer = rate_ci(s.char_err, s.char_len)
    num = s[s.has_number]
    out = {"n": len(s), "cer": cer[0], "cer_ci": cer[1:], "failure_rate": float(s.failure.mean()),
           "silent": int(s.silent.sum()), "skip": int(s.get("skip", pd.Series(False)).sum()),
           "repeat": int(s.get("repeat", pd.Series(False)).sum()), "abnormal_length": int(s.abnormal_length.sum()),
           "rtf_mean": float(s.rtf.mean()), "rtf_p95": float(s.rtf.quantile(0.95)),
           "ttfa_p50": float(s.ttfa_sec.median()), "ttfa_p95": float(s.ttfa_sec.quantile(0.95))}
    if len(num):
        out["cer_numbers"] = float(num.char_err.sum() / max(num.char_len.sum(), 1))
    if "utmos" in s:
        out["utmos"], *out["utmos_ci"] = mean_ci(s.utmos)
    return out


def mos_sheets(df: pd.DataFrame, engines: list[str], out_dir: Path, n_listeners: int = 5, n_sent: int = 20,
               seed: int = 0) -> Path:
    """Phiếu MOS nghe mù: mỗi người nghe n_sent câu × mọi engine, thứ tự xáo trộn, tên file ẩn danh."""
    rng = random.Random(seed)
    ids = rng.sample(list(df.id), min(n_sent, len(df)))
    key, sheets = [], []
    for li in range(n_listeners):
        items = [(i, e) for i in ids for e in engines]
        rng.shuffle(items)
        for k, (i, e) in enumerate(items):
            code = f"L{li + 1}_{k:03d}"
            key.append({"code": code, "id": i, "engine": e, "path": str(out_dir / e / f"{i}.wav")})
            sheets.append({"listener": li + 1, "code": code, "score_1_to_5": ""})
    mos = out_dir / "mos"
    mos.mkdir(exist_ok=True)
    pd.DataFrame(key).to_csv(mos / "answer_key_DO_NOT_SHARE.csv", index=False)
    pd.DataFrame(sheets).to_csv(mos / "listening_sheet.csv", index=False)
    return mos


def pick(summ: dict, dcfg: dict) -> list[tuple[str, str]]:
    ranked = []
    for e, s in summ.items():
        ok_cer = s["cer"] <= dcfg["cer_max"]
        ok_fail = s["failure_rate"] < dcfg["failure_rate_max"]
        ranked.append((not ok_cer, not ok_fail, -(s.get("mos") or s.get("utmos") or 0), s["rtf_mean"], e))
    ranked.sort()
    return [(r[-1], "đạt" if not r[0] and not r[1] else "không đạt ngưỡng") for r in ranked]


def write_report(cfg: dict, summ: dict, df: pd.DataFrame) -> None:
    lines = ["# Benchmark TTS tiếng Việt (Phase 4)\n",
             f"Bộ test: {len(df)} câu ({int((df.kind == 'mt_output').sum())} output MT thật, "
             f"{int((df.kind == 'tourism').sum())} câu du lịch; {int(df.has_number.sum())} câu có số). "
             "Văn bản qua `vi_normalizer` trước mọi engine. Số đo trên máy chạy benchmark (không lấy từ README).\n",
             "| Engine | CER round-trip [CI] | CER câu có số | Lỗi (%) | câm/bỏ/lặp/độ dài | UTMOS | RTF mean/p95 | TTFA p50/p95 (s) |",
             "|---|---|---|---|---|---|---|---|"]
    for e, s in summ.items():
        lines.append(f"| {e} | {s['cer']:.3f} [{s['cer_ci'][0]:.3f},{s['cer_ci'][1]:.3f}] | {s.get('cer_numbers', float('nan')):.3f} "
                     f"| {100 * s['failure_rate']:.1f} | {s['silent']}/{s['skip']}/{s['repeat']}/{s['abnormal_length']} "
                     f"| {s.get('utmos', float('nan')):.2f} | {s['rtf_mean']:.2f}/{s['rtf_p95']:.2f} "
                     f"| {s['ttfa_p50']:.2f}/{s['ttfa_p95']:.2f} |")
    lines += ["\nMOS nghe mù (5 người × 20 câu): điền `outputs/tts_benchmark/mos/listening_sheet.csv`, "
              "rồi chạy `python -m src.tts.benchmark mos` để cập nhật cột MOS.\n",
              "## Xếp hạng theo quy tắc quyết định\n"]
    for e, st in pick(summ, cfg["decision"]):
        lines.append(f"1. **{e}** — {st}")
    lines.append(f"\nMẫu audio: `{cfg['out_dir']}/<engine>/<id>.wav`.")
    p = resolve_path(cfg["report"])
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["testset", "run", "report", "mos"])
    ap.add_argument("--config", default="tts_benchmark.yaml")
    ap.add_argument("--engines", nargs="*", default=None)
    args = ap.parse_args()
    cfg = load_config(args.config)
    out_dir = resolve_path(cfg["out_dir"])
    engines = args.engines or list(cfg["engines"])
    if args.cmd == "testset":
        make_testset(cfg)
        return
    df = pd.read_csv(resolve_path(cfg["testset"]["file"]))
    if args.cmd == "run":
        for e in engines:
            log.info("== %s", e)
            run_engine(e, cfg["engines"][e], df, out_dir)
        asr = RoundTripASR(cfg["metrics"]["asr_model"])
        for e in engines:
            score_engine(e, df, out_dir, cfg["metrics"], asr)
        mos_sheets(df, engines, out_dir, seed=cfg["seed"])
    summ = {}
    for e in engines:
        p = out_dir / e / "scores.csv"
        if p.exists():
            summ[e] = summarize(pd.read_csv(p))
    if args.cmd == "mos":
        key = pd.read_csv(out_dir / "mos" / "answer_key_DO_NOT_SHARE.csv")
        sheet = pd.read_csv(out_dir / "mos" / "listening_sheet.csv").merge(key, on="code")
        sheet = sheet[pd.to_numeric(sheet.score_1_to_5, errors="coerce").notna()]
        for e, g in sheet.groupby("engine"):
            if e in summ:
                summ[e]["mos"], *summ[e]["mos_ci"] = mean_ci(g.score_1_to_5.astype(float))
    (out_dir / "summary.json").write_text(json.dumps(summ, indent=1, default=float), encoding="utf-8")
    write_report(cfg, summ, df)


if __name__ == "__main__":
    main()
