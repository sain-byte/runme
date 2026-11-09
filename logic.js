const API = 'https://script.google.com/macros/s/AKfycbxRM5j6PF7gLAD_DfIIeiOdtDMF9pblJAV5IaX3gl5qAz8RlR-b6OilGtfv-EgFEg0YmQ/exec';
const $ = id => document.getElementById(id);
const MON = {jan:0,feb:1,mar:2,apr:3,mei:4,may:4,jun:5,jul:6,agu:7,ags:7,agt:7,aug:7,sep:8,okt:9,oct:9,nov:10,des:11,dec:11};
const MID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const H = {tanggal:'Tanggal',kategori:'Kategori',jarak:'Jarak (km)',waktu:'Waktu',pace:'Pace',hr:'HR',cadence:'Cadence',vo2:'VO2 Max',stride:'Stride',catatan:'Catatan'};
const F = [['tanggal','Tanggal'],['kategori','Kategori'],['jarak','Jarak (km)'],['waktu','Waktu (mm:ss)'],['pace','Pace'],['hr','HR'],['cadence','Cadence'],['vo2','VO2 Max'],['stride','Stride'],['catatan','Catatan']];
let S = {token:'', role:'', rows:[], editId:null, charts:[], f:[], sort:{k:null,dir:1}, target:50};

try { S.token = localStorage.getItem('tk') || ''; S.role = localStorage.getItem('rl') || ''; S.target = parseFloat(localStorage.getItem('tgt')) || 50; } catch(e){}
try { const _t = +localStorage.getItem('tkt') || 0; if (S.token && (!_t || Date.now() - _t > 21600000)) { S.token = ''; S.role = ''; ['tk','rl','tkt'].forEach(k => localStorage.removeItem(k)); } } catch(e){}

const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function sec(t){ const p = String(t).split(':').map(Number); if(!p.length || p.some(isNaN)) return 1e9; if(p.length === 3) return p[0] >= 10 ? p[0]*60 + p[1] : p[0]*3600 + p[1]*60 + p[2]; return p.length === 2 ? p[0]*60 + p[1] : 1e9; }
const fT = t => { const p = String(t).split(':'); return p.length === 3 && +p[0] >= 10 ? p[0] + ':' + p[1] : t; };
function pDate(s){ const m = String(s).toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s*(\d{4})?/); if(!m || MON[m[2].slice(0,3)] === undefined) return null; return new Date(+(m[3] || new Date().getFullYear()), MON[m[2].slice(0,3)], +m[1]); }
const fromRow = r => { const o = {id: r.id}; for(const k in H) o[k] = r[H[k]] ?? ''; o.d = pDate(o.tanggal); return o; };
const toRow = o => { const r = {}; for(const k in H) r[H[k]] = String(o[k] ?? ''); return r; };

async function api(action, extra={}){
  const r = await fetch(API, {method: 'POST', body: JSON.stringify({action, token: S.token, ...extra})});
  const j = await r.json();
  if (j.error === 'unauthorized') { dropSess(); throw new Error('Sesi habis, login lagi'); }
  if (!j.ok) throw new Error(j.error || 'gagal');
  return j;
}

function applyAuth(){
  const adm = S.role === 'admin';
  document.querySelectorAll('.adm').forEach(e => e.classList.toggle('hidden', !adm));
  const b = $('authBtn'); if (b) b.textContent = S.token ? 'Logout' : 'Login';
  const r = $('role'); if (r) r.textContent = S.token ? S.role.toUpperCase() : 'VIEW';
}

function dropSess(){ S.token = ''; S.role = ''; try { ['tk','rl','tkt'].forEach(k => localStorage.removeItem(k)); } catch(e){} applyAuth(); }
function authClick(){ if (S.token) logout(); else { $('login').classList.remove('hidden'); $('pw').focus(); } }
function show(){ applyAuth(); load(); }
function logout(){ const t = S.token; dropSess(); if (t) fetch(API, {method: 'POST', body: JSON.stringify({action: 'logout', token: t})}).catch(()=>{}); show(); }

const DEF_CFG = {pb_12min: '11:30-12:30', pb_5k: '4.9-5.2', pb_10k: '9.9-10.2', pb_hm: '21.0-21.3', pb_marathon: '42.1-42.6'};
const rng = s => String(s || '').split('-').map(x => x.trim());
function pbDefs(){
  const c = Object.assign({}, DEF_CFG, S.cfg || {});
  const mk = (k, l, key, t) => {
    const p = rng(c[key]);
    return t ? {k, l, t: 1, lo: sec(p[0]), hi: sec(p[1]), txt: p[0] + ' - ' + p[1] + ' menit'}
             : {k, l, lo: num(p[0]), hi: num(p[1]), txt: p[0] + ' - ' + p[1] + ' km'};
  };
  return [mk('12m','12 Menit','pb_12min',1), mk('5k','5K','pb_5k'), mk('10k','10K','pb_10k'), mk('hm','Half','pb_hm'), mk('fm','Marathon','pb_marathon')];
}

const pbIn = (d, r) => { if (d.t) { const w = sec(r.waktu); return w >= d.lo && w <= d.hi; } const j = num(r.jarak); return j >= d.lo && j <= d.hi; };
const pbBetter = (d, a, b) => d.t ? num(a.jarak) > num(b.jarak) : sec(a.waktu) < sec(b.waktu);
function pbBest(d){ let b = null; S.rows.forEach(r => { if (pbIn(d, r) && (!b || pbBetter(d, r, b))) b = r; }); return b; }
function pbHist(d){ const rs = S.rows.filter(r => pbIn(d, r)).sort((a, b) => (+a.d || 0) - (+b.d || 0) || a.no - b.no); const o = []; let cur = null; rs.forEach(r => { if (!cur || pbBetter(d, r, cur)) { o.push({r, prev: cur}); cur = r; } }); return o.reverse(); }
const fSec = n => { n = Math.abs(Math.round(n)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
const sd = r => r.d ? r.d.getDate() + ' ' + MID[r.d.getMonth()] + (r.d.getFullYear() !== new Date().getFullYear() ? " '" + String(r.d.getFullYear()).slice(2) : '') : esc(r.tanggal);
function pbDelta(d, x){ if (!x.prev) return 'rekor pertama'; if (d.t) return '+' + Math.round((num(x.r.jarak) - num(x.prev.jarak)) * 1000) + ' m'; return '-' + fSec(sec(x.prev.waktu) - sec(x.r.waktu)); }

function openPB(k){
  const d = pbDefs().find(x => x.k === k); if (!d) return;
  const h = pbHist(d);
  $('pbT').textContent = 'Riwayat PB ' + d.l;
  $('pbB').innerHTML = `<div class="text-[12px] opacity-50 mb-2">Rentang ${esc(d.txt)} &bull; ${d.t ? 'jarak terjauh' : 'waktu tercepat'}</div>` +
    (h.length ? `<table class="w-full text-[13px] text-left"><thead class="text-[12px] uppercase opacity-50 border-b" style="border-color:var(--border)"><tr><th class="p-2">Tanggal</th><th class="p-2">Jarak</th><th class="p-2">Waktu</th><th class="p-2">Pace</th><th class="p-2">Selisih</th></tr></thead><tbody>` +
      h.map((x, i) => `<tr class="border-t" style="border-color:var(--border)"><td class="p-2">${esc(x.r.tanggal)}${i === 0 ? ' <span class="text-[10px] px-1 py-0.5 rounded-full bg-amber-400/15 text-amber-500 font-bold">REC</span>' : ''}</td><td class="p-2 mono">${esc(x.r.jarak)} km</td><td class="p-2 mono">${esc(fT(x.r.waktu))}</td><td class="p-2 mono">${esc(x.r.pace)}</td><td class="p-2 mono opacity-70">${pbDelta(d, x)}</td></tr>`).join('') +
      '</tbody></table>' : '<div class="p-3 text-center opacity-40 text-[13px]">Belum ada sesi di rentang ini</div>');
  $('pbM').classList.remove('hidden');
}

async function loadCfg(){ if (S.cfg) return; S.cfg = {}; try { const r = await fetch(API + '?action=config'); const j = await r.json(); if (j.ok && j.config) S.cfg = j.config; } catch(e){} }

async function load(){
  $('msg').textContent = 'Memuat...';
  const isAdm = S.role === 'admin';
  try {
    await loadCfg();
    let j;
    if (isAdm && S.token) {
      j = await api('list');
    } else {
      const r = await fetch(API + '?action=list');
      j = await r.json();
      if (!j.ok) throw new Error(j.error || 'gagal memuat data');
    }
    if (!Array.isArray(j.data)) throw new Error('Backend belum versi terbaru, deploy ulang Code.gs');
    S.rows = j.data.filter(r => r['Tanggal']).map(fromRow);
    S.rows.forEach((r, i) => r.no = i + 1);
    $('msg').textContent = '';
    fillMonths();
    render();
  } catch(e) {
    if (isAdm && !S.token) return load();
    $('msg').textContent = e.message;
  }
}

function filtered(){
  const df = $('fd').value, tf = $('ft').value, n = new Date();
  const sw = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7)); sw.setHours(0,0,0,0);
  const slw = new Date(sw); slw.setDate(sw.getDate() - 7);
  const lm = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return S.rows.filter(r => {
    const j = num(r.jarak);
    const k5 = pbDefs().find(x => x.k === '5k'); if ((df === 'lt_49' && !(j < k5.lo)) || (df === '5k' && !(j >= k5.lo && j <= k5.hi)) || (df === 'mid' && !(j > k5.hi && j <= 10)) || (df === 'gt10' && !(j > 10))) return false;
    const d = r.d;
    if (tf === 'all') return true;
    if (!d) return false;
    if (tf.startsWith('m:')) { const p = tf.slice(2).split('-'); return d.getFullYear() === +p[0] && d.getMonth() === +p[1] - 1; }
    if (tf === 'this_week') return d >= sw;
    if (tf === 'last_week') return d >= slw && d < sw;
    if (tf === 'this_month') return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
    if (tf === 'last_month') return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    if (tf === 'this_year') return d.getFullYear() === n.getFullYear();
    if (tf === 'last_year') return d.getFullYear() === n.getFullYear() - 1;
    return true;
  });
}

function fillMonths(){
  const g = $('ftm'); if (!g) return;
  const cur = $('ft').value;
  const ks = [...new Set(S.rows.filter(r => r.d).map(r => r.d.getFullYear() + '-' + String(r.d.getMonth() + 1).padStart(2, '0')))].sort().reverse();
  g.innerHTML = ks.map(k => `<option value="m:${k}">${MID[+k.slice(5) - 1]} ${k.slice(0, 4)}</option>`).join('');
  $('ft').value = cur; if ($('ft').value !== cur) $('ft').value = 'all';
}

function streak(){
  const ds = new Set(S.rows.filter(r => r.d).map(r => +r.d));
  const t = new Date(); let c = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (!ds.has(+c)) { c.setDate(c.getDate() - 1); if (!ds.has(+c)) return 0; }
  let n = 0; while (ds.has(+c)) { n++; c.setDate(c.getDate() - 1); }
  return n;
}

function setTarget(){
  if (S.role !== 'admin') return;
  const v = parseFloat(prompt('Target bulanan (km)', S.target));
  if (isNaN(v) || v < 0) return;
  S.target = v; try { localStorage.setItem('tgt', v); } catch(e){} render();
}

function sortBy(k){ S.sort = {k, dir: S.sort.k === k ? -S.sort.dir : 1}; renderTable(); }

function catInfo(k){
  const s = (k || '').toLowerCase();
  if (s.includes('pb')) return {dot: 'linear-gradient(135deg,#FDE68A,#F59E0B)', bg: 'rgba(251,191,36,.15)', text: '#FBBF24', border: 'rgba(251,191,36,.25)', label: 'PB'};
  if (s.includes('interval')) return {dot: 'linear-gradient(135deg,#D6FF57,#84CC16)', bg: 'rgba(214,255,87,.14)', text: '#A3E635', border: 'rgba(214,255,87,.2)', label: k};
  if (s.includes('easy')) return {dot: '#10B981', bg: 'rgba(16,185,129,.1)', text: '#10B981', border: 'rgba(16,185,129,.18)', label: k};
  if (s.includes('long')) return {dot: '#3B82F6', bg: 'rgba(59,130,246,.1)', text: '#3B82F6', border: 'rgba(59,130,246,.18)', label: k};
  if (s.includes('tempo')) return {dot: '#8B5CF6', bg: 'rgba(139,92,246,.1)', text: '#8B5CF6', border: 'rgba(139,92,246,.18)', label: k};
  if (s.includes('fast')) return {dot: '#F97316', bg: 'rgba(249,115,22,.1)', text: '#F97316', border: 'rgba(249,115,22,.18)', label: k};
  return {dot: 'var(--muted)', bg: 'var(--card)', text: 'var(--muted)', border: 'var(--border)', label: k || 'Lainnya'};
}

// ===== Generator Story =====
const G = {st: 'white', tpl: 'poster', mode: 'tight', bg: 0, fonts: null, logo: null};
const SH_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABNIAAAEJCAYAAABRzgqYAAEAAElEQVR42uydd5gsV3H2f90TdvdeZSQUCJLIQkggcrTIOeecDZhkbGycsMGZDyfAAWNjcgabaMCYHEXOOYggoYjyvXd3Z6b7+6NOuavP9qTd3tme2XqfZ56dndBz+oQ6Ve+pkOR5jqN2JEAKZEBuXssrPtMGloAV4FDgcOCa4e/hQBfoAxcDPwV+DlwYrrUGXBH+2ut2gEF4MOT3HQ6Hw+FwOBwOh8PhcDgcUyBxIm0mSIEWQmRlCGl2DHAScAvg5sDxwHL4/GHhMx0dp/D3MuAi4FfhWucDnwc+DvwQuBTYb363E35vEK6RhP8dDofD4XA4HA6Hw+FwOBxTwom07UEXWK94fhXghsBjEa+zayBeaCBeZ0n4vEK9ypSI09faQA8h03LgcuBM4D3A2xGvtQPh8y0Kz7R2eO6D7nA4HA6Hw+FwOBwOh8MxJZxI2z5Y0up44P7AA4FTEM8z9T5TYkyRUw7DTMzr9v8MIdhAiLouEub5LeD/AZ9GQkC7bAzzdDgcDofD4XA4HA6Hw+FwTAkn0ob0C6O9ttTLSPOgYZ7r3y4SorkUhEC7JhJqqQSaepNprjTM68kUbc3NQ3OynQe8BPg3xNNtdUibHQ6Hw+FwOBwOh8PhcDgcE8KJtK2hjRBVUCbSVoAnAfcCboMUE0jCZ7XAwFaItPgzecXjQuCfgBeH/weUwzwdDofD4XA4HA6Hw+FwOBxToO1dsCko8aUkWgfJWbYCnAz8HnBr4Kjw3hpFdU4Y7e2WbKI9WkhAr7sOHAs8ETgLyZvWM+11OBwOh8PhcDgcDofD4XBMCfdI2zrS8NgL3Bt4JpIHbS9CoC2Zz2oFTSUwc3ONaTCJ19oBhMT7KvA44Hvhe+6V5nA4HA6Hw+FwOBwOh8OxCaTeBZvuNw3JTIHrAH8OvBS4GQXJ1UXIK62wmSLkliL2JJsUw0i03FxrJfze9ZAw0xZFAQSHw+FwOBwOh8PhcDgcU8M90oY0S/g7rnD3Ag4BnAKciRFWbjUSXepBlSHhlZ8RvbgZxOzUXWwvxTLsYeBTwCaYn7RwOh8PhcDgcDofD4XA4HA6Hw+FwOBzTRf4/7nKk03vYkPgAAAAASUVORK5CYII=';
function shLogo(){
  if (!G.logo) G.logo = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = SH_LOGO; });
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
  const logoW = 350; const logoH = logoW * 265 / 1234;
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

function shRender(cv, r, st, mode, bot) {
  const ctx = cv.getContext('2d'), m = G.tpl === 'strava' ? shStrava(ctx, r) : shPoster(ctx, r);
  const [fill, line] = SH_ST[st], pad = 40 + (line ? 16 : 0);
  let cw, ch, x0, y0;
  if (mode === 'full') { cw = 1080; ch = 1920; x0 = 90; y0 = ch - bot - m.H; } else { cw = Math.ceil(m.mw + pad * 2); ch = m.H + pad * 2; x0 = pad; y0 = pad; }
  cv.width = cw; cv.height = ch;
  ctx.clearRect(0, 0, cw, ch); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  for (const o of m.lay) {
    if (o.logo) {
      const img = G.logo; const drawX = x0 + o.x, drawY = y0 + o.y;
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

function renderTable(){
  const adm = S.role === 'admin', q = $('q').value.toLowerCase();
  let a = [...S.f].reverse();
  if (S.sort.k) { const kf = {tanggal: r => +r.d || 0, jarak: r => num(r.jarak), pace: r => sec(r.pace)}[S.sort.k]; a.sort((x, y) => (kf(x) - kf(y)) * S.sort.dir); }
  if (q) a = a.filter(r => [r.tanggal, r.kategori, r.jarak, r.waktu, r.pace, r.catatan].join(' ').toLowerCase().includes(q));
  
  $('tb').innerHTML = a.map(r => {
    const ci = catInfo(r.kategori);
    return `<tr class="border-t hover:bg-[var(--card-hover)] transition-colors" style="border-color:var(--border)"><td class="p-2 mono font-medium cursor-pointer underline decoration-dotted underline-offset-2" onclick="openShare('${esc(r.id)}')">${esc(r.tanggal)}</td><td class="p-2"><span class="badge" style="background:${ci.bg};color:${ci.text};border-color:${ci.border}"><span style="width:6px;height:6px;border-radius:999px;background:${ci.dot};display:inline-block"></span>${esc(ci.label)}</span></td><td class="p-2 mono font-semibold">${esc(r.jarak)} km</td><td class="p-2 mono">${esc(fT(r.waktu))}</td><td class="p-2 mono">${esc(r.pace)}</td><td class="p-2 mono opacity-70">${num(r.hr)||'-'}</td><td class="p-2 mono opacity-70">${num(r.cadence)||'-'}</td><td class="p-2 mono">${num(r.vo2)||'-'}</td><td class="p-2 max-w-[160px] truncate opacity-60" title="${esc(r.catatan)}">${esc(r.catatan)||'-'}</td>${adm ? `<td class="p-2"><button class="btn-icon !w-6 !h-6" onclick="openForm('${esc(r.id)}')">✎</button> <button class="btn-icon !w-6 !h-6" onclick="del('${esc(r.id)}')">✕</button></td>` : ''}</tr>`;
  }).join('');

  const cardsEl = $('tbCards');
  if (cardsEl) {
    cardsEl.innerHTML = a.map(r => {
      const ci = catInfo(r.kategori); const cad = num(r.cadence); const vo2 = num(r.vo2); const str = num(r.stride); const note = (r.catatan || '').trim();
      return `<div class="card p-2 space-y-1.5"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="text-[13px] font-medium mono cursor-pointer underline decoration-dotted underline-offset-2" onclick="openShare('${esc(r.id)}')">${esc(r.tanggal)}</span><span class="badge !text-[11px]" style="background:${ci.bg};color:${ci.text};border-color:${ci.border}"><span style="width:5px;height:5px;border-radius:999px;background:${ci.dot};display:inline-block"></span>${esc(ci.label)}</span></div><span class="text-[14px] font-bold mono">${esc(r.jarak)} km</span></div><div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] mono opacity-70 leading-tight"><span>${esc(fT(r.waktu))}</span><span class="opacity-30">•</span><span>${esc(r.pace)}/km</span><span class="opacity-30">•</span><span>HR ${num(r.hr)||'-'}</span>${cad ? `<span class="opacity-30">•</span><span>CAD ${cad}</span>` : ''}${vo2 ? `<span class="opacity-30">•</span><span>VO2 ${vo2}</span>` : ''}${str ? `<span class="opacity-30">•</span><span>STR ${str}</span>` : ''}${note ? `<span class="opacity-30">•</span><span class="opacity-90 truncate max-w-[120px]">${esc(note)}</span>` : ''}</div>${adm ? `<div class="flex gap-1 justify-end pt-1"><button class="btn !h-6 !text-[12px]" onclick="openForm('${esc(r.id)}')">Edit</button><button class="btn !h-6 !text-[12px]" onclick="del('${esc(r.id)}')">Hapus</button></div>` : ''}</div>`;
    }).join('') || '<div class="text-center p-4 opacity-40 text-[13px]">Belum ada aktivitas</div>';
  }
}

function render(){
  const f = filtered(); S.f = f;
  const avg = k => { const v = f.map(r => num(r[k])).filter(x => x > 0); return v.length ? (v.reduce((a, b) => a + b) / v.length).toFixed(1) : '0'; };
  const pc = f.map(r => r.pace).filter(Boolean).sort((a, b) => sec(a) - sec(b));
  const n = new Date(), tfv = $('ft').value, isAdm = S.role === 'admin'; let ty = n.getFullYear(), tm = n.getMonth();
  if (tfv === 'last_month') { const l = new Date(n.getFullYear(), n.getMonth() - 1, 1); ty = l.getFullYear(); tm = l.getMonth(); } else if (tfv.startsWith('m:')) { const p = tfv.slice(2).split('-'); ty = +p[0]; tm = +p[1] - 1; }
  const bm = S.rows.filter(r => r.d && r.d.getFullYear() === ty && r.d.getMonth() === tm).reduce((a, r) => a + num(r.jarak), 0); const pct = S.target > 0 ? Math.min(100, bm / S.target * 100) : 0; const tlab = MID[tm] + (ty !== n.getFullYear() ? ' ' + ty : '');
  const isDark = document.documentElement.classList.contains('dark');
  const grads = {jarak: 'linear-gradient(135deg,#D6FF57,#84CC16)', pace: 'linear-gradient(135deg,#22D3EE,#0891B2)', hr: 'linear-gradient(135deg,#FBBF24,#D97706)', cad: 'linear-gradient(135deg,#A78BFA,#7C3AED)', streak: 'linear-gradient(135deg,#FB923C,#EF4444)', vo2: 'linear-gradient(135deg,#F472B6,#DB2777)'};
  
  $('stats').innerHTML = [
    {l: 'Total', v: `${f.reduce((a, r) => a + num(r.jarak), 0).toFixed(1)} km`, s: `${f.length} sesi`, g: grads.jarak, ic: '◧'},
    {l: 'Tercepat', v: esc(pc[0] || '-'), s: '/km', g: grads.pace, ic: '⚡'},
    {l: 'HR/Cad', v: `${avg('hr')}/${avg('cadence')}`, s: 'avg', g: grads.hr, ic: '♥'},
    {l: 'VO2Max', v: avg('vo2'), s: 'ml/kg', g: grads.vo2, ic: '◍'},
    {l: 'Streak', v: `${streak()} hari`, s: 'berturut', g: grads.streak, ic: '🔥'},
    {l: `Target • ${tlab}`, v: `${bm.toFixed(1)}/${S.target} km`, s: `${pct.toFixed(0)}%${isAdm ? ' • tap edit' : ''}`, g: grads.jarak, ic: '◎', prog: pct, tap: true}
  ].map(o => `<div class="card card-st p-2 flex gap-2.5 items-start${o.tap && isAdm ? ' cursor-pointer' : ''}"${o.tap && isAdm ? ' onclick="setTarget()"' : ''}><div class="icon-grad ic-hide shrink-0" style="background:${o.g}">${o.ic}</div><div class="min-w-0"><div class="text-[11px] uppercase tracking-widest opacity-50 font-semibold truncate">${o.l}</div><div class="text-[13px] sm:text-[15px] font-bold mono leading-tight mt-0.5 truncate">${o.v}</div><div class="text-[12px] opacity-50">${o.s}</div>${o.prog !== undefined ? `<div class="w-full h-1 rounded-full bg-[var(--border)] mt-2 overflow-hidden"><div class="h-full rounded-full" style="width:${o.prog}%;background:var(--lime)"></div></div>` : ''}</div></div>`).join('');

  const defs = pbDefs();
  $('pb').innerHTML = defs.map((d, i) => { const s = pbBest(d); const has = !!s; const main = has ? (d.t ? esc(s.jarak) + ' km' : esc(fT(s.waktu))) : '\u2014'; const sub = has ? ((d.t ? esc(fT(s.waktu)) : esc(s.pace)) + ' \u2022 ' + sd(s)) : 'Belum ada'; return `<div onclick="openPB('${d.k}')" class="card card-pb p-2 cursor-pointer col-span-2 lg:col-span-1 ${i === 3 ? 'col-start-2 lg:col-start-auto ' : ''}${has ? '' : 'empty'}"><div class="flex items-center justify-between gap-1"><div class="pbl text-[11px] font-bold tracking-wider uppercase truncate">PB ${d.l}</div>${has ? '<span class="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-400"></span>' : ''}</div><div class="pbv text-[17px] font-bold mono leading-tight mt-0.5 truncate">${main}</div><div class="text-[11px] opacity-60 mono truncate">${sub}</div></div>`; }).join('');

  renderTable();
  const allRec = []; defs.forEach(d => pbHist(d).forEach(x => allRec.push({d, r: x.r}))); allRec.sort((a, b) => (+b.r.d || 0) - (+a.r.d || 0) || b.r.no - a.r.no);
  $('pbh').innerHTML = allRec.map(({d, r}) => `<tr class="border-t" style="border-color:var(--border)"><td class="p-2">${esc(r.tanggal)}</td><td class="p-2 font-bold">${d.l}</td><td class="p-2 mono">${esc(r.jarak)} km</td><td class="p-2 mono">${esc(fT(r.waktu))}</td><td class="p-2 mono">${esc(r.pace)}</td></tr>`).join('') || '<tr><td colspan="5" class="p-3 text-center opacity-40 text-[13px]">Belum ada PB</td></tr>';

  const kc = {}; f.forEach(r => { const k = (r.kategori || '').trim() || 'Lainnya'; kc[k] = (kc[k] || 0) + 1; });
  $('kat').innerHTML = '<div class="text-[12px] font-bold tracking-widest uppercase opacity-50 mb-2">Kategori</div>' + (Object.entries(kc).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const ci = catInfo(k); const pct = v / f.length * 100; return `<div class="mb-2"><div class="flex justify-between text-[13px]"><span class="flex items-center gap-1.5"><span style="width:6px;height:6px;border-radius:999px;background:${ci.dot};display:inline-block"></span>${esc(k)}</span><span class="opacity-60 mono text-[12px]">${v}× ${pct.toFixed(0)}%</span></div><div class="w-full h-1 rounded-full bg-[var(--border)] mt-1 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${ci.dot}"></div></div></div>`; }).join('') || '<div class="text-[13px] opacity-40">Belum ada data</div>');

  S.charts.forEach(c => { try { c.destroy(); } catch(e){} }); if (!window.Chart) return;
  const L = f.map(r => sd(r)); const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; const tickColor = isDark ? '#9F9FA9' : '#71717A'; const ax = {ticks: {color: tickColor, font: {size: 10}}, grid: {color: gridColor}, border: {display: false}}; const base = {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}}; const axx = {...ax, ticks: {...ax.ticks, maxTicksLimit: 5, maxRotation: 0, autoSkip: true}};
  const line = (id, d, c, rev) => new Chart($(id), {type: 'line', data: {labels: L, datasets: [{data: d, borderColor: c, backgroundColor: c + '22', borderWidth: 1.5, fill: true, tension: .35, pointRadius: 0}]}, options: {...base, scales: {x: axx, y: {...ax, reverse: !!rev}}}});
  const ag = {}; S.rows.forEach(r => { if (r.d) { const k = r.d.getFullYear() + '-' + String(r.d.getMonth() + 1).padStart(2, '0'); ag[k] = (ag[k] || 0) + num(r.jarak); } }); const ks = Object.keys(ag).sort();
  S.charts = [ line('c1', f.map(r => num(r.jarak)), '#84CC16'), line('c2', f.map(r => sec(r.pace) / 60), '#06B6D4', true), line('c3', f.map(r => num(r.hr)), '#F59E0B'), line('c4', f.map(r => num(r.cadence)), '#8B5CF6'), new Chart($('c5'), {type: 'bar', data: {labels: ks.map(k => MID[+k.slice(5) - 1] + ' ' + k.slice(0, 4)), datasets: [{data: ks.map(k => +ag[k].toFixed(1)), backgroundColor: '#84CC16', borderRadius: 6, barThickness: 14}]}, options: {...base, scales: {x: ax, y: ax}}}) ];
}

function openForm(id, pre){
  S.editId = id || null; const r = id ? S.rows.find(x => x.id === id) : (pre || {}); const n = new Date();
  $('mt').textContent = id ? 'Edit data' : 'Tambah data';
  $('ff').innerHTML = F.map(([k, l]) => `<div class="${k === 'catatan' ? 'col-span-2' : ''}"><label class="text-[11px] uppercase opacity-50 font-semibold">${l}</label><input id="f_${k}" class="input h-8 mt-1" value="${esc(r[k] ?? (k === 'tanggal' ? n.getDate() + ' ' + MID[n.getMonth()] + ' ' + n.getFullYear() : ''))}"></div>`).join('') + '<datalist id="kt"><option>Regular<option>Easy Run<option>Fast Run<option>Long Run<option>Tempo Run<option>Interval<option>PB 🏆</datalist>';
  $('modal').classList.remove('hidden');
}

async function save(){
  const o = {}; for(const k in H) o[k] = $('f_' + k).value.trim();
  if (!o.tanggal || !o.jarak || !o.waktu || !o.pace) return alert('Tanggal, jarak, waktu, pace wajib');
  $('sv').disabled = true;
  try {
    if (S.editId) await api('update', {id: S.editId, row: toRow(o)});
    else await api('add', {row: toRow(o)});
    $('modal').classList.add('hidden'); await load();
  } catch(e) { alert(e.message); }
  $('sv').disabled = false;
}

async function del(id){
  if (!confirm('Hapus?')) return;
  try { await api('delete', {id}); await load(); } catch(e) { alert(e.message); }
}

function auto(){
  const k = $('kal').value.toLowerCase(), m = re => (k.match(re) || [])[1];
  const kt = [['interval','Interval'],['easy','Easy Run'],['long','Long Run'],['tempo','Tempo Run'],['fast','Fast Run']].find(([a]) => k.includes(a));
  let tgl = m(/(\d{1,2}\s+[a-z]+(?:\s+\d{4})?)/);
  if (tgl) { tgl = tgl.replace(/\b[a-z]/g, c => c.toUpperCase()); if (!/\d{4}/.test(tgl)) tgl += ' ' + new Date().getFullYear(); }
  openForm(null, {
    tanggal: tgl, kategori: kt ? kt[1] : 'Regular',
    jarak: (m(/(\d+[.,]?\d*)\s*km/) || '5').replace(',', '.'),
    waktu: m(/(\d+:\d+(?::\d+)?)/) || '30:00',
    pace: m(/pace\s*[:=]?\s*(\d+:\d+)/) || '6:30',
    hr: m(/hr\s*[:=]?\s*(\d+)/) || '',
    cadence: m(/(?:cadence|cad)\s*[:=]?\s*(\d+)/) || '',
    vo2: (m(/vo2\s*(?:max)?\s*[:=]?\s*(\d+[.,]?\d*)/) || '').replace(',', '.'),
    stride: m(/stride\s*[:=]?\s*(\d+)/) || ''
  });
}

const dl = (name, txt, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type})); a.download = name; a.click(); };
function expCsv(){ const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'; const hd = ['No','Tanggal','Kategori','Jarak (km)','Waktu','Pace','HR','Cadence','VO2 Max','Stride','Catatan']; dl('running_log_export.csv', '\ufeff' + [hd.map(q).join(','), ...S.rows.map(r => [r.no, r.tanggal, r.kategori, r.jarak, r.waktu, r.pace, r.hr, r.cadence, r.vo2, r.stride, r.catatan].map(q).join(','))].join('\n'), 'text/csv'); }
function expJson(){ dl('running_log.json', JSON.stringify(S.rows.map(r => ({no: r.no, tanggal: r.tanggal, kategori: r.kategori, jarak: num(r.jarak), waktu: r.waktu, pace: r.pace, hr: num(r.hr)|0, cadence: num(r.cadence)|0, vo2: num(r.vo2), stride: num(r.stride)|0, catatan: r.catatan})), null, 4), 'application/json'); }

(function(){
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.remove('dark','light'); document.documentElement.classList.add(saved);
  const btn = $('themeToggle');
  if (btn) {
    btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    btn.onclick = () => {
      const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.remove('dark','light'); document.documentElement.classList.add(next);
      localStorage.setItem('theme', next); btn.textContent = next === 'dark' ? '☀️' : '🌙';
      setTimeout(render, 50);
    };
  }
})();

$('go').onclick = async () => {
  $('err').textContent = ''; $('go').disabled = true;
  try {
    const j = await api('login', {password: $('pw').value});
    S.token = j.token; S.role = j.role;
    try { localStorage.setItem('tk', S.token); localStorage.setItem('rl', S.role); localStorage.setItem('tkt', Date.now()); } catch(e){}
    $('pw').value = ''; $('login').classList.add('hidden'); show();
  } catch(e) { $('err').textContent = e.message; }
  $('go').disabled = false;
};

$('pw').onkeydown = e => e.key === 'Enter' && $('go').click();
$('fd').onchange = $('ft').onchange = render;

(async () => {
  if (S.token) {
    try { const j = await api('me'); S.role = j.role; } catch(e){}
  }
  show();
})();

