/* ============================================================================
   world.js — PROSEDÜREL HARİTA ÜRETİMİ (PRD md.3 "Harita Üretimi")

   Harita tek boyutlu bir Uint8Array üzerine serilmiş 2B ızgaradır:
       index = row * WORLD_W + col

   Dikey yerleşim:
       satır 0 .. SKY_ROWS-1            → gökyüzü / yüzey mekânları
       satır SKY_ROWS                   → 0 metre, zeminin ilk katı
       ... GROUND_ROWS satır boyunca    → kazılabilir maden sahası (10.000 m)
       satır ARENA_TOP .. +ARENA_ROWS   → Erlik Han arenası (kırılamaz obsidyen)

   Üretim tamamen tohumla (seed) belirlenir. Kayıt dosyası yalnızca
   { seed, kazılmış karo indeksleri } tutar; harita her açılışta yeniden üretilir.
   ============================================================================ */

class World {
  constructor(seed){
    this.seed = seed >>> 0;
    this.w = CFG.WORLD_W;
    this.skyRows = CFG.SKY_ROWS;
    this.groundRows = CFG.GROUND_ROWS;
    this.arenaTop = CFG.SKY_ROWS + CFG.GROUND_ROWS;
    this.h = this.arenaTop + CFG.ARENA_ROWS;

    this.tiles = new Uint8Array(this.w * this.h);
    this.variant = new Uint8Array(this.w * this.h);  // aynı karonun 4 görsel varyantı
    this.dug = new Set();                            // oyuncunun boşalttığı indeksler

    this.generate();
  }

  /* ---------------- ızgara erişimi ---------------- */
  idx(c, r){ return r * this.w + c; }
  inBounds(c, r){ return c >= 0 && c < this.w && r >= 0 && r < this.h; }
  get(c, r){ return this.inBounds(c, r) ? this.tiles[this.idx(c, r)] : T.BEDROCK; }
  set(c, r, v){ if (this.inBounds(c, r)) this.tiles[this.idx(c, r)] = v; }
  def(c, r){ return TILES[this.get(c, r)] || TILES[T.BEDROCK]; }
  isSolid(c, r){ return !!this.def(c, r).solid; }

  /** Satırın metre cinsinden derinliği (yüzey = 0 m) */
  depthOfRow(r){ return (r - this.skyRows) * CFG.METERS_PER_TILE; }
  rowOfDepth(m){ return this.skyRows + Math.floor(m / CFG.METERS_PER_TILE); }
  /** Yüzeyin piksel cinsinden y'si */
  get groundY(){ return this.skyRows * CFG.TILE; }
  layerAt(m){ return LAYERS.find(l => m < l.to) || LAYERS[LAYERS.length - 1]; }

  /* ========================================================================
     ÜRETİM
     ======================================================================== */
  generate(){
    const rng = mulberry32(this.seed);
    const { w } = this;

    for (let r = 0; r < this.h; r++){
      const depth = this.depthOfRow(r);

      for (let c = 0; c < w; c++){
        const i = this.idx(c, r);
        this.variant[i] = (rng() * 4) | 0;

        /* --- gökyüzü --- */
        if (r < this.skyRows){ this.tiles[i] = T.EMPTY; continue; }

        /* --- harita kenarları: ana kaya duvarı --- */
        if (c === 0 || c === w - 1){ this.tiles[i] = T.BEDROCK; continue; }

        /* --- arena --- */
        if (r >= this.arenaTop){ this.tiles[i] = this.arenaTile(c, r, rng); continue; }

        /* --- arenaya giriş katmanı: son 3 satır obsidyen, ortada çatlak --- */
        if (r >= this.arenaTop - 3){
          this.tiles[i] = (c >= 19 && c <= 21) ? T.ENTRANCE : T.OBSIDIAN;
          continue;
        }

        /* --- yüzey katı: her zaman dolu toprak (araç üstünde gezsin) --- */
        if (r === this.skyRows){ this.tiles[i] = T.DIRT1; continue; }

        this.tiles[i] = this.terrainTile(depth, rng);
      }
    }

    /* Başlangıç kuyusu: oyuncunun spawn olduğu sütunda 1 karo hava boşluğu
       bırakılmaz — Davut Usta zeminin ÜSTÜNDE başlar. Yalnızca dükkân
       önlerinin düz olduğundan emin oluyoruz. */
    for (const b of BUILDINGS)
      for (let c = b.col - 1; c <= b.col + b.w; c++)
        this.set(c, this.skyRows, T.DIRT1);
  }

  /** Derinliğe göre tek bir yeraltı karosu üretir. */
  terrainTile(depth, rng){
    const layer = this.layerAt(depth);

    /* 1) Mağara boşlukları — derinlik arttıkça biraz daha sık */
    if (rng() < 0.050 + Math.min(depth, 9000) / 9000 * 0.025) return T.EMPTY;

    /* 2) Grizu cepleri (PRD md.4: 1000-3000 m bandında tanışırsın, dipte de sürer) */
    if (depth > 900 && depth < 6800 && rng() < 0.026) return T.GAS;

    /* 3) Lav — 3500 m'den sonra, 7000 m'den sonra iki katı */
    if (depth > 3500 && rng() < (depth > 7000 ? 0.038 : 0.019)) return T.LAVA;

    /* 4) Hazineler (çok nadir: tüm haritada ~10 adet) */
    if (depth > 1500 && rng() < 0.00028) return rng() < 0.5 ? T.HITIT : T.OSMANLI;

    /* 5) Madenler */
    const ore = this.oreFor(depth, rng);
    if (ore) return ore;

    /* 6) Sert kayaçlar */
    const rr = rng();
    if (depth > 4500 && rr < 0.075) return T.HARDROCK;
    if (depth > 1800 && rr < 0.115) return T.ROCK;

    /* 7) Katmanın normal toprağı */
    return layer.dirt;
  }

  /** Derinlik bandına göre maden dağılımı (PRD md.4) */
  oreFor(depth, rng){
    const r = rng();
    if (depth < 1000){
      if (r < 0.070) return T.COAL;
      if (r < 0.125) return T.COPPER;
    } else if (depth < 3000){
      if (r < 0.038) return T.COAL;
      if (r < 0.086) return T.COPPER;
      if (r < 0.134) return T.SILVER;
      if (r < 0.160) return T.GOLD;
    } else if (depth < 6000){
      if (r < 0.020) return T.SILVER;
      if (r < 0.045) return T.GOLD;
      if (r < 0.092) return T.OLTU;
      if (r < 0.124) return T.LULE;
    } else if (depth < 9000){
      if (r < 0.016) return T.GOLD;
      if (r < 0.038) return T.OLTU;
      if (r < 0.064) return T.LULE;
      if (r < 0.118) return T.BOR;
    } else {
      if (r < 0.022) return T.LULE;
      if (r < 0.090) return T.BOR;
    }
    return 0;
  }

  /** Boss arenası: kırılamaz obsidyen kabuk, ortada lav havuzu (PRD md.6) */
  arenaTile(c, r, rng){
    const local = r - this.arenaTop;                 // 0 .. ARENA_ROWS-1
    const last = CFG.ARENA_ROWS - 1;

    if (c <= 1 || c >= this.w - 2) return T.OBSIDIAN;   // yan duvarlar
    if (local >= last - 1) return T.OBSIDIAN;           // taban
    if (local === last - 2){
      /* Zeminin bir üst satırı: ortada lav havuzu, kenarlarda platform */
      return (c >= 14 && c <= 25) ? T.LAVA : T.OBSIDIAN;
    }
    if (local === 0){
      /* Tavan: sadece giriş çatlağının altı açık kalır */
      return (c >= 19 && c <= 21) ? T.EMPTY : T.OBSIDIAN;
    }
    /* Savaş alanı boş; iki yanda kaçış platformu */
    if ((local === last - 6) && (c === 5 || c === 6 || c === 33 || c === 34)) return T.OBSIDIAN;
    return T.EMPTY;
  }

  /* ========================================================================
     KAZMA
     ======================================================================== */
  /** Karo kırılabilir mi? (matkabın gücü yetiyor mu) */
  canDig(c, r, maxHardness){
    const t = this.get(c, r);
    const d = TILES[t];
    if (!d || !d.solid) return false;
    if (t === T.BEDROCK || t === T.OBSIDIAN) return false;
    return d.hardness <= maxHardness;
  }

  /** Karoyu boşalt ve eski tipini döndür. */
  dig(c, r){
    const i = this.idx(c, r);
    const old = this.tiles[i];
    this.tiles[i] = T.EMPTY;
    this.dug.add(i);
    return old;
  }

  /** Patlama: yarıçap içindeki kırılabilir karoları uçurur. */
  blast(cc, cr, radius){
    const cleared = [];
    for (let r = cr - radius; r <= cr + radius; r++){
      for (let c = cc - radius; c <= cc + radius; c++){
        if (!this.inBounds(c, r)) continue;
        if ((c - cc) ** 2 + (r - cr) ** 2 > radius * radius + 0.5) continue;
        const t = this.get(c, r);
        if (t === T.EMPTY || t === T.BEDROCK || t === T.OBSIDIAN || t === T.ENTRANCE) continue;
        cleared.push(t);
        this.dig(c, r);
      }
    }
    return cleared;
  }

  /* ========================================================================
     KAYIT / YÜKLEME
     ======================================================================== */
  serializeDug(){ return Array.from(this.dug); }
  applyDug(list){
    for (const i of list){
      this.dug.add(i);
      this.tiles[i] = T.EMPTY;
    }
  }
}

window.World = World;
