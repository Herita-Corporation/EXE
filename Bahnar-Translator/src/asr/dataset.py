"""Dataset ASR: nối split jsonl (text đã lọc) với audio trong parquet đầy đủ của cuong06.

Audio được giải mã bằng soundfile (FLAC) — không phụ thuộc torchcodec của `datasets` 4.x.
"""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pandas as pd
import soundfile as sf

from src.text.bahnar_normalizer import normalize_for_asr
from src.utils import get_logger, resolve_path

log = get_logger("asr.dataset")
SR = 16000


def decode_audio(audio: dict | bytes | None) -> np.ndarray:
    if audio is None:
        raise ValueError("audio=None")
    data = audio["bytes"] if isinstance(audio, dict) else audio
    y, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    if sr != SR:
        import librosa

        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    return y.astype(np.float32)


def load_split_df(split: str, data_cfg: dict, asr_only: bool = True) -> pd.DataFrame:
    p = resolve_path(data_cfg["paths"]["splits"]) / f"{split}.jsonl"
    df = pd.read_json(p, lines=True)
    if asr_only and "asr_ok" in df:
        df = df[df.asr_ok.fillna(False).astype(bool)]
    df = df.copy()
    df["text"] = [normalize_for_asr(t) for t in df.ba]
    return df


def shard_files(raw_dir: str | Path, shards: list[int], split_orig: str = "train") -> dict[int, Path]:
    base = resolve_path(raw_dir) / "cuong06" / "data"
    out = {}
    for s in shards:
        pat = f"{split_orig}-{int(s):05d}-of-*.parquet" if split_orig == "train" else f"{split_orig}-*.parquet"
        f = next(iter(sorted(base.glob(pat))), None)
        if f is not None:
            out[int(s)] = f
    return out


def build_hf_dataset(df: pd.DataFrame, raw_dir: str | Path, subset_frac: float = 1.0, seed: int = 42,
                     max_samples: int | None = None, audio_parquet: str | Path | None = None):
    """Trả về `datasets.Dataset` với cột: uid, audio (struct bytes), text, duration, source.

    Chỉ những shard đã tải mới được dùng; số dòng thiếu audio được log ra.
    ``audio_parquet``: file audio đã trích sẵn cho split (src.data.export_audio) — dùng thay cho shard.
    """
    import datasets

    df = df.drop_duplicates("uid")
    if audio_parquet is not None:
        import pyarrow.parquet as pq

        have = set(pq.read_table(audio_parquet, columns=["id"]).column("id").to_pylist())
        df = df[df.uid.isin(have)]
        log.info("Dùng audio đã trích %s (%d câu)", audio_parquet, len(df))
    if subset_frac < 1.0:
        df = df.sample(frac=subset_frac, random_state=seed)
    if max_samples and len(df) > max_samples:
        df = df.sample(n=max_samples, random_state=seed)
    files = ({"x": Path(audio_parquet)} if audio_parquet is not None
             else shard_files(raw_dir, sorted(df.shard.dropna().astype(int).unique())))
    missing = set() if audio_parquet is not None else set(df.shard.astype(int).unique()) - set(files)
    if missing:
        log.warning("Thiếu %d shard audio (%s…) → bỏ %d dòng. Tải: python -m src.data.download --mode shards --shards ...",
                    len(missing), sorted(missing)[:5], int(df.shard.isin(missing).sum()))
        df = df[~df.shard.isin(missing)]
    if df.empty:
        raise RuntimeError("Không có dòng nào có audio local.")
    meta = df.set_index("uid")[["text", "duration", "source"]]
    wanted = set(meta.index)
    ds = datasets.Dataset.from_parquet([str(f) for f in files.values()], columns=["id", "audio"])
    # giữ bytes FLAC thô (tự giải mã bằng soundfile) → không phụ thuộc torchcodec của datasets 4.x
    ds = ds.cast_column("audio", datasets.Audio(decode=False))
    ids = ds["id"]
    # Thêm cột metadata cho MỌI dòng TRƯỚC, rồi mới select(): add_column trên dataset đã select() sẽ
    # "flatten" bảng chỉ số → ghi lại toàn bộ bytes audio ra đĩa (đo thật: cache 1.56x parquet;
    # với 75GB dữ liệu là thêm ~66GB). Làm theo thứ tự này thì select() chỉ tạo bảng chỉ số, không copy.
    meta_text, meta_dur, meta_src = meta["text"].to_dict(), meta["duration"].to_dict(), meta["source"].to_dict()
    ds = ds.add_column("text", [meta_text.get(u, "") for u in ids])
    ds = ds.add_column("duration", [float(meta_dur.get(u, 0.0)) for u in ids])
    ds = ds.add_column("source", [meta_src.get(u, "") for u in ids])
    seen: set[str] = set()
    keep = []
    for i, u in enumerate(ids):
        if u in wanted and u not in seen:  # bỏ trùng uid nếu một câu xuất hiện ở 2 shard
            keep.append(i)
            seen.add(u)
    ds = ds.select(keep).rename_column("id", "uid")
    log.info("Dataset ASR: %d câu, %.1f giờ", len(ds), sum(ds["duration"]) / 3600)
    return ds
