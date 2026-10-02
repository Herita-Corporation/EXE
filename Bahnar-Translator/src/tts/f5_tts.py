"""Adapter F5-TTS (hynt/F5-TTS-Vietnamese-ViVoice) — CC BY-NC-SA 4.0: chỉ để SO SÁNH, không dùng sản phẩm.

Cần ``pip install f5-tts``, checkpoint + vocab, và một audio tham chiếu có sự đồng ý của người nói.
Flow-matching → chậm trên CPU.
"""
from __future__ import annotations

import numpy as np


class F5TTS:
    name = "f5_vivoice"

    def __init__(self, ckpt_file: str, vocab_file: str, ref_audio: str, ref_text: str):
        from f5_tts.api import F5TTS as _F5

        self.model = _F5(ckpt_file=ckpt_file, vocab_file=vocab_file)
        self.ref_audio, self.ref_text = ref_audio, ref_text
        self.sample_rate = 24000

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray:
        wav, sr, _ = self.model.infer(ref_file=self.ref_audio, ref_text=self.ref_text, gen_text=text)
        self.sample_rate = int(sr)
        return np.asarray(wav, dtype=np.float32)
