"""KenLM 5-gram cho decode CTC (Phase 1.3).

    python -m src.asr.lm --config lm.yaml prepare     # ghi corpus text đã chuẩn hóa
    python -m src.asr.lm --config lm.yaml build       # LM_cuong, LM_conv, và các LM nội suy theo λ

Cài KenLM binary: xem scripts/install_kenlm.sh (lmplz, build_binary). Python: pip install kenlm pyctcdecode.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

import pandas as pd

from src.text.bahnar_normalizer import has_digit, normalize_for_asr
from src.utils import get_logger, load_config, resolve_path

log = get_logger("asr.lm")


def corpus_lines(split_names: list[str], data_cfg: dict) -> list[str]:
    sp = resolve_path(data_cfg["paths"]["splits"])
    out: list[str] = []
    for name in split_names:
        p = sp / f"{name}.jsonl"
        if not p.exists():
            log.warning("Thiếu %s", p)
            continue
        df = pd.read_json(p, lines=True)
        if "repeat_frac" in df:
            df = df[df.repeat_frac.fillna(0) <= data_cfg["quality"]["max_repeat_ngram_frac"]]
        for t in df.ba:
            t = normalize_for_asr(t)
            # bỏ token chứa chữ số (ASR không sinh chữ số)
            t = " ".join(w for w in t.split() if not has_digit(w))
            if t:
                out.append(t)
    return out


def write_corpus(lines: list[str], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def weighted_mix(main: list[str], extra: list[str], lam: float) -> list[str]:
    """Xấp xỉ nội suy tuyến tính bằng trộn corpus: nhân bản `extra` để chiếm ≈ λ tổng số token."""
    if lam <= 0 or not extra:
        return main
    tm = sum(len(x.split()) for x in main)
    te = sum(len(x.split()) for x in extra)
    k = max(1, round(lam / (1 - lam) * tm / max(te, 1)))
    return main + extra * k


def _bin(cfg: dict, name: str) -> str:
    d = cfg.get("kenlm_bin")
    exe = str(Path(d) / name) if d else shutil.which(name)
    if not exe:
        raise FileNotFoundError(f"Không thấy KenLM `{name}`. Chạy scripts/install_kenlm.sh hoặc đặt kenlm_bin.")
    return exe


def build_kenlm(cfg: dict, text: Path, out_prefix: Path) -> Path:
    arpa = out_prefix.with_suffix(".arpa")
    with open(text, "rb") as fin, open(arpa, "wb") as fout:
        subprocess.run([_bin(cfg, "lmplz"), "-o", str(cfg["order"]), "--discount_fallback", "-S", "40%"],
                       stdin=fin, stdout=fout, check=True)
    fix_arpa_eos(arpa)
    binary = out_prefix.with_suffix(".bin")
    subprocess.run([_bin(cfg, "build_binary"), str(arpa), str(binary)], check=True)
    log.info("KenLM -> %s", binary)
    return binary


def fix_arpa_eos(arpa: Path) -> None:
    """pyctcdecode cần </s> trong unigram (lmplz đôi khi thiếu) — thêm nếu thiếu."""
    lines = arpa.read_text(encoding="utf-8").split("\n")
    if any(l.split("\t")[1:2] == ["</s>"] for l in lines if "\t" in l):
        return
    out, in_uni = [], False
    for l in lines:
        if l.startswith("ngram 1="):
            n = int(l.split("=")[1]) + 1
            l = f"ngram 1={n}"
        if l.strip() == "\\1-grams:":
            in_uni = True
            out.append(l)
            continue
        if in_uni and "<s>" in l.split("\t")[1:2]:
            out.append(l)
            out.append(l.replace("<s>", "</s>"))
            in_uni = False
            continue
        out.append(l)
    arpa.write_text("\n".join(out), encoding="utf-8")


def unigrams_file(lines: list[str], path: Path) -> Path:
    words = sorted({w for l in lines for w in l.split()})
    path.write_text("\n".join(words), encoding="utf-8")
    return path


def srilm_mix(a_arpa: Path, b_arpa: Path, lam: float, out: Path, order: int) -> Path:
    ngram = shutil.which("ngram")
    if ngram is None:
        raise FileNotFoundError("SRILM `ngram` không có trong PATH")
    subprocess.run([ngram, "-order", str(order), "-lm", str(a_arpa), "-mix-lm", str(b_arpa),
                    "-lambda", str(1 - lam), "-write-lm", str(out)], check=True)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="lm.yaml")
    ap.add_argument("cmd", choices=["prepare", "build"])
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg = load_config(cfg["data_config"])
    out = resolve_path(cfg["out_dir"])
    corp = {name: corpus_lines(splits, data_cfg) for name, splits in cfg["corpora"].items()}
    for name, lines in corp.items():
        write_corpus(lines, out / f"{name}.txt")
        log.info("%s: %d dòng, %d token", name, len(lines), sum(len(l.split()) for l in lines))
    all_lines = [l for v in corp.values() for l in v]
    unigrams_file(all_lines, out / "unigrams.txt")
    if args.cmd == "prepare":
        return
    main_lines, extra = corp["LM_cuong"], corp["LM_conv"]
    build_kenlm(cfg, out / "LM_cuong.txt", out / "LM_cuong")
    build_kenlm(cfg, out / "LM_conv.txt", out / "LM_conv")
    for lam in cfg["interpolation"]["lambdas"]:
        if lam <= 0:
            continue
        tag = f"LM_mix_l{int(round(lam * 100)):02d}"
        if cfg["interpolation"]["method"] == "srilm":
            arpa = srilm_mix(out / "LM_cuong.arpa", out / "LM_conv.arpa", lam, out / f"{tag}.arpa", cfg["order"])
            subprocess.run([_bin(cfg, "build_binary"), str(arpa), str(out / f"{tag}.bin")], check=True)
        else:
            write_corpus(weighted_mix(main_lines, extra, lam), out / f"{tag}.txt")
            build_kenlm(cfg, out / f"{tag}.txt", out / tag)


if __name__ == "__main__":
    main()
