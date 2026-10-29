# Runbook — bật / tắt / kiểm tra tính năng dịch Ba Na → Việt

```
App ──JWT──► aitour-service (stack chính) ──HTTPS + X-API-Key──► translator.disatravel.id.vn (EC2 riêng)
```

| Máy | Địa chỉ | Chạy gì |
|---|---|---|
| Stack chính (EC2, tài khoản 1) | 54.251.107.214 · iam./aitour./task.disatravel.id.vn | `docker-compose.prod.yml` (KHÔNG `--profile translator` — máy 4 GB) |
| Máy dịch (EC2 t3.large, tài khoản 2) | 46.51.216.24 (Elastic IP) · translator.disatravel.id.vn | `Bahnar-Translator/deploy/docker-compose.yml` (translator + Caddy HTTPS) |
| Model | Hugging Face private `justeg4n/bahnar-translator-models` | tải bằng `scripts/models_hub.py download` |

## 1. Bật máy dịch
1. EC2 console (tài khoản 2) → Instance state → **Start**, chờ ~2 phút (container tự chạy lại: `restart: unless-stopped`).
2. `curl https://translator.disatravel.id.vn/healthz` → `{"status":"ok",...}`
3. Không lên → SSH (`ssh -i <key>.pem ubuntu@46.51.216.24`):
   ```bash
   cd ~/EXE/Bahnar-Translator
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
   docker compose -f deploy/docker-compose.yml ps     # translator: healthy
   ```
Lần dịch đầu sau khi bật mất ~15–30 s (nạp model).

## 2. Stack chính (production)
`.env` cạnh `docker-compose.prod.yml` phải có:
```
TRANSLATOR_BASE_URL=https://translator.disatravel.id.vn
TRANSLATOR_API_KEY=<giống hệt deploy/.env trên máy dịch>
```
Sau khi pull code mới: `docker compose -f docker-compose.prod.yml up -d --build aitour-service`
Kiểm tra: `docker exec disa-aitour-service printenv Translator__BaseUrl`

## 3. Dev ở máy nhà (Expo Go trên điện thoại)
```powershell
cd EXE
docker compose up -d                                   # dùng máy dịch trên EC2 (theo .env), không cần --profile translator
cd Front-End
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<IP LAN của máy tính>"   # tránh Expo chọn nhầm IP VPN/WSL
npx expo start -c --lan
```
- Điện thoại cùng mạng với máy tính, quét QR mới. Trong app → API Settings: địa chỉ phải có cổng `:5195` `:5289` `:5020`.
- Timeout → mở `http://<IP>:8081` trên trình duyệt điện thoại; mở cổng 8081 trên tường lửa; tắt VPN; hoặc `npx expo start -c --tunnel`.
- Bản phát hành: `expo-audio` + `expo-speech` là module native → phải `eas build` (không OTA); `EXPO_PUBLIC_AITOUR_API_URL=https://aitour.disatravel.id.vn`.

## 4. Thử nhanh
AI Guide → Ba Na → gõ câu Ba Na → Dịch → Nghe; bấm micro → nói → app dịch và tự đọc to.

| Lỗi | Nguyên nhân thường gặp |
|---|---|
| "Dịch vụ dịch đang không khả dụng" (503) | Máy dịch đang tắt, hoặc `TRANSLATOR_API_KEY` hai nơi không khớp |
| "Không thể kết nối tới máy chủ" | Sai IP/cổng trong API Settings, Docker chưa chạy |
| "Bạn chưa đăng nhập" (401) | Token hết hạn → đăng nhập lại |

## 5. Cập nhật code / dựng lại máy dịch
```bash
cd ~/EXE && git pull && cd Bahnar-Translator
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build   # build lỗi "exit code 2" (mạng) → chạy lại
```
Máy mới hoàn toàn: Ubuntu 24.04 x86, t3.large, ổ 30 GB gp3, SG chỉ mở 22 (My IP) / 80 / 443, Elastic IP + bản ghi A
`translator` (DNS ở Mắt Bão) → cài `docker.io docker-compose-v2 git python3-venv`, swap 4 GB → clone →
`python3 -m venv ~/hfenv && ~/hfenv/bin/pip install huggingface_hub pyyaml` →
`HF_TOKEN=<read> ~/hfenv/bin/python scripts/models_hub.py download --repo justeg4n/bahnar-translator-models` →
`cp deploy/.env.example deploy/.env` (điền domain + khóa) → `up -d --build`.

## 6. Tắt để tiết kiệm
- Máy dịch: EC2 → **Stop** (giữ IP/ổ/model; ~6 USD/tháng khi dừng). App vẫn chạy, chỉ tính năng dịch báo không khả dụng.
- Máy nhà: `docker compose down` (KHÔNG `-v` — xoá dữ liệu DB).

## 7. Bí mật — không commit, không gửi
File `.pem` SSH · `.env` (stack chính) · `deploy/.env` (máy dịch) · `HF_TOKEN`.

## 8. Giấy phép dữ liệu (hạn cần nhớ)
cuong06/Bahnar_Vietnamese: được thu phí các tính năng khác **đến hết 30/11/2026** (dịch giữ miễn phí); doanh thu
> 3.000.000đ → gửi tác giả 10%; gửi tác giả báo cáo ngắn khi kết thúc. Sau hạn: dừng thu phí hoặc xin gia hạn.
