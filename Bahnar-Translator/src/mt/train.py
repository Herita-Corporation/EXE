"""Train MT Ba Na → Việt (Phase 2.3).

    python -m src.data.build_mt_corpus --config mt_bartpho.yaml
    python -m src.mt.train --config mt_bartpho.yaml --run M4                      # stage 1
    python -m src.mt.train --config mt_bartpho.yaml --run M6 --stage 2 \
           --init_from outputs/mt_bartpho/M6/stage1/best                           # stage 2 (LR thấp)

Early stopping theo chrF++ trên val hội thoại (EAAI24 valid). Không đụng test.
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import torch

from src.data.build_mt_corpus import with_tags
from src.mt.modeling import encode, prepare
from src.train_budget import make_budget_callback
from src.utils import apply_overrides, training_args, get_logger, git_commit, load_config, read_jsonl, resolve_path, set_seed

log = get_logger("mt.train")


class Seq2SeqCollator:
    """Tự tạo decoder_input_ids từ labels: khi bật label smoothing, Seq2SeqTrainer gọi model KHÔNG kèm labels,
    nếu thiếu decoder_input_ids thì MBart sẽ dịch phải từ input_ids (source) → loss sai."""

    def __init__(self, tok, cfg, model):
        self.tok, self.cfg, self.model = tok, cfg, model

    def __call__(self, rows: list[dict]) -> dict:
        m = self.cfg["model"]
        e = encode(self.tok, self.cfg, [r["src"] for r in rows], [r["tgt"] for r in rows],
                   m["max_source_length"], m["max_target_length"])
        pad = self.tok.pad_token_id
        L = max(map(len, e["input_ids"]))
        T = max(map(len, e["labels"]))
        ids = torch.tensor([x + [pad] * (L - len(x)) for x in e["input_ids"]])
        att = torch.tensor([x + [0] * (L - len(x)) for x in e["attention_mask"]])
        lab = torch.tensor([x + [-100] * (T - len(x)) for x in e["labels"]])
        dec = self.model.prepare_decoder_input_ids_from_labels(labels=lab)
        return {"input_ids": ids, "attention_mask": att, "labels": lab, "decoder_input_ids": dec}


def eval_rows(cfg: dict, split: str, max_n: int | None, tags: bool) -> list[dict]:
    p = resolve_path(cfg["corpus"]["out_dir"]) / "eval" / f"{split}.jsonl"
    rows = list(read_jsonl(p))
    if max_n and len(rows) > max_n:
        rows = [rows[i] for i in np.random.default_rng(0).choice(len(rows), max_n, replace=False)]
    return [{"src": with_tags(r["ba"], r["dialect"], r["domain"], tags), "tgt": r["tgt"]} for r in rows]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="mt_bartpho.yaml")
    ap.add_argument("--run", required=True)
    ap.add_argument("--stage", type=int, default=1, choices=[1, 2])
    ap.add_argument("--init_from", default=None)
    ap.add_argument("--max_steps", type=int, default=None)
    ap.add_argument("--override", action="append", default=[], help="vd --override train.max_steps=6000")
    args = ap.parse_args()
    cfg = apply_overrides(load_config(args.config), args.override)
    set_seed(cfg["seed"])
    tc, rcfg = cfg["train"], cfg["runs"][args.run]
    corpus_dir = resolve_path(cfg["corpus"]["out_dir"]) / args.run
    train_rows = list(read_jsonl(corpus_dir / ("train.jsonl" if args.stage == 1 else "train_stage2.jsonl")))
    val_rows = eval_rows(cfg, cfg["corpus"]["val_conv"], tc["eval_max_samples"], rcfg["tags"])
    log.info("%s stage %d: %d cặp train, %d val", args.run, args.stage, len(train_rows), len(val_rows))

    if args.init_from:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        tok = AutoTokenizer.from_pretrained(resolve_path(args.init_from))
        model = AutoModelForSeq2SeqLM.from_pretrained(resolve_path(args.init_from))
    else:
        bahnar = [r["src"] for r in train_rows if r["corpus"] != "dict"]
        tok, model = prepare(cfg, bahnar)

    from sacrebleu.metrics import CHRF
    from transformers import EarlyStoppingCallback, Seq2SeqTrainer, Seq2SeqTrainingArguments

    chrf = CHRF(word_order=2)

    def compute_metrics(pred):
        preds = np.where(pred.predictions < 0, tok.pad_token_id, pred.predictions)
        hyps = [h.strip() for h in tok.batch_decode(preds, skip_special_tokens=True)]
        refs = [r["tgt"] for r in val_rows]
        return {"chrf": chrf.corpus_score(hyps, [refs]).score}

    out_dir = resolve_path(tc["output_dir"]) / args.run / f"stage{args.stage}"
    lr = tc["learning_rate"] if args.stage == 1 else tc["stage2_learning_rate"]
    steps = args.max_steps or (tc["max_steps"] if args.stage == 1 else tc["stage2_max_steps"])
    targs = training_args(
        Seq2SeqTrainingArguments, total_steps=steps,
        output_dir=str(out_dir), max_steps=steps, learning_rate=lr, warmup_ratio=tc["warmup_ratio"],
        weight_decay=tc["weight_decay"], label_smoothing_factor=tc["label_smoothing_factor"],
        per_device_train_batch_size=tc["per_device_train_batch_size"],
        per_device_eval_batch_size=tc["per_device_eval_batch_size"],
        gradient_accumulation_steps=tc["gradient_accumulation_steps"],
        bf16=tc["bf16"] and torch.cuda.is_available(), eval_strategy="steps", eval_steps=tc["eval_steps"],
        save_steps=tc["save_steps"], logging_steps=tc["logging_steps"], save_total_limit=tc["save_total_limit"],
        load_best_model_at_end=True, metric_for_best_model="chrf", greater_is_better=True,
        predict_with_generate=True, generation_num_beams=tc["generation_num_beams"],
        generation_max_length=cfg["model"]["max_target_length"], remove_unused_columns=False,
        report_to=tc["report_to"], seed=cfg["seed"],
    )
    trainer = Seq2SeqTrainer(
        model=model, args=targs, train_dataset=train_rows, eval_dataset=val_rows,
        data_collator=Seq2SeqCollator(tok, cfg, model), processing_class=tok, compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(tc["early_stopping_patience"])]
        + ([make_budget_callback(tc["time_budget_hours"], usage_file=out_dir / "budget_usage.json")]
           if tc.get("time_budget_hours") else []),
    )
    t0 = time.time()
    trainer.train()
    best = out_dir / "best"
    trainer.save_model(str(best))
    tok.save_pretrained(str(best))
    (best / "mt_meta.json").write_text(json.dumps({
        "run": args.run, "stage": args.stage, "family": cfg["model"]["family"], "base": cfg["model"]["name"],
        "tags": rcfg["tags"], "src_lang": cfg["model"].get("src_lang"), "tgt_lang": cfg["model"].get("tgt_lang"),
        "steps": trainer.state.global_step, "best_val_chrf": trainer.state.best_metric,
        "elapsed_sec": time.time() - t0, "commit": git_commit(), "config": args.config,
    }, indent=1), encoding="utf-8")
    log.info("Best chrF++ val hội thoại: %s", trainer.state.best_metric)


if __name__ == "__main__":
    main()
