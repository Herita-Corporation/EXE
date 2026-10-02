"""Pipeline Ba Na nói → Việt (văn bản + giọng nói) — Phase 5.1.

Audio ─► VAD ─► 16 kHz + loudness ─► ASR (+KenLM) ─► [chặn nếu asr_conf < τ_asr]
      ─► normalize_bahnar + <conv> ─► MT (+glossary) ─► vi_normalizer ─► TTS
"""
from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

import numpy as np
import soundfile as sf

from src.text.bahnar_normalizer import normalize_for_mt
from src.text.vi_normalizer import normalize_vi
from src.utils import get_logger, load_config, resolve_path

log = get_logger("pipeline")
SR = 16000


def load_audio_bytes(data: bytes) -> np.ndarray:
    """Đọc wav/flac/ogg (soundfile); định dạng khác (m4a, mp3, webm) qua librosa/ffmpeg. → 16 kHz mono."""
    try:
        y, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
    except Exception:
        import tempfile

        import librosa

        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
            f.write(data)
            tmp = f.name
        y, sr = librosa.load(tmp, sr=None, mono=True)
        Path(tmp).unlink(missing_ok=True)
    if y.ndim > 1:
        y = y.mean(axis=1)
    if sr != SR:
        import librosa

        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    return y.astype(np.float32)


def wav_bytes(y: np.ndarray, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@dataclass
class S2STResult:
    transcript_bdq: str = ""
    translation_vi: str = ""
    audio_vi: bytes | None = None
    sample_rate: int | None = None
    confidence: dict = field(default_factory=dict)
    latency_ms: dict = field(default_factory=dict)
    rejected: bool = False
    message: str = ""
    disclaimer: str = ""

    def to_dict(self, include_audio: bool = False) -> dict:
        import base64

        d = {k: v for k, v in self.__dict__.items() if k != "audio_vi"}
        if include_audio and self.audio_vi is not None:
            d["audio_vi_wav_base64"] = base64.b64encode(self.audio_vi).decode("ascii")
        return d


class BahnarS2ST:
    def __init__(self, cfg: dict | str = "pipeline.yaml", asr=None, mt=None, tts=None, load_tts: bool = True):
        self.cfg = load_config(cfg) if isinstance(cfg, str) else cfg
        self.asr = asr or self._load_asr()
        self.decoder = self._load_decoder()
        self.mt = mt or self._load_mt()
        self.tts = tts if tts is not None else (self._load_tts() if load_tts else None)

    # ---------------------------------------------------------------- loaders
    @staticmethod
    def _model_dir(p: str) -> Path:
        """Thiếu thư mục → báo rõ (transformers sẽ tưởng là tên repo HF và báo lỗi 'Repo id must…' khó hiểu)."""
        d = resolve_path(p)
        if not d.is_dir():
            raise FileNotFoundError(f"Không thấy thư mục model: {d} — kiểm tra đường dẫn trong PIPELINE_CONFIG, "
                                    "hoặc tải model: python scripts/models_hub.py download --repo <...>")
        return d

    def _load_asr(self):
        a = self.cfg["asr"]
        self._model_dir(a["model_dir"])
        if a["backend"] == "onnx":
            from src.serve.runtime import ONNXASRModel

            return ONNXASRModel(resolve_path(a["onnx_path"]), resolve_path(a["model_dir"]))
        from src.asr.decode import ASRModel

        return ASRModel(resolve_path(a["model_dir"]))

    def _load_decoder(self):
        a = self.cfg["asr"]
        if not a.get("lm_path") or not resolve_path(a["lm_path"]).exists():
            log.warning("Không có KenLM → decode greedy")
            return None
        import importlib.util

        if importlib.util.find_spec("kenlm") is None:  # vd Windows: cần build C++ → không cài được bằng pip thường
            log.warning("Có file KenLM nhưng chưa cài thư viện python `kenlm` → decode greedy "
                        "(Linux: pip install https://github.com/kpu/kenlm/archive/master.zip)")
            return None
        from src.asr.decode import build_decoder

        uni = resolve_path(a["unigrams"])
        unigrams = uni.read_text(encoding="utf-8").split() if uni.exists() else None
        hw = resolve_path(a["hotwords_file"]) if a.get("hotwords_file") else None
        self.hotwords = [l.strip() for l in hw.read_text(encoding="utf-8").splitlines() if l.strip()] \
            if hw and hw.exists() else None
        return build_decoder(self.asr.labels, self.asr.processor.tokenizer.pad_token, str(resolve_path(a["lm_path"])),
                             unigrams, a["alpha"], a["beta"])

    def _load_mt(self):
        m = self.cfg["mt"]
        self._model_dir(m["model_dir"])
        gl = resolve_path(m["glossary"]) if m.get("glossary") else None
        if m["backend"] == "ct2":
            from src.serve.runtime import CT2Translator

            return CT2Translator(resolve_path(m["ct2_dir"]), resolve_path(m["model_dir"]), gl, m["num_beams"])
        from src.mt.translate import Translator

        return Translator(resolve_path(m["model_dir"]), glossary=gl, num_beams=m["num_beams"])

    def _load_tts(self):
        t = self.cfg["tts"]
        if not t.get("enabled", True):
            log.info("TTS tắt trong config → chỉ trả transcript + bản dịch")
            return None
        if t.get("remote_url"):
            from src.serve.runtime import RemoteTTS

            return RemoteTTS(t["remote_url"], t.get("voice"))
        from src.tts.base import build_tts

        try:
            return build_tts(t)
        except ImportError as e:  # vd chưa `pip install vieneu` → vẫn phục vụ dịch, không chết cả service
            log.warning("Không nạp được TTS (%s) → tắt TTS, API vẫn trả transcript + bản dịch", e)
            return None

    # ---------------------------------------------------------------- steps
    def recognize(self, wave: np.ndarray) -> tuple[str, float]:
        from src.asr.decode import beam_decode, greedy_confidence

        logp = self.asr.logits(wave)
        if self.decoder is None:
            return self.asr.greedy(logp), greedy_confidence(logp, self.asr.blank_id)
        a = self.cfg["asr"]
        return beam_decode(self.decoder, logp, a["beam_width"], self.hotwords, a["hotword_weight"])

    def translate_text(self, text_bdq: str) -> dict:
        m = self.cfg["mt"]
        return self.mt.translate([normalize_for_mt(text_bdq)], dialect=m["dialect_tag"], domain=m["domain_tag"])[0]

    def speak(self, text_vi: str, voice: str | None = None) -> tuple[np.ndarray, int]:
        y = self.tts.synthesize(normalize_vi(text_vi), voice)
        return y, self.tts.sample_rate

    def preprocess(self, wave: np.ndarray) -> np.ndarray:
        lim = self.cfg["limits"]["max_audio_sec"]
        if len(wave) > lim * SR:
            raise ValueError(f"Audio dài hơn {lim}s")
        v = self.cfg["vad"]
        if v["enabled"]:
            from src.pipeline.vad import trim_speech

            wave = trim_speech(wave, threshold=v["threshold"], min_speech_ms=v["min_speech_ms"], pad_ms=v["pad_ms"])
        return wave

    # ---------------------------------------------------------------- end-to-end
    def stream(self, audio: bytes | np.ndarray, voice: str | None = None, synthesize: bool = True) -> Iterator[tuple[str, dict]]:
        """Sinh sự kiện theo thứ tự: ('transcript', ...), ('translation', ...), ('audio', ...), ('done', ...)."""
        c = self.cfg["confidence"]
        res = S2STResult(disclaimer=c["disclaimer"])
        t0 = time.perf_counter()
        wave = load_audio_bytes(audio) if isinstance(audio, (bytes, bytearray)) else audio
        wave = self.preprocess(wave)
        res.latency_ms["vad"] = 1000 * (time.perf_counter() - t0)
        if len(wave) < SR // 4:
            res.rejected, res.message = True, "Không nghe thấy tiếng nói."
            yield "done", res.to_dict()
            return
        t = time.perf_counter()
        res.transcript_bdq, asr_conf = self.recognize(wave)
        res.confidence["asr"] = asr_conf
        res.latency_ms["asr"] = 1000 * (time.perf_counter() - t)
        yield "transcript", {"transcript_bdq": res.transcript_bdq, "asr_confidence": asr_conf}
        if asr_conf < c["tau_asr"] or not res.transcript_bdq.strip():
            res.rejected, res.message = True, c["retry_message"]
            res.latency_ms["total"] = 1000 * (time.perf_counter() - t0)
            yield "done", res.to_dict()
            return
        t = time.perf_counter()
        mt = self.translate_text(res.transcript_bdq)
        res.translation_vi, res.confidence["mt"] = mt["text"], mt["confidence"]
        res.latency_ms["mt"] = 1000 * (time.perf_counter() - t)
        if c.get("tau_mt") and mt["confidence"] < c["tau_mt"]:
            res.rejected, res.message = True, c["retry_message"]
        yield "translation", {"translation_vi": res.translation_vi, "mt_confidence": mt["confidence"],
                              "disclaimer": res.disclaimer}
        if synthesize and self.tts is not None and not res.rejected:
            t = time.perf_counter()
            y, sr = self.speak(res.translation_vi, voice)
            res.audio_vi, res.sample_rate = wav_bytes(y, sr), sr
            res.latency_ms["tts"] = 1000 * (time.perf_counter() - t)
            res.latency_ms["first_audio"] = 1000 * (time.perf_counter() - t0)
            yield "audio", {"sample_rate": sr, "wav": res.audio_vi}
        res.latency_ms["total"] = 1000 * (time.perf_counter() - t0)
        yield "done", res.to_dict()

    def __call__(self, audio: bytes | np.ndarray, voice: str | None = None, synthesize: bool = True) -> S2STResult:
        res = S2STResult()
        for ev, payload in self.stream(audio, voice, synthesize):
            if ev == "audio":
                res.audio_vi, res.sample_rate = payload["wav"], payload["sample_rate"]
            elif ev == "done":
                for k, v in payload.items():
                    if k not in ("audio_vi", "sample_rate") or v is not None:
                        setattr(res, k, v)
        return res
