# models/ (không commit)

Thư mục chứa model đã huấn luyện (~4 GB). Tải về bằng (cần `HF_TOKEN` có quyền đọc repo model private):

```bash
cd Bahnar-Translator
python scripts/models_hub.py download --repo <org>/bahnar-translator-models
```

Kết quả: `models/asr/`, `models/mt/`, `models/lm/` — đúng đường dẫn trong `configs/pipeline_prod.yaml`.
