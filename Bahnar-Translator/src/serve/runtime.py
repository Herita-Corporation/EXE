"""Backend suy luận tối ưu cho serving: ASR ONNX Runtime int8, MT CTranslate2 int8, TTS qua HTTP (VieNeu Docker)."""
from __future__ import annotations

import io
import json
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

from src.asr.augment import rms_normalize
from src.data.build_mt_corpus import with_tags
from src.mt.glossary import Glossary, load_glossary
from src.mt.modeling import encode


class ONNXASRModel:
    """Cùng interface với src.asr.decode.ASRModel (logits, greedy, labels, blank_id, processor)."""

    def __init__(self, onnx_path: str | Path, processor_dir: str | Path, threads: int = 4):
        import onnxruntime as ort
        from transformers import AutoProcessor

        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(str(onnx_path), so, providers=["CPUExecutionProvider"])
        self.processor = AutoProcessor.from_pretrained(str(processor_dir))
        vocab = self.processor.tokenizer.get_vocab()
        self.labels = [t for t, _ in sorted(vocab.items(), key=lambda kv: kv[1])]
        self.blank_id = self.processor.tokenizer.pad_token_id
        self.input_names = [i.name for i in self.sess.get_inputs()]

    def logits(self, wave: np.ndarray) -> np.ndarray:
        feats = self.processor.feature_extractor(rms_normalize(wave), sampling_rate=16000, return_tensors="np",
                                                 return_attention_mask=True)
        inputs = {k: feats[k] for k in self.input_names}
        if "attention_mask" in inputs:
            inputs["attention_mask"] = inputs["attention_mask"].astype(np.int64)
        lg = self.sess.run(None, inputs)[0][0].astype(np.float32)
        lg = lg - lg.max(-1, keepdims=True)
        return lg - np.log(np.exp(lg).sum(-1, keepdims=True))

    def greedy(self, logp: np.ndarray) -> str:
        return self.processor.tokenizer.decode(logp.argmax(-1))


class CT2Translator:
    """Cùng interface với src.mt.translate.Translator."""

    def __init__(self, ct2_dir: str | Path, hf_dir: str | Path, glossary: str | Path | None = None,
                 num_beams: int = 5, device: str = "cpu", threads: int = 4):
        import ctranslate2
        from transformers import AutoTokenizer

        self.meta = json.loads((Path(hf_dir) / "mt_meta.json").read_text(encoding="utf-8"))
        self.cfg = {"model": {"family": self.meta["family"], "src_lang": self.meta.get("src_lang"),
                              "tgt_lang": self.meta.get("tgt_lang")}}
        self.tok = AutoTokenizer.from_pretrained(str(hf_dir))
        self.tr = ctranslate2.Translator(str(ct2_dir), device=device, intra_threads=threads)
        self.glossary = Glossary(load_glossary(glossary))
        self.num_beams = num_beams

    def translate(self, texts: list[str], dialect: str = "<ud>", domain: str = "<conv>", **_) -> list[dict]:
        srcs, maps = [], []
        for t in texts:
            s, mp = self.glossary.protect(t) if len(self.glossary) else (t, {})
            srcs.append(with_tags(s, dialect, domain, self.meta.get("tags", True)))
            maps.append(mp)
        ids = encode(self.tok, self.cfg, srcs)["input_ids"]
        toks = [self.tok.convert_ids_to_tokens(x) for x in ids]
        prefix = [[self.cfg["model"]["tgt_lang"]]] * len(toks) if self.cfg["model"]["family"] == "nllb" else None
        res = self.tr.translate_batch(toks, target_prefix=prefix, beam_size=self.num_beams, return_scores=True,
                                      max_decoding_length=256)
        out = []
        for r, mp in zip(res, maps):
            h = self.tok.decode(self.tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=False)
            for t in self.tok.all_special_tokens:
                if not (t.startswith("<g") and t[2:-1].isdigit()):
                    h = h.replace(t, "")
            lp = float(r.scores[0])  # CT2: logprob chuẩn hóa theo độ dài
            out.append({"text": Glossary.restore(" ".join(h.split()), mp), "confidence": float(np.exp(lp)),
                        "logprob": lp})
        return out


class RemoteTTS:
    """Gọi server VieNeu tương thích OpenAI (POST /v1/audio/speech, response_format=wav)."""
    name = "vieneu_remote"

    def __init__(self, url: str, default_voice: str | None = None, model: str = "vieneu-v3-turbo"):
        self.url, self.default_voice, self.model = url, default_voice, model
        self.sample_rate = 48000

    def synthesize(self, text: str, voice: str | None = None) -> np.ndarray:
        body = {"model": self.model, "input": text, "response_format": "wav"}
        if voice or self.default_voice:
            body["voice"] = voice or self.default_voice
        req = urllib.request.Request(self.url, data=json.dumps(body).encode("utf-8"), method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            y, sr = sf.read(io.BytesIO(r.read()), dtype="float32")
        self.sample_rate = sr
        return y
