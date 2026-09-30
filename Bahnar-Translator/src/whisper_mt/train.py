"""Whisper đa nhiệm (kiến trúc C, Phase 3). Mỗi audio → 2 mẫu: <|bdq|> → Ba Na, <|vi|> → Việt.

    python -m src.whisper_mt.train --config whisper_multitask.yaml
Chỉ chạy khi kiến trúc A đã đạt DoD và còn tài nguyên. Không dùng được dữ liệu text-only (EAAI24).
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass

import torch

from src.asr.augment import rms_normalize
from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.utils import training_args, get_logger, load_config, resolve_path, set_seed

log = get_logger("whisper.train")


def add_lang_token(model, tokenizer, new_tok: str, init_from: str) -> int:
    tokenizer.add_tokens([new_tok], special_tokens=True)
    model.resize_token_embeddings(len(tokenizer))
    new_id, src_id = tokenizer.convert_tokens_to_ids(new_tok), tokenizer.convert_tokens_to_ids(init_from)
    with torch.no_grad():
        model.get_input_embeddings().weight[new_id] = model.get_input_embeddings().weight[src_id]
    # Nếu proj_out không tie với embedding, sao chép cả hàng output
    out = model.get_output_embeddings()
    if out is not None and out.weight.data_ptr() != model.get_input_embeddings().weight.data_ptr():
        with torch.no_grad():
            out.weight[new_id] = out.weight[src_id]
    return new_id


def prefix_ids(tokenizer, lang_tok: str) -> list[int]:
    """[<|lang|>, <|transcribe|>, <|notimestamps|>] — <|startoftranscript|> do model tự thêm."""
    return tokenizer.convert_tokens_to_ids([lang_tok, "<|transcribe|>", "<|notimestamps|>"])


class MultiTaskDataset(torch.utils.data.Dataset):
    """Nhân đôi: chỉ số chẵn → Ba Na, lẻ → Việt."""

    def __init__(self, hf_ds, texts_vi: dict[str, str]):
        self.ds, self.vi = hf_ds, texts_vi

    def __len__(self):
        return 2 * len(self.ds)

    def __getitem__(self, i):
        r = self.ds[i // 2]
        if i % 2 == 0:
            return {"audio": r["audio"], "text": r["text"], "task": "bdq"}
        return {"audio": r["audio"], "text": self.vi[r["uid"]], "task": "vi"}


@dataclass
class WhisperCollator:
    processor: object
    prefixes: dict

    def __call__(self, rows):
        waves = [rms_normalize(decode_audio(r["audio"])) for r in rows]
        feats = self.processor.feature_extractor(waves, sampling_rate=16000, return_tensors="pt")
        tok = self.processor.tokenizer
        eot = tok.convert_tokens_to_ids("<|endoftext|>")
        labs = [self.prefixes[r["task"]] + tok(r["text"], add_special_tokens=False).input_ids[:440] + [eot]
                for r in rows]
        L = max(map(len, labs))
        labels = torch.tensor([x + [-100] * (L - len(x)) for x in labs])
        return {"input_features": feats.input_features, "labels": labels}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="whisper_multitask.yaml")
    ap.add_argument("--max_steps", type=int, default=-1)
    args = ap.parse_args()
    cfg = load_config(args.config)
    data_cfg, acfg = load_config(cfg["data_config"]), load_config(cfg["asr_config"])
    set_seed(cfg["seed"])
    from transformers import (Seq2SeqTrainer, Seq2SeqTrainingArguments, WhisperForConditionalGeneration,
                              WhisperProcessor)

    processor = WhisperProcessor.from_pretrained(cfg["model"]["name"])
    model = WhisperForConditionalGeneration.from_pretrained(cfg["model"]["name"])
    add_lang_token(model, processor.tokenizer, cfg["model"]["new_lang_token"], cfg["model"]["init_from_lang"])
    model.generation_config.forced_decoder_ids = None
    model.config.forced_decoder_ids = None
    prefixes = {"bdq": prefix_ids(processor.tokenizer, cfg["model"]["new_lang_token"]),
                "vi": prefix_ids(processor.tokenizer, "<|vi|>")}

    def load(split, max_n=None):
        df = load_split_df(split, data_cfg)
        df = df[(df.duration <= cfg["data"]["max_duration"]) & df.mt_ok.fillna(False).astype(bool)]
        ds = build_hf_dataset(df, acfg["data"]["raw_dir"], max_samples=max_n, seed=cfg["seed"])
        return MultiTaskDataset(ds, dict(zip(df.uid, df.vi)))

    train_ds = load(cfg["data"]["train_split"])
    eval_ds = load(cfg["data"]["eval_split"], cfg["data"]["max_eval_samples"])
    tc = cfg["train"]
    import math

    steps_per_epoch = math.ceil(len(train_ds) / (tc["per_device_train_batch_size"] * tc["gradient_accumulation_steps"]))
    targs = training_args(
        Seq2SeqTrainingArguments,
        total_steps=args.max_steps if args.max_steps > 0 else steps_per_epoch * int(tc["num_train_epochs"]),
        output_dir=str(resolve_path(tc["output_dir"])), num_train_epochs=tc["num_train_epochs"], max_steps=args.max_steps,
        per_device_train_batch_size=tc["per_device_train_batch_size"],
        gradient_accumulation_steps=tc["gradient_accumulation_steps"], learning_rate=tc["learning_rate"],
        warmup_ratio=tc["warmup_ratio"], optim=tc["optim"], gradient_checkpointing=tc["gradient_checkpointing"],
        bf16=tc["bf16"] and torch.cuda.is_available(), eval_strategy="steps", eval_steps=tc["eval_steps"],
        save_steps=tc["save_steps"], logging_steps=tc["logging_steps"], save_total_limit=tc["save_total_limit"],
        load_best_model_at_end=True, metric_for_best_model="eval_loss", greater_is_better=False,
        remove_unused_columns=False, report_to=tc["report_to"], seed=cfg["seed"],
    )
    trainer = Seq2SeqTrainer(model=model, args=targs, train_dataset=train_ds, eval_dataset=eval_ds,
                             data_collator=WhisperCollator(processor, prefixes), processing_class=processor)
    trainer.train()
    best = resolve_path(tc["output_dir"]) / "best"
    trainer.save_model(str(best))
    processor.save_pretrained(str(best))


if __name__ == "__main__":
    main()
