"""Tạo split mới + chống rò rỉ (Phase 0.3).

Kết quả (``data/processed/splits/*.jsonl`` + ``manifest.json`` có SHA256):
  cuong06_train, cuong06_val, test_book, test_radio, test_source   (từ train gốc, chỉ dòng có audio)
  ura_val, ura_test          (val/test gốc của cuong06 — chủ yếu chỉ có text; dùng cho MT)
  eaai24_train, eaai24_valid, eaai24_test   (giữ split gốc để so với paper)
  dict_train                 (từ điển EAAI24)
  tourism_test               (nếu đã có bản dịch của người bản ngữ)

Nguyên tắc: split theo NHÓM (sách / chương trình-ngày / video / speaker) — không theo câu.
Dedupe: mọi câu thuộc test/val (mọi nguồn) được bảo vệ; câu train trùng (exact hoặc
Jaccard ≥ ngưỡng) ở phía Ba Na hoặc phía Việt bị xóa khỏi train.

    python -m src.data.split --config data.yaml
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.data.dedupe import find_leaks
from src.data.loaders import load_cuong06_meta, load_eaai24, load_eaai24_dict, load_tourism
from src.data.quality import add_quality_columns, flag_quality
from src.data.sources import bible_book
from src.utils import get_logger, load_config, resolve_path, set_seed, sha256_file

log = get_logger("split")

PROTECTED = ["cuong06_val", "test_book", "test_radio", "test_source", "ura_val", "ura_test",
             "eaai24_valid", "eaai24_test", "tourism_test"]
TRAIN_SETS = ["cuong06_train", "eaai24_train", "dict_train"]
SOFT_PROTECTED = ["ura_val", "ura_test"]
KEEP_COLS = ["uid", "corpus", "split_orig", "source", "group", "dialect", "domain", "speaker_id",
             "duration", "has_audio", "shard", "ba", "vi", "asr_ok", "mt_ok", "has_digit", "non_latin", "repeat_frac"]


def pick_test_source(df: pd.DataFrame, wanted: str | None, rng: np.random.Generator) -> str:
    """Speaker giữ ra. Nếu ``wanted`` không tồn tại: chọn speaker yt_* có tổng giờ gần 8h nhất."""
    hours = df.groupby("speaker_id").duration.sum() / 3600
    if wanted and wanted in hours.index:
        return wanted
    cands = hours[[s.startswith("yt_") for s in hours.index]]
    cands = cands[(cands > 2) & (cands < 30)]
    if cands.empty:
        raise ValueError("Không tìm được speaker phù hợp cho test_source; chỉ định trong data.yaml")
    chosen = (cands - 8).abs().idxmin()
    log.warning("test_source '%s' không tồn tại → tự chọn '%s' (%.1f giờ)", wanted, chosen, hours[chosen])
    return chosen


def assign_cuong06(df: pd.DataFrame, scfg: dict, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    tr = df[df.split_orig == "train"].copy()
    tr = tr[tr.has_audio.astype(bool)]
    tr["split"] = ""

    src_spk = pick_test_source(tr, scfg.get("test_source"), rng)
    tr.loc[tr.speaker_id == src_spk, "split"] = "test_source"

    books = set(scfg["test_book"])
    is_book = tr.uid.map(bible_book).isin(books) & (tr.source == "bible") & (tr.split == "")
    tr.loc[is_book, "split"] = "test_book"

    radio_groups = sorted(tr[(tr.source == "radio") & (tr.split == "")].group.unique())
    n_radio = max(1, int(round(len(radio_groups) * scfg["test_radio_frac"]))) if radio_groups else 0
    held = set(rng.choice(radio_groups, size=n_radio, replace=False)) if n_radio else set()
    tr.loc[tr.group.isin(held) & (tr.split == ""), "split"] = "test_radio"

    rest_groups = sorted(tr[tr.split == ""].group.unique())
    n_val = max(1, int(round(len(rest_groups) * scfg["val_frac"])))
    val_groups = set(rng.choice(rest_groups, size=n_val, replace=False))
    tr.loc[tr.group.isin(val_groups) & (tr.split == ""), "split"] = "cuong06_val"
    tr.loc[tr.split == "", "split"] = "cuong06_train"
    tr.attrs["test_source_speaker"] = src_spk
    tr.attrs["test_radio_groups"] = sorted(held)
    return tr


def build_splits(cfg: dict) -> dict:
    set_seed(cfg["seed"])
    scfg, qcfg = cfg["split"], cfg["quality"]
    cu = add_quality_columns(load_cuong06_meta(cfg["paths"]["meta"]))
    ea = add_quality_columns(load_eaai24(cfg["paths"]["eaai24"]))
    dic = load_eaai24_dict(cfg["paths"]["eaai24"])
    tour = load_tourism(cfg["paths"]["tourism"])

    cu_tr = assign_cuong06(cu, scfg, cfg["seed"])
    # Ngưỡng percentile tính trên train để mọi split dùng cùng ngưỡng
    cu_tr = flag_quality(cu_tr, qcfg, ref=cu_tr[cu_tr.split == "cuong06_train"],
                         min_dur=scfg["min_duration"], max_dur=scfg["max_duration"])
    thresholds = {"cuong06": cu_tr.attrs["thresholds"]}
    ura = cu[cu.split_orig.isin(["validation", "test"])].copy()
    ura = flag_quality(ura, qcfg, ref=cu_tr[cu_tr.split == "cuong06_train"],
                       min_dur=scfg["min_duration"], max_dur=scfg["max_duration"])
    ura["split"] = ura.split_orig.map({"validation": "ura_val", "test": "ura_test"})
    ea = flag_quality(ea, qcfg, ref=ea[ea.split_orig == "train"])
    thresholds["eaai24"] = ea.attrs["thresholds"]
    ea["split"] = "eaai24_" + ea.split_orig
    dic["split"] = "dict_train"
    frames = [cu_tr, ura, ea, dic]
    if tour is not None:
        tour["split"] = "tourism_test"
        frames.append(tour)
    all_df = pd.concat(frames, ignore_index=True)

    # --- ura_val/ura_test (val/test gốc cuong06) là tập eval PHỤ: plan quy định "chỉ dùng nếu không trùng"
    # → câu ura trùng bất kỳ train nào bị loại khỏi ura (không cắt train).
    tr_all = all_df[all_df.split.isin(TRAIN_SETS)]
    ura_mask = all_df.split.isin(SOFT_PROTECTED)
    ura_rows = all_df[ura_mask]
    hit_ba = find_leaks({"train": tr_all.ba.tolist()}, ura_rows.ba.tolist(), cfg["dedupe"])
    tr_vi = tr_all[tr_all.split != "dict_train"].vi.tolist()
    hit_vi = find_leaks({"train": tr_vi}, ura_rows.vi.tolist(), cfg["dedupe"])
    drop_ura = [idx for idx, a, b in zip(ura_rows.index, hit_ba, hit_vi) if a or b]
    ura_dropped = all_df.loc[drop_ura].groupby("split").size().to_dict()
    all_df = all_df.drop(index=drop_ura)
    log.info("Loại khỏi ura_* %s câu trùng train", ura_dropped)

    # --- Dedupe: bảo vệ mọi test/val; kiểm tra mọi train ở cả 2 phía ---
    prot = all_df[all_df.split.isin(PROTECTED)]
    protected = {f"{name}:{side}": g[side].tolist() for name, g in prot.groupby("split") for side in ("ba", "vi")}
    train_mask = all_df.split.isin(TRAIN_SETS)
    tr_rows = all_df[train_mask]
    leak_ba = find_leaks({k: v for k, v in protected.items() if k.endswith(":ba")}, tr_rows.ba.tolist(), cfg["dedupe"])
    # Từ điển là cặp từ đơn: phía Việt trùng một câu test rất ngắn không phải rò rỉ → chỉ so phía Ba Na
    vi_texts = [v if s != "dict_train" else "" for v, s in zip(tr_rows.vi, tr_rows.split)]
    leak_vi = find_leaks({k: v for k, v in protected.items() if k.endswith(":vi")}, vi_texts, cfg["dedupe"])
    leak = [a or b for a, b in zip(leak_ba, leak_vi)]
    all_df["leak"] = None
    all_df.loc[tr_rows.index, "leak"] = [None if x is None else f"{x[0]}|{x[1]}|{x[2]:.3f}" for x in leak]
    leak_report = (all_df[all_df.leak.notna()].assign(kind=lambda d: d.leak.str.split("|").str[0],
                                                       target=lambda d: d.leak.str.split("|").str[1])
                   .groupby(["split", "kind", "target"]).size().rename("n").reset_index())
    removed = all_df[all_df.leak.notna()]
    all_df = all_df[all_df.leak.isna()]
    log.info("Dedupe: xóa %d câu train rò rỉ", len(removed))

    # --- Ghi file ---
    out_dir = resolve_path(cfg["paths"]["splits"])
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"seed": cfg["seed"], "config": scfg, "thresholds": thresholds,
                "test_source_speaker": cu_tr.attrs["test_source_speaker"],
                "test_radio_groups": cu_tr.attrs["test_radio_groups"], "files": {}}
    for name, g in all_df.groupby("split"):
        cols = [c for c in KEEP_COLS if c in g.columns]
        p = out_dir / f"{name}.jsonl"
        g[cols].to_json(p, orient="records", lines=True, force_ascii=False)
        ids_p = out_dir / f"{name}.ids.txt"
        ids_p.write_text("\n".join(g.uid.astype(str)), encoding="utf-8")
        dur = pd.to_numeric(g.get("duration"), errors="coerce")
        manifest["files"][name] = {
            "rows": int(len(g)), "hours": round(float(dur.sum() / 3600), 2) if dur is not None else 0.0,
            "asr_ok": int((g["asr_ok"] == True).sum()) if "asr_ok" in g else 0,  # noqa: E712
            "mt_ok": int((g["mt_ok"] == True).sum()) if "mt_ok" in g else 0,  # noqa: E712
            "sha256": sha256_file(p), "ids_sha256": sha256_file(ids_p),
        }
    removed[["uid", "split", "leak", "ba", "vi"]].to_json(out_dir / "removed_leaks.jsonl", orient="records",
                                                        lines=True, force_ascii=False)
    manifest["leaks_removed"] = leak_report.to_dict(orient="records")
    manifest["ura_rows_dropped_overlap_train"] = {k: int(v) for k, v in ura_dropped.items()}
    manifest["verify_zero_overlap"] = verify_no_overlap(out_dir, cfg["dedupe"])
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    log.info("Đã ghi split vào %s", out_dir)
    return manifest


def verify_no_overlap(split_dir: Path, dcfg: dict) -> dict:
    """Kiểm tra lại độc lập trên file đã ghi: 0 trùng exact/near giữa mọi test và mọi train."""
    def load(n):
        p = split_dir / f"{n}.jsonl"
        return pd.read_json(p, lines=True) if p.exists() else pd.DataFrame(columns=["ba", "vi", "split"])

    prot = {n: load(n) for n in PROTECTED}
    trains = {n: load(n) for n in TRAIN_SETS}
    res = {}
    for side in ("ba", "vi"):
        protected = {n: d[side].tolist() for n, d in prot.items() if len(d)}
        for tn, td in trains.items():
            if side == "vi" and tn == "dict_train":
                continue
            hits = [h for h in find_leaks(protected, td[side].tolist(), dcfg) if h]
            res[f"{tn}:{side}"] = len(hits)
    assert all(v == 0 for v in res.values()), f"Còn rò rỉ: {res}"
    return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="data.yaml")
    args = ap.parse_args()
    m = build_splits(load_config(args.config))
    for k, v in m["files"].items():
        print(f"{k:16s} rows={v['rows']:7d} hours={v['hours']:7.2f} asr_ok={v['asr_ok']:7d} mt_ok={v['mt_ok']:7d}")
    print("verify:", m["verify_zero_overlap"])


if __name__ == "__main__":
    main()
