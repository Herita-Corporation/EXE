"""Đọc dữ liệu thô đã tải về thành DataFrame thống nhất.

Cột chuẩn: uid, corpus, split_orig, source, group, dialect, domain, speaker_id, duration,
has_audio, shard, ba (Ba Na thô), vi (Việt thô).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.data.sources import DOMAIN_TAG, classify, dialect, group_key
from src.utils import read_lines, resolve_path

EAAI_SUB = "EAAI24-official-bahnaric-dataset"


def load_cuong06_meta(meta_dir: str | Path) -> pd.DataFrame:
    meta_dir = resolve_path(meta_dir)
    files = sorted(meta_dir.glob("*.parquet"))
    if not files:
        raise FileNotFoundError(f"Chưa có metadata cuong06 trong {meta_dir}. Chạy: python -m src.data.download")
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    df = df.rename(columns={"id": "uid", "text_bahnar": "ba", "text_vi": "vi", "split": "split_orig"})
    df["corpus"] = "cuong06"
    df["source"] = [classify(u, s, sp) for u, s, sp in zip(df.uid, df.speaker_id, df.split_orig)]
    df["group"] = [group_key(u, s) for u, s in zip(df.uid, df.source)]
    df["dialect"] = [dialect(s, src) for s, src in zip(df.speaker_id, df.source)]
    df["domain"] = df.source.map(DOMAIN_TAG)
    df["duration"] = df.duration.astype("float64").round(3)
    df["ba"] = df.ba.fillna("")
    df["vi"] = df.vi.fillna("")
    return df


def _eaai_root(root: str | Path) -> Path:
    root = resolve_path(root)
    return root / EAAI_SUB if (root / EAAI_SUB).exists() else root


def eaai24_file_stats(root: str | Path) -> dict[str, dict]:
    base = _eaai_root(root)
    out = {}
    for f in sorted(base.rglob("*.ba")) + sorted(base.rglob("*.vi")):
        lines = read_lines(f)
        out[str(f.relative_to(base)).replace("\\", "/")] = {
            "lines": len(lines),
            "non_empty": sum(1 for x in lines if x.strip()),
        }
    return out


def load_eaai24(root: str | Path) -> pd.DataFrame:
    base = _eaai_root(root) / "parallel_corpus"
    rows = []
    for split in ("train", "valid", "test"):
        ba, vi = read_lines(base / f"{split}.ba"), read_lines(base / f"{split}.vi")
        if len(ba) != len(vi):
            raise ValueError(f"EAAI24 {split}: số dòng .ba ({len(ba)}) != .vi ({len(vi)})")
        for i, (b, v) in enumerate(zip(ba, vi)):
            if not b.strip() and not v.strip():
                continue
            rows.append({"uid": f"eaai24_{split}_{i:05d}", "split_orig": split, "ba": b, "vi": v})
    df = pd.DataFrame(rows)
    df["corpus"] = "eaai24"
    df["source"] = "eaai24"
    df["group"] = df.uid
    df["dialect"] = "<bd>"
    df["domain"] = DOMAIN_TAG["eaai24"]
    df["speaker_id"] = None
    df["duration"] = float("nan")
    df["has_audio"] = False
    df["shard"] = -1
    return df


def load_eaai24_dict(root: str | Path) -> pd.DataFrame:
    base = _eaai_root(root) / "dictionary"
    ba, vi = read_lines(base / "dict.ba"), read_lines(base / "dict.vi")
    if len(ba) != len(vi):
        raise ValueError(f"Từ điển EAAI24 lệch dòng: {len(ba)} vs {len(vi)}")
    rows = [
        {"uid": f"dict_{i:05d}", "ba": b.strip(), "vi": v.strip()}
        for i, (b, v) in enumerate(zip(ba, vi))
        if b.strip() and v.strip() and b.strip() != "@"
    ]
    df = pd.DataFrame(rows)
    df["corpus"] = "eaai24_dict"
    df["source"] = "dict"
    df["split_orig"] = "dict"
    df["group"] = df.uid
    df["dialect"] = "<bd>"
    df["domain"] = DOMAIN_TAG["dict"]
    return df


def load_tourism(tourism_dir: str | Path) -> pd.DataFrame | None:
    """Tourism eval (khi người bản ngữ đã dịch): tourism_eval.csv với cột id, vi, ba[, audio_path]."""
    p = resolve_path(tourism_dir) / "tourism_eval.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p).rename(columns={"id": "uid"})
    df = df[df.get("ba", pd.Series(dtype=str)).fillna("").str.strip() != ""]
    df["corpus"] = "tourism"
    df["source"] = "tourism"
    df["group"] = df.uid
    df["dialect"] = df.get("dialect", "<ud>")
    df["domain"] = DOMAIN_TAG["tourism"]
    return df
