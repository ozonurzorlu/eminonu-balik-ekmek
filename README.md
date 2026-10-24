# Eminönü Balık Ekmek

Eminönü balık ekmeğinin tarihini, kültürel önemini ve coğrafi işaret sürecini anlatan çok sayfalı, duyarlı bir web sitesi.

## Site bölümleri

- Ürün ve coğrafi işaret bilgileri
- Tarihçe, denetimler ve satış noktaları
- Basın kiti, makaleler, kitaplar ve görsel kütüphane
- Kurum ve proje iletişim bilgileri

## Teknolojiler

- HTML
- CSS
- JavaScript

Site statik dosyalardan oluşur ve GitHub Pages ile yayımlanabilir. Form arayüzlerinin sunucuya veri gönderme özelliği bu statik sürümde bulunmayabilir.

## Yerelde görüntüleme

Proje klasöründe basit bir HTTP sunucusu başlatın ve `index.html` dosyasını açın. Örneğin Python yüklüyse:

```bash
python -m http.server 8080
```

Ardından `http://localhost:8080` adresini ziyaret edin.

## GitHub Pages

`main` dalına gönderilen değişiklikler `.github/workflows/pages.yml` iş akışı ile GitHub Pages'e dağıtılır. Depo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçili olmalıdır.
