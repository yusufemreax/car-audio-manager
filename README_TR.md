# Car Audio Manager - Montaj Rezervasyonu / Gecikmeli Stok Cikisi

Bu paket mevcut `car-audio-manager` proje kokune acilmak icin hazirlanmistir.

## V2 duzeltmesi

Onceki paketi uyguladiysaniz geri yukleme yapmayin. Bu surumu ayni proje kokune cikartip `INSTALL_UPDATE.cmd` dosyasini tekrar calistirabilirsiniz. Kurucu, `customers-page-client.tsx` icindeki interceptor importu daha once yanlislikla `"use client"` direktifinin ustune eklenmisse importu otomatik olarak direktifin altina tasir ve build oncesi siralamayi dogrular.

## Kurulum

1. ZIP icerigini `package.json` dosyanizin bulundugu proje kokune, klasor yapisini koruyarak cikarin.
2. Windows'ta `INSTALL_UPDATE.cmd` dosyasini calistirin.
   - Alternatif: `node scripts/apply-stock-reservation-update.mjs`
3. Ardindan `npm run build` calistirin.

Kurucu, degistirdigi mevcut dosyalari otomatik olarak su klasore yedekler:

`.stock-reservation-update-backup/<tarih-saat>/`

## Yeni akis

- `Satildi` / `start-sale` aninda fiziksel stok artik dusmez.
- Teklif `installation_pending` oldugunda urunler mantiksal olarak montaj icin ayrilmis kabul edilir.
- Siparis tamamlandiginda (`order-completed`) eksik/siparis verilen urunler stok miktarina eklenir; teklif Montaj Bekliyor'a gecer ama stoktan cikis yapilmaz.
- Gercek stok cikisi yalnizca `complete-sale` (Montaj Yapildi / satis tamamlama) aninda yapilir.
- Bir urun fiziksel stokta gorunuyor fakat baska `installation_pending` teklifler tarafindan ayrilmissa, yeni satis sirasinda kullaniciya secim penceresi acilir:
  - `Yeni siparis ver`: ayrilmis stok kullanilmaz, cakisan miktar siparis ihtiyacina eklenir.
  - `Stoktaki urunu kullan`: cakisan miktar icin yeni siparis acilmaz.
- Eski kayitlarla uyumluluk icin `installation_pending` olup `stockDeductedAt` alani bulunan eski teklifler rezervasyon hesabina dahil edilmez; onlarin stok cikisi eski akista zaten yapilmistir.

## Degisen / eklenen dosyalar

Kurulum tamamlandiginda uygulama tarafinda su dosyalar degismis olur:

- `src/types/customer-offer-workflow.ts`
- `src/lib/customer-offer-stock-workflow.ts`
- `src/app/api/customer-system-offers/[id]/workflow/route.ts` (route request body'yi dogrudan aktariyorsa degisiklik gerekmeyebilir)
- `src/components/customers/customers-page-client.tsx`
- `src/components/customers/customer-offer-stock-decision-interceptor.tsx` (yeni)

Paket ayrica kurulum icin:

- `scripts/apply-stock-reservation-update.mjs`
- `scripts/customer-offer-stock-workflow.tail.txt`
- `INSTALL_UPDATE.cmd`
- `INSTALL_UPDATE.sh`

icerir.

## Not

`Stoktaki urunu kullan` secimi, baska bir montaj icin ayrilmis fiziksel stoğun bu yeni teklif tarafindan da kullanilmasina bilerek izin verir. O urun daha once baska bir montajda fiziksel olarak tuketilirse, `complete-sale` aninda backend yetersiz stok nedeniyle montaji tamamlamaz; boylece stok negatif olmaz.


## V3 build duzeltmesi

- MongoDB Driver TypeScript filtresindeki `stockDeductedAt: null` kaldirildi.
- Yerine `stockDeductedAt: { $not: { $type: "date" } }` kullanildi.
- Bu filtre yeni akista alani olmayan/null kayitlari rezervasyon sayar; gercek Date bulunan eski stok-dusulmus kayitlari rezervasyon hesabina katmaz.
- V2 uygulanmis proje uzerine dogrudan calistirilabilir; geri yukleme gerekmez.
