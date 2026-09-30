"""Tiện ích dùng chung: config, seed, IO jsonl, SHA256, logging, commit hash."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable, Iterator

import yaml

ROOT = Path(__file__).resolve().parents[1]  # .../bahnar_translator
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
CONFIG_DIR = ROOT / "configs"


def _load_dotenv() -> None:
    """Nạp `.env` ở gốc repo (HF_TOKEN, AZURE_TTS_KEY…) nếu có `python-dotenv`.

    Không ghi đè biến đã set sẵn trong shell/CI. Thiếu python-dotenv thì bỏ qua (tự export biến cũng được).
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for candidate in (ROOT.parent / ".env", ROOT / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)
            break


_load_dotenv()


def get_logger(name: str) -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    for noisy in ("httpx", "httpcore", "urllib3", "huggingface_hub", "fsspec"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    return logging.getLogger(name)


def load_config(path: str | Path) -> dict[str, Any]:
    """Đọc YAML. Hỗ trợ khóa `_base_` để kế thừa config khác (merge nông theo từng khóa cấp 1)."""
    path = Path(path)
    if not path.is_absolute() and not path.exists():
        path = CONFIG_DIR / path
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    base = cfg.pop("_base_", None)
    if base:
        merged = load_config(path.parent / base)
        for k, v in cfg.items():
            if isinstance(v, dict) and isinstance(merged.get(k), dict):
                merged[k] = {**merged[k], **v}
            else:
                merged[k] = v
        cfg = merged
    return cfg


_FLOAT_RE = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)[eE][+-]?\d+$")


def apply_overrides(cfg: dict[str, Any], overrides: list[str] | None) -> dict[str, Any]:
    """`--override train.per_device_train_batch_size=4` → sửa cfg lồng nhau. Giá trị parse bằng YAML
    (4 → int, 1e-4 → float, true → bool, [0,1] → list, null → None)."""
    for item in overrides or []:
        if "=" not in item:
            raise ValueError(f"--override phải dạng khoa.con=giatri, nhận: {item!r}")
        key, raw = item.split("=", 1)
        node = cfg
        parts = key.strip().split(".")
        for p in parts[:-1]:
            node = node.setdefault(p, {})
            if not isinstance(node, dict):
                raise ValueError(f"--override {key}: '{p}' không phải nhóm cấu hình")
        val = yaml.safe_load(raw)
        # PyYAML (YAML 1.1) đọc "5e-5" là CHUỖI (phải viết 5.0e-5) → tự đổi sang số để override LR không hỏng.
        if isinstance(val, str) and _FLOAT_RE.match(val.strip()):
            val = float(val)
        node[parts[-1]] = val
        get_logger("utils").info("override %s = %r", key, node[parts[-1]])
    return cfg


def resolve_path(p: str | Path) -> Path:
    """Đường dẫn tương đối trong config được hiểu là tương đối với thư mục bahnar_translator/."""
    p = Path(p)
    return p if p.is_absolute() else ROOT / p


def set_seed(seed: int) -> None:
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except ImportError:
        pass
    try:
        import torch

        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass


def read_jsonl(path: str | Path) -> Iterator[dict]:
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def write_jsonl(path: str | Path, rows: Iterable[dict]) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def read_lines(path: str | Path) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return f.read().split("\n")


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_lines(lines: Iterable[str]) -> str:
    h = hashlib.sha256()
    for line in lines:
        h.update(line.encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return "nogit"


# Tham số chỉ ảnh hưởng chi tiết lưu trữ / mặc định đã đúng ở bản mới → bỏ được, không cảnh báo to.
_SAFE_TO_DROP = {"save_safetensors"}


def training_args(cls, total_steps: int | None = None, **kw):
    """Tạo (Seq2Seq)TrainingArguments tương thích transformers 4.x và 5.x.

    Xử lý các khác biệt giữa phiên bản:
      * `group_by_length` → `train_sampling_strategy="group_by_length"` (5.x).
      * `warmup_ratio` → `warmup_steps` khi bản đang cài không có `warmup_ratio` (cần ``total_steps``).
        BẮT BUỘC làm vì mất warmup khiến CTC rất dễ sụp về output rỗng ở những step đầu.
      * `save_safetensors`: bỏ được (5.x mặc định đã dùng safetensors).
    Tham số nào bị bỏ mà KHÔNG nằm trong danh sách an toàn thì raise, thay vì âm thầm train sai.
    """
    import inspect

    params = inspect.signature(cls.__init__).parameters
    if "warmup_ratio" in kw:
        # `warmup_ratio` đã deprecated từ transformers 5.2 và bị XOÁ ở bản mới hơn → luôn quy đổi sang
        # `warmup_steps` (có ở mọi phiên bản). Mất warmup làm CTC rất dễ sụp về output rỗng, nên nếu
        # không suy ra được số step thì dừng hẳn thay vì train sai.
        ratio = kw.pop("warmup_ratio")
        if ratio:
            if not total_steps:
                raise RuntimeError(
                    "Cần `total_steps` để quy đổi warmup_ratio → warmup_steps. Train không warmup sẽ "
                    "làm CTC sụp — dừng để bạn kiểm tra.")
            kw["warmup_steps"] = max(1, int(round(ratio * total_steps)))
            get_logger("utils").info("warmup_ratio=%.3f × %d step → warmup_steps=%d", ratio, total_steps,
                                     kw["warmup_steps"])
    if "group_by_length" in kw and "group_by_length" not in params:
        g = kw.pop("group_by_length")
        if "train_sampling_strategy" in params:
            kw["train_sampling_strategy"] = "group_by_length" if g else "random"
    dropped = [k for k in kw if k not in params]
    unsafe = [k for k in dropped if k not in _SAFE_TO_DROP]
    if unsafe:
        raise RuntimeError(
            f"transformers này ({cls.__name__}) không nhận các tham số: {unsafe}. Bỏ âm thầm có thể làm "
            f"train sai (vd mất warmup, mất group_by_length) → sửa src/utils.py:training_args() cho khớp "
            f"phiên bản trước khi chạy.")
    if dropped:
        get_logger("utils").info("Bỏ tham số an toàn (mặc định bản mới đã đúng): %s", dropped)
    return cls(**{k: v for k, v in kw.items() if k in params})
