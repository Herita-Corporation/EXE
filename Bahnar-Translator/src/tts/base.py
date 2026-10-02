"""Interface chung cho TTS tiếng Việt + factory. Mọi engine nhận văn bản ĐÃ qua ``normalize_vi``."""
from __future__ import annotations

from typing import Iterator, Protocol, runtime_checkable

import numpy as np


@runtime_checkable
class VietTTS(Protocol):
    sample_rate: int
    name: str

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray: ...


def stream_or_whole(tts: VietTTS, text: str, voice: str | None = None) -> Iterator[np.ndarray]:
    """Dùng streaming nếu engine hỗ trợ (``synthesize_stream``), nếu không trả cả câu."""
    if hasattr(tts, "synthesize_stream"):
        yield from tts.synthesize_stream(text, voice)
    else:
        yield tts.synthesize(text, voice)


def build_tts(cfg: dict) -> VietTTS:
    t = cfg["type"]
    if t == "vieneu":
        from src.tts.vieneu_tts import VieNeuTTS

        return VieNeuTTS(precision=cfg.get("precision", "fp32"), default_voice=cfg.get("voice"),
                         sdk_version=cfg.get("sdk_version"))
    if t == "mms":
        from src.tts.mms_tts import MMSTTS

        return MMSTTS(cfg.get("name", "facebook/mms-tts-vie"))
    if t == "f5":
        from src.tts.f5_tts import F5TTS

        return F5TTS(cfg["ckpt_file"], cfg["vocab_file"], cfg["ref_audio"], cfg["ref_text"])
    if t == "azure":
        from src.tts.cloud_tts import AzureTTS

        return AzureTTS(cfg.get("voice", "vi-VN-HoaiMyNeural"))
    raise ValueError(f"TTS không hỗ trợ: {t}")
