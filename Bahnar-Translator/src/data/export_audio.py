"""Trích audio của val/test thành parquet nhỏ (chỉ các dòng cần) — chạy MỘT lần, lưu lên Drive.

Val/test nằm rải trên nhiều shard (val: 38 shard, test_source: 28 shard). Script tải TỪNG shard vào thư mục tạm,
lấy đúng các dòng cần, rồi xóa shard → không cần giữ 75 GB. Nên chạy trên runtime CPU của Colab.

    python -m src.data.export_audio --splits cuong06_val:400 test_book test_radio test_source \
        --tmp_dir /content/tmp_shards
Ra: data/processed/audio/<split>.parquet (cột id, audio{bytes,path}).
"""
from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from src.utils import get_logger, load_config, resolve_path

log = get_logger("export_audio")


def audio_dir(data_cfg: dict) -> Path:
    return resolve_path(data_cfg["paths"].get("split_audio", "data/processed/audio"))


def split_audio_file(split: str, data_cfg: dict) -> Path | None:
    p = audio_dir(data_cfg) / f"{split}.parquet"
    return p if p.exists() else None


def wanted_rows(spec: str, data_cfg: dict, seed: int, allowed_shards: set[int] | None = None,
                max_duration: float | None = None) -> tuple[str, pd.DataFrame]:
    """`split` hoặc `split:N` (lấy mẫu N câu asr_ok, cố định theo seed).

    Lọc shard/độ dài TRƯỚC khi lấy mẫu — nếu lấy mẫu trước thì phần lớn mẫu rơi vào shard bị loại
    và chỉ trích được rất ít câu (vd `cuong06_val:300 --only_shards 0-3` chỉ ra 20 câu thay vì 300).
    """
    name, _, n = spec.partition(":")
    df = pd.read_json(resolve_path(data_cfg["paths"]["splits"]) / f"{name}.jsonl", lines=True)
    df = df[df.asr_ok == True]  # noqa: E712
    if allowed_shards is not None:
        df = df[df.shard.isin(allowed_shards)]
    if max_duration:
        df = df[df.duration <= max_duration]
    if n and int(n) < len(df):
        df = df.sample(n=int(n), random_state=seed)
    return name, df[["uid", "shard"]]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="data.yaml")
    ap.add_argument("--splits", nargs="+", default=["cuong06_val:400", "test_book", "test_radio", "test_source"])
    ap.add_argument("--tmp_dir", default=None, help="nơi tải shard tạm (Colab: /content/tmp_shards)")
    ap.add_argument("--raw_dir", default=None, help="nếu shard đã có sẵn ở đây thì dùng lại, không tải/xóa")
    ap.add_argument("--only_shards", default=None,
                    help="vd '0-3': CHỈ lấy câu nằm trong các shard này (lấy mẫu sau khi lọc shard)")
    ap.add_argument("--max_duration", type=float, default=None, help="bỏ câu dài hơn (khớp max_duration_override)")
    args = ap.parse_args()
    cfg = load_config(args.config)
    from src.data.download import _parse_shards, cuong06_files

    n_train = cfg["hf"]["cuong06_num_train_shards"]
    allowed = set(_parse_shards(args.only_shards, n_train)) if args.only_shards else None
    wanted = dict(wanted_rows(s, cfg, cfg["seed"], allowed, args.max_duration) for s in args.splits)
    out_dir = audio_dir(cfg)
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = {name: df for name, df in wanted.items() if not (out_dir / f"{name}.parquet").exists()}
    if not todo:
        log.info("Mọi split đã được trích: %s", list(wanted))
        return
    uid2split = {u: name for name, df in todo.items() for u in df.uid}
    shards = sorted({int(s) for df in todo.values() for s in df.shard})
    log.info("Cần %d shard: %s (số câu: %s)", len(shards), shards, {n: len(d) for n, d in todo.items()})
    tmp = Path(args.tmp_dir or resolve_path("data/tmp_shards"))
    raw = resolve_path(args.raw_dir) / "cuong06" if args.raw_dir else None
    parts: dict[str, list[pa.Table]] = {n: [] for n in todo}
    files = cuong06_files(cfg["hf"]["cuong06"], n_train)["train"]
    from huggingface_hub import hf_hub_download

    for i, s in enumerate(shards, 1):
        rel = files[s]
        local = raw / rel if raw and (raw / rel).exists() else None
        if local is None:
            local = Path(hf_hub_download(cfg["hf"]["cuong06"], rel, repo_type="dataset", local_dir=tmp,
                                         token=os.environ.get("HF_TOKEN")))
        t = pq.read_table(local, columns=["id", "audio"])
        ids = t.column("id").to_pylist()
        for name in todo:
            mask = [uid2split.get(u) == name for u in ids]
            if any(mask):
                parts[name].append(t.filter(pa.array(mask)))
        if not (raw and str(local).startswith(str(raw))):
            local.unlink(missing_ok=True)
        log.info("[%d/%d] shard %d xong", i, len(shards), s)
    shutil.rmtree(tmp / "data", ignore_errors=True)
    for name, ts in parts.items():
        if not ts:
            continue
        table = pa.concat_tables(ts)
        pq.write_table(table, out_dir / f"{name}.parquet")
        log.info("%s: %d/%d câu -> %s", name, table.num_rows, len(todo[name]), out_dir / f"{name}.parquet")


if __name__ == "__main__":
    main()
