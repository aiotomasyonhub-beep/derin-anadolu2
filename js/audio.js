/* ============================================================================
   audio.js — SES MOTORU (WebAudio, sıfır dosya)

   ► HEDEF: Motherload'un ses kimliği + AĞIR İŞ MAKİNESİ karakteri.
     Oyuncunun kulağında çalışan şey bir "oyuncak" değil, mazot yakan,
     dişlileri taşa sürten, hidroliği inleyen bir sondaj makinesi olmalı.

   Ses tasarımının üç kuralı:
     1) HİÇBİR SES TEK KATMAN DEĞİL. Gerçek makine sesi en az üç bileşendir:
        · düşük  → dizel bloğunun gürültüsü (40-120 Hz testere/kare dalga)
        · orta   → işin kendisi (taşa sürten matkabın bant geçiren gürültüsü)
        · yüksek → metal sürtünmesi / hidrolik tıslama (yüksek geçiren gürültü)
     2) MAKİNE DÜZGÜN ÇALIŞMAZ. Her döngüye "yük dalgalanması" (slow LFO ile
        perde oynaması) ve "dişli vuruşu" (hızlı amplitüd modülasyonu) eklenir.
        Sabit perdeli bir uğultu kulağa sentezleyici gibi gelir, makine gibi değil.
     3) DARBELER İNHARMONİKTİR. Metal çarpması, notası olmayan bir sestir:
        frekanslar 1 / 2.76 / 5.40 / 8.93 oranlarıyla dizilir (çubuk modları).
        Bunu armonik seriyle yaparsan "çan" olur, "kaporta" olmaz.

   ► MEKÂN: Maden şaftı yankılıdır. Üretilen bir impuls yanıtı (üstel sönümlü
     gürültü) ile ConvolverNode kullanılır ve yankı miktarı DERİNLİKLE ARTAR
     (Sfx.setSpace). Yüzeyde kuru, -8000 m'de mağara gibi.

   ► MÜZİK: Motherload'un soundtrack'i chiptune değil; yavaş, karanlık,
     atmosferik elektroniktir. Burada da öyle: uzun detune saw pad'ler, nabız
     gibi sub bas, seyrek yankılı pluck'lar ve endüstriyel metal vuruşlar.
     Akorlar hicaz renginde (b2 / natural 3) — Anadolu tadı melodide değil,
     armonide duruyor.
   ============================================================================ */

const Sfx = (() => {
  const MUSIC_BASE = 0.26;

  let ctx = null;
  let master, musicGain, sfxGain, revIn, revOut, conv;
  let ducked = false;
  let noiseBuf = null;
  let ready = false;

  let muted = false;
  try { muted = localStorage.getItem('derin_anadolu_mute') === '1'; } catch (e) {}

  /* ==========================================================================
     KURULUM
     ========================================================================== */
  function ensure(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return ready; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    musicGain = ctx.createGain(); musicGain.gain.value = MUSIC_BASE; musicGain.connect(master);
    sfxGain   = ctx.createGain(); sfxGain.gain.value   = 0.60; sfxGain.connect(master);

    /* 2 saniyelik beyaz gürültü — bütün darbe/uğultu sesleri bundan türer */
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    /* --- maden şaftı yankısı --- */
    conv = ctx.createConvolver();
    conv.buffer = makeIR(2.1, 3.0);
    revIn  = ctx.createGain(); revIn.gain.value = 1;
    revOut = ctx.createGain(); revOut.gain.value = 0.10;   // yüzeyde neredeyse kuru
    musicGain.connect(revIn); sfxGain.connect(revIn);
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);

    buildLoops();
    ready = true;
    startSequencer();
    return true;
  }

  /** Üstel sönümlü gürültü = ucuz ve ikna edici bir oda yankısı */
  function makeIR(seconds, decay){
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++){
      const ch = buf.getChannelData(c);
      for (let i = 0; i < n; i++){
        /* ilk 12 ms'de erken yansımalar seyrek olsun — tünel hissi */
        const t = i / n;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  const now = () => ctx.currentTime;

  /** Derinliğe göre yankıyı aç: 0 = yüzey (kuru), 1 = yedi kat dip (mağara) */
  function setSpace(amount){
    if (!ready) return;
    revOut.gain.setTargetAtTime(0.08 + clamp(amount, 0, 1) * 0.42, now(), 0.8);
  }

  /* ==========================================================================
     TEMEL ÜRETİCİLER
     ========================================================================== */
  function env(g, t, peak, attack, dur){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function blip(freq, { type = 'square', dur = 0.12, gain = 0.3, slide = 0, delay = 0, dest } = {}){
    if (!ready) return;
    const t = now() + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 20), t + dur);
    env(g, t, gain, 0.008, dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.3, gain = 0.4, lp = 1200, lpEnd = 120, hp = 0, delay = 0, attack = 0.005 } = {}){
    if (!ready) return;
    const t = now() + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;      // her seferinde farklı doku
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(lp, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(lpEnd, 20), t + dur);
    const g = ctx.createGain();
    env(g, t, gain, attack, dur);
    let node = s;
    if (hp){ const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node.connect(h); node = h; }
    node.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t); s.stop(t + dur + 0.05);
  }

  /** METAL ÇARPMASI — inharmonik kısmi tonlar (çubuk modları).
   *  Kaporta, matkap ucu, römork kapağı, maden vagonu... hepsi bu. */
  const BAR_MODES = [1, 2.76, 5.40, 8.93, 13.34];
  function clang(base, { dur = 0.4, gain = 0.3, delay = 0, partials = 4, bright = 1 } = {}){
    if (!ready) return;
    for (let i = 0; i < partials; i++){
      blip(base * BAR_MODES[i] * (0.995 + Math.random() * 0.01), {
        type: i === 0 ? 'triangle' : 'sine',
        dur: dur * Math.pow(0.68, i),
        gain: gain * Math.pow(0.55, i) * bright,
        delay,
      });
    }
    /* vuruş anındaki "tak" transiyenti */
    noise({ dur: 0.035, gain: gain * 0.6, lp: 11000, lpEnd: 2500, hp: 1800, delay });
  }

  /** PNÖMATİK / HİDROLİK TISLAMA — valf boşalması */
  function hiss({ dur = 0.35, gain = 0.2, delay = 0 } = {}){
    noise({ dur, gain, lp: 9000, lpEnd: 2400, hp: 2600, delay, attack: 0.02 });
  }

  /** MEKANİK CIRCIR — dişli/mandal serisi (yükseltme, yazar kasa, kurma) */
  function ratchet(n = 7, spacing = 0.035, gain = 0.16){
    for (let i = 0; i < n; i++)
      noise({ dur: 0.028, gain: gain * (1 - i / (n * 1.6)), lp: 9000, lpEnd: 3000, hp: 2200, delay: i * spacing });
  }

  /* ==========================================================================
     SÜREKLİ DÖNGÜLER — makinenin kendisi
     Bir kez kurulur; sonra sadece kazanç ve perde rampalanır.
     ========================================================================== */
  const loops = {};

  /** Ortak yardımcı: sürekli gürültü kaynağı + filtre */
  function noiseLoop(filterType, freq, Q){
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    if (Q !== undefined) f.Q.value = Q;
    s.connect(f); s.start();
    return { src: s, filter: f, out: f };
  }

  function buildLoops(){
    /* ----------------------------------------------------------------------
       MATKAP — kaya deliciye sürten burgu
       Katman 1: dizel blok  (testere 54 Hz + oktav, alçak geçiren)
       Katman 2: taş öğütme  (bant geçiren gürültü ~1300 Hz)
       Katman 3: metal sürtünme (yüksek geçiren gürültü > 4 kHz, kısık)
       Modülasyon: 26 Hz dişli vuruşu + 1.7 Hz yük dalgalanması
       ---------------------------------------------------------------------- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxGain);

      const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 54;
      const motorOct = ctx.createOscillator(); motorOct.type = 'square'; motorOct.frequency.value = 108;
      const motorLp = ctx.createBiquadFilter(); motorLp.type = 'lowpass'; motorLp.frequency.value = 420;
      const motorG = ctx.createGain(); motorG.gain.value = 0.55;
      motor.connect(motorLp); motorOct.connect(motorLp);
      motorLp.connect(motorG); motorG.connect(g);
      motor.start(); motorOct.start();

      const grind = noiseLoop('bandpass', 1300, 0.9);
      const grindG = ctx.createGain(); grindG.gain.value = 0.85;
      grind.out.connect(grindG); grindG.connect(g);

      const scrape = noiseLoop('highpass', 4200);
      const scrapeG = ctx.createGain(); scrapeG.gain.value = 0.10;
      scrape.out.connect(scrapeG); scrapeG.connect(g);

      /* dişli vuruşu: öğütme katmanını 26 Hz'de kırpar */
      const teeth = ctx.createOscillator(); teeth.type = 'square'; teeth.frequency.value = 26;
      const teethG = ctx.createGain(); teethG.gain.value = 0.45;
      teeth.connect(teethG); teethG.connect(grindG.gain); teeth.start();

      /* yük dalgalanması: motor perdesi 1.7 Hz'de ±4 Hz gezinir */
      const load = ctx.createOscillator(); load.type = 'sine'; load.frequency.value = 1.7;
      const loadG = ctx.createGain(); loadG.gain.value = 4;
      load.connect(loadG); loadG.connect(motor.frequency); load.start();

      loops.drill = { g, motor, motorOct, grind: grind.filter, teeth };
    }

    /* ----------------------------------------------------------------------
       PERVANE / KALDIRMA — turbo + hidrolik
       Katman 1: turbo fısıltısı (testere 190 Hz, bant geçiren, gaza göre çıkar)
       Katman 2: dizel kükreme (alçak geçiren gürültü)
       Katman 3: hidrolik tıslama (yüksek geçiren gürültü)
       ---------------------------------------------------------------------- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxGain);

      const turbo = ctx.createOscillator(); turbo.type = 'sawtooth'; turbo.frequency.value = 190;
      const turboBp = ctx.createBiquadFilter(); turboBp.type = 'bandpass';
      turboBp.frequency.value = 900; turboBp.Q.value = 1.6;
      const turboG = ctx.createGain(); turboG.gain.value = 0.30;
      turbo.connect(turboBp); turboBp.connect(turboG); turboG.connect(g); turbo.start();

      const roar = noiseLoop('lowpass', 520);
      const roarG = ctx.createGain(); roarG.gain.value = 0.85;
      roar.out.connect(roarG); roarG.connect(g);

      const hyd = noiseLoop('highpass', 3000);
      const hydG = ctx.createGain(); hydG.gain.value = 0.16;
      hyd.out.connect(hydG); hydG.connect(g);

      loops.thrust = { g, turbo, roar: roar.filter };
    }

    /* ----------------------------------------------------------------------
       RÖLANTİ — dizel "pat... pat... pat"
       Testere dalgayı 7.5 Hz'lik ASİMETRİK (testere) LFO ile kırpmak, kare
       LFO'dan çok daha inandırıcı bir tek silindir patlaması verir.
       ---------------------------------------------------------------------- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxGain);

      const block = ctx.createOscillator(); block.type = 'sawtooth'; block.frequency.value = 42;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const chugG = ctx.createGain(); chugG.gain.value = 0.5;
      block.connect(lp); lp.connect(chugG); chugG.connect(g); block.start();

      const chug = ctx.createOscillator(); chug.type = 'sawtooth'; chug.frequency.value = 7.5;
      const chugAmt = ctx.createGain(); chugAmt.gain.value = 0.55;
      chug.connect(chugAmt); chugAmt.connect(chugG.gain); chug.start();

      /* egzoz çıtırtısı */
      const exh = noiseLoop('bandpass', 320, 1.2);
      const exhG = ctx.createGain(); exhG.gain.value = 0.22;
      exh.out.connect(exhG); exhG.connect(g);
      chugAmt.connect(exhG.gain);

      loops.idle = { g, block, chug };
    }

    /* ----------------------------------------------------------------------
       PALET / YÜRÜYÜŞ TAKIMI — yerde giderken tırtılların tıkırtısı
       Bant geçiren gürültü + 11 Hz'lik makara vuruşu.
       ---------------------------------------------------------------------- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxGain);
      const tr = noiseLoop('bandpass', 620, 1.1);
      const trG = ctx.createGain(); trG.gain.value = 0.9;
      tr.out.connect(trG); trG.connect(g);

      const roll = ctx.createOscillator(); roll.type = 'square'; roll.frequency.value = 11;
      const rollG = ctx.createGain(); rollG.gain.value = 0.6;
      roll.connect(rollG); rollG.connect(trG.gain); roll.start();

      const rumble = noiseLoop('lowpass', 180);
      const rumbleG = ctx.createGain(); rumbleG.gain.value = 0.5;
      rumble.out.connect(rumbleG); rumbleG.connect(g);

      loops.tread = { g, roll };
    }
  }

  /* Döngü hedef seviyeleri */
  const LOOP_LEVEL = { drill: 0.30, thrust: 0.26, idle: 0.13, tread: 0.10 };

  function setLoop(name, on, level = 0){
    if (!ready || !loops[name]) return;
    const L = loops[name], t = now();
    L.g.gain.cancelScheduledValues(t);
    L.g.gain.setTargetAtTime(on ? LOOP_LEVEL[name] : 0, t, on ? 0.025 : 0.07);
    if (!on) return;

    /* Donanım seviyesi sese yansır: daha iyi matkap = daha hızlı, daha tiz. */
    if (name === 'drill'){
      L.motor.frequency.setTargetAtTime(50 + level * 7, t, 0.12);
      L.motorOct.frequency.setTargetAtTime((50 + level * 7) * 2, t, 0.12);
      L.grind.frequency.setTargetAtTime(1050 + level * 260, t, 0.12);
      L.teeth.frequency.setTargetAtTime(22 + level * 5, t, 0.12);
    }
    if (name === 'thrust'){
      L.turbo.frequency.setTargetAtTime(170 + level * 34, t, 0.18);
      L.roar.frequency.setTargetAtTime(460 + level * 60, t, 0.18);
    }
  }

  /* ==========================================================================
     SES KÜTÜPHANESİ
     ========================================================================== */
  const LIB = {
    /* --- arayüz: röle / şalter tıkırtısı, bip değil --- */
    click: () => { noise({ dur:0.022, gain:0.22, lp:7000, lpEnd:1800, hp:1400 });
                   blip(180, { type:'square', dur:0.03, gain:0.10 }); },
    back:  () => { noise({ dur:0.03, gain:0.18, lp:4000, lpEnd:900, hp:600 }); },
    /* ağır ekipman hatası: kısa korna */
    error: () => { blip(196, { type:'square', dur:0.22, gain:0.26 });
                   blip(147, { type:'square', dur:0.26, gain:0.20, delay:0.02 }); },

    /* --- kasa: mekanik circir + madeni para çınlaması --- */
    cash:  () => { ratchet(9, 0.032, 0.18);
                   clang(880, { dur:0.5, gain:0.18, delay:0.30, partials:3 });
                   clang(1320, { dur:0.4, gain:0.14, delay:0.40, partials:3 }); },
    /* --- satın alma: pnömatik anahtar + oturma tıkırtısı --- */
    buy:   () => { hiss({ dur:0.22, gain:0.24 });
                   clang(320, { dur:0.28, gain:0.26, delay:0.18, partials:3 }); },

    /* --- kazma: kürek dolusu taş dökülmesi --- */
    dig:   () => { noise({ dur:0.09, gain:0.12, lp:3200, lpEnd:700, hp:500 });
                   if (Math.random() < 0.3) clang(1400, { dur:0.09, gain:0.05, partials:2 }); },

    /** Maden, sacdan kasaya düşer: metalik "çınk". Değerli maden daha tiz. */
    ore:   (v = 0) => {
             const base = 520 * Math.pow(1.055, clamp(Math.log2((v || 35) / 30) * 3.2, 0, 14));
             clang(base, { dur:0.34, gain:0.24, partials:3, bright:1.1 });
             noise({ dur:0.05, gain:0.08, lp:6000, lpEnd:1200, hp:900, delay:0.01 });
           },

    /* --- hazine: circir + yükselen zil --- */
    artifact: () => {
             ratchet(6, 0.04, 0.14);
             [0, 5, 7, 12].forEach((s, i) =>
               clang(392 * Math.pow(2, s / 12), { dur:0.9, gain:0.20, delay:0.22 + i * 0.12, partials:3 }));
           },

    /* --- hasar: kaportaya balyoz --- */
    hit:   () => { clang(150, { dur:0.55, gain:0.40, partials:5 });
                   noise({ dur:0.22, gain:0.22, lp:1400, lpEnd:160 }); },

    /* --- sert iniş: süspansiyon dibe vurur + sac zangırtısı --- */
    thud:  () => { blip(130, { type:'sine', dur:0.30, gain:0.42, slide:-88 });
                   noise({ dur:0.34, gain:0.34, lp:620, lpEnd:60 });
                   clang(210, { dur:0.5, gain:0.18, delay:0.03, partials:4 });
                   for (let i = 0; i < 3; i++)
                     clang(300 + Math.random() * 500, { dur:0.2, gain:0.07, delay:0.08 + i * 0.07, partials:2 }); },

    /* --- dinamit: sub patlama + taş yağmuru --- */
    explosion: () => {
             noise({ dur:0.9, gain:0.6, lp:2800, lpEnd:45 });
             blip(62, { type:'sawtooth', dur:0.6, gain:0.40, slide:-38 });
             for (let i = 0; i < 7; i++)                       // düşen kaya parçaları
               noise({ dur:0.1, gain:0.10, lp:2600, lpEnd:500, hp:400, delay:0.28 + Math.random() * 0.7 });
           },

    /* --- grizu: önce parlama (whoosh), sonra gümbürtü --- */
    grizu: () => {
             noise({ dur:0.28, gain:0.34, lp:1200, lpEnd:8000, hp:600, attack:0.12 });  // ters süpürme
             noise({ dur:1.3, gain:0.62, lp:3600, lpEnd:40, delay:0.16 });
             blip(54, { type:'sine', dur:1.1, gain:0.40, slide:-22, delay:0.16 });
             for (let i = 0; i < 9; i++)
               noise({ dur:0.12, gain:0.11, lp:2200, lpEnd:400, hp:300, delay:0.45 + Math.random() * 0.9 });
           },

    /* --- deprem: uzun alçak gümbürtü + tavan çatırtısı --- */
    quake: () => {
             noise({ dur:2.0, gain:0.46, lp:220, lpEnd:38, attack:0.35 });
             blip(41, { type:'sine', dur:1.8, gain:0.32, slide:9 });
             for (let i = 0; i < 12; i++)
               noise({ dur:0.09, gain:0.08, lp:3000, lpEnd:600, hp:700, delay:Math.random() * 1.8 });
           },

    lava:  () => noise({ dur:0.4, gain:0.12, lp:700, lpEnd:240 }),

    /* --- MAZOT ALARMI: iş makinesi geri vites bipi --- */
    fuelWarn: () => { for (let i = 0; i < 2; i++)
                        blip(1046, { type:'square', dur:0.16, gain:0.20, delay:i * 0.26 }); },

    /* --- TELSİZ: squelch + çağrı bipi. Parazit seviyesi arttıkça perde düşer
       ve altına sönmeyen bir uğultu binir: sinyalin kaynağı artık insan değil. */
    radio: (s = 0) => {
             noise({ dur:0.09, gain:0.17, lp:4200, lpEnd:900, hp:700 });
             const f = s >= 2 ? 300 : (s === 1 ? 660 : 920);
             blip(f,       { type:'square', dur:0.07, gain:0.15, delay:0.10 });
             blip(f * 1.5, { type:'square', dur:0.09, gain:0.13, delay:0.19 });
             if (s >= 1) noise({ dur:0.7, gain:0.05, lp:2600, lpEnd:700, hp:500, delay:0.1, attack:0.15 });
             if (s >= 2) blip(41, { type:'sine', dur:1.6, gain:0.16, slide:-6, delay:0.1 });
           },

    /* --- eşyalar --- */
    item:  () => { hiss({ dur:0.18, gain:0.18 });
                   clang(440, { dur:0.25, gain:0.18, delay:0.10, partials:3 }); },
    /* fitil: kibrit + tıslama */
    fuse:  () => { noise({ dur:0.06, gain:0.16, lp:9000, lpEnd:3000, hp:2500 });
                   noise({ dur:0.9, gain:0.07, lp:6000, lpEnd:4000, hp:3000, delay:0.05, attack:0.1 }); },
    /* ışınlayıcı: kondansatör şarjı + boşalma */
    teleport: () => { blip(90, { type:'sawtooth', dur:0.55, gain:0.20, slide:2400 });
                      noise({ dur:0.5, gain:0.16, lp:500, lpEnd:9000, attack:0.3 });
                      noise({ dur:0.25, gain:0.34, lp:9000, lpEnd:300, delay:0.52 });
                      clang(760, { dur:0.5, gain:0.16, delay:0.52, partials:3 }); },

    /* --- boss --- */
    fire:  () => { noise({ dur:0.16, gain:0.26, lp:1400, lpEnd:5200, hp:500, attack:0.06 });
                   blip(210, { type:'sawtooth', dur:0.3, gain:0.16, slide:-110, delay:0.06 }); },
    bosshit: () => { clang(620, { dur:0.45, gain:0.34, partials:5, bright:1.3 });
                     noise({ dur:0.16, gain:0.20, lp:6000, lpEnd:900, hp:1500 }); },
    /* golem kükremesi: taş öğütme + sub */
    roar:  () => { blip(46, { type:'sawtooth', dur:1.6, gain:0.44, slide:-14 });
                   blip(69, { type:'square', dur:1.3, gain:0.18, slide:-20, delay:0.06 });
                   noise({ dur:1.7, gain:0.34, lp:1100, lpEnd:60, attack:0.25 });
                   for (let i = 0; i < 8; i++)
                     clang(120 + Math.random() * 180, { dur:0.5, gain:0.09, delay:Math.random() * 1.2, partials:3 }); },

    /* --- oyun akışı --- */
    death: () => { noise({ dur:1.4, gain:0.62, lp:3400, lpEnd:40 });
                   blip(58, { type:'sawtooth', dur:1.2, gain:0.36, slide:-32 });
                   for (let i = 0; i < 10; i++)                 // dağılan kaporta
                     clang(180 + Math.random() * 600, { dur:0.5, gain:0.13, delay:0.1 + Math.random() * 1.1, partials:3 }); },
    win:   () => { [0, 7, 12, 19].forEach((s, i) =>
                     clang(262 * Math.pow(2, s / 12), { dur:1.6, gain:0.22, delay:i * 0.34, partials:3 })); },
  };

  function play(name, arg){
    if (!ready || muted) return;
    const f = LIB[name];
    if (f) f(arg);
  }

  /* ==========================================================================
     MÜZİK — atmosferik, Motherload dokusunda

     Voice'lar:
       pad    : 2 detune sawtooth → alçak geçiren (yavaş süpürme) → uzun zarf
       sub    : sine nabız, akorun köküne kilitli
       pluck  : üçgen dalga + iki yankı tekrarı (mağara gecikmesi)
       clank  : endüstriyel metal vuruş (perküsyon yerine)

     Akorlar hicaz renginde: kök, b2/b3, 5, b7 aralıkları. Melodi yok —
     Motherload'da da yok; ambiyans var.
     ========================================================================== */
  const TRACKS = {
    /* Yüzey: akşamüstü, motor soğuyor. Sıcak ama melankolik. */
    surface: {
      bpm: 68, root: 110,                          // A2
      chords: [[0,7,12,16], [0,7,12,15], [-2,5,10,14], [-5,2,7,11]],
      chordEvery: 16, cutoff: 1150, padGain: 0.115, subGain: 0.20,
      sub:   [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      pluck: [null,null,null,19, null,null,null,null, null,null,15,null, null,null,null,null],
      clank: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    },

    /* Yeraltı: yalnızlık. Pad'ler kısılır, yankı açılır, seyrek damla sesleri. */
    underground: {
      bpm: 58, root: 98,                           // G2
      chords: [[0,8,12,15], [0,7,12,17], [-3,4,9,12], [0,8,12,19]],
      chordEvery: 16, cutoff: 820, padGain: 0.125, subGain: 0.22,
      sub:   [1,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
      pluck: [null,null,null,null, 12,null,null,null, null,null,null,null, null,null,17,null],
      clank: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    },

    /* Dip: tehdit. Sub ağırlaşır, endüstriyel vuruşlar başlar. */
    deep: {
      bpm: 64, root: 82.41,                        // E2
      chords: [[0,1,7,13], [0,3,7,14], [-1,6,11,13], [0,1,8,12]],
      chordEvery: 16, cutoff: 620, padGain: 0.14, subGain: 0.30,
      sub:   [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
      pluck: [null,null,13,null, null,null,null,null, null,null,null,null, 8,null,null,null],
      clank: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    },

    /* Boss: makine dairesi. Hızlı sub nabzı, sürekli metal vuruş. */
    boss: {
      bpm: 112, root: 73.42,                       // D2
      chords: [[0,1,7,12], [0,1,6,12], [0,3,7,13], [-2,1,6,11]],
      chordEvery: 8, cutoff: 900, padGain: 0.12, subGain: 0.34,
      sub:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,0,1],
      pluck: [null,null,null,13, null,null,12,null, null,null,null,8, null,null,null,null],
      clank: [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,1],
    },
  };

  let curTrack = null, step = 0, nextTime = 0, timer = null;

  function startSequencer(){
    if (timer) return;
    timer = setInterval(() => {
      if (!ready || !curTrack || muted) return;
      const tr = TRACKS[curTrack];
      const stepDur = 60 / tr.bpm / 2;               // 8'lik adım
      while (nextTime < now() + 0.3){
        scheduleStep(tr, step, nextTime, stepDur);
        nextTime += stepDur;
        step++;
      }
    }, 40);
  }

  /** Uzun, nefes alan pad akoru */
  function pad(freqs, t, dur, gain, cutoff){
    freqs.forEach(f => {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = f;
      o2.frequency.value = f * 1.0055;                     // detune = genişlik
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
      lp.frequency.setValueAtTime(cutoff * 0.45, t);
      lp.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.55);
      lp.frequency.linearRampToValueAtTime(cutoff * 0.5, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.30);
      g.gain.setValueAtTime(gain, t + dur * 0.62);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicGain);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    });
  }

  function scheduleStep(tr, absStep, t, stepDur){
    const i = absStep % 16;
    const chordIdx = Math.floor(absStep / tr.chordEvery) % tr.chords.length;
    const chord = tr.chords[chordIdx];
    const semi = s => tr.root * Math.pow(2, s / 12);

    /* --- akor değişimi: yeni pad --- */
    if (absStep % tr.chordEvery === 0)
      pad(chord.map(semi), t, stepDur * tr.chordEvery * 1.02, tr.padGain, tr.cutoff);

    /* --- sub nabız --- */
    if (tr.sub[i]){
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(semi(chord[0]) / 2 * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(semi(chord[0]) / 2, t + 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(tr.subGain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.9);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + stepDur + 0.05);
    }

    /* --- pluck + mağara yankısı (iki tekrar) --- */
    const pl = tr.pluck[i];
    if (pl !== null && pl !== undefined){
      for (let e = 0; e < 3; e++){
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = semi(pl) * 2;
        const tt = t + e * stepDur * 0.75;
        const gain = 0.10 * Math.pow(0.45, e);
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(gain, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.7);
        o.connect(g); g.connect(musicGain);
        o.start(tt); o.stop(tt + 0.75);
      }
    }

    /* --- endüstriyel metal vuruş --- */
    if (tr.clank[i]){
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 2200; bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      s.connect(bp); bp.connect(g); g.connect(musicGain);
      s.start(t); s.stop(t + 0.26);
      /* altına düşük bir "tok" */
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.10, t + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(og); og.connect(musicGain);
      o.start(t); o.stop(t + 0.18);
    }
  }

  function setTrack(name){
    if (!ready){ curTrack = name; return; }
    if (curTrack === name) return;
    curTrack = name;
    step = 0;
    nextTime = now() + 0.05;
  }

  /* ==========================================================================
     SESSİZE ALMA
     ========================================================================== */
  /** Motorun tamamını sustur (ölüm, menü, sekme arka plana geçti...) */
  function stopLoops(){ for (const k in loops) setLoop(k, false); ducking(false); }

  /** SIDECHAIN DUCKING — matkap çalışırken müziği kıs.
   *  Matkabın dizel bloğu ile pad'lerin alt-orta bandı aynı yerde boğuşuyor;
   *  müziği %55'e çekmek ikisini de netleştirir. İniş hızlı (çalışma anında),
   *  dönüş yavaş (matkap durunca müzik usulca geri gelir). */
  function ducking(on){
    if (!ready || ducked === on) return;
    ducked = on;
    musicGain.gain.setTargetAtTime(on ? MUSIC_BASE * 0.45 : MUSIC_BASE, now(), on ? 0.06 : 0.40);
  }

  function toggleMute(){
    muted = !muted;
    try { localStorage.setItem('derin_anadolu_mute', muted ? '1' : '0'); } catch (e) {}
    if (ready) master.gain.setTargetAtTime(muted ? 0 : 0.85, now(), 0.05);
    if (muted) stopLoops();
    return muted;
  }
  const isMuted = () => muted;

  return { ensure, play, setLoop, stopLoops, ducking, setTrack, setSpace, toggleMute, isMuted,
           get ready(){ return ready; } };
})();

window.Sfx = Sfx;
