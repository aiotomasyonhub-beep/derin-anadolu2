# Derin Anadolu: Ahit Sandığı

16-bit Anadolu Pixel-Art / Steampunk tarzında, Motherload soyundan gelen bir
yeraltı madencilik oyunu. Vanilla JS + Canvas 2D. Derleme adımı yok, bağımlılık yok.

## Hikâye

Motherload'un iskeleti — taşeronluk → tuhaflaşma → patronun ne olduğunun ifşası →
dipteki Şeytan — Anadolu'ya oturtulmuş hâli. Bütün metin `js/story.js` içinde;
oynanış kodu metin içermez.

**Ana hamle:** dedenin şifreli defteri bir hazine haritası değil, bir **bakım
kaydı**. Ahi loncasından bu yana her kuşakta bir usta inmiş, mührü yoklamış,
"duruyor" yazıp çıkmış. Karanlık Holding kırk yıldır ihaleyi hep Ahi soyundan
birine veriyor, çünkü mühür ancak Davut'un elinden açılır (Süleyman'ın
babasının adı — bilinçli). Oyuncu kazdıkça mührü inceltir — kötü adamın
matkabı oyuncunun kendisidir.

**Ahit Sandığı** hazine değil, kapının ta kendisi: Süleyman onu saklamak için
gömmemiş, aşağıdakini içeride tutmak için oraya koymuş. Finalde Davut Usta
sandığı almaz; yerine oturtur.

| Perde | Derinlik | Sermet Bey'in telsizi |
|---|---|---|
| 1 · Taşeronluk | 0–1000 m | Kurumsal, sıcak, patron |
| 2 · İlk çatlak | 1000–3000 m | "Deden de dönmemişti." — aileyi tanıyor |
| 3 · Maske gevşer | 3000–6000 m | Tabletleri okumayı yasaklar |
| 4 · Maske düşer | 6000–9000 m | 1867'den beri buradadır |
| 5 · Kapı | -10.000 m | Telsizde yalnızca nefes |

**Telsiz sistemi** (`STORY.radio`, 16 mesaj) en derin noktaya göre tetiklenir;
aşağı-yukarı gidip gelmek tekrarlatmaz, sıra kayda yazılır. Parazit seviyesi
derinlikle tırmanır (camgöbeği → kehribar → kırmızı, bozuk sinyal), telsiz
bipinin perdesi düşer ve altına sönmeyen bir uğultu biner.

**Tabletler** artık yalnızca para değil: her Hitit Tableti / Osmanlı Altını
dedenin dağılmış defterinden bir sayfa (8 parça). Sırayla verilir ki "yeni bir
şey buldum" hissi ölmesin; her biri tek başına ürpertir, birleşince zinciri kurar.

**Ton:** yüzeyde kara mizah (esnaf, semaver, "Hadi be oradan!"), toprağın
altında gerilim.

## Çalıştırma

```bash
node server.js
```

Sonra `http://localhost:5173`. ES module kullanılmadığı için `index.html`'i
doğrudan çift tıklayarak (file://) da açabilirsin.

## Dosya yapısı

```
index.html          Canvas + HUD/menü DOM katmanı, script yükleme sırası
css/style.css       Arcade kabini, neon HUD, modal paneller, CRT tarama çizgisi
js/config.js        ► TÜM DENGELEME BURADA: karo tipleri, madenler, 6x5 upgrade
                      ağacı, bakkal eşyaları, derinlik katmanları, yüzey mekânları
js/utils.js         Tohumlu RNG (mulberry32), clamp/lerp, ₺ biçimleme, AABB
js/story.js         ► TÜM ANLATI: telsiz mesajları, defter sayfaları, ekran metinleri
js/audio.js         WebAudio ses motoru: SFX sentezi + chiptune sekansör
js/art.js           Prosedürel piksel sanat + SANAT YÖNETMENLİĞİ notları
js/world.js         Izgara, prosedürel üretim, kazma, patlama, arena
js/entities.js      Parçacık, uçuşan yazı, dinamit, magma topu, mazot varili
js/player.js        Köstebek-V1: fizik, kazma, kaynaklar, hasar, eşyalar
js/boss.js          Erlik Golemi: fazlar, zayıf noktalar, saldırı döngüsü
js/ui.js            HUD güncelleme, toast, prompt, modal panel
js/shops.js         4 yüzey mekânının menüleri ve satın alma eylemleri
js/game.js          Durum makinesi, girdi, kamera, render, kayıt, hikâye ekranları
server.js           Geliştirme için minik statik sunucu
```

Yükleme sırası önemlidir (klasik `<script>`, module değil): her dosya `window`
üzerine global bırakır.

---

## Sistem tasarımı

### 1. Harita (world.js)

Tek bir `Uint8Array` üzerine serilmiş 2B ızgara: `index = row * WORLD_W + col`.
40 sütun × 1024 satır ≈ 41.000 karo — tamamı bellekte, tembel üretim gerekmez.

| Bölge | Satır | Karşılığı |
|---|---|---|
| Gökyüzü | `0 .. SKY_ROWS-1` | Yüzey mekânları, paralaks siluetler |
| Maden sahası | `SKY_ROWS .. +1000` | 1 karo = 10 m → 10.000 m |
| Giriş kabuğu | son 3 satır | Obsidyen duvar, 19-21. sütunlarda çatlak |
| Arena | `arenaTop .. +16` | Kırılamaz obsidyen, ortada lav havuzu |

Üretim tamamen **tohumla** belirlenir. Kayıt dosyası yalnızca
`{ seed, kazılmış karo indeksleri, oyuncu durumu }` tutar; harita her açılışta
yeniden üretilip kazılmış karolar üzerine uygulanır.

Karo üretim sırası (`terrainTile`): mağara boşluğu → grizu → lav → hazine →
maden → sert kayaç → katman toprağı. Her adım kendi bağımsız `rng()` çekişini
kullanır, böylece bir olasılığı değiştirmek diğerlerini kaydırmaz.

### 2. Kazma

`canDig(c, r, maxHardness)` matkap seviyesini karo sertliğine karşı kontrol eder.
Delme süresi: `hardness * 0.55 / drillPower`. `SHIFT` bunu 0.45× hıza düşürür ama
**grizu patlamasını engeller** — riskin doğrudan oyuncu kararına bağlandığı tek yer.

Aşağı kazarken araç, tünelin düzgün açılması için sütun ortasına `lerp` ile
hizalanır. Yana kazmak zemine basmayı gerektirir (Motherload kuralı).
Kasa doluyken maden karosu kazılamaz — böylece maden boşa gitmez.

### 3. Fizik ve hasar

- Yerçekimi 900 px/s², düşme hızı tavanı 620.
- **Motor itkisi yerçekiminden büyük olmak zorunda** (`thrust[0] = 1180 > 900`),
  yoksa 1. seviye araç hiç havalanamaz. Tırmanışta hız tavanı −400.
- Düşme hasarı: `(vy - 400) * 0.085`.
- Çarpışma eksen ayrık çözülür (önce X, sonra Y); kare başına hareket ~3 px
  olduğu için basit geri itme yeterlidir.

### 3b. Enkaz — ölümün bedeli

Ölüm artık "kaydı yükle"den ibaret değil. Patladığında **kasandaki her şey
öldüğün koordinatta bir enkaz olarak kalır**; son kayıttan devam edersin ama
yükün hâlâ orada, seni bekliyordur.

- **Tek enkaz kuralı.** Aynı anda yalnızca bir enkaz olabilir; yeni ölüm
  eskisini siler. Aksi hâlde harita bedava para tarlasına döner.
- **Kısmi kurtarma.** Kasana sığdığı kadarını alırsın, kalanı enkazda bekler.
  Küçük kasayla ölmek "iki sefer gel" demektir — kasa yükseltmesi böylece
  soyut bir sayı olmaktan çıkar.
- **Pusula.** Enkaz ekran dışındaysa ekranın kenarında ona bakan yanıp sönen
  bir ok ve metre cinsinden uzaklık çizilir (`drawWreckCompass`). Onsuz enkaz
  sadece kayıp bir sayı olurdu.
- **Hurda sigortası.** Kurtarmaya gücün yetmiyorsa Rıza Başkan enkazı uzaktan
  %30'una satın alır. Ölüm sarmalından çıkış kapısı.

**Teknik püf noktası:** enkaz ölüm ANINDA diskteki kayda yamanır
(`patchSavedWreck`). Oyuncu son kayda geri döneceği için normal `save()`
akışına bırakılsaydı, yükleme enkazı silerdi.

Kayıt yüklenince o dalışta açtığın tünel de kaybolur (kayıt yüzeyde alınmıştı),
yani enkaz çoğu zaman **kayanın içine gömülü** kalır. Bu bilinçli: geri dönüş
yolunu yeniden kazman gerekir, pusula da sana yönü verir.

### 4. Yakıt ekonomisi

| Durum | L/s |
|---|---|
| Rölanti | 0.22 |
| Yerde sürüş | 0.90 |
| **Uçuş** | **2.70** (PRD: sürüşün tam 3 katı) |
| Kazma | 0.90 |

Uçmak saniyede 3 kat pahalıdır ama metre başına ucuzdur — bu yüzden "aç tüneli,
yukarı uç" doğru strateji olur, tünelsiz derinliğe dalmak değil.

### 4b. Kargo ağırlığı — "bir maden daha" bedava değil

Dolu kasa aracın her fiziksel özelliğini bozar. Bu, oyundaki tek gerçek
risk/ödül kararını yaratan mekanik: dönüş yolunu düşünmeden kazmaya devam
edemezsin.

| Doluluk | Net tırmanış ivmesi (1. sv. motor) | Yatay hız | Uçuş yakıtı |
|---|---|---|---|
| Boş | 280 px/s² | 185 | 2.70 L/s |
| Yarı | 207 px/s² | 168 | 3.54 L/s |
| Tam | 140 px/s² | 152 | 4.32 L/s |

Düşme hasarı da yükle %35'e kadar artar; ağır yükle hızlı inmek artık aptallık.

> **Kritik uygulama detayı:** itki cezası ham `thrust` değerine değil **net
> tırmanış ivmesine** (`thrust - GRAVITY`) uygulanır. Ham değere uygulansaydı
> dolu kasada 1. seviye motor (1180) yerçekimini (900) yenemez ve araç yerden
> hiç kalkamazdı. Bu haliyle araç her yükte havalanır, sadece zorlanır.

`%70` doluluktan sonra HUD'da **AĞIR YÜK** rozeti ve araç sprite'ında sarı
gösterge lambası yanar; süspansiyon da görsel olarak çöker.

### 5. Geliştirme ağacı

6 donanım × 5 seviye, hepsi `config.js > UPGRADES` içinde. Depo veya şasi
büyütüldüğünde fark kadar dolum/tamir bedava verilir ki oyuncu "yükselttim ama
yarısı boş kaldı" cezası yemesin.

### 6. Boss (boss.js)

- 3 zayıf nokta, aynı anda yalnız biri açık (3.4 sn'de bir döner, 2. fazda 2.2).
- Açık çekirdeğe matkapla temas → 8 hasar + oyuncuya geri tepme = **vur-kaç**.
- Dinamit açık çekirdeğin dibinde → 32 hasar; gövdeye → 8.
- %50 canda 2. faz: saldırı hızı ~2×, lav havuzu genişler.
- Oyuncunun yakıtı savaş boyunca akar; 24 sn'de bir mazot varili düşer.

### 6b. Geri bildirim tokluğu (juiciness)

Aynı hasar, aynı ödül — ama hissedilir olması için:

- **Hit-stop.** Büyük darbelerde simülasyon 60-140 ms donar, **çizim sürer**
  (sarsıntı titremeye devam eder, patlama karesi ekranda asılı kalır). Grizu
  100 ms, dinamit 90 ms, boss çekirdek isabeti 70 ms, ölüm 140 ms.
  Maden toplamada **kullanılmaz** — kazma akışını kekeme yapardı.
- **Uçan madenler.** Kazılan maden, dünya uzayında değil **ekran uzayında**
  yaşayan bir parça olarak HUD'daki kasa barına yay çizerek uçar ve vardığında
  bar bir kare parlar. Düz çizgi "veri transferi" gibi görünürdü; yay "nesne"
  gibi görünüyor. Hedef, kasa barının DOM konumundan canvas koordinatına
  çevrilir (`computeHudAnchors`) — HUD gizliyken ölçüsü 0 olduğu için HUD her
  görünür olduğunda yeniden hesaplanır.
- **Araç üstü gösterge lambaları.** Mazot kritik (kırmızı), kasa dolu (sarı),
  ağır yük (sönük sarı). Ağır iş makinelerinde olduğu gibi kritik bilgi
  operatörün gözünün önünde, HUD'a bakmadan okunabilir.
- Ekran sarsıntısı zaten vardı (`Game.shake`), hit-stop onun üstüne biniyor.

### 7. Görseller

Hiç harici asset yok. Tüm sprite'lar `art.js` içinde prosedürel olarak çizilir:
- Karolar 4 varyantlı offscreen canvas'lara **bir kez** render edilip önbelleğe alınır.
- **Kenar ışığı sprite'a gömülmez** — renderer, yalnızca komşusu boş olan yüzlere
  çizer. Aksi hâlde dolu kütlenin içinde satranç tahtası etkisi oluşur.
- Araç, golem ve binalar her karede mantıksal ızgara üzerinde çizilir (animasyon
  için). Gerçek sprite sheet geldiğinde sadece `Art.tile()` ve `Art.drawPlayer()`
  içini `drawImage` ile değiştirmek yeterli.

`art.js` başındaki blok, sanatçıya teslim edilecek **sanat yönetmenliği notunu**
içerir: palet kuralı (gölge/ana/açık/neon), 2 px minimum detay, dither ile geçiş,
pirinç perçin ve is lekesi imzası.

### 8. Ses (audio.js)

Hedef: **Motherload'un ses kimliği + ağır iş makinesi karakteri.** Tek bir ses
dosyası yok; her şey WebAudio ile osilatör ve beyaz gürültüden sentezlenir.

**Ses tasarımının üç kuralı** (kod içinde de yazılı):

1. **Hiçbir ses tek katman değil.** Gerçek makine sesi en az üç bileşendir:
   düşük = dizel bloğu (40-120 Hz testere/kare), orta = işin kendisi (taşa sürten
   matkabın bant geçiren gürültüsü), yüksek = metal sürtünmesi / hidrolik tıslama.
2. **Makine düzgün çalışmaz.** Her döngüye yük dalgalanması (yavaş LFO ile perde
   oynaması) ve dişli vuruşu (hızlı amplitüd modülasyonu) eklenir. Sabit perdeli
   uğultu kulağa sentezleyici gibi gelir, makine gibi değil.
3. **Darbeler inharmoniktir.** Metal çarpması notası olmayan bir sestir;
   frekanslar `1 / 2.76 / 5.40 / 8.93` oranlarıyla dizilir (çubuk modları).
   Armonik seriyle yapılırsa "çan" olur, "kaporta" olmaz. → `clang()`

**Sürekli döngüler** bir kez kurulur, sonra sadece kazanç ve perde rampalanır
(kare başına düğüm yaratılmaz):

| Döngü | Katmanlar | Modülasyon | Tetik |
|---|---|---|---|
| **Matkap** | dizel blok (saw 54 Hz + oktav) · taş öğütme (bandpass ~1300 Hz) · metal sürtünme (>4 kHz) | 26 Hz dişli vuruşu + 1.7 Hz yük dalgalanması | kazarken; **matkap seviyesi arttıkça hızlanır ve tizleşir** |
| **Pervane** | turbo fısıltısı (saw 190 Hz, bandpass) · dizel kükreme · hidrolik tıslama | gaz oranına göre perde | uçarken; motor seviyesine bağlı |
| **Rölanti** | saw 42 Hz + egzoz çıtırtısı | 7.5 Hz **asimetrik** (testere) LFO — kare LFO'dan çok daha inandırıcı bir tek silindir patlaması verir | yerde boşta dururken |
| **Palet** | bandpass gürültü + alçak rumble | 11 Hz makara vuruşu | yerde giderken |

**Mekân:** Maden şaftı yankılıdır. Üretilen bir impuls yanıtı (üstel sönümlü
gürültü) `ConvolverNode`'a verilir ve **yankı miktarı derinlikle artar** —
yüzeyde kuru, -7000 m'de mağara (`Sfx.setSpace`).

**Tek atışlıklar** — hepsi makine dilinde: röle tıkırtısı (arayüz), pnömatik
anahtar (satın alma), mekanik circir + madeni para (kasa), sacdan kasaya düşen
maden çınlaması (*değerli maden daha tiz*), kaportaya balyoz (hasar), süspansiyon
dibe vurması + sac zangırtısı (sert iniş), sub patlama + taş yağmuru (dinamit),
ters süpürme + gümbürtü (grizu), tavan çatırtılı uzun rumble (deprem),
kondansatör şarjı (ışınlayıcı), **iş makinesi geri vites bipi** (mazot alarmı),
taş öğütmeli sub kükreme (golem), dağılan kaporta (ölüm).

**Müzik:** Motherload'un soundtrack'i chiptune değil; yavaş, karanlık,
atmosferik elektroniktir — burada da öyle. Voice'lar: uzun **detune saw pad**
(yavaş filtre süpürmesiyle), nabız gibi **sub bas**, iki yankılı seyrek
**pluck**, ve perküsyon yerine **endüstriyel metal vuruş**. Melodi yok, ambiyans
var. Akorlar hicaz renginde (kök, b2/b3, 5, b7) — Anadolu tadı melodide değil
armonide. Dört parça derinliğe göre otomatik geçer:
`surface` (68 BPM) → `underground` (58, 60 m) → `deep` (64, 5000 m) → `boss` (112).

**Sidechain ducking:** matkap veya pervane çalışırken müzik %45'e kısılır
(`Sfx.ducking`). Matkabın dizel bloğu ile pad'lerin alt-orta bandı aynı yerde
boğuşuyordu; iniş hızlı (60 ms), dönüş yavaş (400 ms) — matkap durunca müzik
usulca geri gelir.

**Hızlanan mazot alarmı:** sabit tempolu bir bip fon gürültüsüne dönüşür ve
oyuncu onu duymamayı öğrenir. Bu yüzden tempo **kalan yakıta** bağlandı
(derinliğe değil — tükenen şey o): %20'de 2 saniyede bir, damla damla
bitiyorken 0.32 saniyede bir. Kalp atışı gibi hızlanır.

Tarayıcılar sesi ancak bir kullanıcı hareketinden sonra açar; `Sfx.ensure()` ilk
tıklama/dokunmada çağrılır. Sağ üstteki **♪** düğmesi sesi kapatır ve tercih
`localStorage`'a yazılır.

### 9. Mobil

- **Canvas iç çözünürlüğü ekran oranına uyarlanır** (`Game.resizeCanvas`).
  Kural: kısa kenar daima ~360 mantıksal piksel →
  masaüstü `640x360`, yatay telefon `780x360`, dikey telefon `360x760`.
  Piksel boyu her cihazda aynı kalır; oyun yakınlaştırılmış hissettirmez.
  Dikey tutuşta görüş alanı uzar — madencilikte bu bir avantaj, o yüzden
  "telefonu çevir" uyarısı yerine dikey mod desteklendi.
- **Dokunmatik kontroller** `(pointer: coarse)` algılanınca açılır: solda
  ◀ ▶, sağda YAVAŞ / KAZ / UÇ. Her düğme kendi `pointerId`'sini yakalar
  (`setPointerCapture`), böylece **çok parmakla aynı anda** basılabilir —
  "sola git + kaz" ya da "sağa git + uç" kombinasyonları şart.
- Eşya kutuları (1-4) dokunmatikte doğrudan basılabilir.
- Mekâna girme düğmesi (**E / GİR**) yalnız bir binanın önündeyken, ekranın
  üstünde belirir; alttaki kontrol kalabalığına karışmaz.
- Sayfa kaydırma, çift dokunup yakınlaştırma ve lastik bant efekti kapalı
  (`touch-action:none`, `overscroll-behavior:none`).
- Yükseklik `100dvh` ile ölçülür ki mobil tarayıcı çubuğu oyunu kırpmasın.

---

## Kontroller

| Tuş | Dokunmatik | İşlev |
|---|---|---|
| `WASD` / Yön tuşları | ◀ ▶ | Hareket; toprağa doğru basınca kazar |
| `S` / `↓` | **KAZ** | Aşağı kaz (zemine basıyorken) |
| `W` / `↑` | **UÇ** | Uçuş (3× mazot) |
| `SHIFT` | **YAVAŞ** | Yavaş ve güvenli kazma (grizu patlatmaz) |
| `E` | **GİR** (üstte belirir) | Yüzey mekânına gir |
| `1 2 3 4` | Eşya kutusuna dokun | Dinamit / Mazot bidonu / Işınlayıcı / Macun |
| `ESC` | ❚❚ | Duraklat, menüden geri |
| — | ♪ | Sesi aç/kapat |

## Dengeleme ipuçları

Her şey `js/config.js` içinde. Sık ayarlanacaklar:

- Oyun çok zor → `FUEL_*` düşür, `UPGRADES.tank.fuel` yükselt.
- Grind çok uzun → `TILES[...].value` yükselt veya `UPGRADES.*.cost` düşür.
- Derinlik çok hızlı geçiliyor → `TILES[...].hardness` yükselt veya
  `UPGRADES.drill.power` düşür.
- Boss çok kolay → `ErlikGolem.maxHp` (boss.js) ve faz eşiğini değiştir.

## Yayına alma

Oyun **saf statik** bir sitedir: derleme adımı yok, sunucu tarafı kod yok,
veritabanı yok. `index.html` + `css/` + `js/` klasörünü herhangi bir statik
barındırıcıya atman yeterli. `server.js`, `build-artifact.js` ve `.claude/`
yalnızca geliştirme içindir — yayına gitmelerine gerek yok.

### Yayın öncesi kontrol listesi

- [ ] `js/config.js` içindeki `VERSION` artırıldı mı?
- [ ] `index.html` içindeki `?v=1.0` önbellek kırıcıları aynı numaraya güncellendi mi?
      (Yapılmazsa oyuncuların tarayıcısı eski JS'i kullanmaya devam eder.)
- [ ] `node --check js/*.js` temiz mi?
- [ ] Bir tam tur oynandı mı: kaz → sat → yükselt → öl → enkazı kurtar?

### A) itch.io — tarayıcı oyunları için doğru ev

1. `index.html`, `css/`, `js/` klasörlerini tek bir **zip** yap.
   (`index.html` zip'in KÖKÜNDE olmalı, bir alt klasörde değil.)
2. itch.io hesabı aç → **Dashboard → Create new project**.
3. **Kind of project: HTML**, sonra zip'i yükle.
4. **This file will be played in the browser** kutusunu işaretle.
5. Viewport: **1280 × 720**, "Fullscreen button" ve "Mobile friendly" açık.
6. Fiyat: Free / Donate, görünürlük Public → **Save & view page**.

### B) Cloudflare Pages veya Netlify — kendi URL'in

1. `pages.cloudflare.com` ya da `app.netlify.com/drop` aç.
2. `derin-anadolu` klasörünü **doğrudan sürükle-bırak**.
3. Dakikalar içinde `xxx.pages.dev` / `xxx.netlify.app` adresi verilir.
4. Kendi alan adını bağlamak istersen Custom domain bölümünden ekle.

### C) GitHub Pages — sürüm takibi istiyorsan

```bash
git init && git add . && git commit -m "Derin Anadolu 1.0"
```

Sonra GitHub'da boş bir depo aç, `git remote add origin <url>` ile bağla,
`git push -u origin main` ile gönder. Depo ayarlarında
**Settings → Pages → Source: main / (root)** seç.
Adres: `https://<kullanıcı-adın>.github.io/<depo-adı>/`

### D) Claude Artifact — anında paylaşılabilir bağlantı

```bash
node build-artifact.js
```

Artifact platformu sayfayı kendi `<html><head><body>` iskeletinin içine
koyduğu için tam bir HTML belgesi gönderilemez. `build-artifact.js` bu yüzden
`index.html`'den sarmalayıcıları sökülmüş `dist/artifact.html` üretir —
böylece `index.html` tek doğru kaynak olarak kalır, elle kopyalanmış ikinci bir
sürüm oluşmaz. Üretilen dosya `css/` ve `js/` ile birlikte yayınlanır.

### Sürüm yükseltirken

`VERSION` ve `?v=` numaralarını birlikte artır, dosyaları tekrar yükle.
Oyuncuların **kayıtları kaybolmaz**: kayıt `localStorage`'da `derin_anadolu_save_v1`
anahtarında durur ve alan adı değişmediği sürece kalır. Kayıt biçimini
değiştirirsen `CFG.SAVE_KEY`'deki sürüm numarasını da artır — eski kayıtlar
okunamayınca oyun onları silip yeni sefer açar (`dropBadSave`).

## Telefonda oynamak

Bilgisayarda `node server.js` çalışırken, telefon aynı Wi-Fi ağındaysa
bilgisayarın yerel IP'siyle açılır (`ipconfig` ile öğrenilir):

```
http://<bilgisayarın-ip-adresi>:5173
```

Safari/Chrome'da "Ana ekrana ekle" dendiğinde tam ekran çalışır
(`mobile-web-app-capable` meta etiketi eklendi).

## Yol haritası

**Paket 1 — Çekirdek ✅ tamam**
Enkaz sistemi, kargo ağırlığının fiziğe etkisi, hit-stop + uçan madenler +
gösterge lambaları, müzik ducking ve hızlanan mazot alarmı.

**Hikâye — Ahit Sandığı ✅ tamam (v1.1)**
Telsiz sistemi, 5 perdelik Sermet Bey arkı, defter sayfası tabletler, Şeytan
boss ifşası, yeni final.

**Paket 2 — Yazı ve ton (kalan)**
Borç sistemi (eksi bakiyeyle başlangıç, HUD'da görünür), esnafın tefeci mizahı
satın alma onaylarında, dört esnafın loncanın son üyeleri olarak yazılması,
piksel portreler.

**Paket 3 — İçerik**
Sipariş defteri (zamanlayıcısız, tamamlayınca yenilenir), tohumlanmış jeotlar
(kayıt yükleyip zar atılamasın), yeraltı rastgele karşılaşmaları, 4 dükkânın
tek "Kasaba" paneline birleşmesi.

**Paket 4 — Konfor ve altyapı**
Dokunmatikte analog itki joystick'i, bit maskeli kompakt kayıt, kayıt kodu ile
cihazlar arası aktarım, çoklu kayıt yuvası.

### Kasıtlı olarak yapılmayanlar

- **Bulut senkronu.** Ölçüldü: kayıt 5.000 kazılan karoda 28 KB, 15.000'de
  84 KB, tüm harita kazılırsa 224 KB. `localStorage` için sorun değil, ama
  ağdan göndermeden önce `dug` dizisini **bit maskesine** çevirmek gerekir
  (40.960 karo = 5 KB, ~30 kat kazanç). Sunucu kurmadan önce export/import
  kayıt kodu aynı işi görür.
- **Süreli indirim / FOMO.** Çevrimdışı tek kişilik bir oyunda "harekete
  geçmemenin bedeli" sahte kalır; üstelik oyunun kendi esprisi olan
  "esnaf seni kazıklıyor" temasıyla çelişir. Şükrü'nün hiç bitmeyen
  "SON GÜN!!" kampanyası kalıcı bir şaka olarak düşünülebilir.
- **Prestige.** Döngü hızlı ve sayılar içerik olduğunda çalışır; burada
  içerik harita ve bir iniş gerçek bir oturum. Üstelik tohum değişse de
  katman yapısı, maden tabloları ve derinlik temposu aynı — çeşitlilik
  kozmetik. Doğru cevabı **New Game+**: garajın sende kalsın, harita sertleşsin.

### Kalan teknik borç

- Ses tamamen sentetik. Gerçek sondaj makinesi örnekleri daha "dolu" duyulur;
  `LIB` içindeki tek atışlıkları `AudioBufferSourceNode`'a çevirmek yeterli —
  döngüler zaten katmanlı yapıda.
- Miksaj kulakla ayarlanmalı: `musicGain 0.26` / `sfxGain 0.60` ve `LOOP_LEVEL`
  sabitleri iyi başlangıç, son söz kulağın.
- Orta oyun (3000-9000 m) hâlâ tek fiilden ibaret: aşağı bas, bekle. Asıl
  çözüm psikolojik kanca değil, o banda **yeni bir fiil** eklemek.
