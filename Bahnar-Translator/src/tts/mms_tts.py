"""Baseline facebook/mms-tts-vie BẢN GỐC (16 kHz, 1 giọng, CC BY-NC 4.0, không tự đọc số).

KHÔNG dùng checkpoint Cond-Only đã fine-tune của dự án cũ (đã xác nhận thất bại).
"""
from __future__ import annotations

import numpy as np


class MMSTTS:
    name = "mms_vie"

    def __init__(self, model_name: str = "facebook/mms-tts-vie", device: str | None = None):
        import torch
        from transformers import AutoTokenizer, VitsModel

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tok = AutoTokenizer.from_pretrained(model_name)
        self.model = VitsModel.from_pretrained(model_name).to(self.device).eval()
        self.sample_rate = int(self.model.config.sampling_rate)

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray:
        import torch

        inputs = self.tok(text.lower(), return_tensors="pt").to(self.device)
        with torch.inference_mode():
            wav = self.model(**inputs).waveform[0]
        return wav.float().cpu().numpy()
