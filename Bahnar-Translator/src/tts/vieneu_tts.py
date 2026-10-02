"""Adapter VieNeu-TTS v3 Turbo (Apache-2.0, 48 kHz, 23 giọng preset Bắc/Trung/Nam).

SDK: ``pip install vieneu==3.7.1`` (CPU: ONNX Runtime, không cần PyTorch; GPU: tự chuyển PyTorch).
KHÔNG clone giọng người thật khi chưa có đồng ý rõ ràng — adapter này chỉ dùng giọng preset.
"""
from __future__ import annotations

from typing import Iterator

import numpy as np

from src.utils import get_logger

log = get_logger("tts.vieneu")


class VieNeuTTS:
    name = "vieneu"

    def __init__(self, precision: str = "fp32", default_voice: str | None = None, sdk_version: str | None = None,
                 temperature: float | None = None):
        from importlib.metadata import PackageNotFoundError, version

        from vieneu import Vieneu

        try:
            v = version("vieneu")
        except PackageNotFoundError:
            v = "unknown"
        if sdk_version and v != "unknown" and v != sdk_version:
            log.warning("vieneu %s khác version đã pin %s — danh sách giọng có thể khác", v, sdk_version)
        self.sdk_version = v
        self.tts = Vieneu(precision=precision) if precision != "fp32" else Vieneu()
        self.sample_rate = int(getattr(self.tts, "sample_rate", 48000))
        self.default_voice = default_voice
        self.temperature = temperature
        self.name = f"vieneu_{precision}"

    def voices(self) -> list[tuple[str, str]]:
        return list(self.tts.list_preset_voices())

    def _kw(self, voice: str | None) -> dict:
        kw = {}
        v = voice or self.default_voice
        if v:
            kw["voice"] = v
        if self.temperature is not None:
            kw["temperature"] = self.temperature
        return kw

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray:
        return np.asarray(self.tts.infer(text, **self._kw(voice)), dtype=np.float32).reshape(-1)

    def synthesize_stream(self, text: str, voice: str | None = None) -> Iterator[np.ndarray]:
        for chunk in self.tts.infer_stream(text, **self._kw(voice)):
            yield np.asarray(chunk, dtype=np.float32).reshape(-1)
