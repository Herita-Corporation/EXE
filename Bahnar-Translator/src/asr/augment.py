"""Augmentation cho điều kiện ngoài trời / micro điện thoại (Phase 1.2).

Speed perturb, noise (MUSAN/ESC-50) theo SNR, RIR, band-limit kiểu điện thoại, nén OPUS (ffmpeg),
loudness normalize. SpecAugment nằm trong model (mask_time_prob / mask_feature_prob).
"""
from __future__ import annotations

import io
import random
import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 16000


def rms_normalize(x: np.ndarray, target_dbfs: float = -23.0) -> np.ndarray:
    rms = np.sqrt(np.mean(x ** 2) + 1e-12)
    y = x * (10 ** (target_dbfs / 20) / rms)
    peak = np.abs(y).max()
    return (y / peak * 0.99 if peak > 0.99 else y).astype(np.float32)


def speed_perturb(x: np.ndarray, factor: float) -> np.ndarray:
    """Đổi tốc độ (kèm cao độ, giống Kaldi speed perturb) bằng resample.

    Dùng scipy thay vì torchaudio: torchaudio phải khớp đúng phiên bản torch, trên máy ảo dễ lệch.
    factor 0.9 → audio DÀI hơn ~11% (tốn VRAM hơn), 1.1 → ngắn hơn.
    """
    if factor == 1.0:
        return x
    from fractions import Fraction

    from scipy.signal import resample_poly

    fr = Fraction(factor).limit_denominator(100)  # 0.9 → 9/10, 1.1 → 11/10
    return resample_poly(x, fr.denominator, fr.numerator).astype(np.float32)


def add_noise(x: np.ndarray, noise: np.ndarray, snr_db: float) -> np.ndarray:
    if len(noise) < len(x):
        noise = np.tile(noise, int(np.ceil(len(x) / max(len(noise), 1))))
    start = random.randint(0, len(noise) - len(x))
    n = noise[start:start + len(x)]
    px, pn = np.mean(x ** 2) + 1e-12, np.mean(n ** 2) + 1e-12
    return (x + n * np.sqrt(px / (pn * 10 ** (snr_db / 10)))).astype(np.float32)


def apply_rir(x: np.ndarray, rir: np.ndarray) -> np.ndarray:
    from scipy.signal import fftconvolve

    rir = rir / (np.abs(rir).max() + 1e-9)
    y = fftconvolve(x, rir)[: len(x)]
    return (y * (np.abs(x).max() / (np.abs(y).max() + 1e-9))).astype(np.float32)


def phone_band(x: np.ndarray, low: float = 300.0, high: float = 3400.0) -> np.ndarray:
    from scipy.signal import butter, sosfilt

    sos = butter(4, [low, high], btype="bandpass", fs=SR, output="sos")
    return sosfilt(sos, x).astype(np.float32)


_FFMPEG = shutil.which("ffmpeg")


def opus_roundtrip(x: np.ndarray, bitrate: str = "12k") -> np.ndarray:
    if _FFMPEG is None:
        return x
    buf = io.BytesIO()
    sf.write(buf, x, SR, format="WAV", subtype="PCM_16")
    enc = subprocess.run([_FFMPEG, "-loglevel", "quiet", "-f", "wav", "-i", "pipe:0", "-c:a", "libopus",
                          "-b:a", bitrate, "-f", "ogg", "pipe:1"], input=buf.getvalue(), capture_output=True)
    if enc.returncode != 0:
        return x
    dec = subprocess.run([_FFMPEG, "-loglevel", "quiet", "-i", "pipe:0", "-ar", str(SR), "-ac", "1",
                          "-f", "wav", "pipe:1"], input=enc.stdout, capture_output=True)
    if dec.returncode != 0:
        return x
    y, _ = sf.read(io.BytesIO(dec.stdout), dtype="float32")
    return y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))


def _load_dir(d: str | None, limit: int = 2000) -> list[np.ndarray]:
    if not d or not Path(d).exists():
        return []
    import librosa

    out = []
    for p in sorted(Path(d).rglob("*.wav"))[:limit]:
        y, _ = librosa.load(p, sr=SR, mono=True)
        if len(y) > SR // 4:
            out.append(y.astype(np.float32))
    return out


class Augmenter:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.noises = _load_dir(cfg.get("noise_dir"))
        self.rirs = _load_dir(cfg.get("rir_dir"))

    def __call__(self, x: np.ndarray) -> np.ndarray:
        c = self.cfg
        x = speed_perturb(x, random.choice(c.get("speed", [1.0])))
        if self.rirs and random.random() < c.get("rir_prob", 0):
            x = apply_rir(x, random.choice(self.rirs))
        if self.noises and random.random() < c.get("noise_prob", 0):
            x = add_noise(x, random.choice(self.noises), random.uniform(*c.get("snr_db", [5, 20])))
        if random.random() < c.get("phone_prob", 0):
            x = phone_band(x)
        if random.random() < c.get("codec_prob", 0):
            x = opus_roundtrip(x)
        return rms_normalize(x, c.get("target_dbfs", -23.0))
