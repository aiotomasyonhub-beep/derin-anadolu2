/* ============================================================================
   game.js — ANA KONTROLCÜ
     • durum makinesi (title / play / gameover / ending)
     • girdi, kamera, render, olaylar (deprem, dinamit, boss tetikleyici)
     • kayıt / yükleme
   ============================================================================ */

class Game {
  constructor(){
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.resizeCanvas();
    addEventListener('resize', () => this.resizeCanvas());
    addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 120));

    this.state = 'title';      // title | play | dying | gameover | ending
    this.modal = null;         // açık modalın kimliği (ESC davranışı için)
    this.paused = false;
    this.t = 0;
    this.cam = { x:0, y:0 };
    this.shakeMag = 0; this.shakeTime = 0;
    this.heatWarning = false;

    this.particles = []; this.floats = []; this.pickups = [];
    this.bombs = []; this.fireballs = []; this.barrels = [];
    this.wreck = null;           // aynı anda yalnızca BİR enkaz olabilir
    this.hitStopT = 0;
    this.cargoAnchor = { x: 120, y: 60 };
    this.boss = null; this.bossIntroShown = false; this.bossDefeated = false;
    this.endingTimer = 0;

    this.quakeTimer = rand(Math.random, CFG.QUAKE_MIN, CFG.QUAKE_MAX);
    this.autosaveTimer = 0;
    this.nearBuilding = null;
    this.storyIndex = 0;         // sıradaki telsiz mesajı (kayda yazılır)

    this.input = { left:false, right:false, up:false, down:false, slow:false };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.fuelWarnTimer = 0;
    this.bindInput();
    this.bindTouch();
    this.bindAudioUnlock();

    UI.init();
    this.showTitle();

    this.last = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  /* ==================================================== ÇÖZÜNÜRLÜK ======= */
  /** Canvas'ın İÇ çözünürlüğünü kabın gerçek en-boy oranına uyarlar.
   *  Kural: kısa kenar daima ~360 mantıksal piksel. Böylece
   *    • masaüstü 16:9  → 640x360  (piksel başına 2 ekran pikseli)
   *    • yatay telefon  → 760x360
   *    • dikey telefon  → 360x700  (madencilikte dikey görüş avantaj)
   *  Piksel boyu her durumda yaklaşık aynı kalır; oyun "zoom"lanmış hissettirmez. */
  resizeCanvas(){
    const box = document.getElementById('screen').getBoundingClientRect();
    if (!box.width || !box.height) return;
    const aspect = box.width / box.height;
    const SHORT = 360;
    let w, h;
    if (aspect >= 1){ h = SHORT; w = Math.round(h * aspect); }
    else            { w = SHORT; h = Math.round(w / aspect); }
    w = clamp(Math.round(w / 2) * 2, 320, 800);
    h = clamp(Math.round(h / 2) * 2, 300, 760);

    if (w === CFG.VIEW_W && h === CFG.VIEW_H && this.canvas.width === w){ this.computeHudAnchors(); return; }
    CFG.VIEW_W = w; CFG.VIEW_H = h;
    this.canvas.width = w; this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.computeHudAnchors();
  }

  /** HUD DOM katmanında; toplanan madenin uçacağı kasa barının konumunu
   *  canvas koordinatına çevirir. Ekran boyutu değişince yeniden hesaplanır. */
  computeHudAnchors(){
    const box = document.getElementById('screen').getBoundingClientRect();
    const bar = document.getElementById('cargoBar').getBoundingClientRect();
    if (!box.width || !bar.width) return;
    this.cargoAnchor = {
      x: (bar.left + bar.width / 2 - box.left) / box.width  * CFG.VIEW_W,
      y: (bar.top  + bar.height / 2 - box.top) / box.height * CFG.VIEW_H,
    };
  }

  /* ======================================================== GİRDİ ======== */
  bindInput(){
    const map = {
      ArrowLeft:'left', KeyA:'left',
      ArrowRight:'right', KeyD:'right',
      ArrowUp:'up', KeyW:'up',
      ArrowDown:'down', KeyS:'down',
      ShiftLeft:'slow', ShiftRight:'slow',
    };
    addEventListener('keydown', e => {
      if (map[e.code]){ this.input[map[e.code]] = true; e.preventDefault(); }
      if (e.code === 'Space') e.preventDefault();
      if (this.state !== 'play') return;

      if (e.code === 'KeyE') this.tryEnterBuilding();
      if (e.code === 'Escape'){
        /* Boss girişi gibi "kapatılamaz" modallar ESC ile atlanamaz. */
        if (Shops.current) Shops.close(this);
        else if (this.modal === 'pause') this.closeMenu();
        else if (!UI.panelOpen) this.openPauseMenu();
      }
      const itemKeys = { Digit1:'dinamit', Digit2:'mazot', Digit3:'isinlayici', Digit4:'macun' };
      if (itemKeys[e.code] && !this.paused && this.player && this.player.alive)
        this.player.useItem(itemKeys[e.code], this);
    });
    addEventListener('keyup', e => { if (map[e.code]) this.input[map[e.code]] = false; });
    addEventListener('blur', () => {
      for (const k in this.input) this.input[k] = false;
      Sfx.stopLoops();
    });
    /* Sekme arka plana geçince sesler askıda kalmasın */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden){
        for (const k in this.input) this.input[k] = false;
        Sfx.stopLoops();
      }
    });
  }

  /* ==================================================== DOKUNMATİK ======= */
  bindTouch(){
    const layer = document.getElementById('touch');
    if (this.isTouch) layer.classList.remove('hidden');

    /* Her düğme kendi pointer'ını yakalar → çok parmakla aynı anda basılabilir
       (sola git + kaz + uç gibi kombinasyonlar şart). */
    layer.querySelectorAll('.tbtn').forEach(btn => {
      const k = btn.dataset.k;
      const down = e => {
        e.preventDefault();
        btn.classList.add('held');
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        if (k === 'E'){ this.tryEnterBuilding(); return; }
        this.input[k] = true;
      };
      const up = e => {
        btn.classList.remove('held');
        if (k !== 'E') this.input[k] = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    /* HUD'daki eşya kutuları dokunmatikte doğrudan kullanılır */
    document.querySelectorAll('#itembar .item').forEach(el => {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (this.state !== 'play' || this.paused || !this.player || !this.player.alive) return;
        this.player.useItem(el.dataset.item, this);
      });
    });

    /* Sistem düğmeleri */
    const bs = document.getElementById('btnSound');
    bs.classList.toggle('off', Sfx.isMuted());
    bs.addEventListener('click', () => {
      Sfx.ensure();
      bs.classList.toggle('off', Sfx.toggleMute());
    });
    document.getElementById('btnPause').addEventListener('click', () => {
      if (this.state !== 'play') return;
      if (UI.panelOpen){ if (this.modal === 'pause') this.closeMenu(); }
      else this.openPauseMenu();
    });
  }

  /** Ses bağlamı ancak kullanıcı etkileşiminden sonra açılabilir. */
  bindAudioUnlock(){
    const unlock = () => { Sfx.ensure(); };
    addEventListener('pointerdown', unlock, { capture:true });
    addEventListener('keydown', unlock, { capture:true });
    /* Panel düğmelerine tıklama sesi (olay delegasyonu) */
    document.addEventListener('click', e => {
      if (e.target.closest('button')) Sfx.play('click');
    }, true);
  }

  tryEnterBuilding(){
    if (this.state !== 'play' || this.paused || !this.nearBuilding) return;
    this.save();
    Shops.open(this.nearBuilding.id, this);
  }

  /* ==================================================== YARDIMCILAR ====== */
  toast(m, k){ UI.toast(m, k); }
  hint(m){ UI.hint(m); }
  shake(mag, time){ this.shakeMag = Math.max(this.shakeMag, mag); this.shakeTime = Math.max(this.shakeTime, time); }

  /** Darbe anında oyunu birkaç kare dondurur. Aynı hasar, çok daha tok his.
   *  Maden toplamada ÇAĞIRILMAZ; kazma akışını kekeme yapar. */
  hitStop(s){ this.hitStopT = Math.min(CFG.HITSTOP_MAX, Math.max(this.hitStopT, s)); }

  /** Kazılan maden HUD'daki kasa barına doğru uçar. */
  spawnPickup(wx, wy, color){
    this.pickups.push(new Pickup(
      wx - this.cam.x, wy - this.cam.y,
      this.cargoAnchor.x, this.cargoAnchor.y,
      color, () => UI.pulseCargo()
    ));
  }

  /* ================================================ OYUN BAŞLATMA ======== */
  newGame(seed){
    this.world = new World(seed !== undefined ? seed : (Math.random() * 1e9) | 0);
    this.player = new Player(this.world);
    this.storyIndex = 0;
    STORY._tabletIndex = 0;
    this.resetRuntime();
    this.state = 'play';
    this.paused = false; this.modal = null;
    UI.showHUD(true);
    UI.closePanel();
    this.save();
    this.toast('Davut Usta: "Bismillah. Köstebek çalışıyor."', 'good');
  }

  resetRuntime(){
    this.particles.length = 0; this.floats.length = 0; this.pickups.length = 0;
    this.bombs.length = 0; this.fireballs.length = 0; this.barrels.length = 0;
    this.boss = null; this.bossIntroShown = false;
    this.endingTimer = 0;
    this.shakeMag = 0; this.shakeTime = 0; this.hitStopT = 0;
    this.wreck = null;              // yüklemede kayıttan geri konur
  }

  /* ======================================================== KAYIT ======== */
  save(){
    if (!this.world || !this.player || !this.player.alive) return;
    try {
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
        seed: this.world.seed,
        dug: this.world.serializeDug(),
        player: this.player.toJSON(),
        bossDefeated: this.bossDefeated,
        wreck: this.wreckToJSON(),
        storyIndex: this.storyIndex,
        tabletIndex: STORY._tabletIndex,
      }));
    } catch (e){ /* kota dolu olabilir — oyunu durdurmaz */ }
  }

  wreckToJSON(){
    const w = this.wreck;
    return w ? { x:w.x, y:w.y, cargo:w.cargo, cargoCount:w.cargoCount, depth:w.depth } : null;
  }

  /** ÖLÜM ANINDA çağrılır. Oyuncu son kayda geri döneceği için enkazı
   *  doğrudan diskteki kayda yamamak gerekir — yoksa yükleme onu siler. */
  patchSavedWreck(){
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      d.wreck = this.wreckToJSON();
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(d));
    } catch (e){ /* yoksay */ }
  }
  hasSave(){ try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch(e){ return false; } }
  /** Bozuk/eski kayıt oyunu kilitlememeli: tüm yükleme tek bir try/catch
   *  içinde, hata hâlinde kayıt silinip false dönülür (çağıran yeni oyun açar). */
  load(){
    let d;
    try { d = JSON.parse(localStorage.getItem(CFG.SAVE_KEY)); } catch(e){ d = null; }
    if (!d || typeof d.seed !== 'number' || !d.player) return this.dropBadSave(!!d);

    try {
      this.world = new World(d.seed);
      this.world.applyDug(Array.isArray(d.dug) ? d.dug : []);
      this.player = new Player(this.world);
      this.player.fromJSON(d.player);
      this.bossDefeated = !!d.bossDefeated;
      this.storyIndex = d.storyIndex || 0;
      STORY._tabletIndex = d.tabletIndex || 0;
      this.resetRuntime();
      if (d.wreck){
        const k = d.wreck;
        this.wreck = new Wreck(k.x, k.y, k.cargo || {}, k.cargoCount || 0, k.depth || 0);
      }
    } catch (e){ return this.dropBadSave(true); }

    this.state = 'play'; this.paused = false; this.modal = null;
    UI.showHUD(true); UI.closePanel();
    this.toast('Son kayıttan devam ediliyor.', 'good');
    return true;
  }

  dropBadSave(existed){
    if (existed){
      try { localStorage.removeItem(CFG.SAVE_KEY); } catch(e){}
      this.toast('Kayıt okunamadı, yeni sefer açılıyor.', 'bad');
    }
    return false;
  }

  /* ======================================================== DÖNGÜ ======== */
  /* YAYIN SERTLEŞTİRMESİ: tek bir karede atılan istisna, requestAnimationFrame
     zincirini kopardığı için oyunu KALICI olarak dondurur — oyuncunun gördüğü
     tek şey donmuş bir ekrandır. Bu yüzden kare gövdesi try/catch içinde ve
     zincir her hâlükârda devam eder. Hata bir kez bildirilir, sonra susulur
     (her karede toast göstermek ekranı çöpe çevirir). */
  loop(now){
    try {
      this.frame(now);
    } catch (err){
      this.errorCount = (this.errorCount || 0) + 1;
      if (this.errorCount === 1){
        this.toast('Bir aksaklık oldu ama oyun devam ediyor.', 'bad');
        if (window.console) console.error('[Derin Anadolu]', err);
      }
    }
    requestAnimationFrame(this.loop.bind(this));
  }

  frame(now){
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, 0.05);          // sekme arka plana atılırsa fiziği patlatma
    this.t += dt;

    /* --- HIT-STOP: simülasyon donar, çizim sürer (sarsıntı titremeye devam
       eder, patlama karesi ekranda asılı kalır). --- */
    if (this.hitStopT > 0){
      this.hitStopT -= dt;
      this.render();
      return;
    }

    if (this.state === 'play' && !this.paused) this.update(dt);
    else if (this.state === 'dying'){
      /* Patlama animasyonu bitene kadar sadece efektler akar. */
      this.updateEntities(dt);
      if (this.shakeTime > 0){ this.shakeTime -= dt; if (this.shakeTime <= 0) this.shakeMag = 0; }
    }
    this.render();
  }

  update(dt){
    const p = this.player, w = this.world;

    p.update(dt, this.input, this);

    /* ---------- kamera ---------- */
    const targetX = clamp(p.cx - CFG.VIEW_W / 2, 0, w.w * CFG.TILE - CFG.VIEW_W);
    const targetY = clamp(p.cy - CFG.VIEW_H / 2, 0, w.h * CFG.TILE - CFG.VIEW_H);
    this.cam.x = lerp(this.cam.x, targetX, Math.min(1, dt * 9));
    this.cam.y = lerp(this.cam.y, targetY, Math.min(1, dt * 9));

    if (this.shakeTime > 0){ this.shakeTime -= dt; if (this.shakeTime <= 0) this.shakeMag = 0; }

    /* ---------- yüzey mekânları ---------- */
    this.nearBuilding = null;
    if (p.depth < 30 && p.onGround){
      for (const b of BUILDINGS){
        const bx = b.col * CFG.TILE, bw = b.w * CFG.TILE;
        if (p.cx > bx - 10 && p.cx < bx + bw + 10){ this.nearBuilding = b; break; }
      }
    }
    UI.prompt(this.nearBuilding && !this.isTouch ? `E — ${this.nearBuilding.title}` : null);
    if (this.isTouch)
      document.getElementById('tbtnE').classList.toggle('hidden', !this.nearBuilding);

    this.updateAudio(dt);

    /* ---------- otomatik kayıt (yüzeyde) ---------- */
    this.autosaveTimer -= dt;
    if (p.depth < 20 && p.onGround && this.autosaveTimer <= 0){
      this.autosaveTimer = 6; this.save();
    }

    /* ---------- deprem (6000-9000 m, PRD md.4) ---------- */
    if (p.depth > 6000 && p.depth < 9200 && !this.boss){
      this.quakeTimer -= dt;
      if (this.quakeTimer <= 0){
        this.quakeTimer = rand(Math.random, CFG.QUAKE_MIN, CFG.QUAKE_MAX);
        this.triggerQuake();
      }
    }

    this.checkStory();
    this.updateEntities(dt);
    this.checkBossTrigger();
    if (this.boss) this.boss.update(dt, p, this);

    /* ---------- final sekansı ---------- */
    if (this.endingTimer > 0){
      this.endingTimer -= dt;
      this.shake(18, 0.3);
      if (Math.random() < 0.5)
        FX.burst(this.particles, this.cam.x + Math.random() * CFG.VIEW_W,
                 this.cam.y + Math.random() * CFG.VIEW_H, 3, ['#ff6b1f','#ffd23f','#2a2230'], 150, 320, 4, .7);
      if (this.endingTimer <= 0) this.showEnding();
    }

    UI.updateHUD(p, this);
  }

  /* ========================================================= SES ========= */
  /** Sürekli döngüleri oyuncunun durumuna bağlar, fon müziğini derinliğe göre
      seçer ve mazot kritikken uyarı bipini çalar. */
  updateAudio(dt){
    const p = this.player;
    const rolling = p.onGround && Math.abs(p.vx) > 12;

    Sfx.setLoop('drill',  p.alive && p.drilling, p.upg.drill);
    Sfx.setLoop('thrust', p.alive && p.thrust,   p.upg.engine);
    Sfx.setLoop('tread',  p.alive && rolling && !p.drilling);
    /* Rölanti yalnızca makine boştayken duyulur: kazarken/uçarken/yürürken susar */
    Sfx.setLoop('idle',   p.alive && p.onGround && !p.drilling && !p.thrust && !rolling);

    /* Matkap çalışırken müzik kısılır — ikisi aynı frekans bandında boğuşuyor. */
    Sfx.ducking(p.alive && (p.drilling || p.thrust));

    /* Maden şaftı yankısı derinlikle açılır: yüzeyde kuru, dipte mağara. */
    Sfx.setSpace(clamp(p.depth / 7000, 0, 1));

    /* --- fon müziği --- */
    let track;
    if (this.boss && !this.boss.dead) track = 'boss';
    else if (p.depth < 60) track = 'surface';
    else if (p.depth < 5000) track = 'underground';
    else track = 'deep';
    Sfx.setTrack(track);

    /* --- MAZOT ALARMI: kalan yakıt azaldıkça hızlanan nabız ---
       Sabit tempolu bir bip fon gürültüsüne dönüşür ve oyuncu onu duymamayı
       öğrenir. Hızlanan tempo ise kalp atışı gibi çalışır: %20'de 2 saniyede
       bir, damla damla bitiyorken neredeyse kesintisiz. Tempoyu DERİNLİĞE
       değil KALAN YAKITA bağladım — tükenen şey o. */
    const fuelRatio = p.fuel / p.maxFuel;
    if (p.alive && fuelRatio < 0.20 && p.depth > 30){
      this.fuelWarnTimer -= dt;
      if (this.fuelWarnTimer <= 0){
        this.fuelWarnTimer = lerp(0.32, 2.0, clamp(fuelRatio / 0.20, 0, 1));
        Sfx.play('fuelWarn');
      }
    } else this.fuelWarnTimer = 0;
  }

  /* ================================================== VARLIK GÜNCELLEME == */
  updateEntities(dt){
    const p = this.player, w = this.world;

    this.particles = this.particles.filter(x => x.update(dt));
    this.floats    = this.floats.filter(x => x.update(dt));
    this.pickups   = this.pickups.filter(x => x.update(dt));

    /* --- enkaz: dur, bekle, kurtarılmayı iste --- */
    if (this.wreck){
      this.wreck.update(dt, w);
      if (p.alive && aabb(p.rect, this.wreck)) this.recoverWreck();
    }

    /* --- dinamitler --- */
    this.bombs = this.bombs.filter(b => {
      const alive = b.update(dt, w);
      if (!alive) this.explodeBomb(b);
      return alive;
    });

    /* --- magma topları --- */
    this.fireballs = this.fireballs.filter(f => {
      const alive = f.update(dt, w);
      if (!alive) return false;
      if (p.alive && p.invuln <= 0 && aabb(p.rect, { x:f.x, y:f.y, w:f.w, h:f.h })){
        p.damage(f.dmg, this, 'Magma topu yedin!');
        p.invuln = 0.5;
        FX.burst(this.particles, f.x, f.y, 14, ['#ff6b1f','#ffd23f'], 200, 300, 3, .5);
        return false;
      }
      return true;
    });

    /* --- mazot varilleri --- */
    this.barrels = this.barrels.filter(b => {
      b.update(dt, w);
      if (p.alive && aabb(p.rect, b)){
        p.addFuel(b.amount);
        this.floats.push(new FloatText(b.x, b.y, `+${b.amount} L`, '#ffd23f'));
        return false;
      }
      return true;
    });
  }

  /* ======================================================== ENKAZ ======== */
  /** Ölüm anında topladığın her şey oraya düşer. Tek enkaz kuralı: yeni ölüm
   *  eskisini siler, yoksa harita bedava para tarlasına döner. */
  createWreck(){
    const p = this.player;
    if (p.cargoCount <= 0) return;
    const replaced = !!this.wreck;
    this.wreck = new Wreck(p.cx - 15, p.y, { ...p.cargo }, p.cargoCount, Math.round(p.depth));
    this.patchSavedWreck();
    if (replaced)
      this.toast('Önceki enkazın kayboldu. Aynı anda tek enkaz taşınabilir.', 'bad');
  }

  /** Oyuncu enkaza dokundu: sığdığı kadarını al, kalanı enkazda kalsın. */
  recoverWreck(){
    const p = this.player, w = this.wreck;
    const rest = {};
    let taken = 0, left = 0;

    /* Sığdığı kadarını al; kalanı enkazda bekler — kasası küçük oyuncu iki
       sefer gelmek zorunda kalır, bu da kasa yükseltmesini anlamlı kılar. */
    for (const k in w.cargo){
      let n = w.cargo[k];
      while (n > 0 && p.cargoCount < p.maxCargo){
        p.cargo[k] = (p.cargo[k] || 0) + 1;
        p.cargoCount++; n--; taken++;
      }
      if (n > 0){ rest[k] = n; left += n; }
    }

    if (taken === 0){
      this.hint('Kasan dolu — enkazdan bir şey alamıyorsun.');
      return;
    }

    FX.burst(this.particles, w.x + 15, w.y, 24, ['#35f0e8','#ffd23f','#ffffff'], 210, 200, 3, 0.8);
    Sfx.play('artifact');
    this.shake(6, 0.2);

    if (left > 0){
      w.cargo = rest; w.cargoCount = left;
      this.toast(`${taken} birim kurtarıldı, ${left} birim enkazda kaldı.`, 'good');
    } else {
      this.wreck = null;
      this.toast('Enkaz kurtarıldı! Köstebek\'in yükü geri sende.', 'good');
    }
    this.save();
  }

  /** Rıza Başkan enkazı uzaktan satın alır (hurda sigortası). */
  sellWreckInsurance(){
    if (!this.wreck) return 0;
    const paid = Math.floor(this.wreck.value * CFG.WRECK_INSURANCE);
    this.player.money += paid;
    this.player.stats.earned += paid;
    this.wreck = null;
    this.save();
    return paid;
  }

  explodeBomb(b){
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const c = Math.floor(cx / CFG.TILE), r = Math.floor(cy / CFG.TILE);

    this.world.blast(c, r, CFG.BOMB_R);
    FX.burst(this.particles, cx, cy, 50, ['#ffd23f','#ff6b1f','#c22a00','#ffffff'], 340, 300, 4, .95);
    this.shake(16, .5);
    this.hitStop(0.09);
    Sfx.play('explosion');

    const p = this.player;
    const d = Math.hypot(p.cx - cx, p.cy - cy);
    const R = (CFG.BOMB_R + 1) * CFG.TILE;
    if (d < R && p.alive){
      p.damage(CFG.BOMB_DMG_SELF * (1 - d / R), this, 'Dinamite fazla yaklaştın!');
      p.vx += Math.sign(p.cx - cx || 1) * 280;
      p.vy -= 160;
    }
    if (this.boss && !this.boss.dead) this.boss.bombHit(cx, cy, this);
  }

  triggerQuake(){
    this.shake(22, 1.2);
    Sfx.play('quake');
    this.toast('DEPREM! Tavan oynuyor, dikkat et Davut!', 'bad');
    const p = this.player;
    p.damage(CFG.QUAKE_DAMAGE, this, null);
    /* Tavandan taş dökülür: oyuncunun üstündeki boş karolara toz parçacığı */
    for (let i = 0; i < 24; i++){
      FX.burst(this.particles, p.cx + (Math.random() - .5) * 320, p.cy - 120 - Math.random() * 120,
               2, ['#3f3f4c','#575767','#2a2a33'], 40, 520, 3, 1.1);
    }
  }

  /* ======================================================== ANLATI ======= */
  /** Telsiz mesajları EN DERİN noktaya göre tetiklenir; aşağı-yukarı gidip
   *  gelmek aynı mesajı tekrarlatmaz. Sıra kayda yazılır (storyIndex). */
  checkStory(){
    const s = STORY.radio[this.storyIndex];
    if (!s || this.player.stats.maxDepth < s.d) return;
    this.storyIndex++;
    UI.radio(s.who, s.text, s.s);
    Sfx.play('radio', s.s);
  }

  /* ================================================== BOSS TETİKLEYİCİ === */
  checkBossTrigger(){
    if (this.boss || this.bossDefeated || this.bossIntroShown) return;
    const arenaY = this.world.arenaTop * CFG.TILE;
    if (this.player.y + this.player.h > arenaY + 8){
      this.bossIntroShown = true;
      this.showBossIntro();
    }
  }

  startBossFight(){
    this.boss = new ErlikGolem(this.world);
    this.paused = false; this.modal = null;
    this.player.invuln = 1.6;         // sahneye iniş için kısa dokunulmazlık
    UI.closePanel();
    this.shake(26, 1.2);
    Sfx.play('roar');
    UI.setBossName('ŞEYTAN');
    this.toast('MÜHÜR KIRILDI. Dinamitlerini boşa harcama!', 'bad');
  }

  onBossDefeated(){
    this.bossDefeated = true;
    this.fireballs.length = 0;
    this.toast('Suret dağılıyor... SANDIĞI YERİNE OTURT! Işınlayıcı otomatik devrede!', 'good');
    this.shake(30, 2);
    this.hitStop(0.14);
    Sfx.play('roar');
    Sfx.play('explosion');
    this.endingTimer = 3.2;
  }

  onDeath(){
    this.state = 'dying';
    UI.prompt(null);
    this.createWreck();          // kargo öldüğün yerde kalır
    this.hitStop(0.14);
    Sfx.play('death');
    Sfx.stopLoops();
    setTimeout(() => this.showGameOver(), 1100);
  }

  /* ======================================================== RENDER ======= */
  render(){
    const ctx = this.ctx, W = CFG.VIEW_W, H = CFG.VIEW_H;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'title' || !this.world){ this.renderTitleBg(ctx); return; }

    /* --- sarsıntı --- */
    const sx = this.shakeTime > 0 ? (Math.random() - .5) * this.shakeMag : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - .5) * this.shakeMag : 0;
    const cam = { x: this.cam.x + sx, y: this.cam.y + sy };

    const w = this.world, T_ = CFG.TILE;
    const groundScreenY = w.groundY - cam.y;

    /* --- gökyüzü (yüzey görünürse) --- */
    if (groundScreenY > 0) Art.drawSky(ctx, cam.x, groundScreenY, this.t);

    /* --- karolar --- */
    const c0 = Math.max(0, Math.floor(cam.x / T_));
    const c1 = Math.min(w.w - 1, Math.floor((cam.x + W) / T_));
    const r0 = Math.max(0, Math.floor(cam.y / T_));
    const r1 = Math.min(w.h - 1, Math.floor((cam.y + H) / T_));

    for (let r = r0; r <= r1; r++){
      const depth = w.depthOfRow(r);
      /* Arenanın arka planı lav ışığıyla yıkanmış koyu bordodur. */
      const bg = r >= w.arenaTop ? '#1d0a12' : Art.undergroundBg(Math.max(0, depth));
      for (let c = c0; c <= c1; c++){
        const t = w.get(c, r);
        const dx = (c * T_ - cam.x) | 0, dy = (r * T_ - cam.y) | 0;
        if (r >= w.skyRows){                       // kazılmış boşluğun arka duvarı
          ctx.fillStyle = bg;
          ctx.fillRect(dx, dy, T_, T_);
        }
        if (t === T.EMPTY) continue;
        ctx.drawImage(Art.tile(t, w.variant[w.idx(c, r)]), dx, dy);

        /* Kenar ışığı: sadece komşusu BOŞ olan yüzlere. Böylece açılmış tünelin
           ağzı belirginleşir, dolu kütle içinde ızgara çizgisi oluşmaz. */
        const ep = Art.edgePal(t);
        if (w.get(c, r - 1) === T.EMPTY){ ctx.fillStyle = ep[3]; ctx.fillRect(dx, dy, T_, 2); }
        if (w.get(c, r + 1) === T.EMPTY){ ctx.fillStyle = ep[0]; ctx.fillRect(dx, dy + T_ - 2, T_, 2); }
        if (w.get(c - 1, r) === T.EMPTY){ ctx.fillStyle = ep[2]; ctx.fillRect(dx, dy, 2, T_); }
        if (w.get(c + 1, r) === T.EMPTY){ ctx.fillStyle = ep[0]; ctx.fillRect(dx + T_ - 2, dy, 2, T_); }

        if (t === T.LAVA){                          // lav yüzeyi kaynama animasyonu
          ctx.fillStyle = 'rgba(255,210,63,.35)';
          const bob = Math.sin(this.t * 3 + c) * 2;
          ctx.fillRect(dx, dy + 2 + bob, T_, 2);
        }
      }
    }

    /* --- yüzey binaları --- */
    if (groundScreenY > -120 && groundScreenY < H + 200){
      for (const b of BUILDINGS)
        Art.drawBuilding(ctx, b, b.col * T_ - cam.x, w.groundY - cam.y, this.t);
    }

    /* --- kazma ilerleme çubuğu --- */
    const p = this.player;
    if (p.dig && p.drilling){
      const bx = p.dig.c * T_ - cam.x, by = p.dig.r * T_ - cam.y;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx + 4, by + T_ - 7, T_ - 8, 4);
      ctx.fillStyle = '#35f0e8';
      ctx.fillRect(bx + 4, by + T_ - 7, (T_ - 8) * clamp(p.dig.prog / p.dig.need, 0, 1), 4);
    }

    /* --- varlıklar --- */
    if (this.wreck) this.wreck.draw(ctx, cam, this.t);
    this.barrels.forEach(b => b.draw(ctx, cam, this.t));
    this.bombs.forEach(b => b.draw(ctx, cam, this.t));
    if (this.boss && !this.boss.dead) this.boss.draw(ctx, cam, this.t);
    if (p.alive) Art.drawPlayer(ctx, { ...p, x: p.x - cam.x, y: p.y - cam.y }, this.t);
    this.fireballs.forEach(f => f.draw(ctx, cam));
    this.particles.forEach(x => x.draw(ctx, cam));
    this.floats.forEach(x => x.draw(ctx, cam));

    /* --- karanlık + fener --- */
    this.renderDarkness(ctx, cam);

    /* Toplanan madenler karanlığın ÜSTÜNDE uçar: HUD'a giden bir geri bildirim,
       dünyanın bir parçası değil. */
    this.pickups.forEach(x => x.draw(ctx));

    /* --- enkaz pusulası: ekran dışındaysa kenarda ok --- */
    if (this.wreck) this.drawWreckCompass(ctx, cam);

    /* --- sıcaklık uyarısı --- */
    if (this.heatWarning){
      ctx.fillStyle = `rgba(255,60,20,${0.10 + 0.06 * Math.sin(this.t * 8)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillStyle = '#ff4438'; ctx.textAlign = 'center';
      ctx.fillText('!! RADYATÖR YETERSİZ — ARAÇ KIZIYOR !!', W / 2, 26);
      ctx.textAlign = 'left';
    }

    /* --- katman adı --- */
    const layer = w.layerAt(p.depth);
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillStyle = 'rgba(200,194,224,.5)';
    ctx.textAlign = 'right';
    /* toUpperCase() Türkçe bilmez: "Derinlik" → "DERINLIK" olur. Yerel ayarlı
       sürüm i→İ, ı→I dönüşümünü doğru yapar. */
    ctx.fillText(layer.name.toLocaleUpperCase('tr-TR'), W - 14, H - 12);
    ctx.textAlign = 'left';
  }

  /** Enkaz ekran dışındaysa, ekranın kenarında ona bakan bir ok çizer.
   *  Oyuncunun "oraya geri dönmeliyim" hissini canlı tutan tek görsel bu;
   *  onsuz enkaz sadece kayıp bir sayı olur. */
  drawWreckCompass(ctx, cam){
    const W = CFG.VIEW_W, H = CFG.VIEW_H, M = 16;
    const wx = this.wreck.x + 15 - cam.x, wy = this.wreck.y + 10 - cam.y;
    if (wx > M && wx < W - M && wy > M && wy < H - M) return;   // zaten ekranda

    const cx = W / 2, cy = H / 2;
    const dx = wx - cx, dy = wy - cy;
    const scale = Math.min((W / 2 - M) / Math.abs(dx || 1), (H / 2 - M) / Math.abs(dy || 1));
    const ax = cx + dx * scale, ay = cy + dy * scale;
    const ang = Math.atan2(dy, dx);
    const blink = Math.sin(this.t * 6) > -0.3 ? 1 : 0.35;

    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(ax | 0, ay | 0);
    ctx.rotate(ang);
    ctx.fillStyle = '#0a0610'; ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#35f0e8';
    ctx.fillRect(-5, -2, 7, 4);
    ctx.fillRect(2, -4, 3, 8);
    ctx.fillRect(5, -2, 2, 4);
    ctx.restore();

    /* mesafe etiketi */
    const dist = Math.round(Math.hypot(this.wreck.x - this.player.x, this.wreck.y - this.player.y) / CFG.TILE * CFG.METERS_PER_TILE);
    ctx.globalAlpha = blink;
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0610'; ctx.fillText(`${dist}m`, (ax | 0) + 1, (ay | 0) + 19);
    ctx.fillStyle = '#35f0e8'; ctx.fillText(`${dist}m`, ax | 0, (ay | 0) + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /** Derinlik arttıkça ekran kararır; aracın etrafında far ışığı kalır. */
  renderDarkness(ctx, cam){
    const p = this.player;
    /* Arena lav havuzuyla aydınlanır: savaşı görebilmek için karanlık kırılır. */
    const inArena = p.y > this.world.arenaTop * CFG.TILE;
    const a = inArena ? 0.42 : clamp((p.depth - 250) / 2600, 0, 0.86);
    if (a <= 0.01) return;
    const px_ = p.cx - cam.x, py = p.cy - cam.y;
    const g = ctx.createRadialGradient(px_, py, 16, px_, py, inArena ? 560 : 300);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.25,`rgba(0,0,0,${a * 0.35})`);
    g.addColorStop(0.60,`rgba(0,0,0,${a})`);
    g.addColorStop(1,   `rgba(0,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    /* Far konisi: aracın baktığı yöne hafif sıcak ışık */
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(px_, py);
    ctx.lineTo(px_ + p.facing * 150, py - 60);
    ctx.lineTo(px_ + p.facing * 150, py + 70);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  renderTitleBg(ctx){
    Art.drawSky(ctx, this.t * 14, CFG.VIEW_H * 0.72, this.t);
    ctx.fillStyle = '#3b2313';
    ctx.fillRect(0, CFG.VIEW_H * 0.72, CFG.VIEW_W, CFG.VIEW_H);
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(0, CFG.VIEW_H * 0.72, CFG.VIEW_W, 4);
  }

  /* ======================================================== EKRANLAR ===== */
  showTitle(){
    this.state = 'title';
    this.modal = 'title';
    this.paused = false;
    Shops.current = null;
    Sfx.stopLoops();
    Sfx.setTrack('surface');
    UI.prompt(null);
    UI.clearRadio();
    UI.showHUD(false);
    document.getElementById('tbtnE').classList.add('hidden');
    const cont = this.hasSave();
    UI.openPanel(`
      <h1>${STORY.title.h1}</h1>
      <h2>${STORY.title.h2}</h2>
      ${STORY.title.body}
      <h3>KONTROLLER</h3>
      <div class="grid2">
        <div class="kv"><span>Hareket / Kazma</span><span>WASD — Yön tuşları</span></div>
        <div class="kv"><span>Uçuş (3× mazot)</span><span>W / ↑</span></div>
        <div class="kv"><span>Yavaş & güvenli kazma</span><span>SHIFT</span></div>
        <div class="kv"><span>Mekâna gir</span><span>E</span></div>
        <div class="kv"><span>Eşya kullan</span><span>1 2 3 4</span></div>
        <div class="kv"><span>Duraklat / Geri</span><span>ESC</span></div>
      </div>
      <div class="actions">
        <button data-a="new" class="primary">YENİ OYUN</button>
        ${cont ? '<button data-a="cont">DEVAM ET</button>' : ''}
        <button data-a="how">NASIL OYNANIR</button>
      </div>
      <p class="dim" style="margin-top:16px">Sürüm ${VERSION} · Kayıt tarayıcına
      (bu cihaza) yazılır. Gizli sekmede veya site verisini silersen kaybolur.</p>
    `, panel => {
      panel.querySelector('[data-a="new"]').onclick = () => this.newGame();
      const c = panel.querySelector('[data-a="cont"]');
      if (c) c.onclick = () => { if (!this.load()) this.newGame(); };
      panel.querySelector('[data-a="how"]').onclick = () => this.showHowTo();
    });
  }

  showHowTo(){
    UI.openPanel(`
      <h1>NASIL OYNANIR</h1>
      <h3>TEMEL DÖNGÜ</h3>
      <p>Yüzeyden başla → aşağı kaz → kasan dolana veya mazotun bitmeye yaklaşana
      kadar maden topla → yüzeye dön → sat, mazot al, tamir ettir, donanım geliştir →
      daha derine in.</p>
      <h3>HAYATTA KALMA</h3>
      <p>• <b>Mazot</b> biterse ya da <b>şasi</b> sıfırlanırsa araç patlar, son kayıttan başlarsın.<br>
      • Yüksekten hızlı düşmek şasiyi yer — inişte <b>W</b> ile frenle.<br>
      • <b>Grizu</b> (yeşil parıltılı karo) hızlı delinirse patlar. <b>SHIFT</b> ile yavaş kaz.<br>
      • 4000 m'den sonra <b>lav</b> başlar; radyatörün yetmediği derinlikte araç kızar.<br>
      • 6000-9000 m arasında <b>deprem</b> olur.</p>
      <h3>DERİNLİK HARİTASI</h3>
      <div class="kv"><span>0 – 1000 m</span><span>Kömür, Bakır</span></div>
      <div class="kv"><span>1000 – 3000 m</span><span>Gümüş, Altın · Grizu</span></div>
      <div class="kv"><span>3000 – 6000 m</span><span>Oltu Taşı, Lületaşı · Sert kayaç</span></div>
      <div class="kv"><span>6000 – 9000 m</span><span>BOR · Deprem</span></div>
      <div class="kv"><span>-10.000 m</span><span>???</span></div>
      <p class="dim" style="margin-top:10px">Hitit Tabletleri ve Osmanlı Altınları haritaya
      rastgele saçılmıştır; her biri ₺50.000 eder.</p>
      <div class="actions"><button data-a="back" class="primary">GERİ</button></div>
    `, panel => { panel.querySelector('[data-a="back"]').onclick = () => this.showTitle(); });
  }

  openPauseMenu(){
    this.paused = true;
    this.modal = 'pause';
    const p = this.player;
    UI.openPanel(`
      <h1>MOLA</h1>
      <div class="npc-line">Davut Usta termosun kapağını açtı. Çay soğumuş.</div>
      <div class="kv"><span>Derinlik</span><span>${Math.round(p.depth)} m</span></div>
      <div class="kv"><span>En derin nokta</span><span>${Math.round(p.stats.maxDepth)} m</span></div>
      <div class="kv"><span>Para</span><span>${money(p.money)}</span></div>
      <div class="kv"><span>Toplam kazanç</span><span>${money(p.stats.earned)}</span></div>
      <div class="kv"><span>Çıkarılan maden</span><span>${p.stats.oreMined} adet</span></div>
      <div class="kv"><span>Bulunan hazine</span><span>${p.stats.artifacts}</span></div>
      <div class="actions">
        <button data-a="resume" class="primary">DEVAM</button>
        <button data-a="save">KAYDET</button>
        <button data-a="title" class="danger">ANA MENÜ</button>
      </div>
    `, panel => {
      panel.querySelector('[data-a="resume"]').onclick = () => this.closeMenu();
      panel.querySelector('[data-a="save"]').onclick = () => { this.save(); UI.toast('Kaydedildi.', 'good'); };
      panel.querySelector('[data-a="title"]').onclick = () => { this.save(); this.showTitle(); };
    });
  }
  closeMenu(){ this.paused = false; this.modal = null; UI.closePanel(); }

  showBossIntro(){
    this.paused = true;
    this.modal = 'bossintro';
    UI.clearRadio();
    UI.openPanel(`
      <h1>${STORY.bossIntro.h1}</h1>
      <h2>${STORY.bossIntro.h2}</h2>
      ${STORY.bossIntro.body}
      <div class="actions"><button data-a="go" class="primary">HADİ BAKALIM</button></div>
    `, panel => { panel.querySelector('[data-a="go"]').onclick = () => this.startBossFight(); });
  }

  showEnding(){
    this.state = 'ending';
    this.paused = true;
    this.modal = 'ending';
    Sfx.stopLoops();
    Sfx.setTrack('surface');
    Sfx.play('win');
    UI.clearRadio();
    UI.showHUD(false);
    const p = this.player;
    UI.openPanel(`
      <h1>${STORY.ending.h1}</h1>
      ${STORY.ending.body}
      <h3>SEFER RAPORU</h3>
      <div class="kv"><span>En derin nokta</span><span>${Math.round(p.stats.maxDepth)} m</span></div>
      <div class="kv"><span>Toplam kazanç</span><span>${money(p.stats.earned)}</span></div>
      <div class="kv"><span>Çıkarılan maden</span><span>${p.stats.oreMined} adet</span></div>
      <div class="kv"><span>Bulunan defter sayfası</span><span>${p.stats.artifacts}</span></div>
      <div class="kv"><span>Kalan para</span><span>${money(p.money)}</span></div>
      <div class="actions">
        <button data-a="title" class="primary">ANA MENÜ</button>
      </div>
      <p class="dim" style="margin-top:14px">— SON —  Derin Anadolu: Ahit Sandığı</p>
    `, panel => { panel.querySelector('[data-a="title"]').onclick = () => this.showTitle(); });
  }

  showGameOver(){
    this.state = 'gameover';
    this.paused = true;
    this.modal = 'gameover';
    UI.clearRadio();
    UI.showHUD(false);
    const p = this.player;
    UI.openPanel(`
      <h1 style="color:#ff4438;text-shadow:3px 3px 0 #4a0b0b">HADİ BE ORADAN!</h1>
      <div class="npc-line">${p.deathReason}</div>
      <p>${pick(Math.random, STORY.deaths)} Neyse ki dede her şeyi deftere yazmıştı — ve Davut Usta da yazmaya devam ediyor.</p>
      <div class="kv"><span>Ulaştığın derinlik</span><span>${Math.round(p.depth)} m</span></div>
      <div class="kv"><span>En derin nokta</span><span>${Math.round(p.stats.maxDepth)} m</span></div>
      ${this.wreck ? `
        <h3>ENKAZ</h3>
        <div class="npc-line">Kasandaki <b>${this.wreck.cargoCount} birim</b> maden ${this.wreck.depth} metrede, enkazın içinde kaldı. Değeri <b>${money(this.wreck.value)}</b>. Yerini haritada işaretledim gidip alırsan senindir.</div>
        <p class="dim">Kurtarmaya gücün yetmezse Rıza Başkan hurda sigortasıyla
        %${Math.round(CFG.WRECK_INSURANCE * 100)}'ini nakit öder.</p>` : ''}
      <div class="actions">
        <button data-a="load" class="primary">SON KAYITTAN DEVAM</button>
        <button data-a="title">ANA MENÜ</button>
      </div>
    `, panel => {
      panel.querySelector('[data-a="load"]').onclick = () => { if (!this.load()) this.newGame(); };
      panel.querySelector('[data-a="title"]').onclick = () => this.showTitle();
    });
  }
}

/* Oyunu başlat.
   lang="tr" çalışma zamanında da atanır: Artifact derlemesi <html> etiketini
   söktüğü için orada dil bilgisi kaybolur, CSS text-transform ise i/İ
   dönüşümünü bu özniteliğe göre yapar. */
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = 'tr';
  window.game = new Game();
});
