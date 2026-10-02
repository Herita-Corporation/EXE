"""Chọn shard audio theo số giờ dữ liệu ASR mong muốn — giảm tải/đĩa mà vẫn giữ đủ mọi nguồn.

Shard 0–11 chứa MỌI nguồn nhỏ (Kinh Thánh, radio, TV, other ≈ 115 giờ) → luôn giữ, và chứa toàn bộ
test_book + test_radio. Shard 12–49 là YouTube (~13 giờ/shard) → lấy thêm các shard RẢI ĐỀU cho tới khi đủ giờ.

Dùng:
    python -m src.data.shard_plan --hours 350          # in kế hoạch (JSON)
    python -m src.data.shard_plan --hours 350 --spec   # chỉ in danh sách shard "0,1,...,48" cho script
    python -m src.data.shard_plan --hours all
"""
from __future__ import annotations

import argparse
import json
import math
import os
from functools import lru_cache

import numpy as np
import pandas as pd

from src.utils import load_config, resolve_path

N_SHARDS = 50
CORE = list(range(12))            # mọi nguồn không phải YouTube
YOUTUBE = list(range(12, N_SHARDS))
FALLBACK_GB = 1.5
FIXED_DISK_GB = 70                # model HF + checkpoint ASR/MT + audio val/test + KenLM + đóng gói + pip


@lru_cache(maxsize=8)
def _read_split(path: str) -> pd.DataFrame:
    df = pd.read_json(path, lines=True)
    return df[df.asr_ok == True][["shard", "duration"]]  # noqa: E712


def shard_hours(data_cfg: dict) -> dict[int, float]:
    df = _read_split(str(resolve_path(data_cfg["paths"]["splits"]) / "cuong06_train.jsonl"))
    h = df.groupby("shard").duration.sum() / 3600
    return {int(k): float(v) for k, v in h.items()}


def shard_sizes_gb(repo: str) -> dict[int, float]:
    """Dung lượng thật từng shard trên HF; không có mạng thì dùng giá trị ước lượng."""
    try:
        from huggingface_hub import HfApi

        info = HfApi(token=os.environ.get("HF_TOKEN")).dataset_info(repo, files_metadata=True)
        out = {}
        for s in info.siblings:
            name = s.rfilename
            if name.startswith("data/train-") and s.size:
                out[int(name.split("-")[1])] = s.size / 1e9
        return out
    except Exception:
        return {}


def plan(target_hours: float | None, data_cfg: dict, sizes: dict[int, float] | None = None) -> dict:
    hours = shard_hours(data_cfg)
    total = sum(hours.values())
    if target_hours is None or target_hours >= total:
        chosen = sorted(hours)
    else:
        chosen = list(CORE)
        core_h = sum(hours.get(s, 0.0) for s in CORE)
        if target_hours > core_h:
            # thêm k shard YouTube rải đều (linspace) — k nhỏ nhất đủ giờ
            for k in range(1, len(YOUTUBE) + 1):
                idx = np.unique(np.round(np.linspace(0, len(YOUTUBE) - 1, k)).astype(int))
                pick = [YOUTUBE[i] for i in idx]
                if core_h + sum(hours.get(s, 0.0) for s in pick) >= target_hours:
                    break
            chosen = sorted(set(chosen) | set(pick))
    sizes = sizes or {}
    raw_gb = sum(sizes.get(s, FALLBACK_GB) for s in chosen)
    got_h = sum(hours.get(s, 0.0) for s in chosen)

    sp = resolve_path(data_cfg["paths"]["splits"])
    cover = {}
    for split in ("cuong06_val", "test_book", "test_radio", "test_source"):
        d = _read_split(str(sp / f"{split}.jsonl"))
        cover[split] = {"rows": int(len(d)), "in_chosen_shards": int(d.shard.isin(chosen).sum())}
    return {
        "target_hours": target_hours, "hours": round(got_h, 1), "total_hours": round(total, 1),
        "n_shards": len(chosen), "shards": chosen, "raw_gb": round(raw_gb, 1),
        # raw parquet + cache Arrow (≈ bằng raw) + phần cố định
        "disk_gb_needed": int(math.ceil(2 * raw_gb + FIXED_DISK_GB)),
        "coverage": cover,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", default="all",
                    help="số giờ audio train ASR mong muốn, 'all', hoặc nhiều mức cách nhau dấu phẩy (in danh sách)")
    ap.add_argument("--config", default="data.yaml")
    ap.add_argument("--spec", action="store_true", help="chỉ in danh sách shard, dạng 0,1,2")
    args = ap.parse_args()
    cfg = load_config(args.config)
    sizes = shard_sizes_gb(cfg["hf"]["cuong06"])
    parse = lambda h: None if str(h).strip().lower() in ("all", "none", "") else float(h)  # noqa: E731
    if "," in str(args.hours):
        print(json.dumps([plan(parse(h), cfg, sizes) for h in str(args.hours).split(",")], ensure_ascii=False))
        return
    p = plan(parse(args.hours), cfg, sizes)
    if args.spec:
        print(",".join(map(str, p["shards"])))
    else:
        print(json.dumps(p, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
