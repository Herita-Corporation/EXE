"""Dựng corpus MT có tag nguồn/phương ngữ/domain cho từng run ablation (Phase 2.1).

    python -m src.data.build_mt_corpus --config mt_bartpho.yaml            # mọi run M1..M6
    python -m src.data.build_mt_corpus --config mt_bartpho.yaml --runs M4

Ra: data/processed/mt/<run>/{train,train_stage2}.jsonl và data/processed/mt/eval/<split>.jsonl
Mỗi dòng: {"src", "tgt", "corpus", "uid"}. Source có tag dạng ``<kt> <bible> văn bản`` khi tags=true.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import pandas as pd

from src.mt.glossary import Glossary, load_glossary
from src.text.bahnar_normalizer import normalize_for_mt
from src.utils import get_logger, load_config, resolve_path, write_jsonl

log = get_logger("mt.corpus")


def with_tags(text: str, dialect: str | None, domain: str | None, tags: bool) -> str:
    text = normalize_for_mt(text)
    if not tags:
        return text
    return " ".join(t for t in (dialect or "<ud>", domain or "<conv>") if t) + " " + text


def _load(split_dir: Path, name: str) -> pd.DataFrame:
    p = split_dir / f"{name}.jsonl"
    if not p.exists():
        return pd.DataFrame()
    return pd.read_json(p, lines=True)


def _rows(df: pd.DataFrame, tags: bool, corpus: str, domain_override: str | None = None) -> list[dict]:
    out = []
    for r in df.itertuples(index=False):
        src = with_tags(r.ba, getattr(r, "dialect", None), domain_override or getattr(r, "domain", None), tags)
        tgt = (r.vi or "").strip()
        if src and tgt:
            out.append({"uid": r.uid, "src": src, "tgt": tgt, "corpus": corpus})
    return out


def source_rows(name: str, split_dir: Path, ccfg: dict, tags: bool) -> list[dict]:
    if name == "cuong06":
        df = _load(split_dir, "cuong06_train")
        df = df[df.mt_ok.fillna(False).astype(bool)]
        # cặp duy nhất: không nhân bản theo số speaker/nguồn
        df = df.assign(_k=df.ba.map(normalize_for_mt) + "\t" + df.vi.str.strip()).drop_duplicates("_k")
        return _rows(df, tags, "cuong06")
    if name == "eaai24":
        df = _load(split_dir, "eaai24_train")
        df = df[df.mt_ok.fillna(True).astype(bool)]
        return _rows(df, tags, "eaai24")
    if name == "dict":
        return _rows(_load(split_dir, "dict_train"), tags, "dict")
    if name in ("asr_noise", "bt"):
        f = ccfg.get("asr_noise_file" if name == "asr_noise" else "bt_file")
        if not f or not resolve_path(f).exists():
            log.warning("Chưa có %s (%s) → bỏ qua. Tạo bằng: python -m src.mt.asr_noise", name, f)
            return []
        df = pd.read_json(resolve_path(f), lines=True)
        if name == "bt":
            df["dialect"], df["domain"] = "<bt>", "<conv>"
        return _rows(df, tags, name)
    raise ValueError(name)


def assemble(sources: list[str], split_dir: Path, ccfg: dict, tags: bool, seed: int,
             oversample_eaai: bool = True) -> list[dict]:
    rng = random.Random(seed)
    parts = {s: source_rows(s, split_dir, ccfg, tags) for s in sources}
    rows: list[dict] = []
    for s in ("cuong06", "eaai24", "bt"):
        if s in parts:
            k = ccfg["eaai24_oversample"] if (s == "eaai24" and oversample_eaai and len(sources) > 1) else 1
            rows += parts[s] * k
    base = len(rows)
    if "dict" in parts and parts["dict"]:
        n = int(ccfg["dict_max_frac"] / (1 - ccfg["dict_max_frac"]) * base)
        d = parts["dict"]
        rows += rng.sample(d, min(n, len(d))) if n < len(d) else d
    if "asr_noise" in parts and parts["asr_noise"]:
        f = ccfg["asr_noise_frac"]
        n = int(f / (1 - f) * len(rows))
        a = parts["asr_noise"]
        rows += [rng.choice(a) for _ in range(n)] if n > len(a) else rng.sample(a, n)
    gl = Glossary(load_glossary(resolve_path(ccfg["glossary"]) if ccfg.get("glossary") else None))
    if len(gl):
        for r in rows:
            r["src"], r["tgt"] = gl.inject(r["src"], r["tgt"], ccfg["glossary_placeholder_prob"], rng)
    rng.shuffle(rows)
    return rows


def build_eval_sets(split_dir: Path, ccfg: dict, out: Path) -> None:
    for name in [ccfg["val_conv"], ccfg["val_indomain"], *ccfg["tests"]]:
        df = _load(split_dir, name)
        if df.empty:
            log.warning("Không có split %s", name)
            continue
        if "mt_ok" in df and name.startswith(("cuong06", "test_")):
            df = df[df.mt_ok.fillna(False).astype(bool)]
        rows = [{"uid": r.uid, "ba": normalize_for_mt(r.ba), "tgt": (r.vi or "").strip(),
                 "dialect": getattr(r, "dialect", "<ud>"), "domain": getattr(r, "domain", "<conv>")}
                for r in df.itertuples(index=False) if (r.vi or "").strip() and (r.ba or "").strip()]
        write_jsonl(out / "eval" / f"{name}.jsonl", rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="mt_bartpho.yaml")
    ap.add_argument("--runs", nargs="*", default=None)
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg = load_config(cfg["data_config"])
    ccfg = cfg["corpus"]
    split_dir = resolve_path(data_cfg["paths"]["splits"])
    out = resolve_path(ccfg["out_dir"])
    build_eval_sets(split_dir, ccfg, out)
    for run, rcfg in cfg["runs"].items():
        if args.runs and run not in args.runs:
            continue
        rows = assemble(rcfg["sources"], split_dir, ccfg, rcfg["tags"], cfg["seed"])
        n = write_jsonl(out / run / "train.jsonl", rows)
        stats = pd.Series([r["corpus"] for r in rows]).value_counts().to_dict()
        log.info("%s: %d cặp %s", run, n, stats)
        if rcfg.get("stage2"):
            rows2 = assemble(rcfg["stage2"], split_dir, ccfg, rcfg["tags"], cfg["seed"] + 1, oversample_eaai=False)
            write_jsonl(out / run / "train_stage2.jsonl", rows2)


if __name__ == "__main__":
    main()
