"""Chuẩn hóa văn bản tiếng Việt trước TTS: số, tiền, giờ, ngày, đơn vị, viết tắt.

Luôn chạy trước mọi engine TTS (kể cả khi engine tự đọc số) để hành vi đồng nhất.
Quy ước tiếng Việt: dấu ``.`` phân tách hàng nghìn, ``,`` là dấu thập phân.
"""
from __future__ import annotations

import regex

DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
SCALES = ["", "nghìn", "triệu", "tỷ"]


def _read_triple(n: int, full: bool) -> str:
    """Đọc số 0..999. ``full`` = có nhóm lớn hơn đứng trước (phải đọc 'không trăm', 'linh')."""
    h, t, u = n // 100, (n // 10) % 10, n % 10
    parts: list[str] = []
    if h > 0 or full:
        parts += [DIGITS[h], "trăm"]
    if t == 0:
        if u > 0 and (h > 0 or full):
            parts.append("linh")
        if u > 0:
            parts.append(DIGITS[u])
    elif t == 1:
        parts.append("mười")
        if u == 5:
            parts.append("lăm")
        elif u > 0:
            parts.append(DIGITS[u])
    else:
        parts += [DIGITS[t], "mươi"]
        if u == 1:
            parts.append("mốt")
        elif u == 4:
            parts.append("tư")
        elif u == 5:
            parts.append("lăm")
        elif u > 0:
            parts.append(DIGITS[u])
    return " ".join(parts)


def number_to_words(n: int) -> str:
    if n < 0:
        return "âm " + number_to_words(-n)
    if n == 0:
        return "không"
    if n >= 10 ** 12:
        hi, lo = divmod(n, 10 ** 9)
        rest = number_to_words(lo) if lo else ""
        return (number_to_words(hi) + " tỷ " + rest).strip()
    groups = []
    while n > 0:
        groups.append(n % 1000)
        n //= 1000
    words: list[str] = []
    for i in range(len(groups) - 1, -1, -1):
        g = groups[i]
        if g == 0:
            continue
        higher = i < len(groups) - 1
        words.append(_read_triple(g, full=higher))
        if SCALES[i]:
            words.append(SCALES[i])
    return " ".join(words)


def read_digits(s: str) -> str:
    return " ".join(DIGITS[int(c)] for c in s if c.isdigit())


def _parse_int(s: str) -> int:
    return int(s.replace(".", "").replace(" ", ""))


def read_decimal(s: str) -> str:
    """'3,5' -> 'ba phẩy năm'; '1.500.000' -> số nguyên."""
    if "," in s:
        a, b = s.split(",", 1)
        frac = number_to_words(int(b)) if not b.startswith("0") else read_digits(b)
        return f"{number_to_words(_parse_int(a) if a else 0)} phẩy {frac}"
    return number_to_words(_parse_int(s))


MONTHS = {4: "tư"}


def _month(m: int) -> str:
    return MONTHS.get(m, number_to_words(m))


UNITS = {
    "km/h": "ki lô mét trên giờ", "km2": "ki lô mét vuông", "m2": "mét vuông", "m²": "mét vuông",
    "km": "ki lô mét", "cm": "xen ti mét", "mm": "mi li mét", "m": "mét",
    "kg": "ki lô gam", "g": "gam", "ha": "héc ta", "ml": "mi li lít", "l": "lít",
    "°C": "độ xê", "độ C": "độ xê", "%": "phần trăm",
    "USD": "đô la Mỹ", "$": "đô la", "VNĐ": "đồng", "VND": "đồng", "vnđ": "đồng", "đ": "đồng",
}

ABBREV = {
    "TP.HCM": "thành phố Hồ Chí Minh", "TP HCM": "thành phố Hồ Chí Minh", "TP.": "thành phố",
    "UBND": "ủy ban nhân dân", "HĐND": "hội đồng nhân dân", "MTTQ": "mặt trận tổ quốc",
    "THPT": "trung học phổ thông", "THCS": "trung học cơ sở", "BHYT": "bảo hiểm y tế",
    "CSGT": "cảnh sát giao thông", "SĐT": "số điện thoại", "ĐT": "điện thoại",
    "v.v.": "vân vân", "v.v": "vân vân", "Q.": "quận", "P.": "phường", "Tp.": "thành phố",
    "WC": "nhà vệ sinh", "wifi": "wai phai", "Wi-Fi": "wai phai", "ATM": "a tê em", "km/h": "ki lô mét trên giờ",
}

_NUM = r"\d{1,3}(?:\.\d{3})+|\d+"
_DEC = rf"(?:{_NUM})(?:,\d+)?"


def _sub_money(m: regex.Match) -> str:
    num, suffix = m.group("num"), m.group("unit")
    if suffix.lower() == "k":
        return number_to_words(_parse_int(num) * 1000) + " đồng"
    return read_decimal(num) + " " + UNITS.get(suffix, "đồng")


def _sub_time(m: regex.Match) -> str:
    h = int(m.group("h"))
    mi = m.group("m")
    out = f"{number_to_words(h)} giờ"
    if mi and int(mi) > 0:
        out += f" {number_to_words(int(mi))} phút"
    return out


def _sub_date_full(m: regex.Match) -> str:
    d, mo, y = int(m.group("d")), int(m.group("m")), int(m.group("y"))
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return m.group(0)
    return f"ngày {number_to_words(d)} tháng {_month(mo)} năm {number_to_words(y)}"


def _sub_date_dm(m: regex.Match) -> str:
    d, mo = int(m.group("d")), int(m.group("m"))
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return m.group(0)
    prefix = "" if m.group("pre") else "ngày "
    return f"{m.group('pre') or ''}{prefix}{number_to_words(d)} tháng {_month(mo)}"


def _sub_unit(m: regex.Match) -> str:
    return read_decimal(m.group("num")) + " " + UNITS[m.group("unit")]


_ORD = {"1": "nhất", "4": "tư"}


def normalize_vi(text: str) -> str:
    if not text:
        return ""
    t = text
    for k in sorted(ABBREV, key=len, reverse=True):
        t = regex.sub(rf"(?<!\p{{L}}){regex.escape(k)}(?!\p{{L}})", ABBREV[k], t)
    # Số khẩn cấp (113 công an, 114 cứu hỏa, 115 cấp cứu...): đọc từng chữ số
    t = regex.sub(r"(?<![\d.,])(11[1-6])(?!\d|[.,]\d)", lambda m: read_digits(m.group(1)), t)
    # Số điện thoại: đọc từng chữ số
    t = regex.sub(r"(?<!\d)(0\d{2,3}[ .]?\d{3}[ .]?\d{3,4})(?!\d)",
                  lambda m: read_digits(m.group(1)), t)
    # Tiền: 150.000 đồng / 150.000đ / 150k / 20 USD
    t = regex.sub(rf"(?P<num>{_DEC})\s*(?P<unit>đồng|VNĐ|VND|vnđ|đ|k|K|USD|\$)(?!\p{{L}})", _sub_money, t)
    # Ngày: 12/02/2026 hoặc 12-02-2026
    t = regex.sub(r"(?<!\d)(?P<d>\d{1,2})[/-](?P<m>\d{1,2})[/-](?P<y>\d{4})(?!\d)", _sub_date_full, t)
    # Ngày: (ngày) 31/7
    t = regex.sub(r"(?P<pre>ngày\s)?(?<!\d)(?P<d>\d{1,2})/(?P<m>\d{1,2})(?![\d/])", _sub_date_dm, t)
    # Giờ: 7h30, 7:30, 7h, 7 giờ 30
    t = regex.sub(r"(?<![\d,.])(?P<h>\d{1,2})(?:h(?!\p{L})|:(?=\d{2})|\s*giờ(?!\p{L}))(?:\s*(?P<m>\d{2})(?!\d)(?:\s*phút)?)?",
                  _sub_time, t)
    # Khoảng: 2-3 ngày
    t = regex.sub(r"(?<!\d)(\d+)\s*-\s*(\d+)(?!\d)",
                  lambda m: f"{number_to_words(int(m.group(1)))} đến {number_to_words(int(m.group(2)))}", t)
    # Số thứ tự: thứ 2, lần thứ 1
    t = regex.sub(r"\bthứ\s+(\d+)\b",
                  lambda m: "thứ " + _ORD.get(m.group(1), number_to_words(int(m.group(1)))), t)
    # Đơn vị
    unit_alt = "|".join(regex.escape(u) for u in sorted(
        [u for u in UNITS if u not in {"đ", "VNĐ", "VND", "vnđ", "USD", "$"}], key=len, reverse=True))
    t = regex.sub(rf"(?P<num>{_DEC})\s*(?P<unit>{unit_alt})(?!\p{{L}})", _sub_unit, t)
    # Số còn lại
    t = regex.sub(_DEC, lambda m: read_decimal(m.group(0)), t)
    return regex.sub(r"\s+", " ", t).strip()
