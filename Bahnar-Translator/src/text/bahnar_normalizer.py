"""Chuẩn hóa văn bản Ba Na — áp dụng GIỐNG NHAU cho mọi nguồn (cuong06, EAAI24, từ điển, tourism).

Quyết định thiết kế (xem docs/data_audit.md):
* NFC. ``ơ̆`` và ``ư̆`` không có dạng precomposed → sau NFC vẫn là chữ + U+0306.
  Vocab CTC giữ U+0306 như MỘT token riêng (giống vocab ``bdq`` của facebook/mms-1b-all),
  nhờ vậy vocab khớp với adapter MMS và không phát sinh ``[UNK]``.
* Dấu ``'`` là âm vị ('Bok, 'nhŏng, P'lơk) → không bao giờ xóa khi đứng trước chữ cái.
  Mọi biến thể (’ ‘ ʼ ´ `) hợp nhất về ``'``. ``''`` (dùng làm ngoặc kép trong EAAI24) → ``"``.
* Gạch nối trong từ (Kei-Dei, ling-lang) giữ nguyên, mọi loại gạch Unicode → ``-``.
* Mapping mức KÝ TỰ được tự áp dụng (CHAR_MAP). Mapping mức TỪ giữa phương ngữ KHÔNG làm ở đây.
* ASR target: lowercase, bỏ dấu câu; CHỮ SỐ được GIỮ lại để bộ lọc dữ liệu phát hiện và loại
  câu có số khỏi train/eval ASR (xóa số sẽ làm transcript lệch với audio).
"""
from __future__ import annotations

import unicodedata

import regex

BREVE = "̆"
CARON = "̌"

APOS = {"’": "'", "‘": "'", "ʼ": "'", "´": "'", "`": "'", "′": "'",
        "ꞌ": "'", "ʻ": "'"}  # ꞌ (saltillo), ʻ cũng là dấu nháy âm vị

# Mapping mức ký tự — an toàn, tự áp dụng. Mỗi mục phải được liệt kê trong data_audit.md.
CHAR_MAP = {
    "Ð": "Đ",  # Ð (Eth, gõ nhầm) -> Đ
    "ð": "đ",  # ð -> đ
    " ": " ",       # NBSP
    "​": "",        # zero-width space
    "‌": "",
    "‍": "",
    "﻿": "",
    "“": '"',
    "”": '"',
}

_DASHES = regex.compile(r"[‐-―−]")
_WS = regex.compile(r"\s+")
_DOUBLE_APOS = regex.compile(r"''+")
# ' chỉ giữ khi đứng ngay trước một chữ cái (âm vị); các ' còn lại là dấu nháy câu.
_APOS_NOT_PHONEME = regex.compile(r"'(?!\p{L})")
# - chỉ giữ khi nằm giữa hai chữ cái.
_HYPHEN_NOT_INTRAWORD = regex.compile(r"(?<!\p{L}\p{M}*)-|-(?!\p{L})")
_ASR_DISALLOWED = regex.compile(r"[^\p{L}\p{M}\p{N}'\- ]+")
_DIGIT = regex.compile(r"\p{N}")
# Chữ ngoài hệ Latin (vd Khmer, Cyrillic, IPA) — pseudo-label ASR đôi khi sinh sai hệ chữ
_NON_LATIN = regex.compile(r"[^\p{Latin}\p{Common}\p{Inherited}]|[ɐ-ʯǝ]")


# Người dùng đã duyệt (27/09/2026): caron là lỗi gõ của breve → chuyển mặc định cho MỌI nguồn.
FIX_CARON_DEFAULT = True


def caron_to_breve(text: str) -> str:
    """ǒ/ě (caron U+030C) là lỗi gõ của breve trong chính tả Ba Na (vd ``khěi`` ~ ``khĕi``).

    Đã được người dùng duyệt → bật mặc định (``FIX_CARON_DEFAULT``); truyền ``fix_caron=False`` để tắt.
    """
    return unicodedata.normalize("NFC", unicodedata.normalize("NFD", text).replace(CARON, BREVE))


def normalize_bahnar(text: str, for_asr: bool, fix_caron: bool | None = None) -> str:
    if text is None:
        return ""
    text = unicodedata.normalize("NFC", text)
    for k, v in APOS.items():
        text = text.replace(k, v)
    for k, v in CHAR_MAP.items():
        text = text.replace(k, v)
    if FIX_CARON_DEFAULT if fix_caron is None else fix_caron:
        text = caron_to_breve(text)
    text = _DASHES.sub("-", text)
    text = _DOUBLE_APOS.sub('"', text)
    # Chuẩn hóa lại sau các thay thế (vd Ð->Đ không ảnh hưởng dấu, nhưng giữ bất biến NFC).
    text = unicodedata.normalize("NFC", text)
    if for_asr:
        text = text.lower()
        text = _ASR_DISALLOWED.sub(" ", text)
        text = _APOS_NOT_PHONEME.sub(" ", text)
        text = _HYPHEN_NOT_INTRAWORD.sub(" ", text)
    return _WS.sub(" ", text).strip()


def normalize_for_mt(text: str, fix_caron: bool | None = None) -> str:
    return normalize_bahnar(text, for_asr=False, fix_caron=fix_caron)


def normalize_for_asr(text: str, fix_caron: bool | None = None) -> str:
    return normalize_bahnar(text, for_asr=True, fix_caron=fix_caron)


def has_digit(text: str) -> bool:
    return bool(_DIGIT.search(text or ""))


def has_non_latin(text: str) -> bool:
    return bool(_NON_LATIN.search(text or ""))


def graphemes(text: str) -> list[str]:
    """Tách theo grapheme cluster (``ơ̆`` là MỘT grapheme dù gồm 2 codepoint)."""
    return regex.findall(r"\X", text)


def words(text: str) -> list[str]:
    return [w for w in normalize_for_asr(text).split(" ") if w]
