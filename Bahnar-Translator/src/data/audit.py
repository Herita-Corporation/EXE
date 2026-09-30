"""Audit dữ liệu (Phase 0.1) → data/processed/audit.json + docs/data_audit.md.

Phần tự sinh nằm giữa ``<!-- AUTO:BEGIN -->`` và ``<!-- AUTO:END -->``; phần điền tay
(license, spot-check, quyết định) được giữ nguyên khi chạy lại.

    python -m src.data.audit --config data.yaml [--spot-check]
"""
from __future__ import annotations

import argparse
import json
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from src.data.dialect_stats import compare_sources
from src.data.loaders import eaai24_file_stats, load_cuong06_meta, load_eaai24, load_eaai24_dict
from src.data.quality import add_quality_columns, export_spot_check
from src.data.sources import id_pattern
from src.text.bahnar_normalizer import CHAR_MAP, normalize_for_mt
from src.utils import get_logger, load_config, resolve_path

log = get_logger("audit")
AUTO_BEGIN, AUTO_END = "<!-- AUTO:BEGIN -->", "<!-- AUTO:END -->"


def _pct(s: pd.Series, qs=(1, 5, 50, 95, 99)) -> dict:
    s = pd.to_numeric(s, errors="coerce").dropna()
    return {f"p{q}": round(float(np.percentile(s, q)), 3) for q in qs} if len(s) else {}


def charset(texts) -> Counter:
    c: Counter = Counter()
    for t in texts:
        c.update(unicodedata.normalize("NFC", t or ""))
    return c


def unique_pairs(df: pd.DataFrame) -> int:
    return len({(normalize_for_mt(b), (v or "").strip()) for b, v in zip(df.ba, df.vi)})


def run_audit(cfg: dict, spot_check: bool = False) -> dict:
    cu = add_quality_columns(load_cuong06_meta(cfg["paths"]["meta"]))
    ea = add_quality_columns(load_eaai24(cfg["paths"]["eaai24"]))
    dic = load_eaai24_dict(cfg["paths"]["eaai24"])
    cu["pattern"] = cu.uid.map(id_pattern)
    r: dict = {"cuong06": {}, "eaai24": {}, "dict": {}}

    # ---- cuong06 ----
    c = r["cuong06"]
    c["shards_loaded"] = int(cu[cu.split_orig == "train"].shard.nunique())
    by_split = cu.groupby("split_orig")
    c["per_split"] = {
        s: {"rows": int(len(g)), "hours": round(g.duration.sum() / 3600, 2),
            "has_audio": int(g.has_audio.sum()), "audio_none": int((~g.has_audio.astype(bool)).sum()),
            "hours_with_audio": round(g[g.has_audio.astype(bool)].duration.sum() / 3600, 2),
            "over_30s": int((g.duration > 30).sum()), "duration_pct": _pct(g.duration),
            "unique_pairs": unique_pairs(g)}
        for s, g in by_split
    }
    c["per_source"] = {
        s: {"rows": int(len(g)), "hours": round(g.duration.sum() / 3600, 2), "groups": int(g.group.nunique()),
            "unique_pairs": unique_pairs(g), "has_digit_frac": round(float(g.has_digit.mean()), 4),
            "non_latin_frac": round(float(g.non_latin.mean()), 4),
            "repeat_loop_frac(>0.35)": round(float((g.repeat_frac > cfg["quality"]["max_repeat_ngram_frac"]).mean()), 4),
            "cps_pct": _pct(g.cps), "len_ratio_pct": _pct(g.len_ratio)}
        for s, g in cu.groupby("source")
    }
    c["speakers"] = (cu.groupby(["split_orig", "speaker_id"]).duration.agg(["count", "sum"])
                     .assign(hours=lambda d: (d["sum"] / 3600).round(2)).drop(columns="sum")
                     .reset_index().to_dict(orient="records"))
    c["id_patterns"] = (cu.groupby(["source", "pattern"]).size().rename("n").reset_index()
                        .sort_values("n", ascending=False).to_dict(orient="records"))
    c["text_en_note"] = "text_en là bản sinh máy từ text_vi → KHÔNG dùng."

    # ---- EAAI24 ----
    e = r["eaai24"]
    e["files"] = eaai24_file_stats(cfg["paths"]["eaai24"])
    e["per_split"] = {s: {"rows": int(len(g)), "unique_pairs": unique_pairs(g),
                          "len_ratio_pct": _pct(g.len_ratio)} for s, g in ea.groupby("split_orig")}
    e["card_claims"] = {"train": 16105, "valid": 1987, "test": 1988, "dict": 13029}
    lic = resolve_path(cfg["paths"]["eaai24"]) / "LICENSE"
    e["license_file_bytes"] = lic.stat().st_size if lic.exists() else None
    r["dict"] = {"entries": int(len(dic)), "unique_ba": int(dic.ba.nunique()),
                 "multiword_ba_frac": round(float((dic.ba.str.split().str.len() > 1).mean()), 4)}

    # ---- Charset ----
    cs = {"cuong06_train": charset(cu[cu.split_orig == "train"].ba),
          "cuong06_ura": charset(cu[cu.split_orig != "train"].ba),
          "eaai24": charset(ea.ba), "dict": charset(dic.ba)}
    all_chars = sorted(set().union(*[set(v) for v in cs.values()]))
    r["charset"] = [
        {"cp": f"U+{ord(ch):04X}", "char": ch if unicodedata.category(ch)[0] != "M" else "◌" + ch,
         "name": unicodedata.name(ch, "?"), **{k: int(v.get(ch, 0)) for k, v in cs.items()}}
        for ch in all_chars if not (ch.isascii() and (ch.isalnum() or ch == " "))
    ]
    r["char_map_applied"] = {f"U+{ord(k):04X}": f"U+{ord(v):04X}" if v else "∅" for k, v in CHAR_MAP.items()}

    # ---- OOV chéo / phương ngữ ----
    r["dialect"] = compare_sources({
        "cuong06_bible": cu[cu.source == "bible"].ba, "cuong06_radio": cu[cu.source == "radio"].ba,
        "cuong06_youtube": cu[cu.source == "youtube"].ba, "cuong06_ura": cu[cu.source == "ura"].ba,
        "eaai24": ea.ba,
    }, k=30)

    if spot_check:
        seed = cfg["seed"]
        out = resolve_path(cfg["paths"]["processed"]) / "spot_check"
        export_spot_check(cu[(cu.split_orig == "train")], cfg["quality"]["spot_check_cuong06"],
                          out / "cuong06_spot_check.csv", seed, raw_dir=cfg["paths"]["raw"])
        export_spot_check(ea, cfg["quality"]["spot_check_eaai24"], out / "eaai24_spot_check.csv", seed)
    return r


def _table(rows: list[dict], cols: list[str] | None = None) -> str:
    if not rows:
        return "_(trống)_\n"
    cols = cols or list(rows[0])
    out = "| " + " | ".join(cols) + " |\n|" + "---|" * len(cols) + "\n"
    for r in rows:
        out += "| " + " | ".join(str(r.get(c, "")).replace("|", "\\|") for c in cols) + " |\n"
    return out


def render_md(r: dict) -> str:
    c, e = r["cuong06"], r["eaai24"]
    md = ["## A. Thống kê tự động (sinh bởi `python -m src.data.audit`)\n",
          f"Số shard train đã đọc metadata: **{c['shards_loaded']}/50**.\n",
          "### A.1 cuong06 theo split gốc\n",
          _table([{"split": k, **{kk: vv for kk, vv in v.items() if kk != "duration_pct"},
                   "dur p50/p99": f"{v['duration_pct'].get('p50')}/{v['duration_pct'].get('p99')}"}
                  for k, v in c["per_split"].items()]),
          "### A.2 cuong06 theo nguồn\n",
          _table([{"source": k, "rows": v["rows"], "hours": v["hours"], "groups": v["groups"],
                   "unique_pairs": v["unique_pairs"], "has_digit": v["has_digit_frac"],
                   "non_latin": v["non_latin_frac"],
                   "loop>0.35": v["repeat_loop_frac(>0.35)"],
                   "cps p1/p50/p99": f"{v['cps_pct'].get('p1')}/{v['cps_pct'].get('p50')}/{v['cps_pct'].get('p99')}",
                   "ratio p1/p50/p99": f"{v['len_ratio_pct'].get('p1')}/{v['len_ratio_pct'].get('p50')}/{v['len_ratio_pct'].get('p99')}"}
                  for k, v in c["per_source"].items()]),
          "### A.3 speaker_id (định danh nguồn, không chắc là một người)\n",
          _table(c["speakers"], ["split_orig", "speaker_id", "count", "hours"]),
          "### A.4 Mọi pattern id (chữ số → #, videoId → `<yt>`)\n",
          _table(c["id_patterns"], ["source", "pattern", "n"]),
          "### A.5 EAAI24\n",
          _table([{"file": k, **v} for k, v in e["files"].items()]),
          _table([{"split": k, "rows": v["rows"], "unique_pairs": v["unique_pairs"]} for k, v in e["per_split"].items()]),
          f"Dataset card ghi: {e['card_claims']}. File LICENSE: {e['license_file_bytes']} byte.\n\n",
          f"Từ điển: {r['dict']}\n\n",
          "### A.6 Charset (ký tự ngoài ASCII chữ-số, theo codepoint sau NFC)\n",
          _table(r["charset"]),
          f"Mapping mức ký tự đã tự áp dụng (`CHAR_MAP`): {r['char_map_applied']}\n\n",
          "### A.7 OOV chéo giữa các nguồn (sau normalize ASR, bỏ token có số)\n",
          _table([{"pair": k, **{kk: (round(vv, 4) if isinstance(vv, float) else vv) for kk, vv in v.items()}}
                  for k, v in r["dialect"]["oov"].items()]),
          "### A.8 Top từ chỉ xuất hiện ở một nguồn\n"]
    for k, v in r["dialect"]["exclusive_top"].items():
        md.append(f"- **{k}**: " + ", ".join(f"`{w}`({n})" for w, n in v[:30]) + "\n")
    return "\n".join(md)


MANUAL_TEMPLATE = """# Data audit — Phiên dịch Ba Na → Việt

{auto}

## B. License (điền tay / đã kiểm tra)
- `cuong06/Bahnar_Vietnamese`: **CC BY-NC 4.0** (dataset card). Không dùng thương mại khi chưa xin phép.
- `EAAI24`: card KHÔNG ghi license, file `LICENSE` trên HF **rỗng** → coi là **chưa rõ license**.
  Việc cần làm: liên hệ nhóm tác giả HCMUT (paper EAAI-24) để xin phép; ghi kết quả vào đây.
- `NIRVLab/rhade-vietnamese-mt`: CC BY-NC 4.0 — chỉ Phase 7, không dùng cho Ba Na.

## C. Phát hiện quan trọng khác với giả định ban đầu của plan
- Ở split train của cuong06, `text_bahnar` là **pseudo-label ASR** (OmniASR-LLM-7B), `text_vi` là căn chỉnh
  bằng LLM từ OCR phụ đề → cả hai phía đều có nhiễu máy. Có vòng lặp ảo giác (xem cột `loop>0.35`).
- Val/test gốc (URA-HCMUT 2023, tin tức) gần như **không có audio** → không dùng cho ASR; chỉ dùng text cho MT.
- Nguồn train gồm Kinh Thánh (`KT_0`), radio (`TS-Bahnar-*`, `Tong-hop-*`) và **video YouTube (`yt_*`)**.
- Số dòng thực tế của EAAI24 khác số trên dataset card (xem A.5).

## D. Spot-check (Phase 0.4) — cần người nghe/đọc
Chạy `python -m src.data.audit --spot-check` → `data/processed/spot_check/*.csv`, chấm cột `audio_ba_ok`, `ba_vi_ok`.
| Nguồn | Số mẫu | Audio↔Ba Na sai | Ba Na↔Việt lệch nghĩa |
|---|---|---|---|
| cuong06 | 100 | _chưa chấm_ | _chưa chấm_ |
| EAAI24 | 50 | — | _chưa chấm_ |

## E. Đề xuất mapping chờ duyệt
- Caron → breve (`ě`→`ĕ`, `ǒ`→`ŏ`): **đã duyệt, bật mặc định** (`FIX_CARON_DEFAULT`).
- Mapping mức TỪ giữa phương ngữ Kon Tum / Bình Định: **không áp dụng**, chỉ liệt kê ở A.8.
"""


def write_md(r: dict, path: Path) -> None:
    auto = f"{AUTO_BEGIN}\n{render_md(r)}\n{AUTO_END}"
    if path.exists():
        old = path.read_text(encoding="utf-8")
        if AUTO_BEGIN in old and AUTO_END in old:
            pre, rest = old.split(AUTO_BEGIN, 1)
            _, post = rest.split(AUTO_END, 1)
            path.write_text(pre + auto + post, encoding="utf-8")
            return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(MANUAL_TEMPLATE.format(auto=auto), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="data.yaml")
    ap.add_argument("--spot-check", action="store_true")
    args = ap.parse_args()
    cfg = load_config(args.config)
    r = run_audit(cfg, args.spot_check)
    p = resolve_path(cfg["paths"]["audit_json"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(r, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    write_md(r, resolve_path(cfg["paths"]["audit_md"]))
    log.info("Audit -> %s, %s", p, cfg["paths"]["audit_md"])


if __name__ == "__main__":
    main()
