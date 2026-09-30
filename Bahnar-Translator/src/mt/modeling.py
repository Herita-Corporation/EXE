"""Nạp tokenizer + model MT (BARTpho / NLLB), thêm token tag/placeholder/ngôn ngữ, mở rộng vocab Ba Na."""
from __future__ import annotations

from collections import Counter
from typing import Iterable

import regex
import torch

from src.data.sources import ALL_TAGS
from src.mt.glossary import PLACEHOLDERS
from src.text.bahnar_normalizer import normalize_for_mt
from src.utils import get_logger

log = get_logger("mt.modeling")


def _bartpho_fast_tokenizer(name: str):
    """BARTpho dùng tokenizer FAST dựng từ `tokenizer.json` của chính repo.

    BartphoTokenizer (slow) trên transformers 5 có lỗi: `convert_tokens_to_ids` trả id SentencePiece GỐC
    (tới ~250k) cho mảnh không có trong từ điển rút gọn 40k → `add_tokens` tưởng token "đã có" và gán id
    vượt số dòng embedding (đo thật: 71 token, gồm đúng `ĕ ĭ ̆` cần sửa UNK) → crash lúc khởi tạo hoặc
    lỗi CUDA lúc train. Bản fast cho id giống hệt bản slow với văn bản thường (đã so sánh) và thêm token đúng.
    """
    from pathlib import Path

    from huggingface_hub import hf_hub_download
    from transformers import PreTrainedTokenizerFast

    p = Path(name)
    tj = p / "tokenizer.json" if p.is_dir() else Path(hf_hub_download(name, "tokenizer.json"))
    return PreTrainedTokenizerFast(tokenizer_file=str(tj), bos_token="<s>", eos_token="</s>", unk_token="<unk>",
                                   pad_token="<pad>", mask_token="<mask>", cls_token="<s>", sep_token="</s>")


def load_tokenizer(cfg: dict):
    from transformers import AutoTokenizer

    m = cfg["model"]
    if m["family"] == "bartpho":
        return _bartpho_fast_tokenizer(m["name"])
    kw = {}
    if m["family"] == "nllb":
        kw = {"src_lang": m.get("tgt_lang", "vie_Latn"), "tgt_lang": m["tgt_lang"]}
    return AutoTokenizer.from_pretrained(m["name"], **kw)


def check_ids(tok, model, texts: list[str], added: list[str]) -> None:
    """Chặn sớm: mọi id (token thêm mới + mã hóa văn bản thật) phải < số dòng embedding, và id token đặc biệt
    phải khớp config model. Sai ở đây nghĩa là train sẽ lỗi CUDA "device-side assert" giữa chừng."""
    n = model.get_input_embeddings().weight.shape[0]
    bad = [(w, tok.convert_tokens_to_ids(w)) for w in added if tok.convert_tokens_to_ids(w) >= n]
    if bad:
        raise RuntimeError(f"{len(bad)} token thêm mới có id >= số embedding ({n}): {bad[:5]}")
    mx = max((max(ids) for ids in tok(texts, add_special_tokens=False)["input_ids"] if ids), default=0)
    if mx >= n:
        raise RuntimeError(f"Mã hóa văn bản ra id {mx} >= số embedding ({n})")
    for name in ("pad_token_id", "eos_token_id", "bos_token_id"):
        want = getattr(model.config, name, None)
        have = getattr(tok, name, None)
        if want is not None and have is not None and want != have:
            raise RuntimeError(f"{name} lệch: tokenizer={have} model={want}")
    log.info("Kiểm tra id OK: %d embedding, id lớn nhất khi mã hóa mẫu = %d", n, mx)


_TAG = regex.compile(r"<[^<>\s]+>")


def _clean(text: str) -> str:
    """Chuẩn hóa + bỏ tag nguồn/phương ngữ (<kt>, <bible>…) và placeholder (<g0>): chúng là token đặc biệt
    riêng, không được đếm như từ Ba Na khi đo fertility / chọn từ để mở rộng vocab."""
    return " ".join(_TAG.sub(" ", normalize_for_mt(text)).split())


def fertility(tokenizer, texts: Iterable[str]) -> dict:
    """Số subword / từ và tỷ lệ UNK trên văn bản Ba Na (không tính tag)."""
    n_words = n_tok = n_unk = 0
    unk_id = tokenizer.unk_token_id
    unk_words: Counter = Counter()
    for t in texts:
        t = _clean(t)
        words = t.split()
        ids = tokenizer(t, add_special_tokens=False)["input_ids"]
        n_words += len(words)
        n_tok += len(ids)
        u = sum(1 for i in ids if i == unk_id)
        n_unk += u
        if u:
            for w in words:
                if unk_id in tokenizer(w, add_special_tokens=False)["input_ids"]:
                    unk_words[w] += 1
    return {"fertility": n_tok / max(n_words, 1), "unk_rate": n_unk / max(n_tok, 1),
            "words": n_words, "top_unk_words": unk_words.most_common(20)}


def words_to_add(tokenizer, texts: Iterable[str], max_words: int, min_count: int = 3,
                 min_pieces: int = 3) -> list[str]:
    """Từ Ba Na hay gặp mà tokenizer cắt vụn (≥ min_pieces mảnh) hoặc ra UNK → thêm làm token nguyên."""
    c: Counter = Counter()
    for t in texts:
        c.update(_clean(t).split())
    out = []
    unk = tokenizer.unk_token_id
    for w, n in c.most_common():
        if n < min_count or len(out) >= max_words:
            break
        ids = tokenizer(w, add_special_tokens=False)["input_ids"]
        if unk in ids or len(ids) >= min_pieces:
            out.append(w)
    return out


def unk_chars(tokenizer, texts: Iterable[str]) -> list[str]:
    """Ký tự mà tokenizer biến thành UNK (vd U+0306, ĭ ĕ ŏ ŭ với BARTpho) → thêm làm token mức ký tự."""
    chars = set()
    for t in texts:
        chars.update(_clean(t))
    unk = tokenizer.unk_token_id
    return sorted(c for c in chars if not c.isspace() and unk in tokenizer(c, add_special_tokens=False)["input_ids"])


def _init_new_embeddings(model, tokenizer, old_tokenizer_len: int, new_words: list[str], base_tok) -> None:
    """Embedding của từ mới = trung bình embedding các mảnh (theo tokenizer gốc), bỏ UNK."""
    emb = model.get_input_embeddings().weight
    mean = emb[:old_tokenizer_len].mean(0)
    with torch.no_grad():
        for w in new_words:
            nid = tokenizer.convert_tokens_to_ids(w)
            if nid < old_tokenizer_len:  # đã có sẵn trong vocab gốc (add_tokens bỏ qua) → giữ embedding pretrained
                continue
            pieces = [i for i in base_tok(w, add_special_tokens=False)["input_ids"] if i != base_tok.unk_token_id]
            emb[nid] = emb[pieces].mean(0) if pieces else mean


def prepare(cfg: dict, bahnar_texts: list[str] | None = None):
    """Trả (tokenizer, model). Thêm: tag, placeholder glossary, (NLLB) bdq_Latn, (tùy chọn) từ Ba Na."""
    from transformers import AddedToken, AutoModelForSeq2SeqLM

    m = cfg["model"]
    tok = load_tokenizer(cfg)
    base_tok = load_tokenizer(cfg)
    model = AutoModelForSeq2SeqLM.from_pretrained(m["name"])
    old_len = len(tok)
    special = list(ALL_TAGS) + PLACEHOLDERS
    if m["family"] == "nllb":
        special = [m["src_lang"]] + special
    # add_tokens(special_tokens=True) tương thích transformers 4.x và 5.x
    tok.add_tokens([AddedToken(t, special=True, normalized=False) for t in special], special_tokens=True)

    new_words: list[str] = []
    ext = m.get("extend_vocab", "auto")
    if bahnar_texts:
        fallback = unk_chars(base_tok, bahnar_texts)
        if fallback:
            tok.add_tokens([AddedToken(c, normalized=False) for c in fallback])
            new_words += fallback
            log.info("Thêm %d ký tự dự phòng (bị UNK): %s", len(fallback), fallback)
    if bahnar_texts and ext:
        f = fertility(base_tok, bahnar_texts[:20000])
        log.info("Fertility %s trên Ba Na: %.2f, UNK %.4f", m["name"], f["fertility"], f["unk_rate"])
        if ext is True or (ext == "auto" and (f["fertility"] > 3 or f["unk_rate"] > 0.01)):
            words = words_to_add(base_tok, bahnar_texts, m.get("extend_vocab_max_words", 8000))
            tok.add_tokens([AddedToken(w, single_word=True, normalized=False) for w in words])
            new_words += words
            log.info("Mở rộng vocab: +%d từ Ba Na", len(words))
    model.resize_token_embeddings(len(tok))
    check_ids(tok, model, (bahnar_texts or [])[:3000], special + new_words)
    emb = model.get_input_embeddings().weight
    with torch.no_grad():
        if m["family"] == "nllb":
            src_id = tok.convert_tokens_to_ids(m["src_lang"])
            init_id = tok.convert_tokens_to_ids(m.get("src_lang_init_from", "vie_Latn"))
            emb[src_id] = emb[init_id]
        # tag/placeholder: khởi tạo gần trung bình để không làm lệch phân phối
        mean = emb[:old_len].mean(0)
        for t in special:
            if m["family"] == "nllb" and t == m["src_lang"]:
                continue
            emb[tok.convert_tokens_to_ids(t)] = mean + 0.01 * torch.randn_like(mean)
    if new_words:
        _init_new_embeddings(model, tok, old_len, new_words, base_tok)
    if m["family"] == "nllb":
        model.generation_config.forced_bos_token_id = tok.convert_tokens_to_ids(m["tgt_lang"])
        model.generation_config.decoder_start_token_id = tok.eos_token_id
    return tok, model


def encode(tok, cfg: dict, srcs: list[str], tgts: list[str] | None = None, max_src: int = 256,
           max_tgt: int = 256) -> dict:
    """Mã hóa KHÔNG phụ thuộc cơ chế src_lang của tokenizer (khác nhau giữa transformers 4/5).

    NLLB : input = [bdq_Latn] X </s>,  labels = [vie_Latn] Y </s>
    BART : input = <s> X </s>,         labels = <s> Y </s>
    """
    m = cfg["model"]
    if m["family"] == "nllb":
        pre_s, pre_t = [tok.convert_tokens_to_ids(m["src_lang"])], [tok.convert_tokens_to_ids(m["tgt_lang"])]
    else:
        pre_s = pre_t = [tok.bos_token_id]
    eos = [tok.eos_token_id]

    def enc(texts, pre, max_len):
        ids = tok(list(texts), add_special_tokens=False, truncation=True, max_length=max_len - 2)["input_ids"]
        return [pre + x + eos for x in ids]

    out = {"input_ids": enc(srcs, pre_s, max_src)}
    out["attention_mask"] = [[1] * len(x) for x in out["input_ids"]]
    if tgts is not None:
        out["labels"] = enc(tgts, pre_t, max_tgt)
    return out
