/* ============================================================================
   shops.js — YÜZEYDEKİ MEKÂNLAR (PRD md.3)

   Maden Kooperatifi (Rıza Başkan)      → madenleri nakde çevir
   Çaycı & Akaryakıtçı Remzi            → mazot al (semaver hep kaynar)
   Sanayi Sitesi (Kaportacı Cabbar)     → 6 donanım, 5'er seviye
   Bakkal                               → tek seferlik eşyalar
   ============================================================================ */

const Shops = {
  current: null,

  open(id, game){
    this.current = id;
    game.paused = true;
    this.render(game);
  },
  close(game){
    this.current = null;
    game.paused = false;
    UI.closePanel();
  },

  render(game){
    const p = game.player;
    const html = this['html_' + this.current](game, p);
    UI.openPanel(html, panel => this.bind(panel, game));
  },
  refresh(game){ if (this.current) this.render(game); },

  /** data-act özniteliği taşıyan her butonu eylem tablosuna bağlar. */
  bind(panel, game){
    panel.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act, arg = btn.dataset.arg;
        this.actions[act](game, arg, btn);
        if (act !== 'exit') this.refresh(game);
      });
    });
  },

  header(title, npc, line, p){
    return `
      <h1>${title}</h1>
      <div class="dim">${npc}</div>
      <div class="npc-line">“${line}”</div>
      <div class="kv"><span>Kasandaki para</span><span>${money(p.money)}</span></div>
    `;
  },
  footer(){
    return `<div class="actions">
      <button data-act="exit" class="primary">ÇIK (ESC)</button>
    </div>`;
  },

  /* ====================================================== KOOPERATİF ===== */
  html_kooperatif(game, p){
    let rows = '';
    let any = false;
    for (const t of ORE_ORDER){
      const n = p.cargo[t] || 0;
      if (!n) continue;
      any = true;
      const d = TILES[t];
      rows += `<div class="row">
        <span class="nm" style="color:${Art.PAL[t][2]}">${d.name}</span>
        <span class="lv">${n} adet × ${money(d.value)}</span>
        <span class="pr">${money(n * d.value)}</span>
      </div>`;
    }
    if (!any) rows = `<div class="row"><span class="nm dim">Kasa bomboş. Dipte iş var Davut.</span></div>`;

    const total = p.cargoValue();

    /* --- hurda sigortası: enkazı kurtarmaya gücü yetmeyen oyuncu için
       ölüm sarmalından çıkış kapısı. Ucuza alır, ama alır. --- */
    let wreckBlock = '';
    if (game.wreck){
      const w = game.wreck;
      const paid = Math.floor(w.value * CFG.WRECK_INSURANCE);
      wreckBlock = `
        <h3>HURDA SİGORTASI</h3>
        <div class="npc-line">“${w.depth} metrede bir enkazın var diye duydum. Bak, ben o yükü uzaktan da alırım ama yarısını bile veremem, riziko bende.”</div>
        <div class="row">
          <span class="nm">Enkazdaki yük<br><span class="dim">${w.depth} m · ${w.cargoCount} birim · piyasa değeri ${money(w.value)}</span></span>
          <span class="pr">${money(paid)}</span>
          <button data-act="insurance" class="danger">SAT (%${Math.round(CFG.WRECK_INSURANCE * 100)})</button>
        </div>
        <p class="dim">Satarsan enkaz kaybolur. Kendin gidip kurtarırsan tamamı senin.</p>`;
    }

    return this.header('MADEN KOOPERATİFİ', 'Rıza Başkan — kooperatif müdürü',
      any ? 'Getir bakalım, tartalım. Boru değil bu Anadolu\'nun kanı.'
          : 'Elin boş gelmişsin usta. Mazotu yak da bir şeyler getir.', p)
      + `<h3>KASA İÇERİĞİ (${p.cargoCount}/${p.maxCargo})</h3>
         <div class="rows">${rows}</div>
         <div class="kv" style="margin-top:12px"><span>TOPLAM</span><span>${money(total)}</span></div>
         ${wreckBlock}
         <div class="actions">
           <button data-act="sell" ${total ? '' : 'disabled'}>HEPSİNİ SAT</button>
           <button data-act="exit" class="primary">ÇIK (ESC)</button>
         </div>`;
  },

  /* ======================================================= AKARYAKIT ===== */
  html_akaryakit(game, p){
    const miss = Math.ceil(p.maxFuel - p.fuel);
    const full = miss * CFG.FUEL_PRICE;
    const half = Math.min(miss, 50), halfCost = half * CFG.FUEL_PRICE;
    return this.header('ÇAYCI & AKARYAKITÇI REMZİ', 'Remzi — 30 yıldır aynı semaver',
      'Çay demli, mazot bol. Otur bir demle, sonra in aşağı.', p)
      + `<div class="kv"><span>Depo</span><span>${p.fuel.toFixed(0)} / ${p.maxFuel} L</span></div>
         <div class="kv"><span>Litre fiyatı</span><span>${money(CFG.FUEL_PRICE)}</span></div>
         <div class="kv"><span>Eksik</span><span>${miss} L</span></div>
         <div class="actions">
           <button data-act="fuel" data-arg="full" ${miss && p.money >= full ? '' : 'disabled'}>
             DEPOYU FULLE — ${money(full)}
           </button>
           <button data-act="fuel" data-arg="half" ${half && p.money >= halfCost ? '' : 'disabled'}>
             ${half} L AL — ${money(halfCost)}
           </button>
           <button data-act="cay">ÇAY İÇ (BEDAVA)</button>
           <button data-act="exit" class="primary">ÇIK (ESC)</button>
         </div>
         <p class="dim" style="margin-top:14px">Not: Uçmak, yerde gitmekten ~3 kat fazla mazot yakar. Derine inerken serbest düşüşü kullan yukarı çıkarken tünelini takip et.</p>`;
  },

  /* =========================================================== SANAYİ ===== */
  html_sanayi(game, p){
    let rows = '';
    for (const key in UPGRADES){
      const u = UPGRADES[key];
      const lv = p.upg[key];                 // 1..5
      const maxed = lv >= 5;
      const cost = maxed ? 0 : u.cost[lv - 1];
      const bars = '█'.repeat(lv) + '░'.repeat(5 - lv);
      rows += `<div class="row ${maxed ? 'maxed' : ''}">
        <span class="nm">${u.label}<br><span class="dim">${u.names[lv - 1]}</span></span>
        <span class="lv">${bars} ${lv}/5</span>
        <span class="pr">${maxed ? 'TAM' : money(cost)}</span>
        <button data-act="upgrade" data-arg="${key}" ${maxed || p.money < cost ? 'disabled' : ''}>
          ${maxed ? '—' : 'AL'}
        </button>
      </div>`;
    }
    const repairNeed = Math.ceil(p.maxHull - p.hull);
    const repairCost = repairNeed * CFG.REPAIR_PRICE;

    return this.header('SANAYİ SİTESİ', 'Kaportacı Cabbar Usta',
      'Getir şu hurdayı, bi\' bakayım... Bu motorla yedi kat dibe inilmez oğlum.', p)
      + `<h3>DONANIM</h3><div class="rows">${rows}</div>
         <h3>TAMİR</h3>
         <div class="row">
           <span class="nm">Şasi tamiri</span>
           <span class="lv">${Math.ceil(p.hull)}/${p.maxHull} can</span>
           <span class="pr">${money(repairCost)}</span>
           <button data-act="repair" ${repairNeed && p.money >= repairCost ? '' : 'disabled'}>YAP</button>
         </div>`
      + this.footer();
  },

  /* =========================================================== BAKKAL ===== */
  html_bakkal(game, p){
    let rows = '';
    for (const key in ITEMS){
      const it = ITEMS[key];
      const have = p.items[key] || 0;
      const full = have >= it.max;
      rows += `<div class="row ${full ? 'maxed' : ''}">
        <span class="nm">${it.label}<br><span class="dim">${it.desc}</span></span>
        <span class="lv">Elinde: ${have}/${it.max}</span>
        <span class="pr">${money(it.price)}</span>
        <button data-act="buyitem" data-arg="${key}" ${full || p.money < it.price ? 'disabled' : ''}>AL</button>
      </div>`;
    }
    return this.header('BAKKAL', 'Bakkal Şükrü — veresiye defteri kalın',
      'Dinamit mi? Var var. Ama bu sefer peşin usta, defter doldu.', p)
      + `<div class="rows">${rows}</div>` + this.footer();
  },

  /* ========================================================== EYLEMLER ==== */
  actions: {
    sell(game){
      const p = game.player;
      const total = p.sellAll();
      Sfx.play('cash');
      UI.toast(`Rıza Başkan ${money(total)} saydı.`, 'good');
    },
    insurance(game){
      const paid = game.sellWreckInsurance();
      Sfx.play('cash');
      UI.toast(`Enkaz sigortaya devredildi. ${money(paid)} alındı.`, 'good');
    },
    fuel(game, arg){
      const p = game.player;
      const miss = Math.ceil(p.maxFuel - p.fuel);
      const amount = arg === 'full' ? miss : Math.min(miss, 50);
      const cost = amount * CFG.FUEL_PRICE;
      if (p.money < cost) return;
      p.money -= cost; p.addFuel(amount);
      Sfx.play('buy');
      UI.toast(`${amount} L mazot alındı.`, 'good');
    },
    cay(game){
      UI.toast('Remzi bir tavşankanı tazeledi. Davut Usta\'nın keyfi yerinde.', 'good');
      game.player.repair(6);    // küçük moral bonusu
    },
    upgrade(game, key){
      const p = game.player, u = UPGRADES[key];
      const lv = p.upg[key];
      if (lv >= 5) return;
      const cost = u.cost[lv - 1];
      if (p.money < cost) return;
      p.money -= cost;
      p.upg[key] = lv + 1;
      /* Depo/şasi büyüyünce fark kadar dolsun ki oyuncu cezalandırılmasın */
      if (key === 'tank') p.addFuel(u.fuel[lv] - u.fuel[lv - 1]);
      if (key === 'hull') p.repair(u.hp[lv] - u.hp[lv - 1]);
      Sfx.play('artifact');
      UI.toast(`${u.label}: ${u.names[lv]} takıldı!`, 'good');
    },
    repair(game){
      const p = game.player;
      const need = Math.ceil(p.maxHull - p.hull);
      const cost = need * CFG.REPAIR_PRICE;
      if (p.money < cost) return;
      p.money -= cost; p.repair(need);
      Sfx.play('buy');
      UI.toast('Cabbar Usta kaportayı düzeltti.', 'good');
    },
    buyitem(game, key){
      const p = game.player, it = ITEMS[key];
      if (p.money < it.price || (p.items[key] || 0) >= it.max) return;
      p.money -= it.price;
      p.items[key] = (p.items[key] || 0) + 1;
      Sfx.play('buy');
      UI.toast(`${it.label} alındı.`, 'good');
    },
    exit(game){ Shops.close(game); },
  },
};

window.Shops = Shops;
