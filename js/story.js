/* ============================================================================
   story.js — ANLATI (tüm metin tek dosyada)

   ► YAPI: Motherload'un iskeleti, Anadolu'ya oturtulmuş hâli.
       1. Perde (0-1000 m)      Taşeronluk. Sermet Bey kurumsal, sıcak, patron.
       2. Perde (1000-3000 m)   İlk yanlışlıklar. Dedeni tanıdığını ima eder.
       3. Perde (3000-6000 m)   Maske gevşer. Tabletler okunmaya başlar.
       4. Perde (6000-9000 m)   Maske düşer. Sermet Bey 1867'den beri buradadır.
       5. Perde (-10.000 m)     Kapı. Ahit Sandığı kapının ta kendisidir.

   ► ANA HAMLE: harita bir hazine haritası değil, bir NÖBET DEFTERİ. Ahi
     loncasından her kuşakta bir usta indi, mührü yokladı, yukarı çıktı. Karanlık
     Holding kırk yıldır ihaleyi hep Ahi soyundan birine veriyor — çünkü mühür
     ancak Davut'un elinden açılır (Süleyman'ın babasının adı). Oyuncu kazdıkça
     mührü zayıflatır. Yani kötü adamın matkabı oyuncunun kendisidir.

   ► SANDIK: Süleyman onu saklamak için gömmedi; aşağıdakini içeride tutmak
     için oraya koydu. Hazine değil, kapı.

   ► TON: yüzeyde kara mizah (esnaf, tefecilik, semaver), toprağın altında
     gerilim. Matkap toprağa girdiği an mizah kesilir.

   Bütün metin burada; oynanış kodu metin içermez. Çeviri ya da yeniden yazım
   yalnızca bu dosyaya dokunur.
   ============================================================================ */

const STORY = {

  /* ==========================================================================
     TELSİZ — hikâyeyi taşıyan asıl sistem
     Oyuncu belirli derinliklere İLK kez ulaştığında tetiklenir (en derin
     noktaya göre; aşağı yukarı gidip gelmek mesajları tekrarlatmaz).
     static: 0-2 arası parazit seviyesi, derinlikle artar.
     ========================================================================== */
  radio: [
    { d: 40, who: 'SERMET BEY · KARANLIK HOLDİNG', s: 0, text:
      'Davut Usta hoş geldin. Taşeronluk sözleşmeni onayladım. Sen kömürü çıkar biz alıcaz. Basit iş.' },

    { d: 250, who: 'SERMET BEY', s: 0, text:
      'Güzel gidiyorsun. Kasan dolunca yukarı çık, Rıza Başkan hesabı kapatacak. Acele etmene gerek yok bizim için derinlik önemli değil, süreklilik önemli.' },

    { d: 600, who: 'SERMET BEY', s: 0, text:
      'Küçük bir hatırlatma: sözleşmende derinlik sınırı yok. Ne kadar inersen o kadar prim alırsın. Şirket cesareti ödüllendirir.' },

    /* --- 2. perde: ilk çatlak --- */
    { d: 1000, who: 'SERMET BEY', s: 0, text:
      'Bin metre. Tebrikler, çoğu taşeron burada döner.\n\n…Deden de dönmemişti.' },

    { d: 1500, who: 'SERMET BEY', s: 1, text:
      'Şaşırma. Bu havzada çalışmış her ailenin dosyası bizde var. Sizinki kalın. 1953\'ten beri değil — çok daha eskiden beri.' },

    { d: 2200, who: 'SİSMİK EKİP · KAYIT', s: 1, text:
      'Anomali teyit edildi. Koordinat taşeronun mevkiiyle çakışıyor. Yoğunluk okunamıyor — cihaz sıfır veriyor. Sıfır, boşluk demek değil.' },

    { d: 2800, who: 'SERMET BEY', s: 1, text:
      'Davut Usta, bir şey soracağım. Deden sana bir defter bıraktı mı? Şifreli, elle çizilmiş bir şey.' },

    /* --- 3. perde: maske gevşiyor --- */
    { d: 3400, who: 'SERMET BEY', s: 1, text:
      'Cevap vermedin. Sorun değil. Zaten biliyorum.' },

    { d: 4000, who: 'SERMET BEY', s: 1, text:
      'Aşağıda üzerinde yazı olan taşlar bulacaksın. Okuma. Şirket politikası. …Bu bir rica değil.' },

    { d: 4800, who: 'SİSMİK EKİP · KAYIT', s: 2, text:
      'Kırk yılda indirilen otuz bir sondaj aracının tamamı bu derinlikte kayboldu. Hiçbiri Ahi soyundan değildi.\n\nBu kayıt silinmeliydi.' },

    { d: 5600, who: 'SERMET BEY', s: 2, text:
      'Yukarıda Remzi\'nin semaveri kaynıyor şimdi. Duyuyorum. Kırk yıldır duyuyorum.\n\nSen o çayı içemeyeceksin Davut Usta.' },

    /* --- 4. perde: maske düşüyor --- */
    { d: 6200, who: 'SERMET', s: 2, text:
      'Kurumsal zırvaları kesiyorum, vakit dar. Aşağıda bir kapı var. Kilidini bizzat Hz. Süleyman vurmuş. Dünya tarihi Ahit Sandığı\'nı kayıp sanıyor ama yalan sandık kayıp değil o kapının ta kendisi. Süleyman onu oraya saklamak için gömmedi. Aşağıdakini içeride tutmak için onu oraya koydu.' },

    { d: 7000, who: 'SERMET', s: 2, text:
      'Ahiler yüz kuşak indi. Mührü yokladı, "duruyor" diye yazdı, yukarı çıktı. Hiçbiri açmadı.\n\nSen açacaksın. Çünkü mühür ancak Davut’un elinden açılır.' },

    { d: 7800, who: 'SERMET', s: 2, text:
      'Korkma. Ben de bir zamanlar senin gibiydim.\n\n1867\'de. Zonguldak sancağında imtiyazı ben almıştım. O gün bugündür ihale açıyorum.' },

    { d: 8600, who: '??? ', s: 2, text:
      'Kırk yıl bekledim. Kırk yıl mı? Yüz yıl. Bin yıl. Sayı önemini yitiriyor burada.\n\nİn. Kapı seni tanıyor.' },

    { d: 9400, who: '???', s: 2, text:
      '—— telsizde yalnızca nefes sesi var ——' },
  ],

  /* ==========================================================================
     TABLETLER — dedenin defterinin dağılmış sayfaları
     Rastgele bulunurlar, bu yüzden her biri TEK BAŞINA ürpertmeli; sıra
     gözetmez ama birleşince zinciri kurar.
     ========================================================================== */
  tablets: [
    { t: 'Hitit tableti · çivi yazısı',
      x: '"Aşağıdakinin adı yazılmaz. Yazanın dili tutulur."' },
    { t: 'Urartu levhası',
      x: '"Yedi kat aşağıda bir kapı. Yedi kat yukarıda gök. Arada biz varız, kapıyı bekleriz."' },
    { t: 'Aramice parşömen',
      x: '"Süleyman sandığı gömmedi. Sandık aslında bi’ kapı."' },
    { t: 'Osmanlı fermanı · 1867',
      x: '"Zonguldak sancağında kömür imtiyazı Sermet Efendi\'ye tevcih olunmuştur."\n\nMühür taze. Kâğıt yüz altmış yaşında.' },
    { t: 'Ahi mührü · dövme demir',
      x: '"Baktım. Duruyor. Sıradaki sensin."\n\nAltında on yedi farklı ustanın damgası. Sonuncusu dedenin.' },
    { t: 'Defter sayfası · 1953',
      x: '"Dedem indi. Ben indim. Oğlum inmesin."\n\nEl yazısı titrek. Mürekkep yer yer dağılmış.' },
    { t: 'Fütüvvetname parçası',
      x: '"Usta olan kapıyı açan değildir. Usta olan, kapıyı kapalı tutandır."' },
    { t: 'Sondaj kaydı · Karanlık Holding',
      x: '"Ünite 31. Derinlik 4.900 m. Pilot Ahi soyundan değil. İletişim kesildi."\n\nOtuz bir satır. Hepsi aynı.' },
  ],

  /* Sıradaki tableti sırayla verir — rastgele seçersen aynı metin tekrar eder
     ve "yeni bir şey buldum" hissi ölür. */
  _tabletIndex: 0,
  nextTablet(){
    const t = this.tablets[this._tabletIndex % this.tablets.length];
    this._tabletIndex++;
    return t;
  },

  /* ==========================================================================
     EKRAN METİNLERİ
     ========================================================================== */
  title: {
    h1: 'DERİN ANADOLU',
    h2: 'Ahit Sandığı',
    body: `
      <p>Zonguldak'ın paslı sanayisinde, Davut Usta hurdaları birleştirerek kendi sondaj aracını yaptı. <b>Köstebek-V1</b>. Görünürdeki hedefi oldukça basitti üç beş ton kömür çıkararak <b>Karanlık Holding</b>'e taşeronluk yapmak ve ensesindeki borç yükünden nihayet kurtulmak.</p>

      <p>Fakat dedesinden kalan şifreli defter ezber bozuyor. Elindeki şey bir hazine haritası değil. Yüzyıllık bir nöbet defteri. Ahi loncasından beri her kuşakta bir usta ocağa inmiş, karanlıktaki mührü kontrol edip "duruyor" yazarak yukarı çıkmış. Aşağıda neyin hapsedildiğini ise deftere yazmaya kimse cesaret edememiş.</p>

      <p>Sorun şu: Karanlık Holding kırk yıldır bu havzada ihale açıyor.
      Ve ihaleyi hep <b>Ahi soyundan bir ustaya</b> veriyor.</p>

      <p class="dim">Mazotunu idareli kullan, matkabını keskin tut.
      Ve telsizde ne söylenirse söylensin — aşağıda yalnız değilsin.</p>
    `,
  },

  bossIntro: {
    h1: '-10.000 METRE',
    h2: 'KAPI',
    body: `
      <p>Obsidyen biter ve Köstebek-V1 devasa bir boşluğa düşer. Ortada kaynayan
      bir lav havuzu; havuzun üstünde, hiçbir şeye bağlı olmadan asılı duran
      altın kaplı bir sandık.</p>

      <p><b>Ahit Sandığı.</b> Kayıp değil. Kayıp olmamış hiç. Süleyman onu buraya bir kapı olarak koymuş.</p>

      <p>Karşıda Sermet Bey duruyor. Takım elbisesi hâlâ üzerinde. Yüz altmış
      yıllık.</p>

      <div class="npc-line">SERMET BEY: “Teşekkür ederim Davut Usta. Kırk yıldır ihale açıyorum, bir bekçi soyu kazsın diye. Matkabın her vuruşu mührü biraz daha inceltti. Ben açamazdım. <b>Sen açtın.</b>”</div>

      <p>Sandık yerinden oynuyor. Lav havuzundan yükselen şey Sermet Bey'i bir
      giysi gibi üstüne alıyor.</p>

      <div class="npc-line">“Bana Deccal dediler. İblis dediler. Ahriman dediler. Her kavim başka ad taktı hepsi aynı kapıyı çizdi. Adın ne olduğu önemli değil <b>usta</b> — önemli olan kimin açtığı.”</div>

      <h3>SAVAŞ TAKTİĞİ</h3>
      <p>• Üç <b>zayıf nokta</b> var; her an yalnız biri parlar (camgöbeği).
      Uçarak yaklaş, matkabı değdir, hemen kaç.<br>
      • <b>Dinamiti (1)</b> parlayan çekirdeğin dibinde patlat — en büyük hasar odur.<br>
      • Magma toplarından kaç, lav havuzuna düşme.<br>
      • <b>Mazotun akmaya devam ediyor.</b> Uzun savaş = ölüm. Hızlı ol.</p>
    `,
  },

  ending: {
    h1: 'MÜHÜR',
    body: `
      <p>Suret dağılırken tavan çöker. Davut Usta son dinamitini sandığın altına sıkıştırır — kaldırmak için değil, <b>yerine oturtmak</b> için.</p>

      <p>Patlama kapağı kapatır. Acil durum ışınlayıcısı, ASELSAN yapımı bir kere olsun iş görür.</p>

      <p>Yüzeyde gün doğuyor. Maden ağzından toz yükseliyor. Karanlık Holding'in Zonguldak ofisinde kimse yok kayıtlara göre orada kırk yıldır kimse çalışmamış. Rıza Başkan, Remzi, Cabbar Usta ve Şükrü maden ağzında bekliyorlar. Hiçbiri "ne buldun" diye sormuyor.</p>

      <div class="npc-line">CABBAR USTA: “Kaportayı yaparım. Matkabı da bilerim.
      Sen otur, çayını iç.”</div>

      <p>Davut Usta akşam dedesinin defterini açıyor. Son yazılı satırın altına on sekizinci damga olarak kendi işaretini vuruyor ve tek bir cümle yazıyor:</p>

      <div class="npc-line" style="border-color:var(--neon-cyan);color:#c8fffb">
      “Baktım. Duruyor. Sıradaki sensin.”</div>

      <p class="dim">Sandık aşağıda kaldı. Zaten hiç çıkarılacak bir şey değildi.</p>
    `,
  },

  /** Ölüm ekranındaki alaycı taziye — yüzey tonuna geri döner. */
  deaths: [
    'Davut Usta yamalı sacın arkasından bağırdı "Hadi be oradan!"',
    'Köstebek-V1 hurdaya çıktı. Cabbar Usta duysa üzülür.',
    'Remzi çayı tazelemişti. Soğudu.',
  ],
};

window.STORY = STORY;
