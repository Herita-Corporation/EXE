"""Test tích hợp pipeline + API với model giả (không cần GPU/checkpoint)."""
import io
import json

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from src.pipeline.s2st import BahnarS2ST
from src.utils import load_config


class FakeTok:
    pad_token = "<pad>"


class FakeProc:
    tokenizer = FakeTok()


class FakeASR:
    labels, blank_id, processor = ["<pad>", "a"], 0, FakeProc()

    def __init__(self, conf=0.9):
        self.conf = conf

    def logits(self, wave):
        p = np.full((10, 2), 1e-3)
        p[:, 1] = self.conf
        return np.log(p)

    def greedy(self, logp):
        return "'bok kei-dei"


class FakeMT:
    def translate(self, texts, dialect="<ud>", domain="<conv>", **_):
        assert domain == "<conv>"
        return [{"text": "Giá 50.000 đồng", "confidence": 0.8} for _ in texts]


class FakeTTS:
    sample_rate = 16000
    last = None

    def synthesize(self, text, voice=None):
        FakeTTS.last = text
        return np.zeros(1600, dtype=np.float32) + 0.01


def make_pipe(conf=0.9):
    cfg = load_config("pipeline.yaml")
    cfg["asr"]["lm_path"] = None
    cfg["vad"]["enabled"] = False
    return BahnarS2ST(cfg, asr=FakeASR(conf), mt=FakeMT(), tts=FakeTTS())


def wav(sec=1.0):
    buf = io.BytesIO()
    sf.write(buf, (np.random.randn(int(16000 * sec)) * 0.1).astype(np.float32), 16000, format="WAV")
    return buf.getvalue()


def test_pipeline_end_to_end_normalizes_numbers_for_tts():
    res = make_pipe()(wav())
    assert res.transcript_bdq == "'bok kei-dei"
    assert res.translation_vi == "Giá 50.000 đồng"
    assert FakeTTS.last == "Giá năm mươi nghìn đồng"
    assert res.audio_vi and not res.rejected
    assert {"asr", "mt", "tts", "total"} <= set(res.latency_ms)


def test_pipeline_rejects_low_asr_confidence():
    res = make_pipe(conf=0.1)(wav())
    assert res.rejected and res.message == "Xin nói lại chậm hơn." and res.transcript_bdq
    assert not res.translation_vi


def test_pipeline_rejects_too_long_audio():
    import pytest

    with pytest.raises(ValueError):
        make_pipe()(wav(31))


def _client(pipe):
    from src.serve import app as appmod

    appmod.app.dependency_overrides[appmod.get_pipeline] = lambda: pipe
    return TestClient(appmod.app)


def test_api_speech_and_stream():
    c = _client(make_pipe())
    r = c.post("/v1/translate/bahnar-speech", files={"audio": ("a.wav", wav(), "audio/wav")})
    assert r.status_code == 200
    body = r.json()
    assert body["translation_vi"] == "Giá 50.000 đồng" and body["audio_vi_wav_base64"]
    assert "Bản dịch máy" in body["disclaimer"]
    r = c.post("/v1/translate/bahnar-speech/stream", files={"audio": ("a.wav", wav(), "audio/wav")})
    events = [json.loads(l)["event"] for l in r.text.strip().split("\n")]
    assert events == ["transcript", "translation", "audio", "done"]


def test_api_text_and_limits():
    c = _client(make_pipe())
    r = c.post("/v1/translate/bahnar-text", json={"text": "'Bok Kei-Dei"})
    assert r.status_code == 200 and r.json()["translation_vi"]
    assert c.post("/v1/translate/bahnar-text", json={"text": "  "}).status_code == 400
    r = c.post("/v1/translate/bahnar-speech", files={"audio": ("a.wav", wav(31), "audio/wav")})
    assert r.status_code == 400


def test_feedback_requires_consent(tmp_path, monkeypatch):
    monkeypatch.setenv("FEEDBACK_PATH", str(tmp_path / "fb.jsonl"))
    c = _client(make_pipe())
    assert c.post("/v1/feedback", json={"consent": False, "note": "x"}).status_code == 400
    assert c.post("/v1/feedback", json={"consent": True, "note": "x"}).status_code == 200
    assert (tmp_path / "fb.jsonl").exists()


def test_api_key_required_when_configured(monkeypatch):
    c = _client(make_pipe())
    body = {"text": "'Bok Kei-Dei"}
    monkeypatch.setenv("TRANSLATOR_API_KEY", "bi-mat")
    assert c.post("/v1/translate/bahnar-text", json=body).status_code == 401
    assert c.post("/v1/translate/bahnar-text", json=body, headers={"X-API-Key": "sai"}).status_code == 401
    assert c.post("/v1/translate/bahnar-text", json=body, headers={"X-API-Key": "bi-mat"}).status_code == 200
    assert c.get("/healthz").status_code == 200  # health check không cần khóa
    monkeypatch.delenv("TRANSLATOR_API_KEY")
    assert c.post("/v1/translate/bahnar-text", json=body).status_code == 200


def test_tts_optional_does_not_break_pipeline(monkeypatch):
    cfg = load_config("pipeline.yaml")
    cfg["asr"]["lm_path"] = None
    cfg["vad"]["enabled"] = False
    cfg["tts"]["enabled"] = False
    p = BahnarS2ST(cfg, asr=FakeASR(), mt=FakeMT())
    assert p.tts is None
    res = p(wav())
    assert res.translation_vi and res.audio_vi is None
    import src.tts.base as base

    cfg["tts"]["enabled"] = True
    monkeypatch.setattr(base, "build_tts", lambda t: (_ for _ in ()).throw(ImportError("vieneu")))
    assert BahnarS2ST(cfg, asr=FakeASR(), mt=FakeMT()).tts is None
