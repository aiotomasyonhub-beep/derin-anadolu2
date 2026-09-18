/* ============================================================================
   build-artifact.js — index.html'i Claude Artifact formatına dönüştürür

   NEDEN GEREKLİ: Artifact platformu yayınladığın dosyayı kendi
   <!doctype html><head>…</head><body> iskeletinin İÇİNE koyar. Tam bir HTML
   belgesi gönderirsen iç içe <html>/<head> etiketleri oluşur.

   Bu betik index.html'i tek doğru kaynak olarak bırakır ve ondan türetir:
     • <!DOCTYPE>, <html>, <head>, <body> sarmalayıcıları atılır
     • <title> ve stil bağlantısı korunur (dosyanın başında olmalı)
     • charset/viewport meta'ları atılır — iskelet kendi sürümünü koyuyor
     • ?v=1.0 önbellek kırıcıları atılır — Artifact sürümlemeyi kendi yapar

   Kullanım:  node build-artifact.js   →  dist/artifact.html
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.html');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'artifact.html');

let html = fs.readFileSync(SRC, 'utf8');

/* --- head'den taşınacaklar --- */
const title = (html.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
const styleLink = (html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/i) || [''])[0];
const iconLink = (html.match(/<link[^>]*rel=["']icon["'][^>]*>/i) || [''])[0];

/* --- gövdeyi çıkar --- */
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error('index.html içinde <body> bulunamadı');
let body = bodyMatch[1];

/* --- önbellek kırıcı sorgu dizelerini temizle --- */
const strip = s => s.replace(/(\.(?:css|js))\?v=[\d.]+/g, '$1');

const out = [
  title,
  iconLink,
  strip(styleLink),
  '',
  strip(body).trim(),
  '',
].join('\n');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, out, 'utf8');

console.log(`dist/artifact.html yazıldı (${(out.length / 1024).toFixed(1)} KB)`);
