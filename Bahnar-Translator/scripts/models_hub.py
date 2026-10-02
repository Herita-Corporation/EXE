"""Lưu model trên Hugging Face Hub (PRIVATE) — GitHub không chứa được file > 100 MB (ASR 2.4 GB, MT 1.6 GB).

Máy nhà (1 lần, cần HF_TOKEN quyền WRITE trong .env):
    python scripts/models_hub.py upload --repo <org-hoac-user>/bahnar-translator-models --src ../results
Máy chủ (cần HF_TOKEN quyền READ, và được mời vào repo/org):
    python scripts/models_hub.py download --repo <org-hoac-user>/bahnar-translator-models
    → models/asr, models/mt, models/lm  (đúng đường dẫn configs/pipeline_prod.yaml)

Bố cục repo model:  asr/  (w2v-bert-2.0 CTC)   mt/  (BARTpho M4)   lm/  (KenLM LM_cuong + unigrams)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.utils import resolve_path  # noqa: E402  (nạp .env → HF_TOKEN)

# thư mục con trong --src (bố cục sau khi giải nén results/*.zip từ Vast) → thư mục trong repo model
LAYOUT = {"asr": "asr_model/asr_model", "mt": "mt_model/mt_model", "lm": "kenlm_lm/lm"}
IGNORE = ["logits_cache/*", "eval/*", "training_args.bin", "*.npz"]
LM_KEEP = ["LM_cuong.bin", "unigrams.txt"]   # các LM khác chỉ để ablation, không cần cho server

CARD = """---
license: cc-by-nc-4.0
language: [bdq, vi]
tags: [speech-translation, asr, machine-translation, bahnar]
---
# Bahnar → Vietnamese translator models (private)

| Thư mục | Model | Ghi chú |
|---|---|---|
| `asr/` | w2v-bert-2.0 + CTC, fine-tune 591 h audio cuong06 | CER test_source 11.7 %, test_radio 16.7 % (pseudo-label) |
| `mt/` | BARTpho M4 (cuong06 + EAAI24, tag `<conv>`) | BLEU eaai24_test 69.4 |
| `lm/` | KenLM 5-gram `LM_cuong` + unigrams | alpha 0.3, beta 0.5 |

Dữ liệu huấn luyện cuong06 là CC BY-NC 4.0, EAAI24 chưa rõ license → **chỉ dùng nghiên cứu / phi thương mại**.
Code + cách chạy: repo GitHub Ethnic_Translation, `configs/pipeline_prod.yaml`.
"""


def upload(repo: str, src: Path) -> None:
    from huggingface_hub import HfApi

    api = HfApi(token=os.environ.get("HF_TOKEN"))
    missing = [str(src / p) for p in LAYOUT.values() if not (src / p).exists()]
    if missing:
        sys.exit(f"Thiếu thư mục: {missing}")
    api.create_repo(repo, repo_type="model", private=True, exist_ok=True)
    api.upload_file(path_or_fileobj=CARD.encode(), path_in_repo="README.md", repo_id=repo)
    for dst, sub in LAYOUT.items():
        print(f"Upload {src / sub} → {repo}/{dst}/ (file lớn mất vài phút)…")
        api.upload_folder(repo_id=repo, folder_path=str(src / sub), path_in_repo=dst,
                          allow_patterns=LM_KEEP if dst == "lm" else None,
                          ignore_patterns=None if dst == "lm" else IGNORE,
                          commit_message=f"Upload {dst}")
    print(f"XONG → https://huggingface.co/{repo} (private)")


def download(repo: str, out: Path, revision: str | None) -> None:
    from huggingface_hub import snapshot_download

    path = snapshot_download(repo, local_dir=str(out), revision=revision, token=os.environ.get("HF_TOKEN"))
    for d in LAYOUT:
        print(f"  {d:4s} {'OK' if (Path(path) / d).exists() else 'THIẾU'}  {Path(path) / d}")
    print("Chạy server: PIPELINE_CONFIG=pipeline_prod.yaml uvicorn src.serve.app:app --host 0.0.0.0 --port 8080")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("upload")
    u.add_argument("--repo", required=True)
    u.add_argument("--src", default="../results", help="thư mục đã giải nén kết quả Vast (mặc định ../results)")
    d = sub.add_parser("download")
    d.add_argument("--repo", required=True)
    d.add_argument("--out", default="models")
    d.add_argument("--revision", default=None, help="commit/tag cụ thể để cố định phiên bản model")
    args = ap.parse_args()
    if not os.environ.get("HF_TOKEN"):
        sys.exit("Thiếu HF_TOKEN (upload cần quyền write, download cần quyền read) — đặt trong .env")
    if args.cmd == "upload":
        upload(args.repo, resolve_path(args.src))
    else:
        download(args.repo, resolve_path(args.out), args.revision)


if __name__ == "__main__":
    main()
