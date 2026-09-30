"""Azure TTS vi-VN (tùy chọn) — mốc chất lượng trên cho benchmark. Cần mạng; dữ liệu rời thiết bị.

Biến môi trường: AZURE_TTS_KEY, AZURE_TTS_REGION.
"""
from __future__ import annotations

import io
import os
import urllib.request
from xml.sax.saxutils import escape

import numpy as np
import soundfile as sf


class AzureTTS:
    name = "azure"
    sample_rate = 24000

    def __init__(self, voice: str = "vi-VN-HoaiMyNeural"):
        self.key = os.environ["AZURE_TTS_KEY"]
        self.region = os.environ["AZURE_TTS_REGION"]
        self.voice = voice

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray:
        ssml = (f"<speak version='1.0' xml:lang='vi-VN'><voice name='{voice or self.voice}'>"
                f"{escape(text)}</voice></speak>").encode("utf-8")
        req = urllib.request.Request(
            f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml, method="POST",
            headers={"Ocp-Apim-Subscription-Key": self.key, "Content-Type": "application/ssml+xml",
                     "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "bahnar-translator"})
        with urllib.request.urlopen(req, timeout=30) as r:
            y, sr = sf.read(io.BytesIO(r.read()), dtype="float32")
        self.sample_rate = sr
        return y
