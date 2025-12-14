# WhatsApp Bot

Bot WhatsApp dengan fitur pembuatan sticker dan integrasi AI.

## Fitur

- Pembuatan sticker dari gambar
- Chat AI menggunakan OpenRouter
- Keep-alive server untuk mencegah sleep
- Auto chat setiap 10 menit untuk menjaga koneksi aktif
- Perintah `.tagall [pesan opsional]` untuk menandai semua anggota grup (hanya admin grup)

## Instalasi

1. Clone repository ini
2. Install dependencies: `npm install`
3. Set environment variable: `OPENROUTER_API_KEY=your_api_key`
4. Jalankan bot: `npm start`

## Deploy

### Railway

1. Push ke GitHub
2. Connect ke Railway
3. Set environment variable `OPENROUTER_API_KEY` dan `RAILWAY_ENVIRONMENT=true`
4. Deploy

### Docker

1. Build image: `docker build -t whatsapp-bot .`
2. Run container: `docker run -p 3000:3000 whatsapp-bot`

## Menjaga Bot Tetap Aktif

Bot ini memiliki server Express di port 3000 untuk keep-alive.

### Ping Service Eksternal

Gunakan layanan seperti cron-job.org atau UptimeRobot untuk ping endpoint `/` atau `/status` setiap 5-10 menit.

Contoh URL: `https://your-app-url.com/` atau `https://your-app-url.com/status`

### Auto Chat

Bot secara otomatis mengirim pesan keep-alive ke diri sendiri setiap 10 menit untuk menjaga koneksi WebSocket aktif.

## Endpoint

- `/` : Keep-alive, mengembalikan "Bot aktif 🚀"
- `/status` : Status bot dalam JSON, termasuk uptime

## Troubleshooting

- Jika bot sering disconnect, pastikan ping service eksternal aktif
- Untuk Railway, pastikan environment variable `RAILWAY_ENVIRONMENT` diset
- Jika ada error ProtocolError, bot akan otomatis reinitialize

## Lisensi

MIT
