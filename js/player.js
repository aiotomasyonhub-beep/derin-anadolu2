/* ============================================================================
   player.js — KÖSTEBEK-V1 / Davut Usta

   Sorumluluklar:
     • Fizik (yerçekimi, itki, sürtünme, karo çarpışması, düşme hasarı)
     • Kazma (hedef seçimi, delme süresi, grizu, kasa kontrolü)
     • Kaynaklar (mazot, şasi canı, kasa, para, eşyalar)
     • Geliştirme seviyelerinden türeyen istatistikler
   ============================================================================ */

class Player {
  constructor(world){
    this.world = world;
    this.w = 28; this.h = 26;

    /* geliştirme seviyeleri: 1..5 */
    this.upg = { drill:1, tank:1, cargo:1, engine:1, hull:1, radiator:1 };

    this.money = CFG.START_MONEY;
    this.items = { dinamit:1, mazot:1, isinlayici:0, macun:1 };

    this.cargo = {};          // { karoTipi: adet }
    this.cargoCount = 0;

    this.fuel = this.maxFuel;
    this.hull = this.maxHull;

    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.thrust = false;
    this.drilling = false;
    this.drillDir = null;
    this.hurtFlash = 0;
    this.invuln = 0;
    this.dig = null;          // { c, r, need, prog }
    this.alive = true;
    this.deathReason = '';
    this.stats = { maxDepth:0, earned:0, oreMined:0, artifacts:0 };

    this.respawnAtSurface();
  }

  /* ---------------- geliştirmeden türeyen istatistikler ---------------- */
  get lv(){ return this.upg; }
  get maxFuel(){ return UPGRADES.tank.fuel[this.upg.tank - 1]; }
  get maxCargo(){ return UPGRADES.cargo.slots[this.upg.cargo - 1]; }
  get maxHull(){ return UPGRADES.hull.hp[this.upg.hull - 1]; }
  get drillPower(){ return UPGRADES.drill.power[this.upg.drill - 1]; }
  get drillMaxHardness(){ return UPGRADES.drill.maxHardness[this.upg.drill - 1]; }
  get thrustPower(){ return UPGRADES.engine.thrust[this.upg.engine - 1]; }
  get safeDepth(){ return UPGRADES.radiator.safeDepth[this.upg.radiator - 1]; }

  /* ---------------- kargo ağırlığı ----------------
     0 = boş kasa, 1 = tıka basa dolu. Aracın her fiziksel özelliğini etkiler.  */
  get load(){ return this.maxCargo > 0 ? clamp(this.cargoCount / this.maxCargo, 0, 1) : 0; }

  /** Yüke göre gerçek itki.
   *  Ceza ham itkiye değil NET tırmanış ivmesine (thrust - GRAVITY) uygulanır;
   *  böylece dolu kasayla bile araç HER ZAMAN havalanabilir, sadece zorlanır. */
  get effectiveThrust(){
    const net = this.thrustPower - CFG.GRAVITY;
    return CFG.GRAVITY + net * (1 - CFG.LOAD_THRUST_PENALTY * this.load);
  }
  get maxSpeed(){ return CFG.MAX_VX * (1 - CFG.LOAD_SPEED_PENALTY * this.load); }
  get heavy(){ return this.load >= CFG.HEAVY_LOAD_AT; }

  /** Yüzeyden itibaren metre */
  get depth(){
    return Math.max(0, (this.y + this.h - this.world.groundY) / CFG.TILE * CFG.METERS_PER_TILE);
  }
  get cx(){ return this.x + this.w / 2; }
  get cy(){ return this.y + this.h / 2; }
  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }

  respawnAtSurface(){
    this.x = SPAWN_COL * CFG.TILE + (CFG.TILE - this.w) / 2;
    this.y = this.world.groundY - this.h;
    this.vx = 0; this.vy = 0;
    this.dig = null;
  }

  /* ========================================================================
     ÇARPIŞMA YARDIMCILARI
     ======================================================================== */
  /** Dikdörtgenin kapsadığı ilk katı karoyu döndürür (yoksa null). */
  solidHit(x, y){
    const T_ = CFG.TILE, W = this.world;
    const c0 = Math.floor(x / T_), c1 = Math.floor((x + this.w - 1) / T_);
    const r0 = Math.floor(y / T_), r1 = Math.floor((y + this.h - 1) / T_);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (W.isSolid(c, r)) return { c, r };
    return null;
  }

  /** Aracın içinde bulunduğu karoları gez (lav/tehlike kontrolü için). */
  eachOverlappedTile(fn){
    const T_ = CFG.TILE, W = this.world;
    const c0 = Math.floor(this.x / T_), c1 = Math.floor((this.x + this.w - 1) / T_);
    const r0 = Math.floor(this.y / T_), r1 = Math.floor((this.y + this.h - 1) / T_);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        fn(W.get(c, r), c, r);
  }

  /* ========================================================================
     ANA GÜNCELLEME
     ======================================================================== */
  update(dt, input, game){
    if (!this.alive) return;

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    const left  = input.left, right = input.right;
    const up    = input.up,   down  = input.down;
    const slow  = input.slow;                       // SHIFT: yavaş ve güvenli kazma

    /* ---------- yatay hareket ---------- */
    let accel = this.onGround ? CFG.MOVE_ACCEL : CFG.MOVE_ACCEL * 0.55;
    if (left && !right){ this.vx -= accel * dt; this.facing = -1; }
    else if (right && !left){ this.vx += accel * dt; this.facing = 1; }
    else {
      const fr = (this.onGround ? CFG.GROUND_FRICTION : CFG.AIR_FRICTION) * dt;
      this.vx = Math.abs(this.vx) <= fr ? 0 : this.vx - Math.sign(this.vx) * fr;
    }
    this.vx = clamp(this.vx, -this.maxSpeed, this.maxSpeed);

    /* ---------- itki (uçuş) — dolu kasa aracı aşağı çeker ---------- */
    this.thrust = false;
    if (up && this.fuel > 0){
      this.vy -= this.effectiveThrust * dt;
      this.vy = Math.max(this.vy, -400 * (1 - 0.3 * this.load));   // tırmanış hız tavanı
      this.thrust = true;
    }

    /* ---------- yerçekimi ---------- */
    this.vy = Math.min(this.vy + CFG.GRAVITY * dt, CFG.MAX_FALL);

    /* ---------- kazma ---------- */
    this.updateDrill(dt, input, game, slow);

    /* ---------- hareket + çarpışma ---------- */
    this.moveAndCollide(dt, game);

    /* ---------- tehlikeler ---------- */
    this.checkHazards(dt, game);

    /* ---------- yakıt ---------- */
    const moving = Math.abs(this.vx) > 8;
    const loadMul = 1 + CFG.LOAD_FUEL_PENALTY * this.load;
    let burn = CFG.FUEL_IDLE;
    if (this.thrust) burn += CFG.FUEL_FLY * loadMul;      // ağır yükle uçmak pahalı
    else if (moving && this.onGround) burn += CFG.FUEL_DRIVE * loadMul;
    if (this.drilling) burn += CFG.FUEL_DRILL;
    this.fuel = Math.max(0, this.fuel - burn * dt);

    /* ---------- gösterge lambaları (araç sprite'ında yanıp söner) ---------- */
    this.warnCargo = this.cargoCount >= this.maxCargo;
    this.warnFuel  = this.fuel / this.maxFuel < 0.18;
    this.warnHeavy = this.heavy;

    /* ---------- istatistik + ölüm ---------- */
    this.stats.maxDepth = Math.max(this.stats.maxDepth, this.depth);
    if (this.fuel <= 0 && this.depth > 4) this.die(game, 'Mazot bitti. Köstebek-V1 karanlıkta kaldı.');
    if (this.hull <= 0) this.die(game, 'Şasi dağıldı. Köstebek-V1 hurdaya çıktı.');
  }

  /* ========================================================================
     KAZMA MANTIĞI
     ======================================================================== */
  updateDrill(dt, input, game, slow){
    this.drilling = false;
    this.drillDir = null;

    const T_ = CFG.TILE, W = this.world;
    const col = Math.floor(this.cx / T_);
    const bodyRow = Math.floor((this.y + this.h - 3) / T_);
    const footRow = Math.floor((this.y + this.h + 2) / T_);

    let target = null, dir = null;

    /* Aşağı kazmak zemine basmayı gerektirir (Motherload kuralı). */
    if (input.down && this.onGround && W.isSolid(col, footRow)){
      target = { c: col, r: footRow }; dir = 'down';
    } else if (this.onGround && (input.left || input.right)){
      const nc = col + (input.right ? 1 : -1);
      if (W.isSolid(nc, bodyRow)){ target = { c: nc, r: bodyRow }; dir = 'side'; }
    }

    if (!target){ this.dig = null; return; }

    const type = W.get(target.c, target.r);
    const def = TILES[type];

    /* --- delinemez mi? --- */
    if (!W.canDig(target.c, target.r, this.drillMaxHardness)){
      this.dig = null;
      this.drillDir = dir;
      if (type === T.OBSIDIAN || type === T.BEDROCK) game.hint('Bu kaya kırılmıyor. Yol başka yerden.');
      else game.hint(`Matkap yetersiz! (${def.name} — ${UPGRADES.drill.names[this.upg.drill - 1]} kesmiyor)`);
      return;
    }

    /* --- kasa dolu ise madeni kazmayı engelle (maden boşa gitmesin) --- */
    if ((def.ore) && this.cargoCount >= this.maxCargo){
      this.dig = null;
      this.drillDir = dir;
      game.hint('Kasa dolu! Rıza Başkan\'a uğra.');
      return;
    }

    /* --- hedef değiştiyse ilerlemeyi sıfırla --- */
    if (!this.dig || this.dig.c !== target.c || this.dig.r !== target.r){
      const base = def.hardness * 0.55 / this.drillPower;
      this.dig = { c: target.c, r: target.r, need: base, prog: 0 };
    }

    this.drilling = true;
    this.drillDir = dir;

    /* Aşağı kazarken araç sütun ortasına hizalanır ki tünel düzgün açılsın. */
    if (dir === 'down'){
      const want = target.c * T_ + (T_ - this.w) / 2;
      this.x = lerp(this.x, want, Math.min(1, dt * 14));
    }

    const speed = slow ? 0.45 : 1;                // SHIFT: yavaş ama grizu patlatmaz
    this.dig.prog += dt * speed;

    /* kıvılcım ve toz */
    const pal = Art.PAL[type] || Art.PAL[T.DIRT1];
    const fx = dir === 'down' ? this.cx : this.x + (this.facing > 0 ? this.w : 0);
    const fy = dir === 'down' ? this.y + this.h : this.cy;
    if (Math.random() < 0.6) FX.drillSparks(game.particles, fx, fy, pal);

    if (this.dig.prog >= this.dig.need){
      this.completeDig(target.c, target.r, type, slow, game);
      this.dig = null;
    }
  }

  completeDig(c, r, type, slow, game){
    const def = TILES[type];
    this.world.dig(c, r);

    const px_ = c * CFG.TILE + CFG.TILE / 2, py = r * CFG.TILE + CFG.TILE / 2;
    const pal = Art.PAL[type] || Art.PAL[T.DIRT1];
    FX.burst(game.particles, px_, py, 8, [pal[0], pal[1], pal[2]], 130, 620, 3, 0.45);

    /* --- GRİZU: hızlı delinirse patlar (PRD md.4) --- */
    if (def.gas){
      if (slow){
        Sfx.play('item');
        game.toast('Grizu güvenle boşaltıldı. (Yavaş kazma işe yaradı)', 'good');
      } else {
        Sfx.play('grizu');
        const cleared = this.world.blast(c, r, CFG.GAS_BLAST_R);
        FX.burst(game.particles, px_, py, 46, ['#c8ff6b','#7ba83d','#ffd23f','#ffffff'], 300, 260, 4, 0.9);
        game.shake(14, 0.5);
        game.hitStop(0.10);
        this.damage(CFG.GAS_DAMAGE * (1 - (this.upg.hull - 1) * 0.08), game, 'GRİZU PATLAMASI!');
        game.toast('GRİZU! Hızlı delme — patladı. (SHIFT ile yavaş kaz)', 'bad');
      }
      return;
    }

    /* --- hazine --- */
    if (def.artifact){
      this.money += def.value;
      this.stats.earned += def.value;
      this.stats.artifacts++;
      Sfx.play('artifact');
      game.floats.push(new FloatText(px_, py, `+${money(def.value)}`, '#ffd23f'));
      game.shake(6, 0.25);
      /* Hazineler artık sadece para değil: her biri dedenin dağılmış
         defterinden bir sayfa. Telsiz kanalında okunur. */
      const frag = STORY.nextTablet();
      UI.radio(frag.t.toLocaleUpperCase('tr-TR'), frag.x, this.depth > 5000 ? 2 : 1);
      Sfx.play('radio', 1);
      return;
    }

    /* --- maden --- */
    if (def.ore){
      this.cargo[type] = (this.cargo[type] || 0) + 1;
      this.cargoCount++;
      this.stats.oreMined++;
      Sfx.play('ore', def.value);
      /* Maden HUD'daki kasa barına uçar: "sayı arttı" geri bildiriminin en
         tatmin edici biçimi. Adı yalnızca kayda değer madenlerde yazılır,
         yoksa ekran her karoda metinle dolar. */
      game.spawnPickup(px_, py, Art.PAL[type][2]);
      if (def.value >= 400)
        game.floats.push(new FloatText(px_, py, def.name, Art.PAL[type][3]));
    } else {
      Sfx.play('dig');
    }
  }

  /* ========================================================================
     HAREKET + ÇARPIŞMA
     ======================================================================== */
  moveAndCollide(dt, game){
    const T_ = CFG.TILE;

    /* --- X ekseni --- */
    this.x += this.vx * dt;
    let hit = this.solidHit(this.x, this.y);
    if (hit){
      this.x = this.vx > 0 ? hit.c * T_ - this.w : (hit.c + 1) * T_;
      this.vx = 0;
    }
    this.x = clamp(this.x, T_, (this.world.w - 1) * T_ - this.w);

    /* --- Y ekseni --- */
    this.y += this.vy * dt;
    hit = this.solidHit(this.x, this.y);
    this.onGround = false;
    if (hit){
      if (this.vy > 0){
        this.y = hit.r * T_ - this.h;
        this.onGround = true;
        /* --- düşme hasarı --- */
        if (this.vy > CFG.FALL_DAMAGE_MIN){
          /* Ağır yük çarpmayı sertleştirir — dolu kasayla dalmak risk almaktır. */
          const dmg = (this.vy - CFG.FALL_DAMAGE_MIN) * CFG.FALL_DAMAGE_MUL
                    * (1 + CFG.LOAD_FALL_PENALTY * this.load);
          Sfx.play('thud');
          this.damage(dmg, game, this.heavy ? 'Sert iniş! (yük ağır)' : 'Sert iniş!');
          game.shake(Math.min(12, dmg * 0.5), 0.25);
          if (dmg > 12) game.hitStop(0.06);
          FX.burst(game.particles, this.cx, this.y + this.h, 10, ['#7a5030','#96663f'], 150, 700, 3, 0.4);
        }
      } else {
        this.y = (hit.r + 1) * T_;
      }
      this.vy = 0;
    }
    this.y = Math.max(0, this.y);

    /* zemine basma toleransı (kazma için gerekli) */
    if (!this.onGround){
      const probe = this.solidHit(this.x, this.y + 2);
      if (probe && this.vy >= 0){ this.onGround = true; }
    }
  }

  /* ========================================================================
     TEHLİKELER
     ======================================================================== */
  checkHazards(dt, game){
    /* --- lav --- */
    let inLava = false;
    this.eachOverlappedTile(t => { if (TILES[t] && TILES[t].lava) inLava = true; });
    if (inLava){
      this.damage(CFG.LAVA_DPS * dt, game, null);
      if (Math.random() < 0.4)
        FX.burst(game.particles, this.cx, this.cy, 2, ['#ff6b1f','#ffd23f'], 90, -60, 3, 0.5);
      if (this.hurtFlash <= 0) this.hurtFlash = 0.12;
    }

    /* --- derinlik sıcaklığı (radyatör yetmezse) --- */
    const over = this.depth - this.safeDepth;
    if (over > 0){
      this.damage((over / 1000) * CFG.HEAT_DPS_PER_KM * dt, game, null);
      game.heatWarning = true;
    } else game.heatWarning = false;
  }

  /* ========================================================================
     HASAR / ÖLÜM
     ======================================================================== */
  damage(amount, game, label){
    if (amount <= 0 || !this.alive) return;
    this.hull = Math.max(0, this.hull - amount);
    this.hurtFlash = 0.18;
    if (label){
      Sfx.play('hit');
      game.floats.push(new FloatText(this.cx, this.y, `-${Math.round(amount)}`, '#ff4438'));
      game.toast(label, 'bad');
    }
    if (this.hull <= 0) this.die(game, 'Şasi dağıldı. Köstebek-V1 hurdaya çıktı.');
  }

  die(game, reason){
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = reason;
    FX.burst(game.particles, this.cx, this.cy, 60, ['#ff6b1f','#ffd23f','#c2571f','#ffffff'], 320, 420, 4, 1.1);
    game.shake(20, 0.7);
    game.onDeath();
  }

  /* ========================================================================
     KAYNAK İŞLEMLERİ
     ======================================================================== */
  addFuel(l){ this.fuel = Math.min(this.maxFuel, this.fuel + l); }
  repair(hp){ this.hull = Math.min(this.maxHull, this.hull + hp); }

  cargoValue(){
    let sum = 0;
    for (const k in this.cargo) sum += (TILES[k].value || 0) * this.cargo[k];
    return sum;
  }
  sellAll(){
    const total = this.cargoValue();
    this.money += total;
    this.stats.earned += total;
    this.cargo = {}; this.cargoCount = 0;
    return total;
  }

  /* --- eşya kullanımı (1-4 tuşları) --- */
  useItem(key, game){
    if (!this.items[key] || this.items[key] <= 0){
      Sfx.play('error');
      game.toast('O eşyadan yok. Bakkala uğra.', 'bad'); return;
    }

    switch (key){
      case 'dinamit': {
        this.items.dinamit--;
        game.bombs.push(new Bomb(this.cx - 5, this.cy));
        Sfx.play('fuse');
        game.toast('Dinamit bırakıldı — kaç!', 'bad');
        break;
      }
      case 'mazot': {
        if (this.fuel >= this.maxFuel - 1){ Sfx.play('error'); game.toast('Depo zaten dolu.'); return; }
        this.items.mazot--;
        this.addFuel(60);
        Sfx.play('item');
        game.floats.push(new FloatText(this.cx, this.y, '+60 L', '#ffd23f'));
        break;
      }
      case 'isinlayici': {
        this.items.isinlayici--;
        this.respawnAtSurface();
        Sfx.play('teleport');
        game.shake(10, 0.4);
        FX.burst(game.particles, this.cx, this.cy, 40, ['#35f0e8','#ffffff','#3d7bff'], 260, 0, 4, 0.8);
        game.toast('ASELSAN ışınlayıcısı çalıştı. Yüzeydesin.', 'good');
        break;
      }
      case 'macun': {
        if (this.hull >= this.maxHull - 1){ Sfx.play('error'); game.toast('Şasi zaten sapasağlam.'); return; }
        this.items.macun--;
        this.repair(70);
        Sfx.play('item');
        game.floats.push(new FloatText(this.cx, this.y, '+70 CAN', '#5ddc6a'));
        break;
      }
    }
  }

  /* --- kayıt --- */
  toJSON(){
    return {
      x:this.x, y:this.y, upg:this.upg, money:this.money, items:this.items,
      cargo:this.cargo, cargoCount:this.cargoCount, fuel:this.fuel, hull:this.hull,
      stats:this.stats,
    };
  }
  fromJSON(d){
    Object.assign(this, {
      x:d.x, y:d.y, upg:d.upg, money:d.money, items:d.items,
      cargo:d.cargo, cargoCount:d.cargoCount, fuel:d.fuel, hull:d.hull,
    });
    if (d.stats) this.stats = d.stats;
    this.alive = true; this.vx = 0; this.vy = 0; this.dig = null;
  }
}

window.Player = Player;
