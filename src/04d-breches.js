/* ==========================================================================
   BRÈCHES (Breachline) : pans de mur qu'une explosion ouvre, la marque de Breachline
   Un pan (wallOpen, 02d-archi.js, option breach) est une ouverture du mur fermée par son propre maillage et sa propre boîte de collision.
   Une explosion assez forte l'ouvre : le pan disparaît, un bord déchiqueté et des gravats prennent sa place, la boîte de collision s'en va
   (soldats, balles, vue, grenades passent), et le passage s'ouvre aux bots.
   Points de vie : 180. Une roquette au contact suffit (souffle + coup direct), deux grenades, une frappe aérienne ; les armes lourdes
   l'entament lentement, les balles des soldats rien.
   Navigation : le réseau des bots est construit pans ouverts (breachNavOpen, buildNav, breachNavGate), puis les nœuds de chaque ouverture
   sont fermés (NAV.gate) tant que le pan tient (findPath et navNode les sautent) : pas de reconstruction du réseau en partie.
   Réseau : l'hôte seul juge (les coups des autres lui parviennent : 'wh'), il annonce l'ouverture ('wb') ; l'état part avec celui du décor
   ('ws'), pour qui arrive en cours de partie.
   ========================================================================== */
const BRCH = { list: [], open: new Uint8Array(0) };
const BREACH = { hp: 180, blast: 1, heavy: 0.25, rocket: 200 };
const _bkA = new V3();
/* Pose d'un pan (appelée par wallOpen) : o { axis, fixed, t, a0, a1, y0, b1, key, tint, kind } ; le pan, puis son bord brisé et ses gravats (cachés) */
function breachReg(o) {
  const id = BRCH.list.length, ax = o.axis === 'x';
  const x0 = ax ? o.a0 : o.fixed - o.t / 2, x1 = ax ? o.a1 : o.fixed + o.t / 2, z0 = ax ? o.fixed - o.t / 2 : o.a0, z1 = ax ? o.fixed + o.t / 2 : o.a1, y0 = o.y0, y1 = o.y0 + o.b1;
  const n0 = COL.length; DECOR.col(x0, x1, y0, y1, z0, z1, o.kind); const col = COL[n0];
  const b = { id, x0, x1, y0, y1, z0, z1, ax, t: o.t, hp: BREACH.hp, open: false, col, g: null, w: null, c: new V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), by: null };
  col.brch = b; col.o = [col.x0, col.x1, col.y0, col.y1, col.z0, col.z1];
  const R = rngOf(4100 + id * 37);
  // le pan : une boîte de la matière du mur, ses coordonnées de texture prises dans le monde (comme les parements) : elle se fond dans le mur
  let T = new DmgTarget(), M = new Maker(T);
  M.save().color(o.tint || [1, 1, 1]).world(1); M.boxB(o.key, x0, x1, y0, y1, z0, z1, {}); M.restore();
  b.g = dmgGroup(T);
  // ouvert : morceaux de mur accrochés aux bords de l'ouverture, gravats au pied des deux côtés
  T = new DmgTarget(); M = new Maker(T); M.save().color(o.tint || [1, 1, 1]).world(1);
  const L = ax ? x1 - x0 : z1 - z0, H = y1 - y0, along = (s, h, a, w, hh, d, rz) => {
    const cx = ax ? x0 + s : (x0 + x1) / 2, cz = ax ? (z0 + z1) / 2 : z0 + s;
    M.save().move(cx, y0 + h, cz).rotY(ax ? 0 : Math.PI / 2).rotZ(rz).rotX(a); M.box(o.key, w, hh, d, {}); M.restore();
  };
  for (const side of [0, 1]) for (let i = 0; i < 6; i++) { // les deux jambages
    const w = 0.12 + R() * 0.22, h = (i + 0.5) * (H / 6) + (R() - 0.5) * 0.15;
    along(side ? L - w / 2 + 0.02 : w / 2 - 0.02, h, (R() - 0.5) * 0.3, w, 0.25 + R() * 0.3, o.t * (0.75 + R() * 0.2), (R() - 0.5) * 0.6);
  }
  for (let i = 0; i < 5; i++) { const s = (i + 0.5) * (L / 5), hh = 0.12 + R() * 0.25; along(s, H - hh / 2 + 0.03, (R() - 0.5) * 0.3, 0.3 + R() * 0.25, hh, o.t * (0.75 + R() * 0.2), (R() - 0.5) * 0.5); } // le linteau
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { // gravats
    const s = R() * L, off = side * (o.t / 2 + 0.1 + R() * 0.9), w = 0.12 + R() * 0.32;
    const cx = ax ? x0 + s : (x0 + x1) / 2 + off, cz = ax ? (z0 + z1) / 2 + off : z0 + s;
    M.save().move(cx, y0 + w * 0.3, cz).rotY(R() * TAU).rotX((R() - 0.5) * 0.8); M.box(o.key, w, w * (0.5 + R() * 0.5), w * (0.6 + R() * 0.6), {}); M.restore();
  }
  M.restore();
  b.w = dmgGroup(T); b.w.visible = false;
  BRCH.list.push(b);
  return b;
}
/* Dégâts : l'hôte décompte ; un autre pair annonce les coups de ses tireurs (roquette, armes lourdes) à l'hôte */
function breachDamage(b, dmg, by, announce) {
  if (b.open || !(dmg > 0)) return;
  if (!dmgAuth()) { if (announce && MATCH.online) netEvent({ k: 'wh', n: b.id, d: Math.round(dmg) }, PL.ent); return; }
  b.hp -= dmg; if (by) b.by = by;
  if (b.hp <= 0) { breachSet(b, true, true); if (MATCH.online) netEvent({ k: 'wb', n: b.id }, PL.ent); }
}
/* Souffle (dmgBlast, chez tous les pairs : seul l'hôte compte) : distance au pan, pas à son centre */
function breachBlast(p, r, maxDmg, owner) {
  if (!BRCH.list.length || !dmgAuth()) return;
  for (const b of BRCH.list) {
    if (b.open) continue;
    const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dy = Math.max(b.y0 - p.y, 0, p.y - b.y1), dz = Math.max(b.z0 - p.z, 0, p.z - b.z1), d = hyp3(dx, dy, dz);
    if (d < r) breachDamage(b, maxDmg * BREACH.blast * Math.pow(1 - d / r, 0.8), owner, false);
  }
}
/* Ouvre (ou referme, nouvelle partie) un pan ; fx : poussière, éclats, fracas */
function breachSet(b, open, fx) {
  if (b.open === open) return;
  b.open = open; BRCH.open[b.id] = open ? 1 : 0;
  dmgColsOn([b.col], !open); b.g.visible = !open; b.w.visible = open;
  if (!open) { b.hp = BREACH.hp; b.by = null; return; }
  if (fx) breachFx(b);
}
function breachFx(b) {
  const c = b.c, nx = b.ax ? 0 : 1, nz = b.ax ? 1 : 0, L = b.ax ? b.x1 - b.x0 : b.z1 - b.z0, H = b.y1 - b.y0;
  for (let i = 0; i < 36; i++) {
    const s = (Math.random() - 0.5) * L, h = Math.random() * H, side = Math.random() < 0.5 ? -1 : 1, sp = rand(1, 5);
    const x = b.ax ? c.x + s : c.x, z = b.ax ? c.z : c.z + s;
    FX.smoke.spawn(x, b.y0 + h, z, nx * side * sp + rand(-0.8, 0.8), rand(0, 1.4), nz * side * sp + rand(-0.8, 0.8), rand(2.5, 4.5), 0.35, rand(1.8, 3.2), 0.62, 0.56, 0.48, 0.55, 0, 0, 1.1, rand(-1, 1));
  }
  for (let i = 0; i < 28; i++) { const side = Math.random() < 0.5 ? -1 : 1, sp = rand(3, 9); FX.smoke.spawn(c.x, c.y + rand(-0.5, 0.8), c.z, nx * side * sp + rand(-2, 2), rand(1, 5), nz * side * sp + rand(-2, 2), rand(0.7, 1.4), rand(0.05, 0.12), 0.05, 0.45, 0.4, 0.34, 1, 0.9, 14, 0.4, rand(-6, 6)); }
  sfxBreach(c);
  const dc = c.distanceTo(camera.position); PL.shake = Math.max(PL.shake, clamp(1 - dc / 24, 0, 1) * 1.2);
}
/* Navigation : réseau construit pans ouverts, puis les nœuds de chaque ouverture fermés tant que le pan tient */
function breachNavOpen() { for (const b of BRCH.list) dmgColsOn([b.col], false); }
function breachNavGate() {
  BRCH.open = new Uint8Array(BRCH.list.length);
  if (!NAV.nx || !BRCH.list.length) { NAV.gate = null; for (const b of BRCH.list) dmgColsOn([b.col], true); return; }
  const n = NAV.count || NAV.nx.length, gate = new Uint16Array(NAV.nx.length); let any = 0;
  for (const b of BRCH.list) {
    const m = b.t / 2 + 0.4, x0 = b.ax ? b.x0 - 0.2 : (b.x0 + b.x1) / 2 - m, x1 = b.ax ? b.x1 + 0.2 : (b.x0 + b.x1) / 2 + m, z0 = b.ax ? (b.z0 + b.z1) / 2 - m : b.z0 - 0.2, z1 = b.ax ? (b.z0 + b.z1) / 2 + m : b.z1 + 0.2;
    for (let i = 0; i < n; i++) {
      const x = NAV.nx[i], y = NAV.ny[i], z = NAV.nz[i];
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && y >= b.y0 - 0.4 && y <= b.y0 + 0.8) { gate[i] = b.id + 1; any++; }
    }
    dmgColsOn([b.col], true);
  }
  NAV.gate = any ? gate : null;
}
/* Nœud fermé par un pan debout (findPath, navNode) */
function navGated(id) { const g = NAV.gate ? NAV.gate[id] : 0; return g > 0 && !BRCH.open[g - 1]; }
function breachReset() { for (const b of BRCH.list) breachSet(b, false, false); }
function breachClear() { BRCH.list.length = 0; BRCH.open = new Uint8Array(0); }
function sfxBreach(p) {
  if (!AU.ready) return;
  const d = p.distanceTo(camera.position); if (d > 80) return;
  const t = AU.ctx.currentTime + Math.min(d / 343, 0.2), o = auOut(p, 0.5, 1.8, 1, 6);
  nz(o, t, 1.6, 'lowpass', 700, 120, 0.7, 1.0, 0.01); tn(o, t, 0.5, 70, 35, 'sine', 0.9, 0.005);
  for (let i = 0; i < 10; i++) nz(o, t + rand(0.05, 1.1), rand(0.04, 0.12), 'bandpass', rand(400, 1400), 600, 1.2, rand(0.15, 0.4), 0.002); // les morceaux qui retombent
}
