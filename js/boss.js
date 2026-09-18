/* ============================================================================
   boss.js — MAGMA SURETİ  (Sermet Bey'in üstüne aldığı şey)

   Sınıf adı ErlikGolem olarak kaldı: anlatıda o şeyin adı yok, her kavim başka
   ad takmış (Deccal, İblis, Ahriman). Oyuncuya "ŞEYTAN" görünür;
   koddaki ad yalnızca bir tutamak.

   Arena: -10.000 m. Zemin kırılamaz obsidyen, ortada lav havuzu.
   Mekanik:
     • Golem oyuncuya magma topları fırlatır; oyuncu uçarak kaçar.
     • Golemin 3 zayıf noktası (çekirdek) vardır; her an yalnız BİRİ açıktır.
       Açık çekirdeğe matkapla dokunmak hasar verir → klasik vur-kaç.
     • Dinamit açık çekirdeğin yanında patlarsa çok daha fazla hasar verir.
     • Oyuncunun yakıtı savaş boyunca akmaya devam eder → tempo baskısı.
       (Arenaya periyodik mazot varili düşer, ama az.)
     • Can %50'nin altına inince 2. faz: saldırılar hızlanır, lav yükselir.
   ============================================================================ */

class ErlikGolem {
  constructor(world){
    this.world = world;
    this.w = 160; this.h = 160;

    const T_ = CFG.TILE;
    this.floorY = (world.arenaTop + CFG.ARENA_ROWS - 2) * T_;
    this.baseY = this.floorY - this.h - 10;

    /* Oyuncu tavandaki çatlaktan (19-21. sütun) düşer; golem uzakta, solda
       belirir ki iniş anında sıfır hasarla ezilmesin. */
    this.x = 6 * T_;
    this.y = this.baseY;
    this.dir = 1;
    this.speed = 42;

    this.maxHp = 130; this.hp = this.maxHp;
    this.hitFlash = 0;
    this.phase = 1;
    this.dead = false;

    /* Zayıf noktalar: drawGolem'deki 20x20 mantıksal ızgarada konumlar */
    this.cores = [
      { rx: 10, ry: 12 },   // göğüs (kravatın altı)
      { rx: 2,  ry: 11 },   // sol kol
      { rx: 18, ry: 11 },   // sağ kol
    ];
    this.activeCore = 0;
    this.coreTimer = 3.2;

    this.fireTimer = 2.0;
    this.slamTimer = 7.0;
    this.barrelTimer = 20;
    this.hurtCooldown = 0;
    this.t = 0;
  }

  /** Aktif çekirdeğin dünya koordinatlarındaki çarpışma kutusu */
  coreRect(){
    const u = this.w / 20, c = this.cores[this.activeCore];
    const s = u * 5;
    return { x: this.x + c.rx * u - s / 2, y: this.y + c.ry * u - s / 2, w: s, h: s };
  }
  get rect(){ return { x:this.x + 20, y:this.y + 16, w:this.w - 40, h:this.h - 26 }; }

  update(dt, player, game){
    if (this.dead) return;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);

    const T_ = CFG.TILE;
    const p2 = this.phase === 2;

    /* ---------- salınımlı hareket ---------- */
    this.x += this.dir * this.speed * (p2 ? 1.7 : 1) * dt;
    const minX = 4 * T_, maxX = (this.world.w - 4) * T_ - this.w;
    if (this.x < minX){ this.x = minX; this.dir = 1; }
    if (this.x > maxX){ this.x = maxX; this.dir = -1; }
    this.y = this.baseY + Math.sin(this.t * 1.6) * 10;

    /* ---------- açık çekirdeği döndür ---------- */
    this.coreTimer -= dt;
    if (this.coreTimer <= 0){
      this.activeCore = (this.activeCore + 1 + ((Math.random() * 2) | 0)) % this.cores.length;
      this.coreTimer = p2 ? 2.2 : 3.4;
    }

    /* ---------- magma topu ---------- */
    this.fireTimer -= dt;
    if (this.fireTimer <= 0){
      this.fireTimer = p2 ? 1.25 : 2.3;
      const n = p2 ? 3 : 2;
      const ox = this.x + this.w / 2, oy = this.y + this.h * 0.45;
      for (let i = 0; i < n; i++){
        const dx = (player.cx - ox), dy = (player.cy - oy);
        const len = Math.hypot(dx, dy) || 1;
        const spread = (i - (n - 1) / 2) * 0.22;
        const ang = Math.atan2(dy, dx) + spread;
        const sp = p2 ? 260 : 210;
        game.fireballs.push(new Fireball(ox, oy, Math.cos(ang) * sp, Math.sin(ang) * sp - 40, p2 ? 20 : 15));
      }
      Sfx.play('fire');
      game.shake(3, 0.12);
    }

    /* ---------- lav gayzeri (yerden fışkırır) ---------- */
    this.slamTimer -= dt;
    if (this.slamTimer <= 0){
      this.slamTimer = p2 ? 5.5 : 8.5;
      const lavaTop = (this.world.arenaTop + CFG.ARENA_ROWS - 3) * T_;
      for (let i = 0; i < (p2 ? 6 : 4); i++){
        const gx = (6 + Math.random() * (this.world.w - 12)) * T_;
        game.fireballs.push(new Fireball(gx, lavaTop, (Math.random() - .5) * 60, -(420 + Math.random() * 120), 14));
        FX.burst(game.particles, gx, lavaTop, 8, ['#ff6b1f','#ffd23f'], 130, 260, 3, .5);
      }
      game.shake(9, 0.4);
      Sfx.play('quake');
      game.toast('Yer sarsılıyor — lav fışkırıyor!', 'bad');
    }

    /* ---------- mazot varili ---------- */
    this.barrelTimer -= dt;
    if (this.barrelTimer <= 0){
      this.barrelTimer = 24;
      const gx = (5 + Math.random() * (this.world.w - 10)) * T_;
      game.barrels.push(new FuelBarrel(gx, (this.world.arenaTop + 2) * T_));
      game.toast('Yukarıdan bir mazot varili düştü.', 'good');
    }

    /* ---------- oyuncuyla temas ---------- */
    this.checkPlayerContact(player, game);

    /* ---------- faz geçişi ---------- */
    if (this.phase === 1 && this.hp / this.maxHp <= 0.5){
      this.phase = 2;
      game.shake(24, 1.0);
      Sfx.play('roar');
      game.toast('"Bin yıl bekledim usta. Sen kırk yılda kazdın. Teşekkür ederim."', 'bad');
      /* lav yükselir: havuzun bir üst satırı da lava dönüşür */
      const r = this.world.arenaTop + CFG.ARENA_ROWS - 3;
      for (let c = 11; c <= 28; c++) this.world.set(c, r, T.LAVA);
    }
  }

  checkPlayerContact(player, game){
    if (!player.alive) return;
    const cr = this.coreRect();

    /* Açık çekirdeğe matkapla vurmak */
    if (aabb(player.rect, cr) && this.hurtCooldown <= 0){
      this.takeDamage(8, game, player.cx, player.cy);
      this.hurtCooldown = 0.45;
      game.hitStop(0.07);              // isabet anı dursun: vuruş hissedilsin
      /* geri tepme + küçük hasar: vur ve KAÇ */
      const dx = Math.sign(player.cx - (cr.x + cr.w / 2)) || 1;
      player.vx = dx * 320; player.vy = -190;
      player.damage(5, game, null);
      player.invuln = 0.4;
      return;
    }

    /* Gövdeye çarpmak */
    if (aabb(player.rect, this.rect) && player.invuln <= 0){
      const dx = Math.sign(player.cx - (this.x + this.w / 2)) || 1;
      player.vx = dx * 360; player.vy = -220;
      player.damage(this.phase === 2 ? 18 : 13, game, 'Golem çarptı!');
      player.invuln = 0.8;
      game.shake(10, 0.3);
    }
  }

  takeDamage(amount, game, fx, fy){
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.14;
    Sfx.play('bosshit');
    game.floats.push(new FloatText(fx, fy, `-${Math.round(amount)}`, '#35f0e8'));
    FX.burst(game.particles, fx, fy, 10, ['#35f0e8','#ffffff','#ffd23f'], 190, 300, 3, .5);
    game.shake(5, .18);
    if (this.hp <= 0){
      this.dead = true;
      game.onBossDefeated();
    }
  }

  /** Dinamit patlaması golemi vurdu mu? */
  bombHit(bx, by, game){
    const cr = this.coreRect();
    const dCore = Math.hypot(bx - (cr.x + cr.w / 2), by - (cr.y + cr.h / 2));
    const dBody = Math.hypot(bx - (this.x + this.w / 2), by - (this.y + this.h / 2));
    const R = CFG.BOMB_R * CFG.TILE + 40;
    if (dCore < R){
      this.takeDamage(CFG.BOMB_DMG_BOSS * 1.8, game, bx, by);
      game.toast('Tam çekirdeğe! Cabbar Usta gurur duyardı.', 'good');
    } else if (dBody < this.w * 0.8){
      this.takeDamage(CFG.BOMB_DMG_BOSS * 0.45, game, bx, by);
    }
  }

  draw(ctx, cam, t){
    const g = { x: this.x - cam.x, y: this.y - cam.y, w: this.w, h: this.h,
                hp: this.hp, maxHp: this.maxHp, hitFlash: this.hitFlash,
                cores: this.cores, activeCore: this.activeCore };
    Art.drawGolem(ctx, g, t);
  }
}

window.ErlikGolem = ErlikGolem;
