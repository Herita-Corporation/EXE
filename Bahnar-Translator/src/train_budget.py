"""Giới hạn thời gian train theo ngân sách (thuê GPU tính theo giờ → chi phí có trần cứng).

Tốc độ thật trên GPU đích không biết trước, nên:
  1. Bỏ qua `skip_steps` step đầu (khởi động, batch dài nhất được xếp đầu).
  2. Đo `measure_steps` step tiếp theo → giây/step thật.
  3. Tính số step còn vừa ngân sách (trừ `overhead_frac` cho eval/save) → nếu ít hơn kế hoạch,
     rút `max_steps` và CO LỊCH LR (warmup → giảm tuyến tính về 0 đúng tại step cuối mới), để model
     vẫn hội tụ đúng cách thay vì bị cắt ngang giữa lúc LR còn cao.
  4. Chặn cứng: vượt `hard_cap` × ngân sách thì dừng (lưu + eval) bất kể ước lượng.

Thời gian đã dùng được ghi ra `usage_file`, nên chạy lại sau khi máy bị ngắt vẫn tính tiếp phần còn lại
của ngân sách chứ không cấp lại từ đầu.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from src.utils import get_logger

log = get_logger("budget")


def _linear_lambda(warmup: int, total: int):
    def f(step: int) -> float:
        if step < warmup:
            return float(step) / float(max(1, warmup))
        return max(0.0, float(total - step) / float(max(1, total - warmup)))

    return f


def make_budget_callback(budget_hours: float, usage_file: str | Path | None = None, skip_steps: int = 5,
                         measure_steps: int = 30, overhead_frac: float = 0.10, hard_cap: float = 1.08,
                         warmup_frac: float = 0.10):
    from transformers import TrainerCallback

    usage_path = Path(usage_file) if usage_file else None

    class TimeBudgetCallback(TrainerCallback):
        def __init__(self):
            self.budget = budget_hours * 3600.0
            self.used_before = 0.0
            if usage_path and usage_path.exists():
                self.used_before = float(json.loads(usage_path.read_text())["used_sec"])
            self.limit = None
            self.adjusted = False
            self.t_measure = None
            self.last_write = 0.0

        # ---------------------------------------------------------------- helpers
        def elapsed(self) -> float:
            return self.used_before + (time.time() - self.t0)

        def _save_usage(self, force: bool = False):
            if usage_path and (force or time.time() - self.last_write > 60):
                usage_path.parent.mkdir(parents=True, exist_ok=True)
                usage_path.write_text(json.dumps({"used_sec": self.elapsed(), "budget_sec": self.budget}))
                self.last_write = time.time()

        def _stop(self, control, why: str):
            log.warning("Dừng train: %s (đã dùng %.2f/%.2f giờ)", why, self.elapsed() / 3600, self.budget / 3600)
            control.should_training_stop = True
            control.should_save = True
            control.should_evaluate = True

        # ---------------------------------------------------------------- events
        def on_train_begin(self, args, state, control, **kw):
            self.t0 = time.time()
            self.start_step = state.global_step
            self.limit = state.max_steps
            remaining = self.budget - self.used_before
            log.info("Ngân sách %.2f giờ, đã dùng %.2f giờ, còn %.2f giờ; kế hoạch tối đa %d step",
                     self.budget / 3600, self.used_before / 3600, remaining / 3600, state.max_steps)
            if remaining <= 0:
                self._stop(control, "hết ngân sách từ lần chạy trước")

        def on_step_end(self, args, state, control, lr_scheduler=None, **kw):
            done = state.global_step - self.start_step
            now = time.time()
            if done == skip_steps:
                self.t_measure = now
            if not self.adjusted and self.t_measure is not None and done == skip_steps + measure_steps:
                self.adjusted = True
                sec_per_step = (now - self.t_measure) / measure_steps
                remaining = self.budget - self.elapsed()
                fit = state.global_step + int(remaining * (1 - overhead_frac) / sec_per_step)
                log.info("Đo thật: %.2f giây/step → còn vừa %d step (kế hoạch %d)", sec_per_step,
                         fit - state.global_step, state.max_steps - state.global_step)
                if fit < state.max_steps:
                    self._reschedule(lr_scheduler, fit, state, args)
            if self.limit is not None and state.global_step >= self.limit:
                self._stop(control, f"đạt số step theo ngân sách ({self.limit})")
            elif self.elapsed() > self.budget * hard_cap:
                self._stop(control, "vượt chặn cứng thời gian")
            self._save_usage()
            return control

        def on_train_end(self, args, state, control, **kw):
            self._save_usage(force=True)

        def _reschedule(self, lr_scheduler, new_total: int, state, args):
            self.limit = new_total
            state.max_steps = new_total
            sched = getattr(lr_scheduler, "scheduler", lr_scheduler)  # accelerate có thể bọc scheduler
            if sched is None or not hasattr(sched, "lr_lambdas"):
                log.warning("Không co được lịch LR (%s) — chỉ dừng tại step %d", type(sched).__name__, new_total)
                return
            warmup = int(getattr(args, "warmup_steps", 0) or 0)
            warmup = min(warmup, max(1, int(warmup_frac * new_total)))
            sched.lr_lambdas = [_linear_lambda(warmup, new_total) for _ in sched.lr_lambdas]
            log.info("Co lịch LR: warmup %d step, giảm tuyến tính về 0 tại step %d", warmup, new_total)

    return TimeBudgetCallback()
