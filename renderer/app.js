/* Kumo – Desktop-Begleiter (Renderer)
   Zählt Mauswege als Schritte, Pomodoro-Timer, Pausen-Erinnerung, Laune & Freundschaft. */
(function () {
"use strict";

/* ---------- Brücke (im Browser ohne Electron: Attrappe zum Testen) ---------- */
const api = window.kumoApi || (() => {
  let acc = 0, lx = null, ly = null, lastMove = Date.now(); const mouseCbs = [], idleCbs = [];
  document.addEventListener('mousemove', e => { if (lx !== null) acc += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; lastMove = Date.now(); });
  setInterval(() => { mouseCbs.forEach(cb => cb(Math.round(acc))); acc = 0; }, 500);
  setInterval(() => { idleCbs.forEach(cb => cb(Math.floor((Date.now() - lastMove) / 1000))); }, 1000);
  return { onMouse: cb => mouseCbs.push(cb), onIdle: cb => idleCbs.push(cb), onCommand() {}, onOnTop() {},
    notify: (t, b) => console.log('[Mitteilung]', t, '–', b), setTrayTitle() {}, setPomoLabel() {}, setOnTop() {}, getOnTop: async () => true, hide() {} };
})();

/* ---------- Leinwand & Farben ---------- */
const W = 64, H = 48;
const cv = document.getElementById('lcd'); const g = cv.getContext('2d');
const P = { sky:'#d4e0bd', sky2:'#c4d3a8', cloud:'#e6eed6', ground:'#a3bc82', ground2:'#87a26b', ink:'#262c26', mid:'#66745b',
  fluff:'#fbfaf1', shade:'#d6d3e3', face:'#6c608d', faceHi:'#f5f2ff', horn:'#cf9f4a', horn2:'#8e6527', heart:'#cf4c64', tear:'#6aa3d6', bubble:'#fbfaf1', leaf:'#5f8f4a' };
function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function px(x, y, c) { rect(x, y, 1, 1, c); }

/* ---------- 3×5-Pixelschrift ---------- */
const F = {'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001111',
'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100','Q':'010101101110011','R':'110101110101101','S':'011100010001110','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111',
':':'000010000010000','.':'000000000000010','-':'000000111000000','!':'010010010000010','?':'110001010000010','/':'001001010100100',' ':'000000000000000','+':'000010111010000'};
function text(s, x, y, c, k) { k = k || 1; s = String(s).toUpperCase(); for (let n = 0; n < s.length; n++) { const gl = F[s[n]] || F['?']; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r * 3 + q] === '1') rect(x + n * 4 * k + q * k, y + r * k, k, k, c); } }
function tw(s, k) { k = k || 1; return String(s).length * 4 * k - k; }
function ctext(s, y, c, k) { text(s, Math.round((W - tw(s, k)) / 2), y, c, k); }
const ICON = { heart:'0101011111111110111000100', note:'0011000101001001110011100', excl:'0010000100001000000000100', ques:'0111000010001000000000100', dots:'0000000000000001010100000', anger:'0101010001000001000101010', star:'0010000100111110111001010', clock:'0111010101101111000101110', cup:'0101000000111101110101110' };
function icon(n, x, y, c) { const s = ICON[n]; for (let i = 0; i < 25; i++) if (s[i] === '1') px(x + i % 5, y + (i / 5 | 0), c); }
const HEART7 = ['0110110','1111111','1111111','0111110','0011100','0001000'];
const TOMATO = ['00200','01110','11111','11111','01110'];

/* ---------- Zustand ---------- */
const LS = 'kumo-desktop-v1', LS_SET = 'kumo-desktop-settings-v1', LS_POMO = 'kumo-desktop-pomo-v1';
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fresh() { const n = Date.now(); return { v:1, created:n, total:0, days:{}, pomos:{}, bond:4, mood:60, lastSeen:n, pxAcc:0, stepAcc:0, capDay:'', stepBond:0, petBond:0, pomoBond:0 }; }
const DEF_SET = { focus:25, short:5, long:15, every:4, remind:50, brk:5, px:400, sound:true, notify:true };
function readJSON(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
let S = Object.assign(fresh(), readJSON(LS) || {}); const isNew = !readJSON(LS);
S.days = S.days || {}; S.pomos = S.pomos || {};
const SET = Object.assign({}, DEF_SET, readJSON(LS_SET) || {});
function save() { S.lastSeen = Date.now(); try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
function saveSet() { try { localStorage.setItem(LS_SET, JSON.stringify(SET)); } catch (e) {} }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEVELS = [[0,'Scheu'],[20,'Neugierig'],[40,'Vertraut'],[60,'Freund'],[80,'Bester Freund']];
function level() { let n = LEVELS[0][1]; for (const [t, l] of LEVELS) if (S.bond >= t) n = l; return n; }
function today() { return S.days[dayKey()] || 0; }
function pomosToday() { return S.pomos[dayKey()] || 0; }
function rollCaps() { const k = dayKey(); if (S.capDay !== k) { S.capDay = k; S.stepBond = 0; S.petBond = 0; S.pomoBond = 0; } }
const sayEl = document.getElementById('say');
let sayLock = 0;
function say(m, hold) { sayEl.textContent = m; sayLock = Date.now() + (hold || 0); }
function fmt(n) { return Math.floor(n).toLocaleString('de-DE'); }
function notify(t, b) { if (SET.notify) api.notify(t, b); }

/* ---------- Ton ---------- */
let ac = null;
function beep(f, d) { if (!SET.sound) return; try { ac = ac || new AudioContext(); const o = ac.createOscillator(), v = ac.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = .035; o.connect(v); v.connect(ac.destination); o.start(); o.stop(ac.currentTime + (d || .05)); } catch (e) {} }
function jingle(notes) { notes.forEach((n, i) => setTimeout(() => beep(n, .09), i * 120)); }

/* ---------- Kumo ---------- */
const pet = { x:32, tx:32, dir:0, mode:'idle', until:0, y:0, vy:0, sq:0, bubble:null, bubbleUntil:0, sulk:0, grumpyUntil:0, awakeUntil:0, happyUntil:0, tiredUntil:0, blink:0, pets:[] };
const parts = [];
let f = 0, lastStepAt = 0, screen = 0, lastDecay = Date.now();
function bubble(n, ms) { pet.bubble = n; pet.bubbleUntil = Date.now() + (ms || 1800); }
function hop() { if (pet.y === 0) pet.vy = 2.6; }
function heartFx() { parts.push({ x: pet.x + 3, y: 22, vy: -.35, k: 'heart', life: 26 }); }

function applyAway() {
  const away = Date.now() - (S.lastSeen || Date.now());
  S.mood = clamp(S.mood - away / 1.2e6, 5, 100);
  if (away > 6 * 3600e3) {
    if (S.bond >= 60) { pet.happyUntil = Date.now() + 4000; bubble('heart', 3000); hop(); say('Kumo hat dich vermisst und hüpft vor Freude.'); }
    else if (S.bond < 30) { pet.sulk = 3; say('Kumo ist beleidigt, weil du so lange weg warst. Drück ein paar Mal A.'); }
    else { bubble('ques', 2500); say('Kumo schaut dich fragend an. Wo warst du so lange?'); }
    return true;
  }
  return false;
}

/* Schritte aus Mauswegen */
const MILESTONES = [1000, 5000, 10000, 20000];
function addSteps(n) {
  if (n <= 0) return;
  rollCaps();
  const before = today(), k = dayKey();
  S.days[k] = before + n; S.total += n; S.stepAcc += n;
  while (S.stepAcc >= 100) { S.stepAcc -= 100; S.mood = clamp(S.mood + 2, 0, 100); if (S.stepBond < 6) { S.stepBond++; S.bond = clamp(S.bond + 1, 0, 100); } }
  for (const m of MILESTONES) if (before < m && before + n >= m) { pet.happyUntil = Date.now() + 3500; bubble('star', 3000); hop(); jingle([880, 1175]); say(fmt(m) + ' Schritte heute! Kumo hüpft vor Freude.', 5000); }
  const keys = Object.keys(S.days).sort(); while (keys.length > 30) delete S.days[keys.shift()];
  const pk = Object.keys(S.pomos).sort(); while (pk.length > 30) delete S.pomos[pk.shift()];
  lastStepAt = Date.now(); led();
}
api.onMouse(pxMoved => {
  if (!pxMoved) return;
  S.pxAcc += pxMoved;
  const steps = Math.floor(S.pxAcc / SET.px);
  if (steps > 0) { S.pxAcc -= steps * SET.px; addSteps(steps); }
});
const ledEl = document.getElementById('led'); let ledT = null;
function led() { ledEl.classList.add('on'); clearTimeout(ledT); ledT = setTimeout(() => ledEl.classList.remove('on'), 90); }

/* ---------- Pomodoro ---------- */
const PO = Object.assign({ phase:'idle', running:false, endsAt:0, remain:0, round:0 }, readJSON(LS_POMO) || {});
function savePo() { try { localStorage.setItem(LS_POMO, JSON.stringify(PO)); } catch (e) {} }
const PHASE_LABEL = { idle:'BEREIT', focus:'FOKUS', short:'PAUSE', long:'LANGE PAUSE' };
function phaseMs(p) { return (p === 'focus' ? SET.focus : p === 'short' ? SET.short : p === 'long' ? SET.long : SET.focus) * 60000; }
function pomoLeft() { return PO.running ? Math.max(0, PO.endsAt - Date.now()) : (PO.phase === 'idle' ? phaseMs('focus') : PO.remain); }
function mmss(ms) { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function pomoStart() {
  if (PO.phase === 'idle') { PO.phase = 'focus'; PO.remain = phaseMs('focus'); }
  PO.running = true; PO.endsAt = Date.now() + PO.remain; savePo(); syncPomoUi();
  beep(660, .06);
  if (PO.phase === 'focus') { say('Fokus läuft. Kumo bleibt ganz leise.'); bubble('clock', 1500); }
  else say('Pause läuft. Steh auf, streck dich, trink was.');
}
function pomoPause() { PO.remain = Math.max(0, PO.endsAt - Date.now()); PO.running = false; savePo(); syncPomoUi(); beep(440, .06); say('Pomodoro pausiert. A setzt fort.'); }
function pomoToggle() { PO.running ? pomoPause() : pomoStart(); }
function pomoReset() { Object.assign(PO, { phase:'idle', running:false, endsAt:0, remain:0, round:0 }); savePo(); syncPomoUi(); beep(330, .06); say('Pomodoro zurückgesetzt.'); }
function pomoComplete() {
  const now = Date.now();
  if (PO.phase === 'focus') {
    rollCaps();
    const k = dayKey(); S.pomos[k] = (S.pomos[k] || 0) + 1; PO.round++;
    S.mood = clamp(S.mood + 5, 0, 100); if (S.pomoBond < 4) { S.pomoBond++; S.bond = clamp(S.bond + 1, 0, 100); }
    const isLong = PO.round % SET.every === 0;
    PO.phase = isLong ? 'long' : 'short'; PO.remain = phaseMs(PO.phase); PO.running = true; PO.endsAt = now + PO.remain;
    pet.happyUntil = now + 3500; hop(); bubble('star', 3000); jingle([784, 988, 1175]);
    const m = isLong ? SET.long : SET.short;
    say('Runde geschafft! Jetzt ' + m + ' Minuten Pause.', 6000);
    notify('Runde geschafft 🍅', 'Zeit für ' + m + ' Minuten ' + (isLong ? 'lange ' : '') + 'Pause. Kumo streckt sich schon.');
    RB.streak = 0; RB.reminded = false;
  } else {
    PO.phase = 'focus'; PO.remain = phaseMs('focus'); PO.running = false;
    bubble('excl', 2500); jingle([988, 784]);
    say('Pause vorbei. Bereit für die nächste Runde? Drück A.', 6000);
    notify('Pause vorbei', 'Bereit für die nächste Fokus-Runde? Klick auf Kumo und drück A.');
  }
  savePo(); save(); syncPomoUi();
}
function syncPomoUi() {
  const lbl = PO.running ? 'Pomodoro pausieren' : (PO.phase === 'idle' ? 'Pomodoro starten' : 'Pomodoro fortsetzen');
  api.setPomoLabel(lbl);
  document.getElementById('tbPomo').classList.toggle('on', PO.running);
  document.getElementById('tbPomo').title = lbl;
  ledEl.classList.toggle('focus', PO.running && PO.phase === 'focus');
  ledEl.classList.toggle('rest', PO.running && PO.phase !== 'focus');
}

/* ---------- Pausen-Erinnerung (Leerlauf aus dem System) ---------- */
const RB = { streak:0, reminded:false, remindedAt:0, ignored:0, idle:0 };
api.onIdle(sec => {
  RB.idle = sec;
  const now = Date.now();
  if (sec >= SET.brk * 60) {
    if (RB.reminded) {
      S.mood = clamp(S.mood + 5, 0, 100); rollCaps(); S.bond = clamp(S.bond + .5, 0, 100);
      pet.happyUntil = now + 4000; bubble('heart', 3000);
      say('Danke für die Pause! Kumo ist stolz auf dich.', 6000);
    }
    RB.streak = 0; RB.reminded = false; RB.ignored = 0;
    return;
  }
  if (sec < 60) RB.streak++;
  const pomoBusy = PO.running; // während Pomodoro übernimmt der Timer die Pausen
  if (!pomoBusy && RB.streak >= SET.remind * 60 && now - RB.remindedAt > 10 * 60000) {
    RB.remindedAt = now;
    if (RB.reminded) { RB.ignored++; S.mood = clamp(S.mood - 4, 0, 100); }
    RB.reminded = true;
    pet.tiredUntil = now + 10 * 60000; bubble('cup', 4000); beep(523, .1);
    const mins = Math.round(RB.streak / 60);
    say('Du bist seit ' + mins + ' Minuten dran. Kumo braucht eine Pause, und du auch.', 8000);
    notify('Zeit für eine Pause', 'Du bist seit ' + mins + ' Minuten aktiv. Steh kurz auf – Kumo wartet so lange.');
  }
  // Während einer Pomodoro-Pause sanft erinnern, wenn weitergearbeitet wird
  if (PO.running && PO.phase !== 'focus' && sec < 2 && now - (RB.breakNudge || 0) > 60000) {
    RB.breakNudge = now; bubble('cup', 2500); say('Psst, du hast gerade Pause.', 3000);
  }
});

/* ---------- Aktionen ---------- */
function isNight() { const h = new Date().getHours(); return h >= 22 || h < 6; }
function sleeping() { return isNight() && Date.now() > pet.awakeUntil && Date.now() - lastStepAt > 3000 && !PO.running; }
function petAction() {
  const now = Date.now(); rollCaps();
  if (sleeping()) { pet.awakeUntil = now + 30000; pet.grumpyUntil = now + 2500; bubble('anger', 2000); S.mood = clamp(S.mood - 1, 0, 100); beep(220, .12); say('Pst, Kumo hat geschlafen und blinzelt dich verschlafen an.'); save(); return; }
  pet.pets = pet.pets.filter(t => now - t < 12000); pet.pets.push(now);
  if (pet.pets.length >= 7) { pet.grumpyUntil = now + 4500; pet.tx = pet.x < 32 ? 10 : 54; pet.mode = 'wander'; pet.until = now + 4500; bubble('anger', 2500); S.mood = clamp(S.mood - 2, 0, 100); pet.pets = []; beep(196, .15); say('Zu viel! Kumo braucht kurz Abstand.'); save(); return; }
  if (pet.sulk > 0) { pet.sulk--; pet.sq = 3; beep(523); if (pet.sulk === 0) { bubble('heart', 2400); heartFx(); hop(); say('Kumo ist dir nicht mehr böse.'); } else { bubble('dots', 1500); say('Kumo dreht sich weg. Noch ' + pet.sulk + '× streicheln.'); } save(); return; }
  if (S.bond < 20 && Math.random() < .35) { pet.tx = clamp(pet.x + (pet.x < 32 ? -14 : 14), 10, 54); pet.mode = 'wander'; pet.until = now + 2500; bubble('excl', 1400); beep(660, .04); say('Kumo zuckt zurück. Ihr kennt euch noch nicht so gut.'); return; }
  pet.sq = 3; pet.dir = 0; pet.mode = 'idle'; pet.until = now + 2500; heartFx(); beep(784, .05);
  S.mood = clamp(S.mood + 4, 0, 100); if (S.petBond < 5) { S.petBond++; S.bond = clamp(S.bond + .6, 0, 100); }
  pet.happyUntil = now + 1500;
  say(S.bond < 40 ? 'Kumo lässt sich vorsichtig streicheln.' : 'Kumo kuschelt sich an deine Hand.');
  save();
}
function callAction() {
  const now = Date.now();
  if (sleeping()) { bubble('dots', 1600); say('Kumo schläft tief und fest. Morgen früh ist es wieder wach.'); beep(330, .05); return; }
  pet.dir = 0; pet.tx = 32; pet.mode = 'wander'; pet.until = now + 2500;
  let m;
  if (pet.sulk > 0) { bubble('dots', 1800); m = 'Kumo tut so, als hätte es nichts gehört.'; }
  else if (now < pet.tiredUntil) { bubble('cup', 1800); m = 'Kumo gähnt. Eine Pause würde euch beiden guttun.'; }
  else if (S.mood < 25) { bubble('dots', 1800); m = 'Kumo ist schlapp. Ein bisschen Bewegung würde helfen.'; }
  else if (S.bond < 20) { bubble('ques', 1800); m = 'Kumo schaut neugierig, bleibt aber auf Abstand.'; }
  else if (S.bond < 60) { bubble('note', 1800); m = 'Kumo summt dir eine kleine Melodie vor.'; }
  else { bubble('heart', 2000); heartFx(); hop(); pet.happyUntil = now + 2000; m = 'Kumo kommt sofort angelaufen!'; }
  S.mood = clamp(S.mood + 1, 0, 100); beep(988, .04); say(m); save();
}

/* ---------- Zeichnen ---------- */
const BLOBS = [[0,0,6.4],[-5.6,1,4.6],[5.6,1,4.6],[-3,-3.6,4.6],[3,-3.6,4.6],[0,-5.2,4],[0,2,6]];
const N = 34; const mask = new Uint8Array(N * N);
function drawKumo(cx, by, o) {
  const sx = o.sx, sy = o.sy, cy = by - 3 - 6.6 * sy;
  const x0 = Math.round(cx) - 17, y0 = Math.round(cy) - 17;
  mask.fill(0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const X = x0 + i + .5, Y = y0 + j + .5;
    for (const b of BLOBS) { const dx = (X - (cx + b[0] * sx)) / sx, dy = (Y - (cy + b[1] * sy)) / sy; if (dx * dx + dy * dy <= b[2] * b[2]) { mask[j * N + i] = 1; break; } } }
  if (o.shadow) rect(cx - 5, 44, 10, 1, P.ground2);
  const legTop = Math.round(cy + 4 * sy);
  [[-3, 1], [2, -1]].forEach(([lx, s]) => { const lift = o.legs === s ? 1 : 0; rect(cx + lx, legTop, 2, Math.max(1, Math.round(by) - legTop - lift), P.ink); });
  const at = (i, j) => i >= 0 && j >= 0 && i < N && j < N && mask[j * N + i];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const X = x0 + i, Y = y0 + j;
    if (mask[j * N + i]) { const lower = Y > cy + 3.6 * sy; const curl = ((X * 7 + Y * 13) % 11 === 0); px(X, Y, lower || curl ? P.shade : P.fluff); }
    else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) px(X, Y, P.ink); }
  const hy = Math.round(cy - 6.8 * sy), hl = Math.round(cx - 8.2 * sx), hr = Math.round(cx + 5.6 * sx);
  [['.hh','h..','hd.'], ['hh.','..h','.dh']].forEach((pat, s) => { const hx = s ? hr : hl; pat.forEach((row, r) => { for (let q = 0; q < 3; q++) { const c = row[q]; if (c !== '.') px(hx + q, hy + r, c === 'h' ? P.horn : P.horn2); } }); });
  if (o.face === 'back') { px(cx, cy + 3 * sy, P.shade); px(cx + 1, cy + 3 * sy, P.shade); return; }
  const fx = Math.round(cx + o.dir * 3 * sx), fy = Math.round(cy + .6 * sy);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx / 3.7) ** 2 + (dy / 2.7) ** 2 <= 1) px(fx + dx, fy + dy, P.face);
  const ey = fy - 1, e1 = fx - 2, e2 = fx + 2, hi = P.faceHi;
  switch (o.eyes) {
    case 'closed': px(e1 - 1, ey + 1, P.shade); px(e1, ey + 1, P.shade); px(e2, ey + 1, P.shade); px(e2 + 1, ey + 1, P.shade); break;
    case 'happy': for (const e of [e1, e2]) { px(e - 1, ey + 1, hi); px(e, ey, hi); px(e + 1, ey + 1, hi); } px(fx, fy + 1, P.heart); break;
    case 'grumpy': for (const e of [e1, e2]) { px(e - 1, ey, hi); px(e, ey, hi); } px(e1 + 1, ey - 1, P.ink); px(e2 - 2, ey - 1, P.ink); break;
    case 'tired': px(e1 - 1, ey + 1, hi); px(e1, ey + 1, hi); px(e2, ey + 1, hi); px(e2 + 1, ey + 1, hi); px(fx, fy + 1, P.shade); break;
    case 'focus': px(e1, ey + 1, hi); px(e2, ey + 1, hi); px(e1, ey, P.shade); px(e2, ey, P.shade); break;
    case 'sad': px(e1, ey + 1, hi); px(e2, ey + 1, hi); px(e1 - 1, ey, P.ink); px(e2 + 1, ey, P.ink); px(e1, ey + 3, P.tear); break;
    default: px(e1, ey, hi); px(e1, ey + 1, hi); px(e2, ey, hi); px(e2, ey + 1, hi);
  }
}

const clouds = [{ x:8, y:11, w:9 }, { x:44, y:15, w:7 }];
function scene() {
  rect(0, 0, W, H, P.sky);
  for (const c of clouds) { rect(c.x, c.y, c.w, 2, P.cloud); rect(c.x + 2, c.y - 1, c.w - 4, 1, P.cloud); }
  rect(0, 40, W, 8, P.ground); rect(0, 40, W, 1, P.ground2);
  for (let x = 3; x < W; x += 7) { px(x, 42 + (x % 3), P.ground2); px(x + 1, 41 + (x % 3), P.ground2); }
}
function topbar() {
  rect(0, 0, W, 7, P.sky2);
  if (PO.running || PO.phase !== 'idle') {
    const c = PO.phase === 'focus' ? P.heart : P.leaf;
    rect(2, 2, 3, 3, c); if (!PO.running && f % 12 < 6) rect(2, 2, 3, 3, P.sky2);
    text(mmss(pomoLeft()), 7, 1, P.ink);
  } else { const d = new Date(); text(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), 2, 1, P.ink); }
  const s = String(Math.min(99999, today())); text(s, W - 2 - tw(s), 1, P.ink);
}
function drawBubble(now) {
  if (!pet.bubble || now > pet.bubbleUntil) return;
  const bx = clamp(Math.round(pet.x) + 5, 1, 54), by = Math.round(17 - pet.y) - 8;
  rect(bx, by, 9, 7, P.ink); rect(bx + 1, by + 1, 7, 5, P.bubble); px(bx + 1, by + 7, P.ink); px(bx + 2, by + 6, P.bubble);
  icon(pet.bubble, bx + 2, by + 1, (pet.bubble === 'heart' || pet.bubble === 'anger') ? P.heart : P.ink);
}
function drawParts() {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.y += p.vy; p.x += Math.sin((p.life + f) / 3) * .2; p.life--;
    if (p.k === 'heart') icon('heart', p.x, p.y, P.heart); else text('Z', p.x, p.y, P.mid);
    if (p.life <= 0) parts.splice(i, 1); }
}

function homeScreen(now) {
  scene();
  const walking = now - lastStepAt < 1200, asleep = sleeping();
  const focusing = PO.running && PO.phase === 'focus';
  let face = pet.dir, eyes = 'open', legs = 0;
  if (asleep) {
    face = 0; eyes = 'closed'; if (f % 28 === 0) parts.push({ x: pet.x + 6, y: 20, vy: -.25, k: 'z', life: 30 });
  } else if (pet.sulk > 0) {
    face = 'back'; if (f % 60 === 0 && Math.random() < .5) bubble('dots', 1200);
  } else if (walking && !focusing) {
    if (Math.abs(pet.x - pet.tx) < 1) pet.tx = pet.x < 32 ? 52 : 12;
    const s = Math.sign(pet.tx - pet.x); pet.x += s * .7; face = s; legs = (f >> 1) % 2 ? 1 : -1;
  } else {
    if (now > pet.until) { const r = Math.random();
      if (focusing || r < .42) { pet.mode = 'idle'; pet.dir = 0; pet.until = now + 2000 + Math.random() * 3500; }
      else if (r < .8) { pet.mode = 'wander'; pet.tx = S.bond < 20 ? (Math.random() < .5 ? 12 + Math.random() * 6 : 46 + Math.random() * 6) : 18 + Math.random() * 28; pet.until = now + 4000; }
      else { pet.mode = 'look'; pet.dir = Math.random() < .5 ? -1 : 1; pet.until = now + 1500; }
      if (!focusing && S.bond >= 60 && S.mood > 50 && Math.random() < .18) hop();
    }
    if (pet.mode === 'wander' && Math.abs(pet.tx - pet.x) > .6) { const s = Math.sign(pet.tx - pet.x); pet.x += s * .4; face = s; legs = (f >> 1) % 2 ? 1 : -1; }
    else face = pet.mode === 'look' ? pet.dir : 0;
    if (now < pet.grumpyUntil) eyes = 'grumpy';
    else if (now < pet.happyUntil || (pet.bubble === 'heart' && now < pet.bubbleUntil)) eyes = 'happy';
    else if (now < pet.tiredUntil) eyes = 'tired';
    else if (focusing) eyes = 'focus';
    else if (S.mood < 25) eyes = 'sad';
    if (eyes === 'open' || eyes === 'focus') { if (pet.blink > 0) { eyes = 'closed'; pet.blink--; } else if (Math.random() < .025) pet.blink = 2; }
  }
  pet.x = clamp(pet.x, 11, 53);
  if (pet.vy || pet.y > 0) { pet.y += pet.vy; pet.vy -= .55; if (pet.y <= 0) { pet.y = 0; pet.vy = 0; pet.sq = 2; } }
  let sx = 1, sy = 1 + (asleep ? .03 * Math.sin(f / 8) : .025 * Math.sin(f / 5));
  if (pet.sq > 0) { sx = 1.14; sy = .86; pet.sq--; }
  if (pet.y > 0) { sx = .94; sy = 1.07; }
  drawKumo(pet.x, 43 - pet.y, { sx, sy, dir: typeof face === 'number' ? face : 0, face: face === 'back' ? 'back' : 'front', eyes, legs, shadow: true });
  drawParts(); drawBubble(now); topbar();
}
function stepsScreen() {
  rect(0, 0, W, H, P.sky); ctext('SCHRITTE', 2, P.ink); rect(4, 8, 56, 1, P.sky2);
  text('HEUTE', 3, 11, P.mid); const t = String(Math.min(99999, today())); text(t, W - 3 - tw(t, 2), 17, P.ink, 2);
  text('GESAMT', 3, 30, P.mid); const tt = S.total >= 1e6 ? Math.floor(S.total / 1000) + 'K' : String(S.total); text(tt, W - 3 - tw(tt), 30, P.ink);
  const vals = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); vals.push(S.days[dayKey(d)] || 0); }
  const mx = Math.max(1000, ...vals);
  vals.forEach((v, i) => { const h = Math.max(1, Math.round(v / mx * 9)); rect(5 + i * 8, 46 - h, 6, h, i === 6 ? P.ink : P.mid); });
}
function bondScreen() {
  rect(0, 0, W, H, P.sky); ctext('FREUNDSCHAFT', 2, P.ink); rect(4, 8, 56, 1, P.sky2);
  for (let h = 0; h < 5; h++) { const x0 = 8 + h * 10, fill = clamp((S.bond - h * 20) / 20, 0, 1);
    HEART7.forEach((row, r) => { for (let q = 0; q < 7; q++) if (row[q] === '1') px(x0 + q, 12 + r, (fill >= 1 || (fill >= .5 && q < 4)) ? P.heart : P.mid); }); }
  ctext(level(), 21, P.ink);
  text('LAUNE', 3, 31, P.mid); rect(25, 31, 36, 5, P.ink); rect(26, 32, 34, 3, P.sky); rect(26, 32, Math.round(34 * S.mood / 100), 3, S.mood < 25 ? P.heart : P.ground2);
  const days = 1 + Math.floor((Date.now() - S.created) / 864e5); ctext('TAG ' + days, 40, P.mid);
}
function pomoScreen() {
  rect(0, 0, W, H, P.sky); ctext('POMODORO', 2, P.ink); rect(4, 8, 56, 1, P.sky2);
  const lbl = PO.phase === 'focus' && !PO.running && PO.remain === phaseMs('focus') && PO.round > 0 ? 'BEREIT' : PHASE_LABEL[PO.phase];
  ctext(lbl + (PO.running || PO.phase === 'idle' || lbl === 'BEREIT' ? '' : ' II'), 11, PO.phase === 'focus' ? P.heart : PO.phase === 'idle' ? P.mid : P.leaf);
  const left = pomoLeft(); const blinkOff = !PO.running && PO.phase !== 'idle' && f % 12 >= 6;
  if (!blinkOff) ctext(mmss(left), 18, P.ink, 2);
  const total = PO.phase === 'idle' ? phaseMs('focus') : phaseMs(PO.phase);
  rect(4, 30, 56, 3, P.ink); rect(5, 31, 54, 1, P.sky); rect(5, 31, Math.round(54 * (1 - left / total)), 1, PO.phase === 'focus' ? P.heart : P.leaf);
  const n = pomosToday();
  for (let i = 0; i < Math.min(n, 5); i++) TOMATO.forEach((row, r) => { for (let q = 0; q < 5; q++) { const c = row[q]; if (c !== '0') px(4 + i * 7 + q, 37 + r, c === '2' ? P.leaf : P.heart); } });
  if (n > 5) text('+' + (n - 5), 40, 38, P.mid);
  if (n === 0 && !PO.running) text(PO.phase === 'idle' ? 'A START' : 'A WEITER', 4, 38, P.mid);
  const a = Math.round(RB.streak / 60) + 'M'; text(a, 60 - tw(a), 38, P.mid);
}
const SCREENS = 4;
function render(now) { if (screen === 0) homeScreen(now); else if (screen === 1) stepsScreen(); else if (screen === 2) bondScreen(); else pomoScreen(); }

/* ---------- Schleife ---------- */
let lastSave = Date.now(), lastTray = '';
function tick() {
  f++; const now = Date.now();
  if (now - lastDecay >= 60000) { const m = (now - lastDecay) / 60000; S.mood = clamp(S.mood - m / 20, 5, 100); lastDecay = now; }
  if (f % 20 === 0) for (const c of clouds) { c.x -= .25; if (c.x < -c.w) c.x = W + 2; }
  if (PO.running && now >= PO.endsAt) pomoComplete();
  if (now - lastSave > 15000) { lastSave = now; save(); }
  const tt = PO.running ? (PO.phase === 'focus' ? '● ' : '○ ') + mmss(pomoLeft()) : '';
  if (tt !== lastTray) { lastTray = tt; api.setTrayTitle(tt); }
  if (!sheet.hidden && f % 12 === 0) statsLine();
  render(now);
}

/* ---------- Bedienung ---------- */
function press(id, fn) { document.getElementById(id).addEventListener('click', fn); }
press('bA', () => { if (screen === 3) { pomoToggle(); return; } if (screen !== 0) { screen = 0; beep(660, .03); return; } petAction(); });
press('bB', () => { if (screen === 3) { pomoReset(); return; } if (screen !== 0) screen = 0; callAction(); });
press('bC', () => { screen = (screen + 1) % SCREENS; beep(523, .03); if (screen === 3 && PO.phase === 'idle') say('Pomodoro: A startet, B setzt zurück.'); });
const keyMap = { a:'bA', s:'bB', d:'bC' };
document.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,select,textarea')) return; const id = keyMap[e.key.toLowerCase()]; if (!id || e.repeat) return; const b = document.getElementById(id); b.classList.add('down'); b.click(); setTimeout(() => b.classList.remove('down'), 120); });
press('tbPomo', () => { pomoToggle(); if (screen !== 3) screen = 3; });
press('tbHide', () => api.hide());
const pinBtn = document.getElementById('tbPin');
let onTop = true;
function setPin(v) { onTop = v; pinBtn.classList.toggle('on', v); pinBtn.title = v ? 'Immer im Vordergrund: an' : 'Immer im Vordergrund: aus'; }
api.getOnTop().then(setPin); api.onOnTop(setPin);
press('tbPin', () => { setPin(!onTop); api.setOnTop(onTop); });
api.onCommand(c => { if (c === 'pomo-toggle') { pomoToggle(); screen = 3; } else if (c === 'pomo-reset') pomoReset(); else if (c === 'settings') openSheet(); });

/* ---------- Einstellungen ---------- */
const sheet = document.getElementById('sheet');
const fields = { setFocus:'focus', setShort:'short', setLong:'long', setEvery:'every', setRemind:'remind', setBreak:'brk' };
function openSheet() { for (const [id, k] of Object.entries(fields)) document.getElementById(id).value = SET[k];
  document.getElementById('setPx').value = String(SET.px); document.getElementById('setSound').checked = SET.sound; document.getElementById('setNotify').checked = SET.notify;
  statsLine(); sheet.hidden = false; }
function statsLine() { document.getElementById('statsLine').textContent = 'Heute ' + fmt(today()) + ' Schritte · ' + pomosToday() + ' Pomodoros · seit ' + Math.round(RB.streak / 60) + ' Min. ohne Pause · ' + level(); }
press('tbSet', openSheet);
press('sheetClose', () => { sheet.hidden = true; });
for (const [id, k] of Object.entries(fields)) document.getElementById(id).addEventListener('change', e => {
  const el = e.target, v = clamp(Math.round(+el.value || DEF_SET[k]), +el.min, +el.max); el.value = v; SET[k] = v; saveSet();
});
document.getElementById('setPx').addEventListener('change', e => { SET.px = +e.target.value; saveSet(); });
document.getElementById('setSound').addEventListener('change', e => { SET.sound = e.target.checked; saveSet(); });
document.getElementById('setNotify').addEventListener('change', e => { SET.notify = e.target.checked; saveSet(); });
const box = document.getElementById('resetBox');
function resetUI() { box.innerHTML = '<button class="btn" id="resetBtn">Neu anfangen</button>'; document.getElementById('resetBtn').addEventListener('click', askReset); }
function askReset() {
  box.innerHTML = '<div class="confirm"><p>Wirklich neu anfangen? Schritte, Pomodoros und eure Freundschaft gehen verloren.</p><div class="row"><button class="btn primary" id="rsYes">Ja, zurücksetzen</button><button class="btn" id="rsNo">Abbrechen</button></div></div>';
  document.getElementById('rsYes').addEventListener('click', () => { S = fresh(); pet.sulk = 0; save(); pomoReset(); resetUI(); sheet.hidden = true; say('Ein neues Kumo! Es ist noch etwas scheu.'); });
  document.getElementById('rsNo').addEventListener('click', resetUI);
}
document.getElementById('resetBtn').addEventListener('click', askReset);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) sheet.hidden = true; });
window.addEventListener('beforeunload', save);

/* ---------- Start ---------- */
rollCaps();
if (PO.running && Date.now() >= PO.endsAt) pomoComplete();
if (isNew) { say('Hallo! Das ist Kumo. Jede Mausbewegung ist ein kleiner Schritt für euch beide.'); save(); }
else if (!applyAway()) say(sleeping() ? 'Kumo schläft. Lass es ruhen bis zum Morgen.' : 'Kumo freut sich, dass du da bist.');
syncPomoUi(); tick();
setInterval(tick, 83);
})();
