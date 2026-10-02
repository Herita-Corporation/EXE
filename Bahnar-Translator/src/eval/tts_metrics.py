"""Metric TTS: intelligibility (CER round-trip qua PhoWhisper), naturalness (UTMOS), độ ổn định, tốc độ."""
from __future__ import annotations

import unicodedata
from functools import lru_cache

import numpy as np
import regex

try:
    from rapidfuzz.distance import Levenshtein
except ImportError:  # pragma: no cover
    Levenshtein = None


def norm_vi_for_cer(text: str) -> str:
    t = unicodedata.normalize("NFC", text or "").lower()
    t = regex.sub(r"[^\p{L}\p{M}\p{N} ]+", " ", t)
    return regex.sub(r"\s+", " ", t).strip()


def edit_ops(ref: str, hyp: str) -> dict:
    """Số thao tác sửa ở mức ký tự: thay thế / xóa (bỏ chữ) / chèn (lặp)."""
    ops = Levenshtein.editops(ref, hyp)
    c = {"replace": 0, "delete": 0, "insert": 0}
    for op in ops:
        c[op.tag] += 1
    c["len"] = len(ref)
    return c


def resample(y: np.ndarray, sr: int, target: int = 16000) -> np.ndarray:
    if sr == target:
        return y
    import librosa

    return librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=target)


class RoundTripASR:
    def __init__(self, model: str = "vinai/PhoWhisper-large", device: str | None = None):
        import torch
        from transformers import pipeline

        dev = device or ("cuda:0" if torch.cuda.is_available() else "cpu")
        self.pipe = pipeline("automatic-speech-recognition", model=model, device=dev,
                             torch_dtype=torch.float16 if dev.startswith("cuda") else torch.float32)

    def __call__(self, wave: np.ndarray, sr: int) -> str:
        y = resample(wave, sr)
        return self.pipe({"raw": y, "sampling_rate": 16000}, generate_kwargs={"language": "vi", "task": "transcribe"})["text"]


@lru_cache(maxsize=1)
def _utmos():
    import torch

    return torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).eval()


def utmos(wave: np.ndarray, sr: int) -> float:
    import torch

    y = torch.from_numpy(resample(wave, sr)).float()[None]
    with torch.inference_mode():
        return float(_utmos()(y, 16000).item())


def stability_flags(wave: np.ndarray, sr: int, text: str, ops: dict | None, mcfg: dict) -> dict:
    dur = len(wave) / sr if sr else 0.0
    rms = float(np.sqrt(np.mean(wave ** 2))) if len(wave) else 0.0
    n = max(len(norm_vi_for_cer(text).replace(" ", "")), 1)
    cps = n / dur if dur > 0 else float("inf")
    f = {"silent": rms < mcfg["rms_min"], "abnormal_length": not (mcfg["cps_range"][0] <= cps <= mcfg["cps_range"][1]),
         "rms": rms, "duration": dur, "cps": cps}
    if ops:
        L = max(ops["len"], 1)
        f["skip"] = ops["delete"] / L > mcfg["del_rate_max"]
        f["repeat"] = ops["insert"] / L > mcfg["ins_rate_max"]
    f["failure"] = bool(f["silent"] or f["abnormal_length"] or f.get("skip") or f.get("repeat"))
    return f
