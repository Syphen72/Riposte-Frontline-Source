/* ==========================================================================
   BARRICADES ET FORTIFICATION (Breachline, survie : 09ia-survie.js)
   Une carte de survie déclare, à sa construction, ses ouvertures à barricader (survOpening : portes, fenêtres, portail de grange), ses
   meubles à pousser (survProp), ses réserves de matériaux (survCache) et les points de ses objectifs (survObjective).
   - Ouverture : des emplacements de planches (4 pour une fenêtre, 5 pour une porte, 8 pour un portail), chacune une vraie boîte de collision
     sur la face extérieure du mur (posée à la construction de la carte pour la grille des collisions, repliée tant qu'elle n'est pas clouée :
     comme les pans à brèche, 04d-breches.js). Entre les planches, des fentes : on tire au travers, les balles passent, un soldat non. Une
     planche a ses points de vie (100, 150 avec les clous) et se voit s'abîmer : fendue (plus sombre, de travers) puis éclatée (pendante), puis
     elle tombe en éclats. Une porte clouée ferme les nœuds du réseau des bots dans son embrasure (NAV.bgate : les morts cherchent une autre
     entrée, ou s'attaquent aux planches) ; une fenêtre se franchit en l'enjambant quand il n'y a plus de planche (07g-zombies.js).
   - Meuble : on le pousse (une pression : il vient devant soi, on marche lentement ; une autre : on le pose, d'équerre). Posé contre une
     ouverture, de l'intérieur, il en devient une couche de plus (350 points de vie) que les morts doivent abattre.
   - Réserve : on y prend des planches (2 par prise, la réserve s'épuise), les outils (réparations plus rapides, et le pick-up), les clous
     (planches plus solides).
   Une seule touche pour tout (E, le bouton d'action de la manette, Ramasser au doigt) : une pression lance l'action, qui va au bout tant
   qu'on reste à portée sans courir ; une autre l'annule. En ligne, l'hôte décide de tout (réserves, planches, meubles) : un invité demande,
   l'hôte applique et publie (09ia-survie.js).
   ========================================================================== */
const SURV = { open: [], props: [], caches: [], objs: [] };
const BARR = { boardHp: 100, nails: 1.5, propHp: 350, nailT: 1.1, fixT: 0.7, takeT: 0.6, reach: 1.7, mats: null, geo: null };
function survMats() {
  if (BARR.mats) return BARR.mats;
  const mk = (c) => csmMaterial(new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, metalness: 0 }));
  BARR.mats = [mk(0x8a6844), mk(0x5e4630), mk(0x3e2f22)]; BARR.geo = new THREE.BoxGeometry(1, 1, 1);
  return BARR.mats;
}
/* Ouverture : { kind, axis ('x' : mur le long de x, à z = fixed ; 'z' : le long de z, à x = fixed), fixed, t (épaisseur), a0, a1 (le long du mur),
   b0, b1 (hauteurs), out (+1 ou -1 : côté extérieur, en z pour axis x, en x pour axis z), room } */
function survOpening(o) {
  const op = { ...o, id: SURV.open.length, slots: [], prop: null, gate: false };
  op.max = o.kind === 'fenetre' ? 4 : o.kind === 'portail' ? 8 : 5;
  const w = o.a1 - o.a0, face = o.fixed + o.out * (o.t / 2 + 0.035);
  for (let i = 0; i < op.max; i++) {
    let ya, aa0 = o.a0 - 0.12, aa1 = o.a1 + 0.12;
    if (o.kind === 'portail') { const col = i % 2, row = Math.floor(i / 2); ya = lerp(0.5, o.b1 - 0.5, row / 3); aa0 = col ? o.a0 + w / 2 - 0.05 : o.a0 - 0.12; aa1 = col ? o.a1 + 0.12 : o.a0 + w / 2 + 0.05; }
    else ya = lerp(o.b0 + (o.kind === 'fenetre' ? 0.16 : 0.3), o.b1 - 0.16, op.max === 1 ? 0.5 : i / (op.max - 1));
    const b = o.axis === 'x' ? { x0: aa0, x1: aa1, y0: ya - 0.08, y1: ya + 0.08, z0: face - 0.03, z1: face + 0.03 } : { x0: face - 0.03, x1: face + 0.03, y0: ya - 0.08, y1: ya + 0.08, z0: aa0, z1: aa1 };
    const c = { ...b, m: 'wood', ray: false, noTop: true, barr: op.id, o: { ...b } }; COL.push(c);
    op.slots.push({ c, y: ya, a0: aa0, a1: aa1, hp: 0, max: 0, mesh: null, tilt: (Math.random() - 0.5) * 0.12 });
  }
  SURV.open.push(op);
  return op;
}
function survBoardSet(op, s, on) { const c = s.c; if (on) Object.assign(c, c.o); else { c.x0 = c.x1 = c.y0 = c.y1 = c.z0 = c.z1 = 1e6; } }
/* Avant le réseau des bots : planches repliées (le réseau passe dans les embrasures) ; après : les nœuds des portes à fermer */
function survNavOpen() { for (const op of SURV.open) for (const s of op.slots) survBoardSet(op, s, false); }
function survNavGate() {
  if (!NAV.nx || !SURV.open.length) return;
  const n = NAV.count || NAV.nx.length; NAV.bgate = new Int16Array(NAV.nx.length);
  for (const op of SURV.open) {
    if (op.kind === 'fenetre') continue;
    const m = op.t / 2 + 0.45, mid = op.fixed;
    const x0 = op.axis === 'x' ? op.a0 - 0.1 : mid - m, x1 = op.axis === 'x' ? op.a1 + 0.1 : mid + m, z0 = op.axis === 'x' ? mid - m : op.a0 - 0.1, z1 = op.axis === 'x' ? mid + m : op.a1 + 0.1;
    for (let i = 0; i < n; i++) { const x = NAV.nx[i], z = NAV.nz[i]; if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && NAV.ny[i] < 0.8) NAV.bgate[i] = op.id + 1; }
  }
  if (!NAV.gate) NAV.gate = new Uint16Array(NAV.nx.length); // (navGated n'est appelé que si NAV.gate existe, 03-nav.js)
}
/* Une porte se ferme pour les bots dès qu'une planche y est clouée, ou qu'un meuble la bloque */
function survOpenShut(op) { return op.slots.some((s) => s.hp > 0) || !!(op.prop && op.prop.hp > 0); }
function survOpenClear(op) { return !survOpenShut(op); }
function survBGated(id) { const g = NAV.bgate ? NAV.bgate[id] : 0; return g > 0 && survOpenShut(SURV.open[g - 1]); }
/* Ancres d'une ouverture : devant (dehors) et derrière (dedans), au sol, à 65 cm du mur */
function survOpenAnchor(op, side, out) {
  const s = side === 'out' ? op.out : -op.out, d = op.t / 2 + 0.65, m = (op.a0 + op.a1) / 2;
  if (op.axis === 'x') out.set(m, 0, op.fixed + s * d); else out.set(op.fixed + s * d, 0, m);
  out.y = groundHeight(out.x, out.z, 1.2, 0.25);
  return out;
}
function survOpenFace(op, out) { const m = (op.a0 + op.a1) / 2; return op.axis === 'x' ? out.set(m, 1.2, op.fixed) : out.set(op.fixed, 1.2, m); }
/* L'ouverture qu'un mort attaque pour atteindre g : celle du bâtiment de g la plus proche de lui (une ouverture déjà libre d'abord) */
function survOpenFor(e, g) {
  const room = survRoomAt(g); let best = null, bd = 1e9;
  for (const op of SURV.open) {
    if (room && op.room !== room) continue;
    const a = survOpenAnchor(op, 'out', _sbA), d = hyp(a.x - e.pos.x, a.z - e.pos.z) * (survOpenClear(op) ? 0.5 : 1) + (op.kind === 'fenetre' ? 2 : 0);
    if (d < bd) { bd = d; best = op; }
  }
  return best;
}
/* La pièce (le bâtiment) qui contient un point : d'après les zones nommées des ouvertures (room) et les bornes de la carte */
function survRoomAt(p) {
  for (const z of SURV_ROOMS) if (p.x >= z[1] && p.x <= z[2] && p.z >= z[3] && p.z <= z[4]) return z[0];
  return null;
}
const SURV_ROOMS = [['maison', -6, 6, -4.5, 4.5], ['grange', -27, -15, -21, -9], ['appentis', 15, 19.5, -17.5, -13.5]];
const _sbA = new V3(), _sbB = new V3();
/* Un coup de mort sur une ouverture : la planche du haut d'abord (puis le meuble posé derrière) */
function survOpenHit(op, dmg, by) {
  if (!survLocal()) return;
  const s = op.slots.filter((x) => x.hp > 0).sort((a, b) => b.y - a.y)[0];
  if (s) { s.hp -= dmg; survBoardFx(op, s, s.hp <= 0); if (s.hp <= 0) survBoardRemove(op, s); else survBoardLook(op, s); survPub('b', op.id); return; }
  if (op.prop && op.prop.hp > 0) { op.prop.hp -= dmg; sfxBarr(survOpenFace(op, _sbA), 'thud'); if (op.prop.hp <= 0) survPropBreak(op.prop); survPub('b', op.id); }
  void by;
}
/* Planches : maillage (créé à la demande), aspect selon ses points de vie, retrait */
function survBoardMesh(op, s) {
  if (s.mesh) return s.mesh;
  survMats(); const m = new THREE.Mesh(BARR.geo, BARR.mats[0]); m.castShadow = true; m.receiveShadow = true; scene.add(m); s.mesh = m; return m;
}
function survBoardLook(op, s) {
  const m = survBoardMesh(op, s), k = s.max ? s.hp / s.max : 1, c = s.c.o, cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2;
  const L = op.axis === 'x' ? c.x1 - c.x0 : c.z1 - c.z0, tilt = s.tilt + (k < 0.66 ? 0.06 : 0) + (k < 0.33 ? 0.12 : 0), droop = k < 0.33 ? -0.06 : 0;
  m.visible = s.hp > 0; m.material = BARR.mats[k < 0.33 ? 2 : k < 0.66 ? 1 : 0];
  m.scale.set(L, 0.15, 0.045); m.position.set(cx, cy + droop, cz);
  m.rotation.set(0, op.axis === 'x' ? 0 : Math.PI / 2, tilt);
}
function survBoardRemove(op, s) { s.hp = 0; survBoardSet(op, s, false); if (s.mesh) s.mesh.visible = false; }
function survBoardAdd(op, s) { s.max = BARR.boardHp * (SURV_RES.nails ? BARR.nails : 1); s.hp = s.max; s.tilt = (Math.random() - 0.5) * 0.12; survBoardSet(op, s, true); survBoardLook(op, s); }
function survBoardFx(op, s, broke) {
  const c = s.c.o, p = _sbA.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2);
  for (let i = 0; i < (broke ? 14 : 5); i++) FX.smoke.spawn(p.x + rand(-0.4, 0.4), p.y, p.z + rand(-0.4, 0.4), rand(-1.5, 1.5), rand(0.2, 2), rand(-1.5, 1.5), rand(0.3, 0.7), 0.03, 0.02, 0.45, 0.34, 0.24, 1, 1, 9, 0.5);
  sfxBarr(p, broke ? 'break' : 'thud');
}
/* ---------- Meubles ---------- */
function survProp(kind, x, y, z, ry, fixed) {
  const d = kind === 'bookcase' ? { w: 1.0, h: 1.95, d: 0.42 } : { w: 1.6, h: 0.78, d: 0.9 };
  const p = { id: SURV.props.length, kind, x, y, z, ry, w: d.w, h: d.h, dd: d.d, hp: 0, max: BARR.propHp, fixed: !!fixed, op: null, carried: null, mesh: null, c: null, home: { x, y, z, ry } };
  if (!fixed) { const b = survPropBox(p); p.c = { ...b, m: 'wood', ray: false, noTop: true, o: { ...b } }; COL.push(p.c); }
  SURV.props.push(p);
  return p;
}
function survPropBox(p) { const sw = Math.abs(Math.sin(p.ry)) > 0.5, hx = (sw ? p.dd : p.w) / 2, hz = (sw ? p.w : p.dd) / 2; return { x0: p.x - hx, x1: p.x + hx, y0: p.y, y1: p.y + p.h, z0: p.z - hz, z1: p.z + hz }; }
function survPropMesh(p) {
  if (p.mesh) return p.mesh;
  const T = survMats(), g = new THREE.Group();
  if (p.kind === 'bookcase') {
    rb(g, T[1], 0, p.h / 2, 0, p.w, p.h, p.dd, 0.01);
    for (let i = 1; i < 5; i++) rb(g, T[0], 0, (i * p.h) / 5, -p.dd / 2 + 0.02, p.w - 0.06, 0.025, 0.04, 0.004);
    for (let i = 0; i < 9; i++) { const sh = Math.floor(i / 2.4), x = -0.38 + (i % 3) * 0.3; rb(g, BARR.mats[i % 3], x, (sh * p.h) / 5 + 0.15, -p.dd / 2 + 0.12, 0.22, 0.24, 0.16, 0.01); }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g); p.mesh = g; return g;
}
function survPropPlace(p) {
  if (p.fixed) return;
  const m = survPropMesh(p); m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry; m.visible = p.hp > 0 || !p.op;
  if (p.c) { Object.assign(p.c.o, survPropBox(p)); Object.assign(p.c, p.c.o); }
}
function survPropBreak(p) { p.hp = 0; if (p.op) { p.op.prop = null; p.op = null; } p.y = -50; survPropPlace(p); buildHash(); sfxBarr(_sbA.set(p.x, 1, p.z), 'break'); }
/* ---------- Réserves et objectifs ---------- */
function survCache(kind, x, y, z, ry) {
  const c = { id: SURV.caches.length, kind, x, y, z, ry, left: 0 };
  if (kind === 'planks') DECOR.place(PF.plankStack(2.2, 0.9, 0.55), x, y, z, ry);
  else { DECOR.save().color(kind === 'tools' ? [0.62, 0.16, 0.12] : [0.4, 0.42, 0.44]).local(1).move(x, y, z).rotY(ry); DECOR.boxB('steel', -0.25, 0.25, 0, kind === 'tools' ? 0.22 : 0.14, -0.13, 0.13, { bevel: 0.01 }); DECOR.restore(); }
  SURV.caches.push(c);
  return c;
}
function survObjective(kind, x, z) { SURV.objs.push({ kind, x, z, done: false, t: 0 }); }
/* Nouvelle carte : registres vidés (mapUnload) */
function survClear() { for (const op of SURV.open) for (const s of op.slots) if (s.mesh) scene.remove(s.mesh); for (const p of SURV.props) if (p.mesh) scene.remove(p.mesh); SURV.open.length = 0; SURV.props.length = 0; SURV.caches.length = 0; SURV.objs.length = 0; NAV.bgate = null; }

/* ---------- Matériaux de l'équipe ---------- */
const SURV_RES = { planks: 0, tools: false, nails: false };
/* Début d'une partie de survie : planches de départ, réserves pleines, ouvertures vides, meubles à leur place */
function survBarrReset() {
  SURV_RES.planks = 6; SURV_RES.tools = false; SURV_RES.nails = false;
  for (const c of SURV.caches) c.left = c.kind === 'planks' ? 8 : 1;
  for (const op of SURV.open) { op.prop = null; for (const s of op.slots) survBoardRemove(op, s); }
  for (const p of SURV.props) { Object.assign(p, p.home); p.hp = p.max; p.op = null; p.carried = null; survPropPlace(p); }
  for (const o of SURV.objs) { o.done = false; o.t = 0; }
  buildHash();
}

/* ---------- Action (une touche) : ce qu'il y a à faire ici ---------- */
const SACT = { cur: null, t: 0, dur: 0, carry: null, hint: '' };
/* La meilleure action à portée du joueur, ou null : { k, label, dur, run() } */
function survActionAt(e) {
  if (!e.alive || SURV_DOWN.me) return null;
  const p = e.pos, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), R = BARR.reach;
  if (SACT.carry) return { k: 'drop', label: _t('Poser le meuble'), dur: 0, run: () => survPropDrop(e) };
  let best = null, bs = 1e9;
  const consider = (a, x, z, extra = 0) => { const dx = x - p.x, dz = z - p.z, d = hyp(dx, dz); if (d > R + extra) return; const f = (dx * fx + dz * fz) / (d || 1), s = d - f * 0.8; if (s < bs) { bs = s; best = a; } };
  const tl = survToolK(e);
  for (const op of SURV.open) {
    const m = survOpenFace(op, _sbA); if (Math.abs(m.y - 1.2 - p.y) > 1.5) continue;
    const hurt = op.slots.find((s) => s.hp > 0 && s.hp < s.max * 0.95), free = op.slots.find((s) => s.hp <= 0);
    if (hurt) consider({ k: 'fix', op, label: _t('Réparer la barricade'), dur: BARR.fixT * tl, run: () => survReq('fix', op.id) }, m.x, m.z, 0.3);
    else if (free && SURV_RES.planks > 0) consider({ k: 'nail', op, label: _t('Clouer une planche ({0})', SURV_RES.planks), dur: BARR.nailT * tl, run: () => survReq('nail', op.id) }, m.x, m.z, 0.3);
  }
  for (const c of SURV.caches) if (c.left > 0) consider({ k: 'take', label: c.kind === 'planks' ? _t('Prendre des planches') : c.kind === 'tools' ? _t('Prendre la caisse à outils') : c.kind === 'drop' ? _t('Prendre le ravitaillement') : _t('Prendre les clous'), dur: BARR.takeT, run: () => survReq('take', c.id) }, c.x, c.z);
  for (const q of SURV.props) if (!q.fixed && q.hp > 0 && !q.carried) consider({ k: 'carry', label: _t('Pousser le meuble'), dur: 0, run: () => survPropTake(e, q) }, q.x, q.z, 0.3);
  const ob = survObjAction(e); if (ob) consider(ob, ob.x, ob.z, 0.5);
  const rv = survReviveAction(e); if (rv) consider(rv, rv.x, rv.z, 0.4);
  return best;
}
const survToolK = (e) => (SURV_RES.tools ? 0.62 : 1) * (survRoleOf(e) === 'engineer' ? 0.6 : 1);
/* La touche : lance l'action à portée, ou annule celle en cours ; vrai si elle a servi (sinon la touche garde son rôle : ramasser une arme) */
function survUse() {
  if (!survOn()) return false;
  if (SACT.cur) { SACT.cur = null; return true; }
  const a = survActionAt(PL.ent); if (!a) return false;
  if (!a.dur) { a.run(); return true; }
  SACT.cur = a; SACT.t = 0; SACT.dur = a.dur; sfxBarr(PL.ent.pos, a.k === 'nail' || a.k === 'fix' ? 'hammer' : 'take');
  return true;
}
/* Chaque image : progression de l'action (annulée si l'on s'éloigne, court ou meurt), meuble porté, invite */
function survActTick(dt) {
  const e = PL.ent;
  if (SACT.carry) survCarryTick(e, dt);
  const a = SACT.cur;
  if (a) {
    const still = survActionAt(e);
    if (!e.alive || SURV_DOWN.me || !still || still.k !== a.k || (still.op && still.op !== a.op) || hyp(e.vel.x, e.vel.z) > 3.2) SACT.cur = null;
    else {
      SACT.t += dt;
      if ((a.k === 'nail' || a.k === 'fix') && Math.floor(SACT.t * 3.2) !== Math.floor((SACT.t - dt) * 3.2)) sfxBarr(e.pos, 'tap');
      if (SACT.t >= SACT.dur) { SACT.cur = null; a.run(); }
    }
  }
  const cur = SACT.cur || survActionAt(e);
  SACT.hint = cur ? cur.label : '';
}
/* Meuble porté : devant soi, au sol ; on marche lentement */
function survPropTake(e, q) {
  if (!survLocal()) { survReq('carry', q.id); return; }
  q.carried = e; SACT.carry = q; if (q.op) { q.op.prop = null; q.op = null; }
  if (q.c) { q.c.x0 = q.c.x1 = q.c.y0 = q.c.y1 = q.c.z0 = q.c.z1 = 1e6; } sfxBarr(e.pos, 'drag'); survPub('p', q.id);
}
function survCarryTick(e, dt) {
  const q = SACT.carry; if (!q || !e.alive) { if (q) survPropDrop(e); return; }
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  q.x = e.pos.x + fx * 1.05; q.z = e.pos.z + fz * 1.05; q.y = e.pos.y; q.ry = Math.round(e.yaw / (Math.PI / 2)) * (Math.PI / 2);
  const m = survPropMesh(q); m.position.set(q.x, q.y, q.z); m.rotation.y = q.ry; m.visible = true;
  e.vel.x *= 1 - Math.min(1, dt * 8) * 0.45; e.vel.z *= 1 - Math.min(1, dt * 8) * 0.45;
  void dt;
}
function survPropDrop(e) {
  const q = SACT.carry; if (!q) return; SACT.carry = null; q.carried = null;
  // contre une ouverture, de l'intérieur : il s'y range (calé sur l'ancre du dedans) et devient une couche de la barricade
  let near = null, nd = 1.4;
  for (const op of SURV.open) { if (op.prop) continue; const a = survOpenAnchor(op, 'in', _sbB), d = hyp(a.x - q.x, a.z - q.z); if (d < nd) { nd = d; near = op; } }
  if (near) { const a = survOpenAnchor(near, 'in', _sbB), back = 0.22; q.x = a.x + (near.axis === 'z' ? near.out * back : 0); q.z = a.z + (near.axis === 'x' ? near.out * back : 0); q.ry = near.axis === 'x' ? 0 : Math.PI / 2; near.prop = q; q.op = near; q.hp = q.max; }
  q.y = groundHeight(q.x, q.z, e.pos.y + 0.4, 0.2);
  survPropPlace(q); buildHash(); sfxBarr(e.pos, 'drop'); survPub('p', q.id);
}
/* Demande à l'hôte (en solo et chez l'hôte : appliquée tout de suite) */
function survReq(k, id) { if (survLocal()) survApply(k, id, PL.ent); else survNetReq(k, id); }
function survApply(k, id, by) {
  if (k === 'nail') { const op = SURV.open[id], s = op && op.slots.find((x) => x.hp <= 0); if (!s || SURV_RES.planks <= 0) return; SURV_RES.planks--; survBoardAdd(op, s); sfxBarr(survOpenFace(op, _sbA), 'nail'); survStat(by, 'boards'); survPub('b', id); survPub('r'); }
  else if (k === 'fix') { const op = SURV.open[id]; if (!op) return; for (const s of op.slots) if (s.hp > 0) { s.hp = s.max; survBoardLook(op, s); } sfxBarr(survOpenFace(op, _sbA), 'nail'); survStat(by, 'repairs'); survPub('b', id); }
  else if (k === 'take') {
    const c = SURV.caches[id]; if (!c || c.left <= 0) return;
    if (c.kind === 'planks') { const n = Math.min(2, c.left); c.left -= n; SURV_RES.planks += n; hudMsgTo(by, _t('+{0} planches', n)); }
    else if (c.kind === 'tools') { c.left = 0; SURV_RES.tools = true; hudMsgTo(by, _t('Caisse à outils trouvée, les réparations vont plus vite')); }
    else if (c.kind === 'drop') { const n = c.left; c.left = 0; SURV_RES.planks += n; hudMsgTo(by, _t('+{0} planches', n)); if (SV.dropMesh) SV.dropMesh.visible = false; SV.drop = null; }
    else { c.left = 0; SURV_RES.nails = true; hudMsgTo(by, _t('Clous trouvés, les planches tiennent mieux')); }
    survPub('r');
  } else if (k === 'carry') { const q = SURV.props[id]; if (q && !q.carried) { q.carried = by; if (q.c) { q.c.x0 = q.c.x1 = q.c.y0 = q.c.y1 = q.c.z0 = q.c.z1 = 1e6; } survPub('p', id); } }
}

/* ---------- Sons (synthèse) : coups de marteau, planche qui craque, qui éclate, meuble traîné ---------- */
function sfxBarr(p, kind) {
  if (!AU.ready || p.distanceTo(camera.position) > 40) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.15, 1, 1, 3);
  if (kind === 'tap') { nz(o, t, 0.04, 'bandpass', 2400, 1800, 3, 0.25, 0.001); tn(o, t, 0.05, 900, 600, 'triangle', 0.12, 0.001); }
  else if (kind === 'nail' || kind === 'hammer') { for (let i = 0; i < (kind === 'nail' ? 3 : 1); i++) { nz(o, t + i * 0.11, 0.05, 'bandpass', 2600, 2000, 3, 0.3, 0.001); tn(o, t + i * 0.11, 0.06, 1000, 700, 'triangle', 0.14, 0.001); } }
  else if (kind === 'thud') { nz(o, t, 0.16, 'lowpass', 900, 250, 1, 0.45, 0.002); nz(o, t + 0.02, 0.1, 'bandpass', 1800, 900, 2, 0.18, 0.004); }
  else if (kind === 'break') { nz(o, t, 0.35, 'bandpass', 1500, 500, 1.4, 0.55, 0.002); nz(o, t + 0.05, 0.25, 'highpass', 3000, 2000, 1, 0.2, 0.002); tn(o, t, 0.2, 140, 60, 'sine', 0.3, 0.002); }
  else if (kind === 'drag') nz(o, t, 0.5, 'bandpass', 500, 300, 1.5, 0.2, 0.05);
  else if (kind === 'drop') { nz(o, t, 0.2, 'lowpass', 600, 200, 1, 0.4, 0.002); tn(o, t, 0.15, 90, 50, 'sine', 0.3, 0.002); }
  else if (kind === 'take') nz(o, t, 0.18, 'bandpass', 1200, 900, 2, 0.15, 0.01);
}
