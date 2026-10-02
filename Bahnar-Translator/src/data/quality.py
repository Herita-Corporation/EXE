"""Heuristic lọc chất lượng + xuất mẫu spot-check (Phase 0.4)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from src.text.bahnar_normalizer import has_digit, has_non_latin, normalize_for_asr
from src.utils import get_logger, resolve_path

log = get_logger("quality")


def repeat_ngram_frac(text: str, n: int = 3) -> float:
    """Tỷ lệ n-gram từ bị lặp. Phát hiện vòng lặp ảo giác của pseudo-label ASR
    (vd ``lơi ăt jep jep pơnăn sa mă kơ`` lặp 5 lần)."""
    toks = text.split()
    if len(toks) < n * 2:
        return 0.0
    grams = [tuple(toks[i:i + n]) for i in range(len(toks) - n + 1)]
    return 1.0 - len(set(grams)) / len(grams)


def add_quality_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ba_asr"] = [normalize_for_asr(t) for t in df.ba]
    df["ba_len"] = df.ba_asr.str.len()
    df["vi_len"] = df.vi.fillna("").str.len()
    dur = df["duration"] if "duration" in df else pd.Series(np.nan, index=df.index)
    df["cps"] = df.ba_len / dur.replace(0, np.nan)
    df["len_ratio"] = df.ba_len / df.vi_len.replace(0, np.nan)
    df["repeat_frac"] = [repeat_ngram_frac(t) for t in df.ba_asr]
    df["has_digit"] = [has_digit(t) for t in df.ba_asr]
    df["non_latin"] = [has_non_latin(t) for t in df.ba_asr]
    return df


def flag_quality(df: pd.DataFrame, qcfg: dict, ref: pd.DataFrame | None = None,
                 min_dur: float = 0.5, max_dur: float = 30.0) -> pd.DataFrame:
    """Gắn cờ. Ngưỡng percentile tính trên ``ref`` (mặc định = df) để train/test dùng CÙNG ngưỡng.

    * ``mt_ok``  : độ dài hai phía hợp lý, không lặp ảo giác, hai phía không rỗng.
    * ``asr_ok`` : có audio, thời lượng trong [min_dur, max_dur], cps hợp lý, không chữ số, không lặp.
    """
    ref = df if ref is None else ref
    lo_r, hi_r = np.nanpercentile(ref.len_ratio, qcfg["ratio_percentiles"])
    cps_ref = ref.cps.dropna()
    lo_c, hi_c = (np.nanpercentile(cps_ref, qcfg["cps_percentiles"]) if len(cps_ref) else (0, np.inf))
    df = df.copy()
    non_empty = (df.ba_len > 0) & (df.vi_len > 0) & ~df.non_latin
    no_loop = df.repeat_frac <= qcfg["max_repeat_ngram_frac"]
    ratio_ok = df.len_ratio.between(lo_r, hi_r)
    df["mt_ok"] = non_empty & no_loop & ratio_ok
    has_audio = df.get("has_audio", pd.Series(False, index=df.index)).fillna(False).astype(bool)
    dur_ok = df.duration.between(min_dur, max_dur) if "duration" in df else False
    df["asr_ok"] = (has_audio & dur_ok & df.cps.between(lo_c, hi_c) & ~df.has_digit
                    & no_loop & (df.ba_len > 0) & ~df.non_latin)
    df.attrs["thresholds"] = {"len_ratio": [float(lo_r), float(hi_r)], "cps": [float(lo_c), float(hi_c)]}
    return df


def export_spot_check(df: pd.DataFrame, n: int, out_csv: str | Path, seed: int,
                      raw_dir: str | Path | None = None) -> Path:
    """Chọn mẫu phân tầng theo nguồn, ghi CSV để người nghe/đọc chấm.

    Cột chấm tay: ``audio_ba_ok`` (audio khớp Ba Na?), ``ba_vi_ok`` (Ba Na↔Việt cùng nghĩa?), ``note``.
    Nếu có parquet đầy đủ (``raw_dir``), cắt audio ra ``<out_dir>/audio/<uid>.flac``.
    """
    rng = np.random.default_rng(seed)
    per = max(1, n // max(1, df.source.nunique()))
    parts = []
    for _, g in df.groupby("source"):
        parts.append(g.iloc[rng.permutation(len(g))[:per]])
    sample = pd.concat(parts).head(n)
    out_csv = resolve_path(out_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in ["uid", "corpus", "source", "speaker_id", "duration", "shard", "ba", "vi"] if c in sample]
    s = sample[cols].copy()
    s["audio_ba_ok"] = ""
    s["ba_vi_ok"] = ""
    s["note"] = ""
    if raw_dir is not None and "shard" in s:
        s["audio_path"] = extract_audio(s, raw_dir, out_csv.parent / "audio")
    s.to_csv(out_csv, index=False, encoding="utf-8-sig")
    log.info("Spot-check: %d mẫu -> %s", len(s), out_csv)
    return out_csv


def extract_audio(rows: pd.DataFrame, raw_dir: str | Path, out_dir: Path) -> list[str]:
    """Lấy bytes audio từ parquet đầy đủ (nếu đã tải shard tương ứng)."""
    import pyarrow.parquet as pq

    raw_dir = resolve_path(raw_dir) / "cuong06" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for shard, g in rows.groupby("shard"):
        f = next(iter(raw_dir.glob(f"train-{int(shard):05d}-of-*.parquet")), None)
        if f is None:
            continue
        want = set(g.uid)
        t = pq.read_table(f, columns=["id", "audio"]).to_pandas()
        for uid, audio in zip(t.id, t.audio):
            if uid in want and audio is not None and audio.get("bytes"):
                p = out_dir / f"{uid}.flac"
                p.write_bytes(audio["bytes"])
                paths[uid] = str(p)
    return [paths.get(u, "") for u in rows.uid]
