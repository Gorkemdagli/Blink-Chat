<div align="center">

# ChatApp

**Gerçek zamanlı, güvenli ve modern bir mesajlaşma uygulaması.**

[![Status](https://img.shields.io/badge/status-active-4ade80?style=flat-square)](https://github.com/Gorkemdagli/ChatApp-React-Node-)
[![License](https://img.shields.io/badge/license-MIT-60a5fa?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

</div>

---

## Ne Yapar?

ChatApp; anlık mesajlaşma, dosya paylaşımı ve okundu bilgisi gibi modern iletişim ihtiyaçlarını karşılayan bir web uygulamasıdır. Hesap oluşturun, arkadaş ekleyin, her cihazdan mesajlaşın.

### Özellikler

| | |
|---|---|
| ⚡ **Anlık Mesajlaşma** | Socket.IO ile gecikme olmaksızın mesaj iletimi |
| ✅ **Okundu Bilgisi** | İletildi (gri) ve okundu (mavi) tik sistemi |
| ✍️ **Yazıyor Göstergesi** | Karşı tarafın yazdığını anlık görün |
| 🟢 **Online Durumu** | Kullanıcıların çevrimiçi/çevrimdışı takibi |
| 📎 **Dosya Paylaşımı** | Görsel ve belge gönderme, önizleme desteği |
| 😊 **Emoji Seçici** | Entegre emoji paneli |
| 🌓 **Koyu / Açık Tema** | Sistem temasına uyumlu, tam geçiş desteği |
| 📱 **Tam Responsive** | Masaüstü, tablet ve mobil için optimize |

---

## Hızlı Başlangıç

En kolay yol: Docker ile tek komutta çalıştırmak.

**Gereksinimler:** [Docker Desktop](https://www.docker.com/products/docker-desktop), [Git](https://git-scm.com)

```bash
# 1. Projeyi klonlayın
git clone https://github.com/Gorkemdagli/ChatApp-React-Node-.git
cd ChatApp-React-Node-

# 2. Ortam değişkenlerini ayarlayın (detaylar aşağıda)
cp backend/.env.example backend/.env
# backend/.env dosyasını kendi Supabase bilgilerinizle doldurun

# 3. Başlatın
npm run build
```

Uygulama **[http://localhost:5173](http://localhost:5173)** adresinde hazır.

> **Supabase hesabı gerekmektedir.** [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluşturun ve `setup.sql` dosyasını SQL editöründe çalıştırın.

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express 5, TypeScript |
| Gerçek Zamanlı | Socket.IO 4 |
| Veritabanı | Supabase (PostgreSQL) |
| Önbellek | Redis 7 |
| Container | Docker, Docker Compose |
| Test | Vitest (frontend), Jest (backend), Playwright (E2E) |

---
---

## Geliştirici Kılavuzu

Aşağıdaki bölüm yerel geliştirme ortamını kurmak isteyen geliştiriciler içindir.

### Gereksinimler

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Docker Desktop** (Docker kurulumu için)
- **Supabase** hesabı (ücretsiz)

### Proje Yapısı

```
ChatApp-React-Node-/
├── backend/                 # Node.js + Express + Socket.IO API
│   ├── config/              # Redis, Supabase, Multer yapılandırmaları
│   ├── controllers/         # İnce HTTP kontrolcüleri (iş mantığı yok)
│   ├── services/            # Domain iş mantığı
│   ├── socket/              # Socket.IO olay yöneticileri
│   ├── routes/              # API rotaları
│   ├── validators/          # Zod şema doğrulamaları
│   ├── utils/               # Yardımcı fonksiyonlar
│   ├── migrations/          # Veritabanı migration'ları
│   ├── tests/               # Jest testleri
│   └── index.ts             # Uygulama giriş noktası
│
├── frontend/                # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/      # UI bileşenleri (ChatWindow, Sidebar, vb.)
│   │   ├── hooks/           # Custom React hook'ları
│   │   ├── types/           # TypeScript tip tanımları
│   │   ├── socket.ts        # Socket.IO istemci yapılandırması
│   │   └── supabaseClient.ts
│   ├── e2e/                 # Playwright E2E testleri
│   └── public/
│
├── setup.sql                # Veritabanı kurulum betiği
├── docker-compose.yml       # Container orkestrasyonu
└── package.json             # Kök komutlar
```

### Ortam Değişkenleri

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayın:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Supabase (supabase.com > Project Settings > API)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis şifresi (docker-compose içinde kullanılır)
REDIS_PASSWORD=güçlü_bir_şifre_seçin

# Swagger UI erişimi (/api-docs)
SWAGGER_USER=admin
SWAGGER_PASSWORD=admin_password
```

`frontend/.env.example` dosyasını `frontend/.env` olarak kopyalayın:

```env
# Supabase (supabase.com > Project Settings > API)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Veritabanı Kurulumu

Supabase dashboard'unda **SQL Editor** bölümüne gidin ve `setup.sql` dosyasının tamamını yapıştırıp çalıştırın. Bu adım tüm tabloları, RLS politikalarını ve Storage bucket'ını oluşturur.

---

### Kurulum Seçenekleri

#### A) Docker ile (Önerilen)

```bash
# Tüm servisleri başlatır (backend, frontend, redis)
npm run build

# Servisleri durdurmak için
npm run down
```

#### B) Manuel Geliştirme Ortamı

```bash
# Backend bağımlılıklarını yükleyin
cd backend && npm install

# Frontend bağımlılıklarını yükleyin
cd ../frontend && npm install
```

İki ayrı terminal açın:

```bash
# Terminal 1 — Backend (http://localhost:3000)
npm run backend:dev

# Terminal 2 — Frontend (http://localhost:5173)
npm run frontend:dev
```

> **Not:** Manuel kurulumda Redis'in ayrıca çalışıyor olması gerekir.
> `docker run -d -p 6379:6379 redis:7-alpine`

---

### Erişim Noktaları

| Servis | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| API Dokümantasyonu | http://localhost:3000/api-docs |
| Sağlık Kontrolü | http://localhost:3000/health |

---

### Testler

```bash
# Tüm testleri çalıştır
npm run test

# Sadece backend testleri
npm run test:backend

# Sadece frontend testleri (watch modu)
npm run test:frontend

# Test kapsamı raporu
cd backend && npm run test:coverage
cd frontend && npm run test:coverage

# E2E testleri (Playwright)
npm run e2e

# E2E testleri — görsel arayüz ile
npm run e2e:ui
```

---

### Veritabanı Migration'ları

```bash
cd backend

# Bekleyen migration'ları uygula
npm run migrate:up

# Son migration'ı geri al
npm run migrate:down

# Yeni migration dosyası oluştur
npm run migrate:create -- add_column_to_messages
```

---

### Mimari Notlar

- **Backend:** Hexagonal / Clean Architecture. Controller'lar sadece HTTP katmanını yönetir; iş mantığı `services/` altında tutulur.
- **Tip Güvenliği:** Hem backend hem frontend tam TypeScript. API kontratları `validators/` içinde Zod şemalarıyla doğrulanır.
- **Güvenlik:** XSS temizleme (`xss`, `DOMPurify`), rate limiting, scope-bazlı Supabase RLS politikaları.
- **Gerçek Zamanlı:** Socket.IO ile okundu bilgisi, yazıyor göstergesi ve online durum yönetimi Redis üzerinden koordine edilir.
- **Loglama:** Winston ile yapılandırılmış JSON loglar (`logs/` dizini).

---

## Lisans

[MIT](LICENSE) © Görkem Dağlı
