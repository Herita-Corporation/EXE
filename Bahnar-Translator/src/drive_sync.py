"""Đồng bộ checkpoint giữa đĩa local (/content, nhanh) và Google Drive (bền) cho Colab.

* Trainer lưu checkpoint vào ``output_dir`` LOCAL.
* Sau mỗi lần lưu: sao sang Drive dưới tên ``checkpoint-N.partial`` rồi mới đổi tên ``checkpoint-N``
  → trên Drive chỉ tồn tại checkpoint đầy đủ (Colab ghi Drive bất đồng bộ, có thể bị ngắt giữa chừng).
* Trên Drive chỉ giữ best + mới nhất (tiết kiệm dung lượng).
* Đầu phiên: ``restore()`` chép best + mới nhất từ Drive về local, cùng tên thư mục → trainer_state
  (``best_model_checkpoint``) vẫn trỏ đúng, rồi resume như bình thường.
"""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from src.utils import get_logger

log = get_logger("drive_sync")
WEIGHTS = ("model.safetensors", "pytorch_model.bin", "model.safetensors.index.json", "pytorch_model.bin.index.json")


def is_complete(d: Path) -> bool:
    return (d.is_dir() and any((d / f).exists() for f in WEIGHTS) and (d / "optimizer.pt").exists()
            and (d / "scheduler.pt").exists() and (d / "trainer_state.json").exists())


def _step(d: Path) -> int:
    return int(d.name.split("-")[-1])


def checkpoints(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted((d for d in root.glob("checkpoint-*") if d.name.split("-")[-1].isdigit() and is_complete(d)),
                  key=_step)


def _best_name(ckpt: Path) -> str | None:
    try:
        best = json.loads((ckpt / "trainer_state.json").read_text(encoding="utf-8")).get("best_model_checkpoint")
    except Exception:
        return None
    return Path(best).name if best else None


def restore(drive_dir: Path, local_dir: Path) -> None:
    """Chép checkpoint mới nhất (+ best của nó) từ Drive về local nếu local chưa có."""
    if checkpoints(local_dir):
        return
    remote = checkpoints(drive_dir)
    if not remote:
        log.info("Drive chưa có checkpoint → train từ đầu")
        return
    latest = remote[-1]
    names = {latest.name}
    if (b := _best_name(latest)) and (drive_dir / b).exists():
        names.add(b)
    local_dir.mkdir(parents=True, exist_ok=True)
    for n in sorted(names):
        t0 = time.time()
        shutil.copytree(drive_dir / n, local_dir / n, dirs_exist_ok=True)
        log.info("Khôi phục %s từ Drive (%.0fs)", n, time.time() - t0)
    if (drive_dir / "runs").exists():
        shutil.copytree(drive_dir / "runs", local_dir / "runs", dirs_exist_ok=True)


def push(local_ckpt: Path, drive_dir: Path, keep: set[str]) -> None:
    drive_dir.mkdir(parents=True, exist_ok=True)
    dst = drive_dir / local_ckpt.name
    if not dst.exists():
        tmp = drive_dir / (local_ckpt.name + ".partial")
        shutil.rmtree(tmp, ignore_errors=True)
        t0 = time.time()
        shutil.copytree(local_ckpt, tmp)
        tmp.rename(dst)
        log.info("Đã đẩy %s lên Drive (%.0fs)", local_ckpt.name, time.time() - t0)
    for d in drive_dir.glob("checkpoint-*"):
        if d.name not in keep:
            shutil.rmtree(d, ignore_errors=True)  # lưu ý: Drive đưa file xóa vào Thùng rác (vẫn tính dung lượng)


def make_callback(drive_dir: Path):
    from transformers import TrainerCallback

    class DriveSync(TrainerCallback):
        def on_save(self, args, state, control, **kw):
            local = Path(args.output_dir) / f"checkpoint-{state.global_step}"
            if not local.exists():
                return
            keep = {local.name}
            if state.best_model_checkpoint:
                keep.add(Path(state.best_model_checkpoint).name)
            for name in sorted(keep):
                src = Path(args.output_dir) / name
                if src.exists():
                    push(src, drive_dir, keep)
            runs = Path(args.output_dir) / "runs"
            if runs.exists():
                shutil.copytree(runs, drive_dir / "runs", dirs_exist_ok=True)

    return DriveSync()


def push_final(local_best: Path, drive_dir: Path) -> None:
    dst = drive_dir / local_best.name
    tmp = drive_dir / (local_best.name + ".partial")
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.copytree(local_best, tmp)
    shutil.rmtree(dst, ignore_errors=True)
    tmp.rename(dst)
    log.info("Model cuối -> %s", dst)
