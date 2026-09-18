/* ============================================================================
   entities.js — parçacıklar, dinamit, magma topu, uçuşan yazılar

   ► PİKSEL SANAT NOTU: hiçbir parçacık 2x2 gerçek pikselden küçük olmamalı.
     Daireler yok — kare bloklar. Alfa yerine palet düşürme (dithering) tercih
     edilir; burada performans için alfa kullanıyoruz.
   ============================================================================ */

class Particle {
  constructor(x, y, vx, vy, life, color, size = 3, grav = 500){
    Object.assign(this, { x, y, vx, vy, life, maxLife: life, color, size, grav });
  }
  update(dt){
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx, cam){
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    ctx.fillRect((this.x - cam.x) | 0, (this.y - cam.y) | 0, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

/** Kazma kıvılcımı / patlama bulutu üretici */
const FX = {
  burst(list, x, y, n, colors, spd = 180, grav = 500, size = 3, life = 0.5){
    const rng = Math.random;
    for (let i = 0; i < n; i++){
      const a = rng() * Math.PI * 2, s = spd * (0.3 + rng() * 0.9);
      list.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        life * (0.6 + rng() * 0.8), colors[(rng() * colors.length) | 0], size, grav));
    }
  },
  /** Kazarken fırlayan toprak kırıntıları */
  drillSparks(list, x, y, pal){
    FX.burst(list, x, y, 3, [pal[2], pal[3], '#ffd23f'], 120, 700, 2, 0.28);
  },
};

/** Ekranda yukarı süzülen bilgi yazısı ("+₺420", "-12 CAN") */
class FloatText {
  constructor(x, y, text, color){
    Object.assign(this, { x, y, text, color, life: 1.2 });
  }
  update(dt){ this.y -= 26 * dt; this.life -= dt; return this.life > 0; }
  draw(ctx, cam){
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(this.text, (this.x - cam.x) | 0, (this.y - cam.y + 1) | 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, (this.x - cam.x) | 0, (this.y - cam.y) | 0);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

/* ============================================================================
   DİNAMİT
   ► Görsel: kırmızı bir çubuk + yanan fitil. Fitil kısaldıkça sprite kırpılır,
     son 0.4 sn'de beyaz yanıp söner.
   ============================================================================ */
class Bomb {
  constructor(x, y){
    this.x = x; this.y = y; this.w = 10; this.h = 14;
    this.vx = 0; this.vy = -60;
    this.fuse = CFG.BOMB_FUSE;
    this.dead = false;
  }
  update(dt, world){
    this.vy = Math.min(this.vy + CFG.GRAVITY * dt, CFG.MAX_FALL);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* basit zemin çarpışması */
    const c = Math.floor((this.x + this.w / 2) / CFG.TILE);
    const r = Math.floor((this.y + this.h) / CFG.TILE);
    if (world.isSolid(c, r)){
      this.y = r * CFG.TILE - this.h;
      this.vy = 0; this.vx *= 0.5;
    }
    this.fuse -= dt;
    if (this.fuse <= 0) this.dead = true;
    return !this.dead;
  }
  draw(ctx, cam, t){
    const x = (this.x - cam.x) | 0, y = (this.y - cam.y) | 0;
    const blink = this.fuse < 0.4 && Math.floor(t * 16) % 2 === 0;
    ctx.fillStyle = blink ? '#ffffff' : '#c81e1e';
    ctx.fillRect(x, y + 4, 10, 10);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 2, y + 6, 6, 2);
    ctx.fillStyle = '#6b4a08'; ctx.fillRect(x + 4, y, 2, 4);
    ctx.fillStyle = '#ff8a00'; ctx.fillRect(x + 4, y - 2, 2, 2);
  }
}

/* ============================================================================
   MAGMA TOPU (Erlik Golemi'nin ateşi)
   ► Görsel: 8x8 turuncu çekirdek + arkasında 2 karelik sönen kuyruk.
   ============================================================================ */
class Fireball {
  constructor(x, y, vx, vy, dmg = 16){
    Object.assign(this, { x, y, vx, vy, dmg, w: 10, h: 10, life: 6, trail: [] });
  }
  update(dt, world){
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.vy += 220 * dt;                 // hafif yerçekimi → balistik yay
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    const c = Math.floor((this.x + 5) / CFG.TILE), r = Math.floor((this.y + 5) / CFG.TILE);
    if (world.isSolid(c, r)) return false;
    return this.life > 0;
  }
  draw(ctx, cam){
    this.trail.forEach((p, i) => {
      ctx.globalAlpha = i / this.trail.length * 0.6;
      ctx.fillStyle = '#c22a00';
      ctx.fillRect((p.x - cam.x) | 0, (p.y - cam.y) | 0, 8, 8);
    });
    ctx.globalAlpha = 1;
    const x = (this.x - cam.x) | 0, y = (this.y - cam.y) | 0;
    ctx.fillStyle = '#ff6b1f'; ctx.fillRect(x, y, 10, 10);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 2, y + 2, 6, 6);
    ctx.fillStyle = '#fffbe0'; ctx.fillRect(x + 4, y + 4, 2, 2);
  }
}

/* ============================================================================
   MAZOT VARİLİ — arenada periyodik olarak düşer (savaşı yakıtsız bırakmamak için)
   ============================================================================ */
class FuelBarrel {
  constructor(x, y){ Object.assign(this, { x, y, w: 16, h: 18, vy: 0, amount: 40 }); }
  update(dt, world){
    this.vy = Math.min(this.vy + CFG.GRAVITY * dt, CFG.MAX_FALL);
    this.y += this.vy * dt;
    const c = Math.floor((this.x + 8) / CFG.TILE), r = Math.floor((this.y + this.h) / CFG.TILE);
    if (world.isSolid(c, r)){ this.y = r * CFG.TILE - this.h; this.vy = 0; }
    return true;
  }
  draw(ctx, cam, t){
    const x = (this.x - cam.x) | 0, y = (this.y - cam.y) | 0;
    const g = Math.sin(t * 6) > 0 ? '#ffd23f' : '#ff8a00';
    ctx.fillStyle = '#2a2436'; ctx.fillRect(x - 1, y - 1, 18, 20);
    ctx.fillStyle = g;         ctx.fillRect(x, y, 16, 18);
    ctx.fillStyle = '#7a2f0d'; ctx.fillRect(x, y + 5, 16, 3);
    ctx.fillStyle = '#12101f'; ctx.fillRect(x + 5, y + 9, 6, 5);
  }
}

/* ============================================================================
   ENKAZ — Köstebek-V1'in mezarı

   Davut Usta patladığında topladığı her şey öldüğü koordinatta kalır.
   Oyuncu son kayıttan devam eder ama kargosu hâlâ orada, 6000 metre dipte,
   onu bekliyordur. Bu, ölümü "kaydı yükle"den çıkarıp kendi kendine hedef
   üreten bir olaya çevirir.

   ► PİKSEL SANAT NOTU: yan yatmış, matkabı kırılmış bir Köstebek gövdesi.
     Üstünde hâlâ tüten ince bir duman sütunu ve kurtarma şamandırası gibi
     yanıp sönen camgöbeği bir işaret fişeği — karanlıkta 3 karo öteden
     görülebilmeli, yoksa oyuncu enkazını bulamaz.
   ============================================================================ */
class Wreck {
  constructor(x, y, cargo, cargoCount, depth){
    this.x = x; this.y = y; this.w = 30; this.h = 22;
    this.cargo = cargo;                 // { karoTipi: adet }
    this.cargoCount = cargoCount;
    this.depth = depth;
    this.vy = 0;
  }

  /** Enkazın içindeki madenlerin toplam satış değeri */
  get value(){
    let sum = 0;
    for (const k in this.cargo) sum += (TILES[k].value || 0) * this.cargo[k];
    return sum;
  }

  /** Havada kalmasın: altı boşaldıysa düşsün (grizu tüneli çökerse vs.) */
  update(dt, world){
    this.vy = Math.min(this.vy + CFG.GRAVITY * dt, CFG.MAX_FALL);
    this.y += this.vy * dt;
    const c = Math.floor((this.x + this.w / 2) / CFG.TILE);
    const r = Math.floor((this.y + this.h) / CFG.TILE);
    if (world.isSolid(c, r)){ this.y = r * CFG.TILE - this.h; this.vy = 0; }
    return true;
  }

  draw(ctx, cam, t){
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    const q = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(x + gx, y + gy, gw, gh); };

    /* yan yatmış gövde */
    q(-1, 7, 32, 16, '#0a0610');
    q(0, 8, 30, 14, '#6b3a18');
    q(0, 8, 30, 2, '#8a4a20');
    q(4, 12, 6, 5, '#1d2f4a');            // kırık cam
    q(5, 13, 2, 2, '#35f0e8');
    q(22, 6, 3, 6, '#3a3a48');            // kopmuş matkap
    q(26, 9, 4, 3, '#4a4a5a');
    q(2, 20, 26, 2, '#231409');

    /* tüten duman */
    const s = Math.floor(t * 3) % 4;
    ctx.fillStyle = 'rgba(190,190,210,.30)';
    ctx.fillRect(x + 12 + s, y - 2 - s * 4, 3, 3);
    ctx.fillRect(x + 10 + s, y - 8 - s * 4, 4, 3);

    /* kurtarma işaret fişeği — karanlıkta bulunabilsin diye */
    const blink = Math.sin(t * 6) > 0;
    if (blink){
      ctx.fillStyle = '#35f0e8';
      ctx.fillRect(x + 13, y - 16, 4, 4);
      ctx.fillStyle = 'rgba(53,240,232,.22)';
      ctx.fillRect(x + 7, y - 22, 16, 16);
      ctx.fillRect(x + 11, y - 30, 8, 30);
    }
  }
}

/* ============================================================================
   TOPLAMA UÇUŞU — kazılan maden HUD'daki kasa barına uçar

   Dünya uzayında değil EKRAN uzayında yaşar: doğduğu yer kameradan bağımsız
   sabitlenir, hedefi HUD'daki kasa barının canvas karşılığıdır. Böylece kamera
   kaysa bile parça hedefini şaşırmaz.
   ► Yay çizer, çünkü düz çizgi "veri transferi" gibi görünür; yay "nesne" gibi.
   ============================================================================ */
class Pickup {
  constructor(sx, sy, tx, ty, color, onArrive){
    this.sx = sx; this.sy = sy;
    this.tx = tx; this.ty = ty;
    this.color = color;
    this.onArrive = onArrive;
    this.life = 0;
    this.dur = 0.42 + Math.random() * 0.12;
    /* yayın tepe noktası: iki uç arasının üstünde rastgele bir sapma */
    this.cx = (sx + tx) / 2 + (Math.random() - 0.5) * 90;
    this.cy = Math.min(sy, ty) - 40 - Math.random() * 40;
  }
  update(dt){
    this.life += dt;
    if (this.life >= this.dur){ if (this.onArrive) this.onArrive(); return false; }
    return true;
  }
  draw(ctx){
    const u = this.life / this.dur;
    const k = 1 - u;
    /* karesel Bézier */
    const x = k*k*this.sx + 2*k*u*this.cx + u*u*this.tx;
    const y = k*k*this.sy + 2*k*u*this.cy + u*u*this.ty;
    const s = 5 - u * 2;
    ctx.fillStyle = '#0a0610';
    ctx.fillRect((x - s/2 - 1)|0, (y - s/2 - 1)|0, s + 2, s + 2);
    ctx.fillStyle = this.color;
    ctx.fillRect((x - s/2)|0, (y - s/2)|0, s, s);
  }
}

window.Particle = Particle; window.FX = FX; window.FloatText = FloatText;
window.Bomb = Bomb; window.Fireball = Fireball; window.FuelBarrel = FuelBarrel;
window.Wreck = Wreck; window.Pickup = Pickup;
