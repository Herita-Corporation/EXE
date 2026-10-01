# Bahnar-Translator — Ba Na → Việt (ASR w2v-bert-2.0 + KenLM, MT BARTpho). CPU image.
# Build context: Bahnar-Translator/  (docker-compose builds it with --profile translator)
# Models are NOT baked in: mount ./models (downloaded with scripts/models_hub.py) at /app/models.
FROM python:3.11-slim

# ffmpeg: decode m4a/mp3/webm from phones · libsndfile1: soundfile · build tools: kenlm
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libsndfile1 build-essential cmake curl \
      libboost-program-options-dev libboost-system-dev libboost-thread-dev libboost-test-dev \
      zlib1g-dev libbz2-dev liblzma-dev libeigen3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir "torch>=2.6,<2.12" --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --no-deps pyctcdecode==0.5.0 pygtrie==2.6.2 \
    && (pip install --no-cache-dir https://github.com/kpu/kenlm/archive/master.zip \
        || echo "WARNING: kenlm build failed -> ASR decodes greedily (WER ~1-2 points higher)")

COPY . /app/
# Fail the BUILD (not the first user request) if any runtime module/dependency is missing.
RUN python -c "import src.serve.app, src.pipeline.s2st, src.asr.decode, src.mt.translate, src.mt.modeling, src.serve.runtime, src.pipeline.vad, src.tts.base; print('runtime imports OK')"

ENV PIPELINE_CONFIG=pipeline_prod.yaml PYTHONUNBUFFERED=1 OMP_NUM_THREADS=4
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS http://localhost:8080/healthz || exit 1
# 1 worker: models are held in RAM (~5 GB); more workers = more copies.
CMD ["uvicorn", "src.serve.app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
