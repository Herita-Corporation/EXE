"""Đánh giá MT trên các test set, với nguồn CHUẨN và nguồn ASR (Phase 2.4).

    python -m src.mt.evaluate --model outputs/mt_bartpho/M6/stage2/best --config mt_bartpho.yaml
    # thêm nguồn ASR: dùng hyp đã decode ở Phase 1
    python -m src.mt.evaluate --model ... --asr_hyp_dir outputs/asr_w2vbert/best/logits_cache --asr_system LM_mix_l10

Kết quả: <model>/eval/<split>[.asr].json (có điểm COMET theo câu để làm paired bootstrap).
Tag: ``--tag_mode production`` (luôn <ud> <conv>, như app) hoặc ``oracle`` (tag thật của câu).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.eval.mt_metrics import mt_report
from src.mt.translate import Translator
from src.utils import get_logger, git_commit, load_config, read_jsonl, resolve_path

log = get_logger("mt.evaluate")


def run_eval(tr: Translator, rows: list[dict], srcs: list[str], tag_mode: str, prod_tags: tuple[str, str],
             with_comet: bool, bleu_tokenize: str | None) -> tuple[dict, list[str]]:
    tags = [(r["dialect"], r["domain"]) for r in rows] if tag_mode == "oracle" else None
    outs = tr.translate(srcs, dialect=prod_tags[0], domain=prod_tags[1], tags=tags)
    hyps = [o["text"] for o in outs]
    rep = mt_report(srcs, hyps, [r["tgt"] for r in rows], with_comet=with_comet, bleu_tokenize=bleu_tokenize)
    rep["mean_confidence"] = sum(o["confidence"] for o in outs) / max(len(outs), 1)
    return rep, hyps


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", default="mt_bartpho.yaml")
    ap.add_argument("--splits", nargs="*", default=None)
    ap.add_argument("--tag_mode", default="production", choices=["production", "oracle"])
    ap.add_argument("--no_comet", action="store_true")
    ap.add_argument("--bleu_tokenize", default=None, help="tokenize như paper (vd '13a', 'none', 'spm')")
    ap.add_argument("--asr_hyp_dir", default=None)
    ap.add_argument("--asr_system", default=None, help="tên hệ ASR trong file <split>.<system>.hyp.jsonl")
    ap.add_argument("--val_only", action="store_true", help="chỉ val (dùng cho quyết định ablation)")
    ap.add_argument("--max_n", type=int, default=None, help="chỉ lấy n câu đầu (kiểm tra nhanh; KHÔNG dùng để báo cáo)")
    args = ap.parse_args()
    cfg = load_config(args.config)
    cc = cfg["corpus"]
    splits = args.splits or ([cc["val_conv"], cc["val_indomain"]] if args.val_only else
                             [cc["val_conv"], cc["val_indomain"], *cc["tests"]])
    tr = Translator(resolve_path(args.model), glossary=resolve_path(cc["glossary"]) if cc.get("glossary") else None)
    prod = (cc["inference_dialect_tag"], cc["inference_domain_tag"])
    out_dir = resolve_path(args.model) / "eval"
    out_dir.mkdir(parents=True, exist_ok=True)
    for s in splits:
        p = resolve_path(cc["out_dir"]) / "eval" / f"{s}.jsonl"
        if not p.exists():
            log.warning("Bỏ qua %s (chưa có)", s)
            continue
        rows = list(read_jsonl(p))[: args.max_n]
        rep, hyps = run_eval(tr, rows, [r["ba"] for r in rows], args.tag_mode, prod, not args.no_comet,
                             args.bleu_tokenize)
        _save(out_dir / f"{s}.json", rep, rows, hyps, args, source="reference")
        log.info("%s [chuẩn] BLEU=%.2f chrF++=%.2f COMET=%s", s, rep["bleu"], rep["chrf++"], rep.get("comet"))
        if args.asr_hyp_dir and args.asr_system:
            hp = resolve_path(args.asr_hyp_dir) / f"{s}.{args.asr_system}.hyp.jsonl"
            if hp.exists():
                asr = {h["uid"]: h["hyp"] for h in read_jsonl(hp)}
                rows_a = [r for r in rows if r["uid"] in asr]
                rep_a, hyps_a = run_eval(tr, rows_a, [asr[r["uid"]] for r in rows_a], args.tag_mode, prod,
                                         not args.no_comet, args.bleu_tokenize)
                # cùng tập câu với nguồn chuẩn để đo khoảng cách công bằng
                rep_ref_sub, _ = run_eval(tr, rows_a, [r["ba"] for r in rows_a], args.tag_mode, prod,
                                          not args.no_comet, args.bleu_tokenize)
                rep_a["gap_vs_reference_source"] = {k: rep_ref_sub[k] - rep_a[k] for k in ("bleu", "chrf++", "comet")
                                                    if k in rep_a}
                _save(out_dir / f"{s}.asr.json", rep_a, rows_a, hyps_a, args, source=f"asr:{args.asr_system}")
                log.info("%s [ASR] chrF++=%.2f (gap %.2f)", s, rep_a["chrf++"],
                         rep_a["gap_vs_reference_source"]["chrf++"])


def _save(path: Path, rep: dict, rows, hyps, args, source: str) -> None:
    rep = {**rep, "model": args.model, "tag_mode": args.tag_mode, "source": source, "commit": git_commit(),
           "hyps": hyps, "uids": [r["uid"] for r in rows]}
    path.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
