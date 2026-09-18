/* ============================================================================
   ui.js — HUD ve modal panel katmanı (DOM tabanlı)

   Canvas'ın üstüne serilmiş HTML kullanıyoruz: barlar, para, derinlik, eşya
   kutuları ve dükkân menüleri. Böylece metin her zaman net okunur, canvas ise
   saf piksel sanatına ayrılmış olur.
   ============================================================================ */

const UI = {
  el: {},
  _lastHint: '', _hintTimer: 0,

  init(){
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      fuelBar: $('fuelBar'), fuelText: $('fuelText'),
      hullBar: $('hullBar'), hullText: $('hullText'),
      cargoBar: $('cargoBar'), cargoText: $('cargoText'),
      money: $('money'), depth: $('depth'),
      heavyTag: $('heavyTag'),
      wreckHud: $('wreckHud'), wreckInfo: $('wreckInfo'),
      prompt: $('prompt'), toasts: $('toasts'),
      radio: $('radio'), radioWho: $('radio').querySelector('.radio-who'),
      radioText: $('radio').querySelector('.radio-text'),
      bossName: $('bossName'),
      overlay: $('overlay'), panel: $('panel'),
      bossbar: $('bossbar'), bossBar: $('bossBar'),
      items: {},
    };
    for (const k in ITEMS) this.el.items[k] = $('qty-' + k);
  },

  /* ---------------------------------------------------------------- HUD -- */
  updateHUD(p, game){
    const e = this.el;
    e.fuelBar.style.width  = (ratio(p.fuel, p.maxFuel) * 100) + '%';
    e.hullBar.style.width  = (ratio(p.hull, p.maxHull) * 100) + '%';
    e.cargoBar.style.width = (ratio(p.cargoCount, p.maxCargo) * 100) + '%';

    e.fuelText.textContent  = `${p.fuel.toFixed(0)}/${p.maxFuel} L`;
    e.hullText.textContent  = `${Math.ceil(p.hull)}/${p.maxHull}`;
    e.cargoText.textContent = `${p.cargoCount}/${p.maxCargo}`;

    e.money.textContent = money(p.money);
    e.depth.textContent = `${Math.round(p.depth)} m`;

    /* Kritik seviyelerde yanıp sönme */
    e.fuelBar.style.filter = p.fuel / p.maxFuel < 0.18 ? 'brightness(1.8)' : '';
    e.hullBar.style.filter = p.hull / p.maxHull < 0.25 ? 'brightness(1.8)' : '';

    /* Ağır yük: uçuşu ve yakıtı doğrudan etkilediği için görünür olmalı */
    e.heavyTag.classList.toggle('hidden', !p.heavy);

    /* Enkaz göstergesi — kaybedilen yükün değeri gözünün önünde dursun */
    if (game.wreck){
      e.wreckHud.classList.remove('hidden');
      e.wreckInfo.textContent = `${game.wreck.depth} m · ${money(game.wreck.value)}`;
    } else e.wreckHud.classList.add('hidden');

    for (const k in ITEMS){
      const n = p.items[k] || 0;
      this.el.items[k].textContent = n;
      this.el.items[k].parentElement.classList.toggle('empty', n <= 0);
    }

    if (game.boss && !game.boss.dead){
      e.bossbar.classList.remove('hidden');
      e.bossBar.style.width = (ratio(game.boss.hp, game.boss.maxHp) * 100) + '%';
    } else e.bossbar.classList.add('hidden');
  },

  /** HUD gizliyken içindeki elemanların ölçüsü 0'dır; bu yüzden HUD her
   *  görünür olduğunda oyun, uçan madenlerin hedefini yeniden hesaplar. */
  showHUD(on){
    this.el.hud.classList.toggle('hidden', !on);
    if (on && window.game) window.game.computeHudAnchors();
  },

  /** Uçan maden kasa barına vardığında bar bir an parlar.
   *  "Bir şey eklendi" geri bildiriminin son halkası — animasyon yeniden
   *  başlatılabilsin diye sınıf kaldırılıp reflow tetikleniyor. */
  pulseCargo(){
    const b = this.el.cargoBar;
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  },

  /* ------------------------------------------------------------ Mesajlar -- */
  toast(msg, kind = ''){
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2600);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  },

  /** Sürekli tetiklenen uyarılar (ör. "matkap yetersiz") için kısılmış toast */
  hint(msg){
    const now = performance.now();
    if (msg === this._lastHint && now - this._hintTimer < 2400) return;
    this._lastHint = msg; this._hintTimer = now;
    this.toast(msg);
  },

  prompt(text){
    if (text){ this.el.prompt.textContent = text; this.el.prompt.classList.remove('hidden'); }
    else this.el.prompt.classList.add('hidden');
  },

  /* ------------------------------------------------------------- TELSİZ -- */
  /* Mesajlar üst üste binmesin diye kuyruğa alınır: iki derinlik eşiği hızlı
     geçilirse ikincisi birincinin bitmesini bekler. Okuma süresi metin
     uzunluğuna göre hesaplanır. */
  _radioQueue: [], _radioTimer: null,

  radio(who, text, staticLevel = 0){
    this._radioQueue.push({ who, text, s: staticLevel });
    if (!this._radioTimer) this._radioNext();
  },

  _radioNext(){
    const m = this._radioQueue.shift();
    if (!m){ this._radioTimer = null; this.el.radio.classList.add('hidden'); return; }

    const e = this.el;
    e.radioWho.textContent = m.who;
    e.radioText.textContent = m.text;
    e.radio.className = 's' + clamp(m.s, 0, 2);      // 'hidden' sınıfını da temizler

    /* ~14 karakter/saniye okuma hızı. Üst sınır 22 sn: eskiden 11 sn'di ve
       ~280 karakterlik bir mesajı saniyede 26 karakter okumaya zorluyordu —
       oyuncu cümlenin yarısında kaybediyordu. */
    const dur = clamp(m.text.length / 14, 4.5, 22) * 1000;
    this._radioTimer = setTimeout(() => this._radioNext(), dur);
  },

  clearRadio(){
    this._radioQueue.length = 0;
    if (this._radioTimer){ clearTimeout(this._radioTimer); this._radioTimer = null; }
    this.el.radio.className = 'hidden';
  },

  setBossName(n){ if (this.el.bossName) this.el.bossName.textContent = n; },

  /* -------------------------------------------------------------- Panel -- */
  /** html: panel içeriği. onMount: DOM hazır olunca çağrılır (buton bağlama). */
  openPanel(html, onMount){
    this.el.panel.innerHTML = html;
    this.el.overlay.classList.remove('hidden');
    if (onMount) onMount(this.el.panel);
  },
  closePanel(){
    this.el.overlay.classList.add('hidden');
    this.el.panel.innerHTML = '';
  },
  get panelOpen(){ return !this.el.overlay.classList.contains('hidden'); },
};

window.UI = UI;
