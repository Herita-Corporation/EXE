"""Tải các dataset tiếng Ba Na từ Hugging Face.

Chế độ cho `cuong06/Bahnar_Vietnamese` (~75 GB, 50 shard train):
  * ``text``   : đọc từ xa CHỈ các cột text (id, speaker_id, duration, text_vi, text_bahnar)
                 bằng column projection của Parquet → vài trăm MB. Đủ cho audit, split, MT, KenLM.
                 Có thêm cột ``has_audio`` và ``shard`` để truy lại audio sau này.
  * ``shards`` : tải nguyên file parquet (có audio) của các shard chỉ định, ví dụ ``--shards 0-4,10``.
  * ``full``   : tải toàn bộ (cần ~75 GB đĩa).
EAAI24 (~4 MB) và Rhade (Phase 7) luôn tải nguyên.

Ví dụ:
    python -m src.data.download --what eaai24 cuong06 --mode text
    python -m src.data.download --what cuong06 --mode shards --shards 0-2
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from src.utils import get_logger, load_config, resolve_path

log = get_logger("download")
TEXT_COLS = ["id", "speaker_id", "duration", "text_vi", "text_bahnar", "text_en"]


def _parse_shards(spec: str | None, n: int) -> list[int]:
    if not spec:
        return list(range(n))
    out: list[int] = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return sorted(set(i for i in out if 0 <= i < n))


def cuong06_files(repo: str, n_train: int) -> dict[str, list[str]]:
    return {
        "train": [f"data/train-{i:05d}-of-{n_train:05d}.parquet" for i in range(n_train)],
        "validation": ["data/validation-00000-of-00001.parquet"],
        "test": ["data/test-00000-of-00001.parquet"],
    }


def _has_audio_column(pf: pq.ParquetFile) -> pa.Array:
    """Trả về mảng bool: dòng có bytes audio hay không, KHÔNG đọc bytes audio.

    Parquet lưu null-count theo trang; cách rẻ nhất vẫn là đọc cột con ``audio.path``
    (nhỏ) — khi audio bị gỡ, cả struct là null nên path cũng null.
    """
    try:
        t = pf.read(columns=["audio.path"])
        col = t.column(0)
        return pc.invert(pc.is_null(col))
    except Exception:
        t = pf.read(columns=["audio"])
        return pc.invert(pc.is_null(t.column(0)))


def download_cuong06_text(cfg: dict, splits: list[str], shards: str | None, retries: int = 3) -> None:
    from huggingface_hub import HfFileSystem

    repo = cfg["hf"]["cuong06"]
    n_train = cfg["hf"]["cuong06_num_train_shards"]
    out_dir = resolve_path(cfg["paths"]["meta"])
    out_dir.mkdir(parents=True, exist_ok=True)
    fs = HfFileSystem(token=os.environ.get("HF_TOKEN"))
    files = cuong06_files(repo, n_train)
    for split in splits:
        todo = files[split]
        idxs = _parse_shards(shards, n_train) if split == "train" else [0]
        for i in idxs:
            rel = todo[i]
            dst = out_dir / f"{split}-{i:05d}.parquet"
            if dst.exists():
                continue
            for attempt in range(1, retries + 1):
                try:
                    t0 = time.time()
                    with fs.open(f"datasets/{repo}/{rel}", "rb", block_size=1 << 20) as f:
                        pf = pq.ParquetFile(f)
                        names = pf.schema_arrow.names
                        cols = [c for c in TEXT_COLS if c in names]
                        table = pf.read(columns=cols)
                        has_audio = _has_audio_column(pf)
                    table = table.append_column("has_audio", has_audio)
                    table = table.append_column("split", pa.array([split] * table.num_rows))
                    table = table.append_column("shard", pa.array([i] * table.num_rows, pa.int16()))
                    tmp = dst.with_suffix(".tmp")
                    pq.write_table(table, tmp)
                    tmp.replace(dst)
                    log.info("%s: %d dòng, %.1fs", dst.name, table.num_rows, time.time() - t0)
                    break
                except Exception as e:  # mạng chập chờn → thử lại
                    log.warning("%s lỗi lần %d: %s", rel, attempt, e)
                    time.sleep(5 * attempt)
            else:
                raise RuntimeError(f"Không tải được {rel}")


def download_cuong06_files(cfg: dict, splits: list[str], shards: str | None) -> None:
    from huggingface_hub import snapshot_download

    repo = cfg["hf"]["cuong06"]
    n_train = cfg["hf"]["cuong06_num_train_shards"]
    files = cuong06_files(repo, n_train)
    patterns: list[str] = []
    for split in splits:
        if split == "train":
            patterns += [files["train"][i] for i in _parse_shards(shards, n_train)]
        else:
            patterns += files[split]
    local = resolve_path(cfg["paths"]["raw"]) / "cuong06"
    local.mkdir(parents=True, exist_ok=True)
    log.info("Tải %d file parquet (có audio) vào %s", len(patterns), local)
    snapshot_download(repo, repo_type="dataset", allow_patterns=patterns, local_dir=local,
                      token=os.environ.get("HF_TOKEN"))


def download_eaai24(cfg: dict) -> Path:
    from huggingface_hub import snapshot_download

    local = resolve_path(cfg["paths"]["eaai24"])
    snapshot_download(cfg["hf"]["eaai24"], repo_type="dataset", local_dir=local,
                      token=os.environ.get("HF_TOKEN"))
    log.info("EAAI24 -> %s", local)
    return local


def download_rhade(cfg: dict) -> Path:
    from huggingface_hub import snapshot_download

    local = resolve_path(cfg["paths"]["raw"]) / "rhade"
    snapshot_download(cfg["hf"]["rhade"], repo_type="dataset", local_dir=local,
                      token=os.environ.get("HF_TOKEN"))
    return local


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="data.yaml")
    ap.add_argument("--what", nargs="+", default=["eaai24", "cuong06"],
                    choices=["eaai24", "cuong06", "rhade"])
    ap.add_argument("--mode", default="text", choices=["text", "shards", "full"])
    ap.add_argument("--splits", nargs="+", default=["train", "validation", "test"])
    ap.add_argument("--shards", default=None, help="vd '0-4,10' (chỉ áp dụng cho train)")
    ap.add_argument("--raw_dir", default=None, help="ghi đè paths.raw (Colab: /content/raw — đĩa local, nhanh)")
    args = ap.parse_args()
    cfg = load_config(args.config)
    if args.raw_dir:
        cfg["paths"]["raw"] = args.raw_dir
    if "eaai24" in args.what:
        download_eaai24(cfg)
    if "rhade" in args.what:
        download_rhade(cfg)
    if "cuong06" in args.what:
        if args.mode == "text":
            download_cuong06_text(cfg, args.splits, args.shards)
        else:
            download_cuong06_files(cfg, args.splits, None if args.mode == "full" else args.shards)


if __name__ == "__main__":
    main()
