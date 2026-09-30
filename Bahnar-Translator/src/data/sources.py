"""Phân loại nguồn, nhóm (để split không rò rỉ), phương ngữ và tag domain cho từng dòng.

Nguồn quan sát được trong `cuong06` (xem data_audit.md):
* ``bible``  : speaker ``KT_0``, id ``1CO_01_001`` (SÁCH_CHƯƠNG_CÂU) → nhóm = sách.
* ``radio``  : id ``TS-Bahnar-6h50-SANG-12-02-2026_new_8``, ``Tong-hop-BAHNAR_...``, ``oneway_radio...``
               → nhóm = chương trình + ngày (bỏ hậu tố số câu).
* ``youtube``: id ``<videoId 11 ký tự>_<seg>`` → nhóm = video.
* ``ura``    : split validation/test gốc (URA-HCMUT 2023, tin tức), speaker ``KT_* / GL_* / BD_*``.
* ``tv``     : chương trình VTV ``..._[TIẾNG_BA_NA]_<tên>_｜_VTV5_<seg>`` → nhóm = chương trình.
* ``other``  : mọi pattern còn lại (vd ``vid12_3``) → nhóm = id bỏ hậu tố ``_<số>``.
"""
from __future__ import annotations

import regex

BIBLE_RE = regex.compile(r"^(?P<book>[1-3]?[A-Z]{2,3})_(?P<ch>\d+)_(?P<vs>\d+)$")
RADIO_RE = regex.compile(r"(ts-?ba|tong-hop|oneway_radio|radio|bah?r?nar)", regex.IGNORECASE)
RADIO_WEAK_RE = regex.compile(r"(bana|^bah\d|^ba_new)", regex.IGNORECASE)  # kiểm SAU YouTube
TV_RE = regex.compile(r"(\[TIẾNG_BA_NA\]|VTV)", regex.IGNORECASE)
YT_RE = regex.compile(r"^(?P<vid>[A-Za-z0-9_-]{11})_(?P<seg>\d+)$")
# bỏ hậu tố "_new[-k]_<câu>[_<câu>]" nhưng giữ ngày/số chương trình trong id
RADIO_SUFFIX = regex.compile(r"((_new(-\d+)?)?_\d+)+$")

DOMAIN_TAG = {
    "bible": "<bible>", "radio": "<radio>", "tv": "<radio>", "youtube": "<web>", "other": "<web>",
    "ura": "<news>", "eaai24": "<conv>", "dict": "<dict>", "tourism": "<conv>",
}
DIALECT_TAGS = ["<kt>", "<gl>", "<bd>", "<ud>"]
ALL_TAGS = DIALECT_TAGS + sorted(set(DOMAIN_TAG.values())) + ["<bt>"]


def classify(uid: str, speaker_id: str | None, split: str) -> str:
    if split in ("validation", "test"):
        return "ura"
    if BIBLE_RE.match(uid) and (speaker_id or "").startswith("KT"):
        return "bible"
    if TV_RE.search(uid):
        return "tv"
    if RADIO_RE.search(uid):
        return "radio"
    if YT_RE.match(uid):
        return "youtube"
    if RADIO_WEAK_RE.search(uid):
        return "radio"
    return "other"


def group_key(uid: str, source: str) -> str:
    """Khóa nhóm: mọi câu cùng nhóm phải nằm cùng một split."""
    if source == "bible":
        m = BIBLE_RE.match(uid)
        return f"bible:{m.group('book')}"
    if source in ("radio", "tv", "other"):
        return f"{source}:{RADIO_SUFFIX.sub('', uid, count=1)}"
    if source == "youtube":
        return f"yt:{YT_RE.match(uid).group('vid')}"
    return f"{source}:{uid}"


def bible_book(uid: str) -> str | None:
    m = BIBLE_RE.match(uid)
    return m.group("book") if m else None


def dialect(speaker_id: str | None, source: str) -> str:
    """Tag phương ngữ. Chỉ gán khi có căn cứ (tiền tố tỉnh của speaker_id); còn lại ``<ud>``."""
    if source in ("eaai24", "dict"):
        return "<bd>"  # EAAI24 = Ba Na Bình Định (dataset card)
    sp = (speaker_id or "").upper()
    for pre, tag in (("KT", "<kt>"), ("GL", "<gl>"), ("BD", "<bd>")):
        if sp.startswith(pre):
            return tag
    return "<ud>"


def id_pattern(uid: str) -> str:
    """Pattern thô để liệt kê trong audit (videoId → <yt>, chữ số → #)."""
    m = YT_RE.match(uid)
    if m and not BIBLE_RE.match(uid):
        return "<yt>_#"
    return regex.sub(r"\d+", "#", uid)
