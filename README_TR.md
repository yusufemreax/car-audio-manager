# Car Audio Manager - Araç Kamerası 6 Kanal Güncellemesi V1

Bu paket, kullanıcı tarafından gönderilen güncel kaynak dosyalar temel alınarak hazırlanmıştır.

## Değiştirilen dosyalar

- `src/lib/product-config.ts`
- `src/lib/product-schema.ts`
- `src/lib/customer-offer-pdf.ts`

Gönderilen `product-form-dialog` ve `product-table` dosyalarında ek değişiklik gerekmedi. Form altyapısı zaten `visibleWhen` kurallarını destekliyor ve görünmeyen alanları payload'a eklemiyor.

## Yeni davranış

Araç Kamerası > Kamera Tipi alanına yeni `6 Kanal` seçeneği eklendi.

`6 Kanal` seçildiğinde:

- Ön / Arka / İç kamera kalite alanları gösterilmez.
- `Kamera Kalitesi` tek kez seçilir.
  - 720p
  - 1080p HD
  - 2K
  - 4K
- `Monitör Ekran Boyutu` seçilir.
  - 7"
  - 9"
  - 10.1"
- Sistem sabit olarak 6 kamera + 1 monitör kabul eder.
- ADAS Desteği, Park Modu, Sallantı Sensörü ve SD Kart Desteği mevcut davranışla devam eder.

Diğer kamera tipleri (`Ön`, `Ön - Arka`, `Ön - Arka - İç`) mevcut davranışlarını korur.

## PDF / JPG çıktısı

6 Kanal ürününde Araç Kamerası Özellikleri bölümünde şunlar gösterilir:

- Kamera Tipi: 6 Kanal
- Kamera Adedi: 6
- Kamera Kalitesi
- Monitör Adedi: 1
- Monitör Ekran Boyutu
- ADAS Desteği
- Sallantı Sensörü
- Park Halinde Kayıt
- SD Kart Desteği

`customer-offer-pdf.ts` aynı belge tanımını hem PDF hem JPG çıktısı için kullandığı için değişiklik iki çıktıya da yansır.

Ayrıca eski tekliflerde araç kamerası snapshot specifications boşsa ürün API fallback kontrolü araç kamerası için de etkinleştirildi.

## Kurulum

ZIP içeriğini proje köküne çıkarın. Proje kökünde `package.json` ve `src` klasörü bulunmalıdır.

Ardından:

```powershell
.\INSTALL_UPDATE.cmd
```

Installer değiştireceği mevcut dosyaları önce şu klasöre yedekler:

```text
.vehicle-camera-six-channel-update-backup\<timestamp>\
```

Alternatif olarak `UPDATED_FILES` klasörünün içeriğini proje köküne manuel olarak kopyalayabilirsiniz.

Sonrasında:

```powershell
npm run build
```

## Test önerisi

1. Araç Kamerası sayfasında Yeni Ürün açın.
2. Kamera Tipi = `6 Kanal` seçin.
3. Sadece tek `Kamera Kalitesi` ve `Monitör Ekran Boyutu` alanının göründüğünü doğrulayın.
4. 7", 9" ve 10.1" monitör seçeneklerini kontrol edin.
5. Kamera kalitesi seçeneklerinin 720p, 1080p HD, 2K ve 4K olduğunu doğrulayın.
6. ADAS / Park Modu / Sallantı Sensörü / SD Kart alanlarını doldurup kaydedin.
7. Teklif oluşturup PDF ve JPG çıktısında 6 kamera + 1 monitör özelliklerini kontrol edin.
