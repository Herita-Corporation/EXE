"""Dịch Ba Na → Việt: beam search, glossary, confidence (logprob trung bình theo token)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from src.data.build_mt_corpus import with_tags
from src.mt.glossary import Glossary, load_glossary
from src.mt.modeling import encode


class Translator:
    def __init__(self, model_dir: str | Path, device: str | None = None, glossary: str | Path | None = None,
                 num_beams: int = 5, max_length: int = 256):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_dir = Path(model_dir)
        self.meta = json.loads((model_dir / "mt_meta.json").read_text(encoding="utf-8"))
        self.cfg = {"model": {"family": self.meta["family"], "src_lang": self.meta.get("src_lang"),
                              "tgt_lang": self.meta.get("tgt_lang")}}
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tok = AutoTokenizer.from_pretrained(str(model_dir))
        self.model = AutoModelForSeq2SeqLM.from_pretrained(str(model_dir)).to(self.device).eval()
        self.glossary = Glossary(load_glossary(glossary))
        self.num_beams, self.max_length = num_beams, max_length
        self.max_src = min(256, getattr(self.model.config, "max_position_embeddings", 256) or 256)
        self.max_length = min(max_length, self.max_src)

    def translate(self, texts: list[str], dialect: str = "<ud>", domain: str = "<conv>",
                  batch_size: int = 32, tags: list[tuple[str, str]] | None = None) -> list[dict]:
        """``tags``: (dialect, domain) riêng cho từng câu (dùng khi eval oracle); mặc định dùng chung."""
        import torch

        out: list[dict] = []
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            tg = tags[i:i + batch_size] if tags else [(dialect, domain)] * len(chunk)
            srcs, maps = [], []
            for t, (d, dm) in zip(chunk, tg):
                s, mp = self.glossary.protect(t) if len(self.glossary) else (t, {})
                srcs.append(with_tags(s, d, dm, self.meta.get("tags", True)))
                maps.append(mp)
            e = encode(self.tok, self.cfg, srcs, max_src=self.max_src)
            L = max(map(len, e["input_ids"]))
            pad = self.tok.pad_token_id
            ids = torch.tensor([x + [pad] * (L - len(x)) for x in e["input_ids"]], device=self.device)
            att = torch.tensor([x + [0] * (L - len(x)) for x in e["attention_mask"]], device=self.device)
            with torch.inference_mode():
                seqs = self.model.generate(input_ids=ids, attention_mask=att, num_beams=self.num_beams,
                                           max_length=self.max_length)
                scores = self._mean_logprob(ids, att, seqs).cpu().numpy()
            hyps = self.tok.batch_decode(seqs, skip_special_tokens=False)
            for h, mp, sc in zip(hyps, maps, scores):
                h = self._clean(h)
                out.append({"text": Glossary.restore(h, mp), "confidence": float(np.exp(sc)), "logprob": float(sc)})
        return out

    def _mean_logprob(self, ids, att, seqs):
        """Logprob trung bình theo token của chuỗi đã sinh (1 lượt forward; không giữ scores từng bước beam)."""
        import torch

        dec_in, target = seqs[:, :-1], seqs[:, 1:]
        logits = self.model(input_ids=ids, attention_mask=att, decoder_input_ids=dec_in).logits
        lp = torch.log_softmax(logits.float(), -1).gather(-1, target.unsqueeze(-1)).squeeze(-1)
        mask = (target != self.tok.pad_token_id).float()
        return (lp * mask).sum(1) / mask.sum(1).clamp(min=1)

    def _clean(self, h: str) -> str:
        # bỏ special token nhưng GIỮ placeholder <gN> để restore
        for t in self.tok.all_special_tokens:
            if not (t.startswith("<g") and t[2:-1].isdigit()):
                h = h.replace(t, "")
        return " ".join(h.split())
