/* ============================================================================
   art.js — PROSEDÜREL 16-BIT PİKSEL SANAT (placeholder görseller)

   ► SANAT YÖNETMENLİĞİ NOTU (tüm asset'ler için geçerli)
     Tarz: "16-bit Anadolu Pixel-Art / Steampunk".
     • Çalışma çözünürlüğü: karo başına 16x16 "mantıksal piksel", ekrana 2x
       basılır (32x32 px). Yani hiçbir detay 2 gerçek pikselden ince olmamalı.
     • Palet: her materyal için 4 ton — gölge / ana / açık / vurgu(neon).
       Anti-alias YOK, gradient YOK; sadece dither (satranç deseni) ile geçiş.
     • Kontrast yüksek: maden damarları arka plandan en az 3 ton ayrık olmalı.
     • Neon vurgular (tabelalar, matkap kıvılcımı, bor parıltısı) saf doygun
       renk + 1 piksel koyu kontur ile çizilir; "glow" ayrı bir yarı saydam
       katmanla değil, 1-2 piksel açık renkli halka ile taklit edilir.
     • Steampunk imzası: pirinç perçinler (2x2 açık sarı nokta), bakır borular,
       is/kurum lekeleri, yamalı sac dokusu.

   Bu dosyadaki her fonksiyon, sanatçı gerçek sprite sheet'i çizene kadar
   yerini tutacak "programatik" piksel sanat üretir. Sprite sheet geldiğinde
   sadece Art.tile() ve Art.drawPlayer() içini drawImage ile değiştirmek yeter.
   ============================================================================ */

const Art = (() => {
  const S = 2;  // 1 mantıksal piksel = 2 gerçek piksel

  function makeCanvas(w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c, x };
  }
  /** Mantıksal ızgarada piksel bloğu boya */
  function px(ctx, gx, gy, gw, gh, color){
    ctx.fillStyle = color;
    ctx.fillRect(gx * S, gy * S, gw * S, gh * S);
  }

  /* ==========================================================================
     KARO PALETLERİ
     [gölge, ana, açık, vurgu]
     ========================================================================== */
  const PAL = {
    [T.DIRT1]:    ['#3b2313','#5a3a20','#7a5030','#96663f'],  // Zonguldak kahvesi
    [T.DIRT2]:    ['#2a2a33','#3f3f4c','#575767','#6e6e80'],  // gri şist
    [T.DIRT3]:    ['#33151a','#4d2028','#672c36','#813a45'],  // koyu kızıl
    [T.DIRT4]:    ['#120d18','#1e1626','#2b2036','#3a2c48'],  // obsidyen kumu
    [T.ROCK]:     ['#2d2d33','#45454e','#5e5e69','#7b7b88'],
    [T.HARDROCK]: ['#1c1c22','#2e2e38','#44444f','#5d5d6b'],
    [T.BEDROCK]:  ['#0a0a0d','#141418','#1e1e24','#28282f'],
    [T.OBSIDIAN]: ['#080610','#110d1c','#1b1429','#2a1f3d'],

    [T.COAL]:     ['#0b0b0e','#17171c','#24242c','#3b3b47'],
    [T.COPPER]:   ['#5a2a12','#8c4a1e','#c2571f','#ff9a4d'],
    [T.SILVER]:   ['#4a5560','#7d8a96','#b3c0cb','#eaf2f8'],
    [T.GOLD]:     ['#6b4a08','#a87a10','#ffd23f','#fff3b0'],
    [T.OLTU]:     ['#0d0d14','#1a1a26','#2b2b3d','#6a6a8c'],  // Erzurum oltu taşı: kömür siyahı + mavi parlama
    [T.LULE]:     ['#8a8470','#b7b09a','#ded8c4','#fffaf0'],  // lületaşı: kirli krem
    [T.BOR]:      ['#0b4a52','#0f7d86','#35f0e8','#c8fffb'],  // BOR: neon camgöbeği, oyunun yıldızı
    [T.HITIT]:    ['#4a3a16','#7d6524','#b89642','#ffe7a3'],
    [T.OSMANLI]:  ['#6b4a08','#a87a10','#ffd23f','#fffbe0'],
    [T.GAS]:      ['#2c3a18','#48602a','#7ba83d','#c8ff6b'],  // grizu: zehirli yeşil parıltı
    [T.LAVA]:     ['#6b0b0b','#c22a00','#ff6b1f','#ffd23f'],
    [T.ENTRANCE]: ['#1a0a1e','#2d1136','#6b1f7d','#ff3d8b'],  // çatlaktan sızan pembe cehennem ışığı
  };

  const cache = {};   // { tipId: [varyant canvasları] }
  const VARIANTS = 4;

  /* --------------------------------------------------------------------------
     Toprak/kaya karosu.
     Görsel reçete: ana renkle doldur → seyrek gölge/ışık lekeleri (kayaç
     boşlukları, çakıl) → kenarlarda dither.
     NOT: Kenar ışığı BİLEREK sprite'a konmaz. Aksi hâlde her karo çerçeveli
     görünür ve ekranda satranç tahtası etkisi oluşur. Işık/gölge kenarları
     renderer'da yalnızca komşusu boş olan karolara çizilir (bkz. game.js).
     -------------------------------------------------------------------------- */
  function drawRockTile(ctx, pal, rng){
    px(ctx, 0, 0, 16, 16, pal[1]);
    for (let i = 0; i < 18; i++){
      const gx = randInt(rng, 0, 14), gy = randInt(rng, 0, 14);
      px(ctx, gx, gy, randInt(rng,1,3), randInt(rng,1,2), rng() < .55 ? pal[0] : pal[2]);
    }
    /* köşelere hafif dither — 16-bit doku hissi */
    for (let i = 0; i < 6; i++){
      px(ctx, randInt(rng,0,15), randInt(rng,0,15), 1, 1, shade(pal[1], -18));
      px(ctx, randInt(rng,0,15), randInt(rng,0,15), 1, 1, shade(pal[1], 16));
    }
  }

  /* --------------------------------------------------------------------------
     Maden karosu: toprak zemin + 3-5 adet kristal/damar bloğu.
     Her damarın sol-üst köşesine 1 piksel "vurgu" konur ki 16-bit parlaklık
     hissi doğsun.
     -------------------------------------------------------------------------- */
  function drawOreTile(ctx, basePal, orePal, rng, blobs){
    drawRockTile(ctx, basePal, rng);
    for (let i = 0; i < blobs; i++){
      const w = randInt(rng, 2, 4), h = randInt(rng, 2, 4);
      const gx = randInt(rng, 1, 15 - w), gy = randInt(rng, 1, 15 - h);
      px(ctx, gx, gy, w, h, orePal[1]);
      px(ctx, gx, gy, w - 1, 1, orePal[2]);
      px(ctx, gx, gy, 1, 1, orePal[3]);            // neon parıltı pikseli
      px(ctx, gx + w - 1, gy + h - 1, 1, 1, orePal[0]);
    }
  }

  /* -------------------------------------------------------------------------- */
  function buildTile(type, variant){
    const { c, x } = makeCanvas(32, 32);
    const rng = mulberry32(type * 7919 + variant * 104729);
    const pal = PAL[type] || PAL[T.DIRT1];

    if (type === T.LAVA){
      /* LAV: dalgalı yüzey + sıcak çekirdek. Animasyon renderer'da y kaydırmasıyla. */
      px(x, 0, 0, 16, 16, pal[1]);
      for (let i = 0; i < 20; i++)
        px(x, randInt(rng,0,15), randInt(rng,0,15), randInt(rng,1,3), 1, pick(rng, [pal[2], pal[3], pal[0]]));
      px(x, 0, 0, 16, 1, pal[3]);
    } else if (type === T.GAS){
      /* GRİZU: koyu toprak içinde kabarcıklar. Halkalı çizim = gaz cebi. */
      drawRockTile(x, PAL[T.DIRT2], rng);
      for (let i = 0; i < 5; i++){
        const gx = randInt(rng,2,12), gy = randInt(rng,2,12), r = randInt(rng,2,3);
        px(x, gx, gy, r, r, pal[2]);
        px(x, gx, gy, 1, 1, pal[3]);
      }
    } else if (type === T.ENTRANCE){
      /* ARENA KAPISI: obsidyen + pembe çatlaklar (Erlik Han'ın ışığı sızıyor). */
      px(x, 0, 0, 16, 16, pal[1]);
      for (let i = 0; i < 6; i++){
        let gx = randInt(rng,1,14), gy = 0;
        while (gy < 16){ px(x, gx, gy, 1, 2, i % 2 ? pal[3] : pal[2]); gy += 2; gx += randInt(rng,-1,1); gx = clamp(gx,0,15); }
      }
      px(x, 0, 0, 16, 1, pal[0]); px(x, 0, 15, 16, 1, pal[0]);
    } else if (TILES[type] && (TILES[type].ore || TILES[type].artifact)){
      /* Madenin gömülü olduğu toprak, derinliğine göre değil sadeleştirme için
         sabit bir zemin kullanır (DIRT2). Renderer katman rengini üstüne katar. */
      drawOreTile(x, PAL[T.DIRT2], pal, rng, TILES[type].artifact ? 1 : randInt(rng, 2, 4));
      if (TILES[type].artifact){
        /* HAZİNE: ortada kare bir tablet/sikke silueti + altın kontur. */
        px(x, 5, 5, 6, 6, pal[1]);
        px(x, 5, 5, 6, 1, pal[3]); px(x, 5, 5, 1, 6, pal[3]);
        px(x, 7, 7, 2, 2, pal[0]);
      }
    } else {
      drawRockTile(x, pal, rng);
    }
    return c;
  }

  /** Kenar ışığı/gölgesi için kullanılacak palet.
      Maden karolarının zemini toprak olduğundan kenarları da toprak tonundadır;
      yoksa her bakır damarı turuncu çerçeveli görünürdü. */
  function edgePal(type){
    const d = TILES[type];
    if (d && (d.ore || d.artifact)) return PAL[T.DIRT2];
    return PAL[type] || PAL[T.DIRT1];
  }

  function tile(type, variant){
    if (!cache[type]){
      cache[type] = [];
      for (let v = 0; v < VARIANTS; v++) cache[type].push(buildTile(type, v));
    }
    return cache[type][variant & (VARIANTS - 1)];
  }

  /* ==========================================================================
     KÖSTEBEK-V1 — Davut Usta'nın sondaj aracı
     ► Sprite tarifi: 2 karo genişliğinde olmayan, tek karoya sığan tıknaz bir
       araç. Alt tarafta paletli yürüyüş takımı (traktör paleti), gövde eski bir
       Şahin/Doğan kaportasından kesilmiş sac, üstte pirinç bir egzoz bacası ve
       iki yanda katlanır pervane. Ön alt köşede dönen konik matkap.
       Kabinde Davut Usta'nın kasketi ve bıyığı 2-3 piksel ile görünür.
     ========================================================================== */
  function drawPlayer(ctx, p, t){
    const w = p.w, h = p.h;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.facing < 0){ ctx.translate(w, 0); ctx.scale(-1, 1); }

    const P = ctx;
    const u = w / 16;                       // mantıksal piksel boyu
    const q = (gx, gy, gw, gh, col) => { P.fillStyle = col; P.fillRect(gx*u, gy*u, gw*u, gh*u); };

    const body   = p.hurtFlash > 0 ? '#ff6b6b' : '#c2571f';   // pas turuncusu kaporta
    const bodyHi = p.hurtFlash > 0 ? '#ffd0d0' : '#f08a3c';
    const bodyLo = '#7a2f0d';
    const steel  = '#4a4a5a', steelHi = '#7e7e94';
    const brass  = '#ffd23f';

    /* --- palet / yürüyüş takımı --- */
    q(1, 12, 14, 3, '#23232c');
    const tread = Math.floor(t * 12 + p.x * 0.35) % 3;
    for (let i = 0; i < 5; i++) q(2 + i*3 + tread, 13, 1, 1, steelHi);

    /* --- ana gövde (yamalı sac) --- */
    q(2, 5, 12, 7, body);
    q(2, 5, 12, 1, bodyHi);            // üst ışık
    q(2, 11, 12, 1, bodyLo);           // alt gölge
    q(3, 8, 2, 2, bodyLo);             // yama
    q(10, 7, 1, 1, brass); q(13,10,1,1, brass);   // perçinler

    /* --- kabin camı + Davut Usta --- */
    q(8, 6, 5, 4, '#1d2f4a');
    q(9, 7, 3, 2, '#35f0e8');          // neon yansımalı cam
    q(9, 7, 2, 1, '#0b3b3a');          // kasket
    q(9, 9, 2, 1, '#2a1a10');          // bıyık

    /* --- egzoz bacası (steampunk) --- */
    q(4, 3, 2, 2, steel); q(4, 3, 2, 1, brass);
    if (p.thrust || Math.abs(p.vx) > 20){
      const s = Math.floor(t * 14) % 2;
      q(4, 1 - s, 2, 2, 'rgba(120,120,140,.55)');
    }

    /* --- pervaneler (uçarken açılır ve döner) --- */
    if (p.thrust){
      const blade = Math.floor(t * 30) % 2 === 0;
      q(0, 4, 16, 1, 'rgba(255,255,255,.12)');
      if (blade){ q(0, 3, 4, 1, steelHi); q(12, 3, 4, 1, steelHi); }
      else      { q(1, 3, 2, 1, steelHi); q(13, 3, 2, 1, steelHi); }
      /* itki alevi */
      q(5, 15, 2, 2, '#ff8a00'); q(9, 15, 2, 2, '#ffd23f');
    }

    /* --- GÖSTERGE LAMBALARI (kabinin üstünde) ---
       HUD'a bakmadan, aracın kendisinden okunabilen uyarılar. Ağır iş
       makinelerinde de böyledir: kritik bilgi operatörün gözünün önündedir. */
    const lamp = Math.floor(t * 5) % 2 === 0;
    if (p.warnFuel && lamp){ q(12, 3, 2, 2, '#ff4438'); q(12, 3, 1, 1, '#ffb4ae'); }
    if (p.warnCargo && lamp){ q(9, 3, 2, 2, '#ffd23f'); q(9, 3, 1, 1, '#fffbe0'); }
    else if (p.warnHeavy && Math.floor(t * 2.5) % 2 === 0) q(9, 3, 2, 2, '#8a5a10');

    /* Ağır yükte araç arkaya doğru çöker: süspansiyon eziliyor hissi */
    if (p.warnHeavy) q(1, 15, 14, 1, '#1a1a22');

    /* --- matkap --- */
    const spin = Math.floor(t * 24) % 3;
    const dir = p.drillDir;   // 'down' | 'side' | null
    if (dir === 'side'){
      q(14, 8, 3, 3, steel);
      q(15 + (spin===0?0:1), 8, 1, 3, brass);
      if (p.drilling){ q(17, 7, 1, 1, '#ffd23f'); q(17, 11, 1, 1, '#ff3d8b'); }
    } else {
      q(6, 14, 4, 3, steel);
      q(7, 15 + (spin===2?1:0), 2, 2, brass);
      if (p.drilling){ q(5, 17, 1, 1, '#ffd23f'); q(10, 17, 1, 1, '#ff3d8b'); }
    }

    ctx.restore();
  }

  /* ==========================================================================
     YÜZEY BİNALARI
     ► Her bina, üstünde titreşen bir NEON TABELA taşıyan tek katlı sanayi
       yapısıdır: oluklu sac çatı, briket duvar, tenteli vitrin.
       Neon tabela = 2 piksel kalınlığında doygun renk + 1 piksel koyu kontur;
       rastgele aralıklarla "kontak arıyor" gibi söner.
     ========================================================================== */
  function drawBuilding(ctx, b, sx, groundY, t){
    const TW = CFG.TILE;
    const w = b.w * TW, h = 3 * TW;
    const x = sx, y = groundY - h;
    const q = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(x+gx, y+gy, gw, gh); };

    q(0, h - 46, w, 46, '#2b2436');                       // briket duvar
    for (let i = 0; i < w; i += 16)                        // briket derzleri
      for (let j = h - 46; j < h; j += 8)
        { ctx.fillStyle = '#231d2d'; ctx.fillRect(x + i + ((j/8)%2?8:0), y + j, 14, 1); }

    q(-4, h - 52, w + 8, 6, '#4a4050');                    // oluklu sac saçak
    for (let i = 0; i < w + 8; i += 6) q(-4 + i, h - 52, 2, 6, '#5e5266');

    q(6, h - 34, w - 12, 20, '#0f1420');                   // vitrin camı
    q(6, h - 34, w - 12, 2, '#35f0e8');
    q(w/2 - 9, h - 16, 18, 16, '#1a1220');                 // kapı

    /* --- neon tabela --- */
    const flick = (Math.sin(t * 9 + b.col) > -0.86) ? 1 : 0.25;
    ctx.globalAlpha = flick;
    ctx.fillStyle = b.neon;
    ctx.fillRect(x + 4, y + h - 62, w - 8, 4);
    ctx.fillRect(x + 4, y + h - 62, 4, 12);
    ctx.fillRect(x + w - 8, y + h - 62, 4, 12);
    ctx.globalAlpha = 1;

    /* Mekâna özel dekor */
    if (b.id === 'akaryakit'){
      /* Semaver + sürekli tüten çay buharı (PRD md.3) */
      q(w - 18, h - 30, 10, 14, '#b78a2a');
      q(w - 16, h - 32, 6, 3, '#ffd23f');
      const st = Math.floor(t * 4) % 3;
      ctx.fillStyle = 'rgba(220,220,235,.45)';
      ctx.fillRect(x + w - 14 + st, y + h - 40 - st * 3, 3, 3);
      ctx.fillRect(x + w - 16 + st, y + h - 46 - st * 3, 4, 3);
      /* mazot pompası */
      q(8, h - 30, 9, 16, '#c2571f'); q(9, h - 28, 7, 5, '#0f1420');
    }
    if (b.id === 'sanayi'){
      /* Kaportacı Cabbar: kaynak kıvılcımı */
      if (Math.floor(t * 6) % 4 === 0){
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 14, y + h - 22, 3, 3);
        ctx.fillStyle = '#35f0e8'; ctx.fillRect(x + 12, y + h - 26, 2, 2);
      }
      q(w - 22, h - 26, 14, 12, '#3a3448');   // hurda yığını
    }
    if (b.id === 'kooperatif'){
      q(4, h - 70, 3, 18, '#5e5266');         // bayrak direği
      ctx.fillStyle = '#e02020'; ctx.fillRect(x + 7, y + h - 70, 14, 9);
    }
    if (b.id === 'bakkal'){
      /* tenteli meyve sandıkları */
      for (let i = 0; i < 3; i++){
        ctx.fillStyle = i % 2 ? '#ff3d8b' : '#ffd23f';
        ctx.fillRect(x + 6 + i * 14, y + h - 12, 12, 4);
      }
    }

    /* Tabela yazısı (gerçek sprite'ta piksel font olacak) */
    ctx.font = '7px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = b.neon;
    ctx.fillText(b.title, x + w / 2, y + h - 66);
    ctx.textAlign = 'left';
  }

  /* ==========================================================================
     ERLİK GOLEMİ
     ► Tarif: 5x5 karo, çatlaklarından magma akan bazalt bir dev. Omuzlarında
       Karanlık Holding'in kırık logosu, boynunda Sermet Bey'in kravatının
       kalıntısı (siyah-kırmızı 2 piksel şerit) — dönüşümün ipucu.
       Gözler: boss öfkelendikçe sarıdan bembeyaza döner.
     ========================================================================== */
  function drawGolem(ctx, g, t){
    const x = Math.round(g.x), y = Math.round(g.y), w = g.w, h = g.h;
    const u = w / 20;
    const q = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(x+gx*u, y+gy*u, gw*u, gh*u); };
    const rage = g.hp / g.maxHp < 0.5;
    const hit = g.hitFlash > 0;

    const outline = '#0a0610';
    const rock   = hit ? '#ffd0c0' : '#43374f';   // bazalt ana ton
    const rockHi = hit ? '#ffffff' : '#5c4c6e';   // üstten gelen lav ışığı
    const rockLo = hit ? '#e0a090' : '#2a2033';   // kollar/bacaklar (geride)

    /* --- silüet konturu: her kütlenin 1 birim büyüğü koyu renkle --- */
    const mass = [
      [7, 1, 6, 6],     // kafa
      [4, 6, 12, 10],   // gövde
      [0, 7, 4, 9],     // sol kol
      [16, 7, 4, 9],    // sağ kol
      [5, 16, 4, 4],    // sol bacak
      [11, 16, 4, 4],   // sağ bacak
    ];
    mass.forEach(m => q(m[0]-0.5, m[1]-0.5, m[2]+1, m[3]+1, outline));

    /* --- kütleler --- */
    q(0, 7, 4, 9, rockLo); q(16, 7, 4, 9, rockLo);      // kollar
    q(5, 16, 4, 4, rockLo); q(11, 16, 4, 4, rockLo);    // bacaklar
    q(4, 6, 12, 10, rock);                              // gövde
    q(4, 6, 12, 1.5, rockHi);                           // omuz ışığı
    q(7, 1, 6, 6, rock);                                // kafa
    q(7, 1, 6, 1.5, rockHi);

    /* --- magma çatlakları — nabız gibi atar --- */
    const pulse = 0.5 + 0.5 * Math.sin(t * (rage ? 9 : 4));
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    const cr = rage ? '#ffd23f' : '#ff6b1f';
    q(6, 7, 1, 8, cr); q(6, 10, 3, 1, cr);
    q(13, 8, 1, 7, cr); q(11, 13, 3, 1, cr);
    q(1, 9, 2, 1, cr); q(18, 11, 1, 3, cr);
    q(6, 17, 2, 1, cr); q(12, 18, 2, 1, cr);
    ctx.globalAlpha = 1;

    /* --- gözler: öfkelendikçe sarıdan beyaza --- */
    const eye = rage ? '#ffffff' : '#ffd23f';
    q(8, 3, 1.5, 2, eye); q(11.5, 3, 1.5, 2, eye);
    q(8, 3, 1.5, 0.5, '#fff');  q(11.5, 3, 1.5, 0.5, '#fff');

    /* --- Sermet Bey'in kravatı: dönüşümün tek kalıntısı --- */
    q(9.5, 6.5, 1, 1, '#8b1020');
    q(9, 7.5, 2, 3.5, '#160a0c');
    q(9.5, 8, 1, 2, '#8b1020');

    /* --- zayıf noktalar --- */
    g.cores.forEach((c, i) => {
      const cx = c.rx * u, cy = c.ry * u;
      const active = i === g.activeCore;
      const r = (active ? 1.9 : 1.3) * u;
      /* koyu yuva → içinde parlayan çekirdek (kontur olmadan kaybolur) */
      ctx.fillStyle = '#12091c';
      ctx.fillRect(x + cx - r - u, y + cy - r - u, (r + u) * 2, (r + u) * 2);
      ctx.fillStyle = active ? (Math.floor(t * 10) % 2 ? '#c8fffb' : '#35f0e8') : '#5a3a6b';
      ctx.fillRect(x + cx - r, y + cy - r, r * 2, r * 2);
      if (active){
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(x + cx - r * 0.4, y + cy - r * 0.4, r * 0.8, r * 0.8);
      }
    });
  }

  /* ==========================================================================
     GÖKYÜZÜ / ARKA PLAN
     ► Zonguldak siluetleri: terk edilmiş maden kuleleri, bacalar, uzakta
       neon tabelalı gecekondular. Paralaks 0.3 hızında kayar.
     ========================================================================== */
  function drawSky(ctx, camX, groundScreenY, t){
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(groundScreenY, 1));
    g.addColorStop(0, '#120b2a'); g.addColorStop(.55, '#2a1636'); g.addColorStop(1, '#5a2432');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.VIEW_W, Math.max(groundScreenY, 0));

    /* yıldızlar */
    const rng = mulberry32(1337);
    for (let i = 0; i < 60; i++){
      const sx = rng() * 2000, sy = rng() * 150;
      const px_ = ((sx - camX * 0.15) % 2000 + 2000) % 2000 - 200;
      if (px_ > -4 && px_ < CFG.VIEW_W && sy < groundScreenY){
        ctx.fillStyle = rng() < .2 ? '#35f0e8' : '#cfc7e8';
        ctx.fillRect(px_ | 0, sy | 0, 2, 2);
      }
    }

    /* maden kulesi siluetleri (paralaks) */
    const rng2 = mulberry32(99);
    for (let i = 0; i < 14; i++){
      const wx = i * 180 + rng2() * 60;
      const sx = wx - camX * 0.35;
      const hh = 40 + rng2() * 60;
      if (sx < -80 || sx > CFG.VIEW_W + 80) continue;
      const by = groundScreenY;
      ctx.fillStyle = '#1a1024';
      ctx.fillRect(sx | 0, (by - hh) | 0, 26, hh);
      ctx.fillRect((sx - 8) | 0, (by - hh - 10) | 0, 42, 10);
      if (Math.sin(t * 2 + i) > 0){   // tepedeki uyarı lambası
        ctx.fillStyle = '#ff3d8b'; ctx.fillRect((sx + 10) | 0, (by - hh - 14) | 0, 4, 4);
      }
    }
  }

  /** Yeraltı arka planı: kazılmış boşluğun arkasındaki duvar (koyu ton) */
  function undergroundBg(depthM){
    const L = LAYERS.find(l => depthM < l.to) || LAYERS[LAYERS.length - 1];
    return L.sky;
  }

  return { makeCanvas, px, tile, edgePal, drawPlayer, drawBuilding, drawGolem, drawSky, undergroundBg, PAL };
})();

window.Art = Art;
