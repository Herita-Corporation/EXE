# Bahnar-Translator — dịch tiếng Ba Na → tiếng Việt

Service Python (FastAPI) nhận **giọng nói hoặc văn bản tiếng Ba Na**, trả **chữ Ba Na nhận dạng được + bản dịch tiếng Việt**.
Mã nguồn lấy từ repo huấn luyện [`Herita-Corporation/Ethnic_Translation`](https://github.com/Herita-Corporation/Ethnic_Translation)
(thư mục `bahnar_translator/`, bản ngày 30/09/2026) — chỉ giữ phần cần để chạy service.

```
App (Front-End) ──JWT──► aitour-service  /api/v1/translate/*   (kiểm tra đăng nhập, giới hạn input)
                              │  X-API-Key (bí mật, chỉ ở server)
                              ▼
                     bahnar-translator  /v1/translate/bahnar-*   (ASR w2v-bert-2.0 + KenLM → MT BARTpho)
```

App **không bao giờ** gọi thẳng service này. Endpoint cho app nằm ở AITour: `Disa-App/AITour.Presentation/Controllers/TranslationController.cs`.

## Kết quả model (đo 30/09/2026)

| | Tập test | Kết quả |
|---|---|---|
| Nhận dạng giọng nói (ASR) | YouTube / radio | CER 11.7 % / 16.7 % (nhãn tự động) |
| Dịch (MT) | EAAI24 hội thoại | BLEU 69.4, chrF++ 78.2 |

Bản dịch máy, có thể sai — app luôn hiển thị `disclaimer`, và khi `rejected = true` thì mời người dùng nói lại.

## Yêu cầu máy

| | Tối thiểu (CPU) |
|---|---|
| RAM | **8 GB riêng cho service này** (model ~4 GB nạp vào RAM) |
| CPU | 4 vCPU — ~0.5–1 s/câu văn bản, vài giây/câu nói |
| Đĩa | ~10 GB (image + model) |

⚠️ **Không chạy chung được** trên EC2 t3.medium (4 GB) cùng 7 container hiện có. Chạy ở máy khác (đặt
`TRANSLATOR_BASE_URL`) hoặc nâng máy ≥ 16 GB — xem ghi chú trong `docker-compose.prod.yml`.

## 1. Tải model (1 lần)

Model nằm ở repo Hugging Face **private** (GitHub không chứa được file 2.4 GB). Cần tài khoản HF được mời vào repo
và token quyền **Read**:

```bash
cd Bahnar-Translator
pip install huggingface_hub
HF_TOKEN=hf_xxx python scripts/models_hub.py download --repo <org>/bahnar-translator-models
# → models/asr, models/mt, models/lm   (models/ đã gitignore)
```

## 2. Chạy

**Docker (khuyến nghị)** — từ thư mục gốc repo, sau khi có `models/`:
```bash
# .env ở thư mục gốc: đặt TRANSLATOR_API_KEY=<chuỗi ngẫu nhiên> (dùng chung cho aitour-service và translator)
docker compose --profile translator up --build
# Swagger của translator (chỉ dev): http://localhost:8090/docs
```
Không có `--profile translator` → mọi thứ chạy như trước, riêng `/api/v1/translate/*` trả 503.

**Không dùng Docker** (Python 3.11–3.12):
```bash
cd Bahnar-Translator
pip install "torch>=2.6" --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt && pip install --no-deps pyctcdecode pygtrie
PIPELINE_CONFIG=pipeline_prod.yaml TRANSLATOR_API_KEY=<khóa> uvicorn src.serve.app:app --host 0.0.0.0 --port 8080
```
Rồi trỏ AITour tới nó: `Translator__BaseUrl=http://<host>:8080`, `Translator__ApiKey=<khóa>`
(biến môi trường, hoặc `appsettings.json` khi chạy `dotnet run` — **không commit khóa thật**).

Tùy chọn: KenLM (`pip install https://github.com/kpu/kenlm/archive/master.zip`, cần C++ build tools — Docker đã có)
giảm lỗi từ ~1–2 điểm; thiếu thì tự giải mã greedy. Giọng đọc tiếng Việt: `pip install vieneu==3.7.1`; thiếu thì
API vẫn trả chữ.

## 3. API (nội bộ, AITour gọi)

| Endpoint | Vào | Ra (JSON, snake_case) |
|---|---|---|
| `POST /v1/translate/bahnar-text` | `{"text": "...", "synthesize": false}` | `translation_vi`, `confidence`, `disclaimer`, `latency_ms` |
| `POST /v1/translate/bahnar-speech` | multipart `audio` (≤ 10 MB, ≤ 30 s), `synthesize` | `transcript_bdq`, `translation_vi`, `rejected`, `message`, `confidence`, `disclaimer`, (`audio_vi_wav_base64`) |
| `GET /healthz` | — | `status`, `pipeline_loaded` |

Mọi `/v1/*` yêu cầu header `X-API-Key` khi `TRANSLATOR_API_KEY` được đặt. Model nạp ở request đầu (~15–30 s).

## 4. Test (không cần model/GPU)

```bash
cd Bahnar-Translator && python -m pytest tests -q
```

## Bản quyền dữ liệu

Model huấn luyện trên **cuong06/Bahnar_Vietnamese** (CC BY-NC 4.0 — tác giả đã đồng ý cho app **miễn phí, không
quảng cáo, không thu phí**, với điều kiện ghi công và không phân phối lại audio gốc; có doanh thu → cần giấy phép
thương mại riêng) và **EAAI24** (đang chờ xác nhận license). Ghi công bắt buộc phải hiển thị trong app — nội dung
chuẩn ở `docs/ATTRIBUTION.md` của repo Ethnic_Translation.
