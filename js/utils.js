/* ============================================================================
   utils.js — küçük yardımcılar
   ============================================================================ */

/** Deterministik (tohumlu) rastgele sayı üreteci.
 *  Aynı tohum = aynı harita. Kayıt dosyası sadece tohumu + kazılan karoları
 *  tuttuğu için 40.000 karoluk haritayı diske yazmaya gerek kalmaz. */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
const lerp  = (a, b, t) => a + (b - a) * t;

/** [a,b) aralığında rastgele ondalık */
const rand = (rng, a, b) => a + rng() * (b - a);
/** [a,b] aralığında rastgele tam sayı */
const randInt = (rng, a, b) => Math.floor(a + rng() * (b - a + 1));
/** Diziden rastgele eleman */
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** ₺ biçimlendirme: 1234567 -> "₺1.234.567" */
function money(n){
  return '₺' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Dikdörtgen çakışması */
function aabb(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Değeri 0..1 aralığına oranlar (bar dolulukları için) */
const ratio = (v, max) => max <= 0 ? 0 : clamp(v / max, 0, 1);

/** Basit renk karartma/aydınlatma: '#rrggbb' + miktar(-255..255) */
function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

window.mulberry32 = mulberry32; window.clamp = clamp; window.lerp = lerp;
window.rand = rand; window.randInt = randInt; window.pick = pick;
window.money = money; window.aabb = aabb; window.ratio = ratio; window.shade = shade;
