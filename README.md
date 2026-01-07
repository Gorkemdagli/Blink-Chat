# 💬 Chat App (Real-Time Messaging)

Modern, güvenli ve ölçeklenebilir bir gerçek zamanlı sohbet uygulaması. React, Node.js, Socket.IO, Redis ve Supabase teknolojileri kullanılarak geliştirilmiştir. 

Hem masaüstü hem de mobil cihazlar için tam uyumlu (responsive) bir arayüze sahiptir.

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚀 Öne Çıkan Özellikler

### 📱 Arayüz ve Deneyim
*   **Tam Mobil Uyumluluk:** Her ekran boyutunda (Apple, Android) kusursuz çalışan responsive tasarım.
*   **Modern UI:** TailwindCSS ile hazırlanmış şık, minimalist ve premium arayüz.
*   **Dosya Paylaşımı:** Görsel ve belge gönderme desteği (Önizlemeli).
*   **Emoji Desteği:** Entegre emoji seçici.

### ⚡ Gerçek Zamanlı İletişim
*   **Socket.IO:** Anlık mesajlaşma ve durum güncellemeleri.
*   **Okundu Bilgisi (Read Receipts):** 
    *   İletildi (Gri Tik)
    *   Okundu (Mavi Tik + Glow Efekti)
*   **Yazıyor Göstergesi:** Karşı tarafın mesaj yazdığını anlık görme ("Ahmet yazıyor...").
*   **Online Durumu:** Kullanıcıların çevrimiçi/çevrimdışı durum takibi.

### 🔒 Güvenlik ve Altyapı
*   **Güvenlik:** XSS Koruması, Rate Limiting ve CORS konfigürasyonu.
*   **Docker:** Tüm projeyi (Backend, Frontend, Redis) tek komutla ayağa kaldırma.
*   **Veritabanı:** Supabase (PostgreSQL) üzerinde ölçeklenebilir veri saklama.
*   **Önbellek:** Redis ile yüksek performanslı oturum ve mesaj yönetimi.

## 🛠️ Kurulum

En kolay kurulum yöntemi **Docker** kullanmaktır.

### Gereksinimler
*   Docker Desktop
*   Git

### Hızlı Başlangıç

1.  **Projeyi Klonlayın:**
    ```bash
    git clone https://github.com/Gorkemdagli/ChatApp-React-Node-
    cd chat-app
    ```

2.  **Çevre Değişkenlerini (Env) Ayarlayın:**
    *   `backend/.env.example` -> `backend/.env`
    *   `frontend/.env.example` -> `frontend/.env`
    *   *Not: Supabase URL ve Key bilgilerinizi girmeyi unutmayın.*

3.  **Veritabanını Kurun:**
    *   Supabase projenizde `setup.sql` dosyasının içeriğini çalıştırarak tüm tabloları ve ayarları oluşturun.

4.  **Uygulamayı Başlatın:**
    ```bash
    npm run build
    # Veya direkt: docker-compose up --build -d
    ```

4.  **Erişim:**
    *   🏠 **Uygulama:** [http://localhost:5173](http://localhost:5173)
    *   🔌 **Backend API:** [http://localhost:3000](http://localhost:3000)
    *   📄 **Swagger Docs:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## 📂 Proje Yapısı

```
chat-app/
├── backend/          # Node.js + Express + Socket.IO
│   ├── config/       # Ayarlar (Redis, Supabase, Multer)
│   ├── socket/       # Gerçek zamanlı olay yöneticileri
│   └── routes/       # API rotaları
├── frontend/         # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/ # ChatWindow, Sidebar vb.
│   │   └── context/    # Auth ve Socket contextleri
└── docker-compose.yml # Container orkestrasyonu
```

## 🧪 Geliştirici Notları

*   **Test:** `npm run test:backend` veya `npm run test:frontend` komutları ile testleri çalıştırabilirsiniz.
*   **Build:** Frontend production build için `npm run build` komutu kullanılır.

## 📄 Lisans
Bu proje MIT lisansı altında sunulmaktadır.
