"""VAD: silero-vad (pip install silero-vad); fallback theo năng lượng nếu chưa cài."""
from __future__ import annotations

from functools import lru_cache

import numpy as np

SR = 16000


@lru_cache(maxsize=1)
def _silero():
    from silero_vad import get_speech_timestamps, load_silero_vad

    return load_silero_vad(), get_speech_timestamps


def speech_segments(wave: np.ndarray, threshold: float = 0.5, min_speech_ms: int = 250,
                    pad_ms: int = 200) -> list[tuple[int, int]]:
    """Trả danh sách (start, end) theo sample."""
    try:
        import torch

        model, get_ts = _silero()
        ts = get_ts(torch.from_numpy(wave.astype(np.float32)), model, sampling_rate=SR, threshold=threshold,
                    min_speech_duration_ms=min_speech_ms, speech_pad_ms=pad_ms)
        return [(t["start"], t["end"]) for t in ts]
    except ImportError:
        return _energy_vad(wave, min_speech_ms, pad_ms)


def _energy_vad(wave: np.ndarray, min_speech_ms: int, pad_ms: int, frame_ms: int = 30) -> list[tuple[int, int]]:
    f = SR * frame_ms // 1000
    n = len(wave) // f
    if n == 0:
        return []
    e = np.sqrt(np.mean(wave[: n * f].reshape(n, f) ** 2, axis=1))
    thr = max(0.02 * e.max(), np.percentile(e, 20) * 3)
    active = e > thr
    segs, start = [], None
    for i, a in enumerate(np.append(active, False)):
        if a and start is None:
            start = i
        elif not a and start is not None:
            if (i - start) * frame_ms >= min_speech_ms:
                pad = SR * pad_ms // 1000
                segs.append((max(0, start * f - pad), min(len(wave), i * f + pad)))
            start = None
    return segs


def trim_speech(wave: np.ndarray, **kw) -> np.ndarray:
    """Cắt bỏ khoảng lặng đầu/cuối và giữa các đoạn nói. Không có tiếng nói → mảng rỗng."""
    segs = speech_segments(wave, **kw)
    if not segs:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate([wave[s:e] for s, e in segs]).astype(np.float32)
