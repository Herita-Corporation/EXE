"""Train ASR Ba Na (Phase 1).

    # chạy thử 5% để ước lượng thời gian 1 epoch (báo người dùng trước khi train full)
    python -m src.asr.train --config asr_w2vbert.yaml --subset_frac 0.05 --max_steps 200
    python -m src.asr.train --config asr_w2vbert.yaml

Cần audio local: ``python -m src.data.download --what cuong06 --mode shards --shards 0-49``.
Lưu ý đĩa: `datasets` tạo cache Arrow (≈ dung lượng các shard đã dùng); có thể đặt HF_DATASETS_CACHE.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import time

# Phải đặt TRƯỚC lần cấp phát CUDA đầu tiên — giảm phân mảnh VRAM (câu dài 20-40s cấp phát không đều
# kích thước dễ phân mảnh bộ nhớ trên GPU ít VRAM như T4). Không ghi đè nếu người dùng đã tự đặt.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from src import drive_sync
from src.train_budget import make_budget_callback
from src.asr.augment import Augmenter, rms_normalize
from src.asr.dataset import build_hf_dataset, decode_audio, load_split_df
from src.eval.asr_metrics import wer_cer
from src.text.vocab import build_ctc_vocab, load_vocab, save_vocab, unk_rate
from src.utils import (apply_overrides, get_logger, git_commit, load_config, resolve_path, set_seed,
                       training_args)

log = get_logger("asr.train")
EXIT_OOM = 3  # script điều phối bắt mã này để tự hạ batch


# ------------------------------------------------------------------ vocab / processor
def ensure_vocab(cfg: dict, data_cfg: dict) -> dict:
    vp = resolve_path(cfg["model"]["vocab_path"])
    if vp.exists():
        return load_vocab(vp)
    import pandas as pd

    sp = resolve_path(data_cfg["paths"]["splits"])
    texts = []
    for name in ("cuong06_train", "eaai24_train", "dict_train"):
        p = sp / f"{name}.jsonl"
        if p.exists():
            texts += pd.read_json(p, lines=True).ba.tolist()
    vocab = build_ctc_vocab(texts, min_count=1)  # đủ mọi ký tự Latin → [UNK] val = 0
    save_vocab(vocab, vp)
    log.info("Vocab CTC: %d token -> %s", len(vocab), vp)
    return vocab


def build_processor(cfg: dict, vocab_path: Path):
    from transformers import (SeamlessM4TFeatureExtractor, Wav2Vec2BertProcessor, Wav2Vec2CTCTokenizer)

    tok = Wav2Vec2CTCTokenizer(str(vocab_path), unk_token="<unk>", pad_token="<pad>", word_delimiter_token="|",
                               bos_token="<s>", eos_token="</s>")
    fe = SeamlessM4TFeatureExtractor.from_pretrained(cfg["model"]["name"])
    return Wav2Vec2BertProcessor(feature_extractor=fe, tokenizer=tok)


def build_model(cfg: dict, processor):
    m = cfg["model"]
    if m["type"] == "w2vbert":
        from transformers import Wav2Vec2BertForCTC

        model = Wav2Vec2BertForCTC.from_pretrained(
            m["name"], vocab_size=len(processor.tokenizer), pad_token_id=processor.tokenizer.pad_token_id,
            ctc_loss_reduction="mean", ctc_zero_infinity=m["ctc_zero_infinity"], layerdrop=m["layerdrop"],
            mask_time_prob=m["mask_time_prob"], mask_time_length=m["mask_time_length"],
            mask_feature_prob=m["mask_feature_prob"], mask_feature_length=m["mask_feature_length"],
            add_adapter=True, attention_dropout=0.0, hidden_dropout=0.0, feat_proj_dropout=0.0,
            ignore_mismatched_sizes=True,  # lm_head luôn khởi tạo mới theo vocab Ba Na
        )
    elif m["type"] == "mms_adapter":
        from transformers import Wav2Vec2ForCTC

        # Nạp adapter bdq PRETRAINED (không init lại), chỉ fine-tune adapter + lm_head
        model = Wav2Vec2ForCTC.from_pretrained(m["mms_name"], target_lang=m["mms_lang"], ctc_zero_infinity=True,
                                               mask_time_prob=m["mask_time_prob"])
        model.freeze_base_model()
        for n, p in model.named_parameters():
            p.requires_grad = ("adapter" in n) or n.startswith("lm_head")
    else:
        raise ValueError(m["type"])
    n_freeze = int(m.get("freeze_encoder_layers") or 0)
    if n_freeze:
        # Đóng băng conv frontend + N tầng encoder DƯỚI. Params vẫn nằm trên GPU nhưng KHÔNG cần grad
        # và KHÔNG có optimizer state → tiết kiệm ~3 byte/param mỗi tầng bị đóng (quan trọng với GPU 8GB).
        # Tầng dưới học đặc trưng âm học chung, đóng băng ít ảnh hưởng chất lượng khi ít dữ liệu.
        enc = None
        for attr in ("wav2vec2_bert", "wav2vec2"):
            if hasattr(model, attr):
                enc = getattr(model, attr)
        if enc is None:
            raise RuntimeError("Không tìm được encoder để đóng băng")
        if hasattr(enc, "feature_projection"):
            for p in enc.feature_projection.parameters():
                p.requires_grad = False
        if hasattr(enc, "feature_extractor"):
            for p in enc.feature_extractor.parameters():
                p.requires_grad = False
        layers = enc.encoder.layers
        if n_freeze >= len(layers):
            raise ValueError(f"freeze_encoder_layers={n_freeze} >= số tầng ({len(layers)}) → không còn gì để train")
        for layer in layers[:n_freeze]:
            for p in layer.parameters():
                p.requires_grad = False
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in model.parameters())
        log.info("Đóng băng %d/%d tầng dưới → train %.0fM/%.0fM tham số (%.0f%%)", n_freeze, len(layers),
                 trainable / 1e6, total / 1e6, 100 * trainable / total)
    if m.get("gradient_checkpointing"):
        model.gradient_checkpointing_enable()
    return model


# ------------------------------------------------------------------ LLRD optimizer
def llrd_param_groups(model, base_lr: float, head_lr: float, decay: float, wd: float) -> list[dict]:
    """Layer-wise LR decay: tầng encoder trên cùng lr=base_lr, mỗi tầng dưới nhân `decay`; head dùng head_lr."""
    layers = None
    for attr in ("wav2vec2_bert", "wav2vec2"):
        if hasattr(model, attr):
            layers = getattr(model, attr).encoder.layers
            prefix = f"{attr}.encoder.layers."
    n_layers = len(layers) if layers is not None else 0
    groups: dict[tuple, dict] = {}
    for name, p in model.named_parameters():
        if not p.requires_grad:
            continue
        if name.startswith("lm_head") or ".adapter." in name or "adapter_layer" in name:
            lr = head_lr
        elif layers is not None and name.startswith(prefix):
            i = int(name[len(prefix):].split(".")[0])
            lr = base_lr * decay ** (n_layers - 1 - i)
        else:  # feature projection / embeddings: thấp nhất
            lr = base_lr * decay ** n_layers
        no_wd = p.ndim == 1 or name.endswith(".bias")
        key = (lr, 0.0 if no_wd else wd)
        groups.setdefault(key, {"params": [], "lr": lr, "weight_decay": key[1]})["params"].append(p)
    return list(groups.values())


# ------------------------------------------------------------------ collator
@dataclass
class CTCCollator:
    processor: object
    augmenter: Augmenter | None = None
    target_dbfs: float = -23.0
    input_key: str = "input_features"

    def __call__(self, rows: list[dict]) -> dict:
        waves = []
        for r in rows:
            y = decode_audio(r["audio"])
            y = self.augmenter(y) if self.augmenter is not None else rms_normalize(y, self.target_dbfs)
            waves.append(y)
        feats = self.processor.feature_extractor(waves, sampling_rate=16000, return_tensors="pt", padding=True,
                                                 return_attention_mask=True)
        labels = self.processor.tokenizer([r["text"] for r in rows], padding=True, return_tensors="pt")
        lab = labels["input_ids"].masked_fill(labels["attention_mask"].ne(1), -100)
        return {**feats, "labels": lab}


# ------------------------------------------------------------------ sampler theo nguồn
def source_weights(sources: list[str], temperature: float) -> np.ndarray:
    """Temperature sampling: q_s ∝ (n_s/N)^(1/T); trọng số mỗi mẫu = q_s / n_s."""
    s = np.asarray(sources)
    names, counts = np.unique(s, return_counts=True)
    q = (counts / counts.sum()) ** (1.0 / temperature)
    q = q / q.sum()
    per = dict(zip(names, q / counts))
    return np.array([per[x] for x in s])


def make_trainer_cls():
    from transformers import Trainer

    class SourceBalancedTrainer(Trainer):
        sample_weights: np.ndarray | None = None

        def _get_train_sampler(self, *args, **kwargs):
            if self.sample_weights is None:
                return super()._get_train_sampler(*args, **kwargs)
            return torch.utils.data.WeightedRandomSampler(
                torch.as_tensor(self.sample_weights, dtype=torch.double), num_samples=len(self.sample_weights),
                replacement=True)

    return SourceBalancedTrainer


def argmax_logits(logits, labels):
    return logits.argmax(dim=-1)


def make_time_save_callback(minutes: float):
    """Lưu checkpoint mỗi `minutes` phút (Colab có thể ngắt GPU bất cứ lúc nào).

    Độc lập với eval_steps; checkpoint vẫn xoay vòng theo save_total_limit (luôn giữ best + mới nhất).
    """
    from transformers import TrainerCallback

    class SaveEveryMinutes(TrainerCallback):
        def __init__(self):
            self.last = time.time()

        def on_step_end(self, args, state, control, **kw):
            if minutes and time.time() - self.last >= minutes * 60:
                control.should_save = True
                self.last = time.time()
                log.info("Lưu checkpoint theo thời gian tại step %d", state.global_step)
            return control

    return SaveEveryMinutes()


def make_early_stopping(patience: int, min_steps: int):
    """Early stopping chỉ tính từ sau `min_steps`: giai đoạn đầu CTC chưa phát chữ (WER = 1.0 đứng yên)."""
    from transformers import EarlyStoppingCallback

    class DelayedEarlyStopping(EarlyStoppingCallback):
        def on_evaluate(self, args, state, control, metrics, **kw):
            if state.global_step < min_steps:
                return
            return super().on_evaluate(args, state, control, metrics, **kw)

    return DelayedEarlyStopping(patience)


def pick_precision(want: str) -> dict:
    """auto: bf16 nếu GPU hỗ trợ (A100/L4), ngược lại fp16 (T4 KHÔNG hỗ trợ bf16)."""
    if not torch.cuda.is_available() or want == "fp32":
        return {}
    if want == "bf16" or (want == "auto" and torch.cuda.is_bf16_supported()):
        return {"bf16": True}
    return {"fp16": True}


def make_optimizer(model, tc: dict):
    """AdamW, hoặc AdamW8bit nếu bật `optim_8bit` (optimizer state 1 byte/param thay vì 8 → tiết kiệm VRAM).

    bitsandbytes hay thiếu/lỗi trên Windows → fallback AdamW thường kèm cảnh báo, KHÔNG crash giữa lúc chạy.
    """
    groups = llrd_param_groups(model, tc["learning_rate"], tc["head_lr"], tc["llrd_decay"], tc["weight_decay"])
    if tc.get("optim_8bit"):
        try:
            import bitsandbytes as bnb

            return bnb.optim.AdamW8bit(groups)
        except Exception as e:
            log.warning("optim_8bit bật nhưng bitsandbytes không dùng được (%s: %s) → dùng AdamW thường. "
                        "Trên GPU ít VRAM hãy tăng freeze_encoder_layers hoặc giảm batch để bù.",
                        type(e).__name__, str(e)[:120])
    return torch.optim.AdamW(groups)


def resolve_resume(arg: str | None, out_dir: Path) -> str | None:
    """--resume auto: checkpoint ĐẦY ĐỦ mới nhất. Checkpoint ghi dở (Colab ngắt giữa lúc lưu) được đổi tên
    thành ``incomplete-checkpoint-N`` để Trainer không dùng và không tính khi xoay vòng."""
    if arg in (None, "none", "no"):
        return None
    if arg != "auto":
        return arg
    if not out_dir.exists():
        log.info("Resume: chưa có output_dir → train từ đầu")
        return None
    ckpts = sorted((d for d in out_dir.glob("checkpoint-*") if d.is_dir() and d.name.split("-")[-1].isdigit()),
                   key=lambda d: int(d.name.split("-")[-1]), reverse=True)
    for d in ckpts:
        if drive_sync.is_complete(d):
            log.info("Resume: %s", d)
            return str(d)
        bad = d.with_name("incomplete-" + d.name)
        d.rename(bad)
        log.warning("Checkpoint ghi dở %s → đổi tên %s (có thể xóa)", d.name, bad.name)
    log.info("Resume: không có checkpoint hợp lệ → train từ đầu")
    return None


def compute_metrics_fn(processor):
    def fn(pred):
        ids = pred.predictions
        ids = np.where(ids == -100, processor.tokenizer.pad_token_id, ids)
        hyps = processor.batch_decode(ids)
        lab = np.where(pred.label_ids != -100, pred.label_ids, processor.tokenizer.pad_token_id)
        refs = processor.batch_decode(lab, group_tokens=False)
        return wer_cer(refs, hyps)

    return fn


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="asr_w2vbert.yaml")
    ap.add_argument("--subset_frac", type=float, default=None)
    ap.add_argument("--max_steps", type=int, default=-1)
    ap.add_argument("--resume", default="auto", help="auto | none | đường dẫn checkpoint")
    ap.add_argument("--tier", default=None, help="tên tầng trong data.tiers (src.asr scaling check)")
    ap.add_argument("--override", action="append", default=[],
                    help="sửa config, vd --override train.per_device_train_batch_size=4 (lặp được)")
    args = ap.parse_args()
    cfg = apply_overrides(load_config(args.config), args.override)
    data_cfg = load_config(cfg["data_config"])
    set_seed(cfg["seed"])
    dc, tc = cfg["data"], cfg["train"]
    if args.subset_frac is not None:
        dc["subset_frac"] = args.subset_frac

    vocab = ensure_vocab(cfg, data_cfg)
    vocab_path = resolve_path(cfg["model"]["vocab_path"])
    train_df = load_split_df(dc["train_split"], data_cfg)
    eval_df = load_split_df(dc["eval_split"], data_cfg)
    if dc.get("exclude_ids_file"):
        bad = set(Path(resolve_path(dc["exclude_ids_file"])).read_text(encoding="utf-8").split())
        train_df = train_df[~train_df.uid.isin(bad)]
        log.info("Vòng 2: loại %d câu CTC loss cao", len(bad))
    if args.tier:
        dc["shards"] = dc["tiers"][args.tier]
        tc["output_dir"] = str(Path(tc["output_dir"]) / args.tier)
    if dc.get("shards") is not None:
        train_df = train_df[train_df.shard.isin(dc["shards"])]
        log.info("Giới hạn shard %s → %d câu train, %.1f giờ", dc["shards"], len(train_df),
                 train_df.duration.sum() / 3600)
    if dc.get("max_duration_override"):
        # Giới hạn RIÊNG cho lần chạy này (vd GPU yếu như T4 không kham nổi câu 40s) — KHÔNG đụng
        # tới data.split.max_duration của Phase 0 (split gốc vẫn giữ 40s cho lần train chính thức).
        cap = dc["max_duration_override"]
        n0, h0 = len(train_df), train_df.duration.sum() / 3600
        train_df = train_df[train_df.duration <= cap]
        eval_df = eval_df[eval_df.duration <= cap]
        log.info("max_duration_override=%.0fs: train %d→%d câu (%.1f→%.1f giờ)", cap, n0, len(train_df), h0,
                 train_df.duration.sum() / 3600)
    rate, unk = unk_rate(eval_df.text, vocab)
    assert rate == 0.0, f"[UNK] trên val phải = 0, đang là {rate:.5f}: {unk.most_common(10)}"

    train_ds = build_hf_dataset(train_df, dc["raw_dir"], dc["subset_frac"], cfg["seed"])
    from src.data.export_audio import split_audio_file

    eval_audio = split_audio_file(dc["eval_split"], data_cfg)
    if eval_audio is None and dc.get("shards") is not None:  # không có audio val đã trích → val trong shard đã tải
        eval_df = eval_df[eval_df.shard.isin(dc["shards"])]
    eval_ds = build_hf_dataset(eval_df, dc["raw_dir"], max_samples=dc["max_eval_samples"], seed=cfg["seed"],
                               audio_parquet=eval_audio)

    if cfg["model"]["type"] == "mms_adapter":
        from transformers import AutoProcessor

        processor = AutoProcessor.from_pretrained(cfg["model"]["mms_name"], target_lang=cfg["model"]["mms_lang"])
        processor.tokenizer.set_target_lang(cfg["model"]["mms_lang"])
        mms_rate, mms_unk = unk_rate(eval_df.text, {**processor.tokenizer.vocab, "|": 0})
        log.warning("MMS bdq vocab: tỷ lệ ký tự ngoài vocab trên val = %.4f %s", mms_rate, mms_unk.most_common(10))
    else:
        processor = build_processor(cfg, vocab_path)
    model = build_model(cfg, processor)

    from transformers import TrainingArguments

    # CLI --max_steps ưu tiên (dùng cho chạy thử nhanh); nếu không truyền, lấy từ config (vd scaling check);
    # -1/0/None = tắt, dùng num_train_epochs như bình thường.
    max_steps = args.max_steps if args.max_steps > 0 else int(tc.get("max_steps") or -1)
    out_dir = resolve_path(tc["output_dir"])
    if args.max_steps > 0:  # chạy thử qua CLI: thư mục riêng, không lẫn checkpoint của run thật
        out_dir = out_dir.with_name(out_dir.name + "_dryrun")
    # Tổng số step, để quy đổi warmup_ratio → warmup_steps trên transformers không còn warmup_ratio.
    steps_per_epoch = math.ceil(len(train_ds) / (tc["per_device_train_batch_size"] * tc["gradient_accumulation_steps"]))
    total_steps = max_steps if max_steps > 0 else steps_per_epoch * int(tc["num_train_epochs"])
    targs = training_args(
        TrainingArguments, total_steps=total_steps,
        output_dir=str(out_dir), per_device_train_batch_size=tc["per_device_train_batch_size"],
        per_device_eval_batch_size=tc["per_device_eval_batch_size"],
        gradient_accumulation_steps=tc["gradient_accumulation_steps"], num_train_epochs=tc["num_train_epochs"],
        max_steps=max_steps, warmup_ratio=tc["warmup_ratio"], **pick_precision(str(tc.get("precision", "auto"))),
        eval_strategy="steps", eval_steps=tc["eval_steps"], save_steps=tc["save_steps"],
        logging_steps=tc["logging_steps"], save_total_limit=tc["save_total_limit"],
        load_best_model_at_end=True, metric_for_best_model="cer", greater_is_better=False,
        group_by_length=dc.get("source_temperature") is None, length_column_name="duration",
        dataloader_num_workers=tc["dataloader_num_workers"], remove_unused_columns=False,
        report_to=tc["report_to"], seed=cfg["seed"], save_safetensors=True,
    )
    drive_dir = resolve_path(tc["drive_dir"]) if tc.get("drive_dir") else None
    if drive_dir is not None and args.max_steps <= 0:
        drive_sync.restore(drive_dir, out_dir)
    opt = make_optimizer(model, tc)
    aug = Augmenter(cfg["augment"]) if cfg["augment"]["enabled"] else None
    Trainer = make_trainer_cls()
    trainer = Trainer(
        model=model, args=targs, train_dataset=train_ds, eval_dataset=eval_ds,
        data_collator=CTCCollator(processor, aug, cfg["augment"]["target_dbfs"]),
        processing_class=processor,  # lưu cả tokenizer/vocab vào MỖI checkpoint → decode được từ checkpoint
        compute_metrics=compute_metrics_fn(processor), preprocess_logits_for_metrics=argmax_logits,
        optimizers=(opt, None),
        callbacks=[make_early_stopping(tc["early_stopping_patience"], tc.get("early_stopping_min_steps", 0)),
                   make_time_save_callback(tc.get("save_every_minutes", 0))]
        + ([make_budget_callback(tc["time_budget_hours"], usage_file=out_dir / "budget_usage.json")]
           if tc.get("time_budget_hours") else [])
        + ([drive_sync.make_callback(drive_dir)] if drive_dir is not None and args.max_steps <= 0 else []),
    )
    if dc.get("source_temperature"):
        trainer.sample_weights = source_weights(train_ds["source"], dc["source_temperature"])

    t0 = time.time()
    fake = os.environ.get("BAHNAR_TEST_OOM_ABOVE")  # CHỈ để kiểm thử thang tự hạ batch của vast_run_all.sh
    if fake and tc["per_device_train_batch_size"] > int(fake):
        log.error("[giả lập] CUDA OOM với per_device_train_batch_size=%d", tc["per_device_train_batch_size"])
        raise SystemExit(EXIT_OOM)
    oom_error = getattr(torch, "OutOfMemoryError", torch.cuda.OutOfMemoryError)
    try:
        trainer.train(resume_from_checkpoint=resolve_resume(args.resume, out_dir))
    except oom_error as e:
        # Batch dài nhất được xếp đầu (group_by_length) → OOM thường lộ ngay ở step đầu.
        log.error("CUDA OOM với per_device_train_batch_size=%d: %s", tc["per_device_train_batch_size"], str(e)[:200])
        raise SystemExit(EXIT_OOM)
    elapsed = time.time() - t0
    best = out_dir / "best"
    trainer.save_model(str(best))
    processor.save_pretrained(str(best))
    info = {"elapsed_sec": elapsed, "train_hours": sum(train_ds["duration"]) / 3600, "commit": git_commit(),
            "steps": trainer.state.global_step, "config": cfg}
    if max_steps > 0:
        info["est_hours_per_full_epoch"] = elapsed / max_steps * steps_per_epoch / dc["subset_frac"] / 3600
        log.info("Ước lượng 1 epoch FULL: %.1f giờ — báo người dùng trước khi train full.", info["est_hours_per_full_epoch"])
    (best / "train_info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    if drive_dir is not None:
        drive_sync.push_final(best, drive_dir if args.max_steps <= 0 else drive_dir.with_name(drive_dir.name + "_dryrun"))


if __name__ == "__main__":
    main()
