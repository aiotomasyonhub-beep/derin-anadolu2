/* ============================================================================
   config.js — Oyunun tüm dengeleme (balance) sabitleri tek yerde.
   Tasarımcı buradaki sayıları değiştirerek kod yazmadan oyunu ayarlayabilir.
   ============================================================================ */

/* Yayın sürümü. Başlık ekranında görünür — oyuncu hata bildirirken hangi
   sürümü oynadığını söyleyebilsin diye. Her yayında elle artır. */
const VERSION = '1.2';

const CFG = {
  /* --- Izgara / dünya ölçüleri --- */
  TILE: 32,                 // bir karo = 32x32 piksel
  VIEW_W: 640, VIEW_H: 360, // canvas iç çözünürlüğü (16-bit arcade)
  WORLD_W: 40,              // harita genişliği (karo)
  SKY_ROWS: 8,              // yüzeyin üstündeki boş (gökyüzü) satır sayısı
  GROUND_ROWS: 1000,        // kazılabilir toprak: 1000 karo x 10m = 10.000 m
  ARENA_ROWS: 16,           // en dipteki boss arenası
  METERS_PER_TILE: 10,

  /* --- Fizik --- */
  GRAVITY: 900,
  MAX_FALL: 620,
  MOVE_ACCEL: 1000,
  MAX_VX: 185,
  GROUND_FRICTION: 1500,
  AIR_FRICTION: 260,
  FALL_DAMAGE_MIN: 400,     // bu hızın üstündeki çarpma şasiyi yer
  FALL_DAMAGE_MUL: 0.085,

  /* --- KARGO AĞIRLIĞI ---
     "Bir maden daha alayım" bedava bir karar olmamalı. Dolu kasa aracı
     yavaşlatır, yakıtı yakar ve düşüşü sertleştirir.
     DİKKAT: itki cezası ham thrust'a değil, NET tırmanış ivmesine uygulanır
     (thrust - GRAVITY). Aksi hâlde dolu kasayla 1. seviye motor yerçekimini
     yenemez ve araç yerden hiç kalkamaz. */
  LOAD_THRUST_PENALTY: 0.50,   // tam dolu kasada net tırmanış ivmesi yarıya iner
  LOAD_FUEL_PENALTY:   0.60,   // tam dolu kasada uçuş yakıtı %60 artar
  LOAD_SPEED_PENALTY:  0.18,   // tam dolu kasada yatay hız %18 düşer
  LOAD_FALL_PENALTY:   0.35,   // tam dolu kasada düşme hasarı %35 artar
  HEAVY_LOAD_AT:       0.70,   // bu doluluktan sonra "AĞIR YÜK" uyarısı

  /* --- Yakıt tüketimi (litre / saniye) --- */
  FUEL_IDLE: 0.22,
  FUEL_DRIVE: 0.90,
  FUEL_FLY: 2.70,           // PRD: uçmak yerde gitmekten tam 3 kat pahalı
  FUEL_DRILL: 0.90,

  /* --- Ekonomi --- */
  FUEL_PRICE: 3,            // ₺ / litre
  REPAIR_PRICE: 4,          // ₺ / can
  START_MONEY: 1200,

  /* --- Tehlikeler --- */
  LAVA_DPS: 26,             // lavaya değmek
  HEAT_DPS_PER_KM: 4.2,     // radyatörün yetmediği her 1000 m için sıcak hasarı
  GAS_DAMAGE: 38,           // grizu patlaması
  GAS_BLAST_R: 2,           // grizunun temizlediği yarıçap (karo)
  QUAKE_MIN: 42, QUAKE_MAX: 80,  // deprem aralığı (sn), 6000-9000 m arası
  QUAKE_DAMAGE: 14,

  /* --- Dinamit --- */
  BOMB_FUSE: 2.0,           // kaçmaya yetecek kadar uzun, taktik olacak kadar kısa
  BOMB_R: 2,
  BOMB_DMG_SELF: 30,
  BOMB_DMG_BOSS: 18,

  /* --- ENKAZ (ölünce geride kalan kargo) ---
     Ölüm artık "kaydı yükle"den ibaret değil: topladığın her şey öldüğün
     koordinatta bir enkaz olarak kalır. Aynı anda YALNIZCA BİR enkaz olabilir,
     yoksa harita bedava para tarlasına döner. */
  WRECK_INSURANCE: 0.30,    // Rıza Başkan enkazı uzaktan bu oranla satın alır

  /* --- Hit-stop (darbe anında kısa donma) ---
     Büyük darbelerde birkaç kare donmak, aynı hasarı çok daha "tok" hissettirir.
     Maden toplamada KULLANILMAZ — kazma akışını kekeme yapar. */
  HITSTOP_MAX: 0.14,

  /* --- Kayıt --- */
  SAVE_KEY: 'derin_anadolu_save_v1',
};

/* ============================================================================
   KARO TİPLERİ
   Dünya tek bir Uint8Array içinde tutulur; her hücre aşağıdaki id'lerden biri.
   ============================================================================ */
const T = {
  EMPTY: 0,
  DIRT1: 1, DIRT2: 2, DIRT3: 3, DIRT4: 4,   // katman toprakları
  ROCK: 5, HARDROCK: 6,                     // sert kayaçlar
  BEDROCK: 7, OBSIDIAN: 8,                  // kırılamaz
  LAVA: 9, GAS: 10,                         // tehlikeler
  COAL: 11, COPPER: 12, SILVER: 13, GOLD: 14,
  OLTU: 15, LULE: 16, BOR: 17,
  HITIT: 18, OSMANLI: 19,                   // hazineler
  ENTRANCE: 20,                             // arenaya açılan çatlak (kırılabilir obsidyen)
};

/* Her karonun oynanış verisi.
   hardness : delme süresi çarpanı. Matkabın maxHardness'ı bundan küçükse delinemez.
   solid    : çarpışma var mı
   ore      : envantere giren maden mi
   value    : satış fiyatı (₺ / adet)                                        */
const TILES = {
  [T.EMPTY]:    { name:'Boşluk',        hardness:0,  solid:false },
  [T.DIRT1]:    { name:'Toprak',        hardness:1,  solid:true  },
  [T.DIRT2]:    { name:'Killi Toprak',  hardness:2,  solid:true  },
  [T.DIRT3]:    { name:'Kızıl Kil',     hardness:3,  solid:true  },
  [T.DIRT4]:    { name:'Obsidyen Kum',  hardness:4,  solid:true  },
  [T.ROCK]:     { name:'Kaya',          hardness:4,  solid:true  },
  [T.HARDROCK]: { name:'Sert Kayaç',    hardness:6,  solid:true  },
  [T.BEDROCK]:  { name:'Ana Kaya',      hardness:99, solid:true  },
  [T.OBSIDIAN]: { name:'Obsidyen',      hardness:99, solid:true  },
  [T.LAVA]:     { name:'Lav',           hardness:0,  solid:false, lava:true },
  [T.GAS]:      { name:'Grizu',         hardness:1,  solid:true,  gas:true  },

  [T.COAL]:     { name:'Kömür',         hardness:1,  solid:true, ore:true, value:   35 },
  [T.COPPER]:   { name:'Bakır',         hardness:2,  solid:true, ore:true, value:   70 },
  [T.SILVER]:   { name:'Gümüş',         hardness:3,  solid:true, ore:true, value:  180 },
  [T.GOLD]:     { name:'Altın',         hardness:3,  solid:true, ore:true, value:  420 },
  [T.OLTU]:     { name:'Oltu Taşı',     hardness:4,  solid:true, ore:true, value:  850 },
  [T.LULE]:     { name:'Lületaşı',      hardness:5,  solid:true, ore:true, value: 1400 },
  [T.BOR]:      { name:'BOR',           hardness:6,  solid:true, ore:true, value: 2600 },

  [T.HITIT]:    { name:'Hitit Tableti', hardness:3,  solid:true, artifact:true, value:50000 },
  [T.OSMANLI]:  { name:'Osmanlı Altını',hardness:3,  solid:true, artifact:true, value:50000 },

  [T.ENTRANCE]: { name:'Çatlak Obsidyen', hardness:6, solid:true },
};

/* Satılabilir madenlerin kooperatifte gösterim sırası */
const ORE_ORDER = [T.COAL, T.COPPER, T.SILVER, T.GOLD, T.OLTU, T.LULE, T.BOR];

/* ============================================================================
   GELİŞTİRME AĞACI — her donanım 5 seviye (PRD md.5)
   cost[i] = i. seviyeden (i+1). seviyeye geçiş bedeli
   ============================================================================ */
const UPGRADES = {
  drill: {
    label: 'Matkap Ucu',
    icon: 'drill',
    names: ['Çıkma Matkap','Çelik Matkap','Elmas Uçlu Matkap','Lazer Delici','Titanyum Matkap'],
    power:       [1.0, 1.7, 2.6, 3.8, 5.4],   // delme hızı
    maxHardness: [2,   3,   4,   5,   6  ],   // delebildiği en sert kayaç
    cost: [2500, 9000, 31000, 96000],
    desc: 'Daha sert kayaçları deler, kazma süresini kısaltır.',
  },
  tank: {
    label: 'Yakıt Deposu',
    icon: 'tank',
    names: ['Sanayi Bidonu','Çift Depo','Takviye Tank','Basınçlı Tank','Mega Depo'],
    fuel: [70, 115, 185, 285, 440],
    cost: [1800, 6500, 23000, 72000],
    desc: 'Yeraltında daha uzun kalırsın.',
  },
  cargo: {
    label: 'Kasa Kapasitesi',
    icon: 'cargo',
    names: ['Römork','Genişletilmiş Kasa','Damperli Kasa','Konteyner','Ambar'],
    slots: [25, 50, 90, 145, 225],
    cost: [2000, 7000, 24000, 78000],
    desc: 'Tek seferde daha çok maden taşırsın.',
  },
  engine: {
    label: 'Motor',
    icon: 'engine',
    names: ['Traktör Motoru','Turbo Dizel','Çift Pervane','Jet Türbini','Steampunk Reaktör'],
    /* DİKKAT: thrust > GRAVITY (900) olmalı, yoksa araç hiç havalanamaz.
       Net tırmanış ivmesi = thrust - 900. */
    thrust: [1180, 1340, 1520, 1750, 2050],
    cost: [2200, 8000, 26000, 84000],
    desc: 'Yerçekimine karşı daha güçlü kaldırır.',
  },
  hull: {
    label: 'Şasi / Kaporta',
    icon: 'hull',
    names: ['Hurda Sac','Çelik Sac','Takviye Şasi','Zırhlı Kaporta','Titanyum Gövde'],
    hp: [100, 165, 250, 350, 500],
    cost: [2600, 9500, 33000, 102000],
    desc: 'Düşme, patlama ve darbelere dayanım.',
  },
  radiator: {
    label: 'Radyatör',
    icon: 'radiator',
    names: ['Petek','Bakır Petek','Çift Fanlı','Kriyojenik','Bor Soğutmalı'],
    safeDepth: [2500, 4200, 5800, 7600, 10200],  // bu derinliğe kadar sıcak hasarı yok
    cost: [3000, 11000, 38000, 122000],
    desc: 'Derinlerdeki sıcaklık hasarını engeller.',
  },
};

/* ============================================================================
   BAKKAL — tek seferlik eşyalar (PRD md.3)
   ============================================================================ */
const ITEMS = {
  dinamit:    { label:'Dinamit',                 price:  800, max:12, key:'1',
                desc:'Sert kayaları ve aşağıdaki şeyi patlatır. (Bırak: 1)' },
  mazot:      { label:'Yedek Mazot Bidonu',      price:  600, max: 8, key:'2',
                desc:'Yeraltında +60 litre mazot.' },
  isinlayici: { label:'Acil Durum Işınlayıcısı', price: 2500, max: 5, key:'3',
                desc:'ASELSAN yapımı. Anında yüzeye ışınlar (yük korunur).' },
  macun:      { label:'Yapılandırıcı Macun',     price: 1200, max: 8, key:'4',
                desc:'Yeraltında şasiyi +70 can tamir eder.' },
};

/* ============================================================================
   DERİNLİK KATMANLARI — PRD md.4
   ============================================================================ */
const LAYERS = [
  { to:1000,  dirt:T.DIRT1, sky:'#3a2418', name:'Yüzey Damarları' },
  { to:3000,  dirt:T.DIRT2, sky:'#2b2b34', name:'Gri Şist' },
  { to:6000,  dirt:T.DIRT3, sky:'#3a161b', name:'Kızıl Derinlik' },
  { to:9000,  dirt:T.DIRT4, sky:'#150f1c', name:'Bor Kuşağı' },
  { to:99999, dirt:T.DIRT4, sky:'#0a0509', name:'Yedi Kat Dip' },
];

/* Yüzeydeki mekânların bulunduğu sütunlar (karo index) */
const BUILDINGS = [
  { id:'kooperatif', col: 4,  w:5, title:'MADEN KOOPERATİFİ', neon:'#35f0e8' },
  { id:'akaryakit',  col:11,  w:4, title:'ÇAYCI & PETROL REMZİ', neon:'#ffd23f' },
  { id:'sanayi',     col:18,  w:5, title:'SANAYİ SİTESİ', neon:'#ff3d8b' },
  { id:'bakkal',     col:26,  w:4, title:'BAKKAL', neon:'#5ddc6a' },
];
const SPAWN_COL = 23;   // Davut Usta oyuna burada başlar

window.VERSION = VERSION;
window.CFG = CFG; window.T = T; window.TILES = TILES; window.ORE_ORDER = ORE_ORDER;
window.UPGRADES = UPGRADES; window.ITEMS = ITEMS; window.LAYERS = LAYERS;
window.BUILDINGS = BUILDINGS; window.SPAWN_COL = SPAWN_COL;
