# 🗄️ Veritabanı Migration Sistemi (Database Migration System)

Bu proje artık `node-pg-migrate` kullanarak versiyonlanmış veritabanı değişikliklerini desteklemektedir. Artık `setup.sql` dosyasını her seferinde manuel çalıştırmak veya `DROP + CREATE` yapmak zorunda değilsiniz.

## 🚀 Başlangıç

1.  **Bağlantı Dizesini Ayarlayın:**
    `.env` dosyasındaki `DATABASE_URL` değişkenini doldurun.
    Supabase için format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

2.  **İlk Migration'ı Uygulayın:**
    Eğer veritabanınız boşsa veya sıfırdan kuruyorsanız:
    ```bash
    npm run migrate:up
    ```

## 🛠️ Kullanım

### Yeni Bir Değişiklik Ekleme
Veritabanında bir tablo eklemek, bir sütun silmek veya bir index oluşturmak istediğinizde yeni bir migration dosyası oluşturun:
```bash
npm run migrate:create -- name_of_change
# Örn: npm run migrate:create -- add_phone_to_users
```
Bu komut `migrations` klasöründe yeni bir `.ts` dosyası oluşturacaktır.

### Değişiklikleri Uygulama
Tüm bekleyen migration'ları çalıştırmak için:
```bash
npm run migrate:up
```

### Geri Alma (Rollback)
Son yapılan değişikliği geri almak için:
```bash
npm run migrate:down
```

## 📝 Kurallar
- Mevcut migration dosyalarını **hiçbir zaman değiştirmeyin**. Eğer bir hata yaptıysanız yeni bir migration oluşturarak düzeltin.
- `up` fonksiyonu değişikliği uygular, `down` fonksiyonu ise tam tersini yaparak sistemi eski haline getirir.
- SQL kullanmak için `pgm.sql(\`SQL KODUNUZ\`)` komutunu kullanabilirsiniz.
