"""FastAPI service — Phase 5.2. Hợp đồng API cho backend: docs/API.md

    uvicorn src.serve.app:app --host 0.0.0.0 --port 8080
Biến môi trường:
    PIPELINE_CONFIG     config pipeline (mặc định pipeline.yaml; server thật: pipeline_prod.yaml)
    TRANSLATOR_API_KEY  nếu đặt → mọi /v1/* bắt buộc header `X-API-Key: <giá trị>` (khuyến nghị khi deploy)
    CORS_ORIGINS        danh sách origin cách nhau dấu phẩy, vd "https://app.example.com" (chỉ cần nếu
                        frontend gọi thẳng service — khuyến nghị để BACKEND gọi, không lộ API key)
    FEEDBACK_PATH       nơi lưu phản hồi người dùng
"""
from __future__ import annotations

import hmac
import json
import os
import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.pipeline.s2st import BahnarS2ST, S2STResult, wav_bytes
from src.utils import resolve_path

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
app = FastAPI(title="Phiên dịch Ba Na → Việt", version="0.1.0")
if os.environ.get("CORS_ORIGINS"):
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.environ["CORS_ORIGINS"].split(",")],
                       allow_methods=["GET", "POST"], allow_headers=["*"])
_pipeline: BahnarS2ST | None = None


def require_api_key(x_api_key: str | None = Header(None)) -> None:
    """Đọc env lúc gọi (không lúc import) → đổi key chỉ cần khởi động lại, test cũng đặt được."""
    key = os.environ.get("TRANSLATOR_API_KEY")
    if key and not hmac.compare_digest(x_api_key or "", key):
        raise HTTPException(401, "Sai hoặc thiếu header X-API-Key")


AUTH = [Depends(require_api_key)]


def get_pipeline() -> BahnarS2ST:
    global _pipeline
    if _pipeline is None:
        _pipeline = BahnarS2ST(os.environ.get("PIPELINE_CONFIG", "pipeline.yaml"))
    return _pipeline


class TextRequest(BaseModel):
    text: str
    synthesize: bool = False
    voice: str | None = None


class Feedback(BaseModel):
    consent: bool
    transcript_bdq: str | None = None
    translation_vi: str | None = None
    correction_vi: str | None = None
    note: str | None = None


async def _read(audio: UploadFile) -> bytes:
    data = await audio.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File quá lớn")
    if not data:
        raise HTTPException(400, "Thiếu audio")
    return data


@app.get("/healthz")
def healthz():
    return {"status": "ok", "pipeline_loaded": _pipeline is not None}


@app.post("/v1/translate/bahnar-speech", dependencies=AUTH)
async def speech(audio: UploadFile = File(...), voice: str | None = Form(None), synthesize: bool = Form(True),
                 p: BahnarS2ST = Depends(get_pipeline)):
    data = await _read(audio)
    try:
        res: S2STResult = p(data, voice=voice, synthesize=synthesize)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return res.to_dict(include_audio=True)


@app.post("/v1/translate/bahnar-speech/stream", dependencies=AUTH)
async def speech_stream(audio: UploadFile = File(...), voice: str | None = Form(None),
                        p: BahnarS2ST = Depends(get_pipeline)):
    """NDJSON: transcript trước, rồi bản dịch, rồi audio (base64) và 'done'."""
    import base64

    data = await _read(audio)

    def gen():
        try:
            for ev, payload in p.stream(data, voice=voice):
                if ev == "audio":
                    payload = {"sample_rate": payload["sample_rate"],
                               "wav_base64": base64.b64encode(payload["wav"]).decode("ascii")}
                yield json.dumps({"event": ev, **payload}, ensure_ascii=False) + "\n"
        except ValueError as e:
            yield json.dumps({"event": "error", "message": str(e)}, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@app.post("/v1/translate/bahnar-text", dependencies=AUTH)
def text(req: TextRequest, p: BahnarS2ST = Depends(get_pipeline)):
    if not req.text.strip():
        raise HTTPException(400, "Văn bản rỗng")
    t0 = time.perf_counter()
    mt = p.translate_text(req.text)
    out = {"translation_vi": mt["text"], "confidence": {"mt": mt["confidence"]},
           "disclaimer": p.cfg["confidence"]["disclaimer"]}
    if req.synthesize and p.tts is not None:
        import base64

        y, sr = p.speak(mt["text"], req.voice)
        out["audio_vi_wav_base64"] = base64.b64encode(wav_bytes(y, sr)).decode("ascii")
        out["sample_rate"] = sr
    out["latency_ms"] = {"total": 1000 * (time.perf_counter() - t0)}
    return out


@app.post("/v1/feedback", dependencies=AUTH)
def feedback(fb: Feedback):
    """Nút báo lỗi: CHỈ lưu khi người dùng đồng ý; không lưu audio."""
    if not fb.consent:
        raise HTTPException(400, "Cần sự đồng ý của người dùng để lưu phản hồi")
    path = Path(os.environ.get("FEEDBACK_PATH", resolve_path("outputs/feedback/feedback.jsonl")))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": time.time(), **fb.model_dump(exclude={"consent"})}, ensure_ascii=False) + "\n")
    return {"status": "saved"}
