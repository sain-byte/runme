// ===== Generator Story (file terpisah dari logic.js) =====
// Butuh dari logic.js (dipakai pas dipanggil, bukan pas load): $, S, num, sec, fT, esc, MID
// Butuh dari story-logo.js: SH_LOGO (opsional; kalau ga ada, template Grid tampil tanpa logo)
//
// ===== CARA NAMBAH TEMPLATE BARU =====
// 1) Bikin fungsi  shNamaBaru(ctx, r)  yang return  {lay, mw, H}
//      r   = 1 baris data sesi (r.tanggal, r.jarak, r.waktu, r.pace, r.hr, r.cadence, r.stride, r.vo2, r.kategori, r.catatan, r.d)
//      lay = daftar elemen:  teks {t, f, s, x, yb}  atau logo {logo:true, x, y, w, h}
//            f = font: 'A' Anton, 'O' Oswald, 'I5' Inter 500, 'I7' Inter 700   (s = ukuran px, yb = baseline y)
//      mw  = lebar konten, H = tinggi konten (px)
//    Pakai shM(ctx) buat ukur teks: const {meas, capR} = shM(ctx);
// 2) Daftarin di SH_TPL di bawah: id: {label: 'Nama di tombol', layout: shNamaBaru}
//    Tombol template di modal otomatis muncul, index.html ga perlu diubah.
const G = {st: 'white', tpl: 'poster', mode: 'tight', bg: 0, fonts: null, logo: null};
function shLogo(){
  // logo opsional: kalau gagal decode, resolve null (jangan reject) biar Story tetap bisa render
  if (!G.logo) G.logo = new Promise(res => {
    if (typeof SH_LOGO !== 'string' || !SH_LOGO) return res(null);   // story-logo.js ga ke-load -> tanpa logo
    const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = SH_LOGO;
  });
  return G.logo;
}
const SH_ST = {white:['#FFFFFF',null], black:['#000000',null], wob:['#FFFFFF','#000000'], bow:['#000000','#FFFFFF']};
function shFonts() {
  if (!G.fonts) {
    G.fonts = Promise.all([
      '400 100px Anton', '400 30px Oswald', '400 100px Inter', '500 100px Inter', '700 40px Inter'
    ].map(f => document.fonts.load(f))).then(() => document.fonts.ready).catch(() => {});
  }
  return G.fonts;
}
function openShare(id) {
  const rows = [...S.rows].sort((a, b) => (+b.d || 0) - (+a.d || 0) || b.no - a.no);
  if (!rows.length) return alert('Belum ada data sesi');
  if (!SH_TPL[G.tpl]) G.tpl = Object.keys(SH_TPL)[0];
  shTplBtns();
  $('shS').innerHTML = rows.map(r => `<option value="${esc(r.id)}">${esc(r.tanggal)} • ${esc(r.kategori)} • ${esc(r.jarak)} km</option>`).join('');
  if (id) $('shS').value = id;
  $('shM').classList.remove('hidden'); shSet('mode', G.mode);
}
function shSet(k, v) {
  G[k] = v;
  document.querySelectorAll('[data-g="' + k + '"]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('shYW').classList.toggle('hidden', G.mode !== 'full');
  shDraw();
}
function shBg() { G.bg = (G.bg + 1) % 3; $('shBgL').textContent = ['Kotak-kotak', 'Gelap', 'Terang'][G.bg]; shPv(); }
function shPv() { const w = $('shW'); w.classList.toggle('chk', G.bg === 0); w.style.backgroundColor = ['', '#161616', '#f1f1f1'][G.bg]; }
async function shDraw() {
  const [, logo] = await Promise.all([shFonts(), shLogo()]);
  G.logo = logo;
  const r = S.rows.find(x => x.id === $('shS').value); if (!r) return;
  $('shYL').textContent = $('shY').value + ' px';
  shRender($('shC'), r, G.st, G.mode, +$('shY').value); shPv();
}

const FAM = {A: 'Anton, Impact, "Arial Narrow Bold", sans-serif', O: 'Oswald, "Arial Narrow", sans-serif', I: 'Inter, system-ui, sans-serif'};
const shF = (f, s) => f[0] === 'I' ? `${f.slice(1)}00 ${s}px ${FAM.I}` : `400 ${s}px ${FAM[f]}`;
const shM = ctx => ({
  meas: (t, f, s) => { ctx.font = shF(f, s); return ctx.measureText(t).width; },
  capR: f => { ctx.font = shF(f, 100); return (ctx.measureText('H').actualBoundingBoxAscent / 100) || .72; }
});
const MAXW = 840;

function shPoster(ctx, r) {
  const {meas, capR} = shM(ctx);
  const sizeFor = (t, f, capT) => { let s = capT / capR(f); while (s > 12 && meas(t, f, s) > MAXW) s -= 2; return s; };
  const wrap = (txt, f, s, max) => {
    const out = []; let cur = '';
    for (const wd of String(txt).trim().split(/[ \t\n]+/).filter(Boolean)) { const t = cur ? cur + ' ' + wd : wd; if (meas(t, f, s) <= MAXW) cur = t; else { if (cur) out.push(cur); cur = wd; } }
    if (cur) out.push(cur);
    if (out.length > max) { out.length = max; let l = out[max - 1]; while (l.length > 1 && meas(l + '…', f, s) > MAXW) l = l.slice(0, -1); out[max - 1] = l.replace(/[\s,.;:-]+$/, '') + '…'; }
    return out;
  };
  const stat = [fT(r.waktu), r.pace ? r.pace + '/km' : '', num(r.hr) ? Math.round(num(r.hr)) + ' bpm' : ''].filter(Boolean).join(' • ');
  const extra = [num(r.cadence) ? 'CAD ' + Math.round(num(r.cadence)) : '', num(r.vo2) ? 'VO2 ' + num(r.vo2) : '', num(r.stride) ? 'STR ' + Math.round(num(r.stride)) : '', String(r.catatan || '').trim()].filter(Boolean).join(' •\u00A0');
  const spec = [['Run • ' + (r.tanggal || ''), 'A', 54, 0]];
  if (r.kategori) spec.push([String(r.kategori), 'A', 46, 24]);
  spec.push([String(r.jarak).replace(',', '.') + ' km', 'A', 215, 40]);
  if (stat) spec.push([stat, 'A', 58, 56]);
  if (extra) { const es = 26 / capR('O'); wrap(extra, 'O', es, 2).forEach((t, i) => spec.push([t, 'O', 26, i ? 14 : 28])); }
  let yb = 0, mw = 0, lastS = 0; const lay = [];
  spec.forEach(([t, f, capT, before], i) => {
    const s = f === 'O' ? 26 / capR('O') : sizeFor(t, f, capT), c = s * capR(f);
    yb = i ? yb + before + c : c; lastS = s; mw = Math.max(mw, meas(t, f, s)); lay.push({t, f, s, yb, x: 0});
  });
  return {lay, mw, H: Math.round(yb + lastS * .28)};
}

function shStrava(ctx, r) {
  const {meas, capR} = shM(ctx), COLW = 330, w = sec(r.waktu);
  const dur = w >= 1e9 ? fT(r.waktu) : w >= 3600
    ? `${Math.floor(w / 3600)}h ${String(Math.floor(w % 3600 / 60)).padStart(2, '0')}m ${String(w % 60).padStart(2, '0')}s`
    : `${Math.floor(w / 60)}m ${String(w % 60).padStart(2, '0')}s`;
  const d = r.d;
  const tgl = d
    ? String(d.getDate()).padStart(2, '0') + ' ' + MID[d.getMonth()] + ' ' + d.getFullYear()
    : (r.tanggal || '');
  const dist = num(r.jarak) ? num(r.jarak).toFixed(2) + ' km' : '—';
  const strideN = num(r.stride);
  const stride = strideN ? Math.round(strideN) + ' cm' : '—';
  const cells = [
    ['Distance', dist], ['Pace', r.pace ? r.pace + ' /km' : '—'], ['Cadence', num(r.cadence) ? Math.round(num(r.cadence)) + ' spm' : '—'],
    ['Time', dur], ['Stride', stride], ['Avg HR', num(r.hr) ? Math.round(num(r.hr)) + ' bpm' : '—']
  ];
  const cv = capR('I7'), cl = capR('I7'), dateCap = capR('I5');
  let vs = 34 / cv;
  while (vs > 17 && Math.max(...cells.map(c => meas(c[1], 'I7', vs))) > COLW - 22) vs -= 1;
  const vcap = vs * cv; const ls = 16 / cl;
  const logoW = 350; const logoH = logoW * 305 / 1234;
  const lay = [];
  lay.push({logo: true, x: 0, y: 0, w: logoW, h: logoH});
  lay.push({t: tgl, f: 'I5', s: 17 / dateCap, x: 0, yb: 108});
  let yb = 171;
  for (let row = 0; row < 2; row++) {
    const yl = yb; const yv = yl + 12 + vcap;
    cells.slice(row * 3, row * 3 + 3).forEach((c, i) => {
      lay.push({t: c[0], f: 'I7', s: ls, x: i * COLW, yb: yl});
      lay.push({t: c[1], f: 'I7', s: vs, x: i * COLW, yb: yv});
    });
    yb = yv + vcap + 52;
  }
  const textW = Math.max(...lay.filter(o => o.t).map(o => o.x + meas(o.t, o.f, o.s)));
  return {lay, mw: Math.max(textW, COLW * 3 - 12), H: Math.round(yb - 14)};
}

// ===== DAFTAR TEMPLATE (tambah di sini) =====
const SH_TPL = {
  poster: {label: 'Poster (Anton)', layout: shPoster},
  strava: {label: 'Grid (gaya Strava)', layout: shStrava}
};
function shTplBtns() {
  const w = $('shTpl'); if (!w || w.dataset.ready) return;
  w.innerHTML = Object.entries(SH_TPL).map(([id, t]) => `<button class="btn${G.tpl === id ? ' on' : ''}" data-g="tpl" data-v="${id}" onclick="shSet('tpl','${id}')">${t.label}</button>`).join('');
  w.dataset.ready = '1';
}

function shRender(cv, r, st, mode, bot) {
  const ctx = cv.getContext('2d'), m = (SH_TPL[G.tpl] || SH_TPL.poster).layout(ctx, r);
  const [fill, line] = SH_ST[st], pad = 40 + (line ? 16 : 0);
  let cw, ch, x0, y0;
  if (mode === 'full') { cw = 1080; ch = 1920; x0 = 90; y0 = ch - bot - m.H; } else { cw = Math.ceil(m.mw + pad * 2); ch = m.H + pad * 2; x0 = pad; y0 = pad; }
  cv.width = cw; cv.height = ch;
  ctx.clearRect(0, 0, cw, ch); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  for (const o of m.lay) {
    if (o.logo) {
      const img = G.logo; if (!img) continue; const drawX = x0 + o.x, drawY = y0 + o.y;
      if (line) {
        ctx.save(); ctx.globalAlpha = 0.98;
        const pad = Math.max(2, Math.round(o.h * .045));
        for (let dx = -pad; dx <= pad; dx += 2) {
          for (let dy = -pad; dy <= pad; dy += 2) {
            if (dx * dx + dy * dy <= pad * pad) {
              ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
              ctx.drawImage(img, drawX + dx, drawY + dy, o.w, o.h);
            }
          }
        }
        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = line;
        ctx.fillRect(drawX - pad, drawY - pad, o.w + pad * 2, o.h + pad * 2); ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(img, drawX, drawY, o.w, o.h);
      if (fill !== '#FFFFFF') {
        const tmp = document.createElement('canvas'); tmp.width = Math.ceil(o.w); tmp.height = Math.ceil(o.h);
        const tc = tmp.getContext('2d'); tc.drawImage(img, 0, 0, o.w, o.h);
        tc.globalCompositeOperation = 'source-in'; tc.fillStyle = fill;
        tc.fillRect(0, 0, tmp.width, tmp.height); ctx.clearRect(drawX, drawY, o.w, o.h);
        ctx.drawImage(tmp, drawX, drawY);
      }
      ctx.restore(); continue;
    }
    ctx.font = shF(o.f, o.s);
    if (line) { ctx.lineWidth = Math.max(3, Math.min(o.s * .1, 16)); ctx.strokeStyle = line; ctx.strokeText(o.t, x0 + o.x, y0 + o.yb); }
    ctx.fillStyle = fill; ctx.fillText(o.t, x0 + o.x, y0 + o.yb);
  }
}

const shBlob = () => new Promise(res => $('shC').toBlob(res, 'image/png'));
function shName() { const r = S.rows.find(x => x.id === $('shS').value); return 'log-run-' + String((r && r.tanggal) || 'sesi').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png'; }
async function shDl() { const b = await shBlob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = shName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function shShare() {
  const b = await shBlob(), f = new File([b], shName(), {type: 'image/png'});
  try {
    if (navigator.canShare && navigator.canShare({files: [f]})) await navigator.share({files: [f]});
    else { await shDl(); alert('Share file belum didukung di browser ini, gambar diunduh.'); }
  } catch (e) { if (e.name !== 'AbortError') alert('Gagal share: ' + e.message); }
}
