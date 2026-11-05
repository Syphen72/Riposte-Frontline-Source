/* ==========================================================================
   BARRICADES ET FORTIFICATION (Breachline, survie : 09ia-survie.js)
   Une carte de survie déclare, à sa construction, ses ouvertures à barricader (survOpening : portes, fenêtres, portail de grange), ses
   meubles à pousser (survProp), ses réserves de matériaux (survCache) et les points de ses objectifs (survObjective).
   Trois familles d'obstacles, un seul système (les morts les traitent tous de la même façon, 07g-zombies.js) :
   - LÉGERS : chaises, tables de la salle, caisses, seaux... ce sont les props physiques du décor (02k-dynprops.js) : une balle, une explosion
     ou un mort qui force le passage les écartent (zombieShove) ;
   - LOURDS : bibliothèque, armoire, commode, canapé (SURV_PROPS) : on les pousse (une pression : le meuble vient devant soi, on marche
     lentement ; une autre : on le pose, d'équerre). Où qu'il soit posé, un meuble ferme les nœuds du réseau des bots qu'il couvre (NAV.pblock,
     survPropNav) : les morts le contournent s'il y a un autre chemin, sinon ils l'abattent (points de vie, il s'abîme à vue d'œil, puis
     éclate : sa collision et ses nœuds se libèrent), le poussent quand il cède (les brutes tout de suite), ou enjambent un meuble bas
     (commode, canapé). Posé contre une ouverture, de l'intérieur, il en devient une couche de plus ;
   - BARRICADES : des emplacements de planches (4 pour une fenêtre, 5 pour une porte, 8 pour un portail), chacune une vraie boîte de collision
     sur la face extérieure du mur (posée à la construction de la carte pour la grille des collisions, repliée tant qu'elle n'est pas clouée :
     comme les pans à brèche, 04d-breches.js). Entre les planches, des fentes : on tire au travers, les balles passent, un soldat non. Une
     planche a ses points de vie (150, 225 avec les clous) et se voit s'abîmer : fendue (plus sombre, de travers) puis éclatée (pendante),
     puis elle tombe en éclats. Par-dessus, une tôle (les tôles de la grange) couvre le bas de l'ouverture : elle se
     cabosse et rouille à vue, sonne sous les coups, arrête les balles (650 points de vie). Une porte fermée ferme les nœuds du réseau dans son embrasure
     (NAV.bgate) ; une fenêtre se franchit en l'enjambant quand il n'y a plus rien devant.
   Chemins : quand un mort n'a pas de chemin ouvert, il en cherche un qui passe par ce qu'il faudrait abattre (findPath en mode « soft » :
   survSoftCost coûte d'autant plus que l'obstacle tient, et que d'autres morts s'y pressent déjà), et s'attaque au premier obstacle du chemin.
   - Réserve : on y prend des planches (2 par prise, la réserve s'épuise), les outils (réparations plus rapides, et le pick-up), les clous
     (planches plus solides), les tôles.
   Réparer remet à neuf la pièce la plus abîmée de l'ouverture (une planche, ou la tôle) : tenir une barricade demande d'y revenir.
   Une seule touche pour tout (E, le bouton d'action de la manette, Ramasser au doigt) : une pression lance l'action, qui va au bout tant
   qu'on reste à portée sans courir ; une autre l'annule. En ligne, l'hôte décide de tout (réserves, planches, meubles) : un invité demande,
   l'hôte applique et publie (09ia-survie.js).
   ========================================================================== */
const SURV = { open: [], props: [], caches: [], objs: [], navDirty: false };
const BARR = { boardHp: 150, nails: 1.5, plateHp: 650, nailT: 1.1, fixT: 0.9, plateT: 2.2, takeT: 0.6, reach: 1.7, zk: 1.7, mats: null, geo: null };
/* Meubles lourds : dimensions (w le long de la face, d en profondeur), points de vie, bas (s'enjambe) */
const SURV_PROPS = {
  bookcase: { w: 1.0, h: 1.95, d: 0.42, hp: 380 },
  wardrobe: { w: 1.1, h: 2.0, d: 0.6, hp: 460 },
  dresser: { w: 1.2, h: 0.92, d: 0.5, hp: 300, low: true },
  couch: { w: 1.9, h: 0.85, d: 0.86, hp: 320, low: true },
};
/* Matières : bois clair, bois fendu, bois éclaté ; tissu, tissu taché ; tôle, tôle cabossée, rouille */
function survMats() {
  if (BARR.mats) return BARR.mats;
  const mk = (c, r = 0.88, m = 0) => csmMaterial(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
  BARR.mats = [mk(0x8a6844), mk(0x5e4630), mk(0x3e2f22), mk(0x6b5140, 0.95), mk(0x45342a, 0.95), mk(0x8a8c88, 0.62, 0.35), mk(0x5f615e, 0.7, 0.3), mk(0x5c3f2b, 0.85, 0.2)];
  BARR.geo = new THREE.BoxGeometry(1, 1, 1);
  return BARR.mats;
}
/* Ouverture : { kind, axis ('x' : mur le long de x, à z = fixed ; 'z' : le long de z, à x = fixed), fixed, t (épaisseur), a0, a1 (le long du mur),
   b0, b1 (hauteurs), out (+1 ou -1 : côté extérieur, en z pour axis x, en x pour axis z), room } */
function survOpening(o) {
  const op = { ...o, id: SURV.open.length, slots: [], prop: null, gate: false, plate: { hp: 0, max: 0, mesh: null, c: null, dent: 0 }, crowd: 0 };
  op.max = o.kind === 'fenetre' ? 4 : o.kind === 'portail' ? 8 : 5;
  const w = o.a1 - o.a0, face = o.fixed + o.out * (o.t / 2 + 0.035);
  const span = (a0, a1, y0, y1, f, th) => (o.axis === 'x' ? { x0: a0, x1: a1, y0, y1, z0: f - th, z1: f + th } : { x0: f - th, x1: f + th, y0, y1, z0: a0, z1: a1 });
  for (let i = 0; i < op.max; i++) {
    let ya, aa0 = o.a0 - 0.12, aa1 = o.a1 + 0.12;
    if (o.kind === 'portail') { const col = i % 2, row = Math.floor(i / 2); ya = lerp(0.5, o.b1 - 0.5, row / 3); aa0 = col ? o.a0 + w / 2 - 0.05 : o.a0 - 0.12; aa1 = col ? o.a1 + 0.12 : o.a0 + w / 2 + 0.05; }
    else ya = lerp(o.b0 + (o.kind === 'fenetre' ? 0.16 : 0.3), o.b1 - 0.16, op.max === 1 ? 0.5 : i / (op.max - 1));
    const b = span(aa0, aa1, ya - 0.08, ya + 0.08, face, 0.03);
    const c = { ...b, m: 'wood', ray: false, noTop: true, barr: op.id, o: { ...b } }; COL.push(c);
    op.slots.push({ c, y: ya, a0: aa0, a1: aa1, hp: 0, max: 0, mesh: null, tilt: (Math.random() - 0.5) * 0.12 });
  }
  // la tôle : par-dessus les planches, le bas de l'ouverture (on tire encore par le haut)
  const pf = o.fixed + o.out * (o.t / 2 + 0.095), py0 = o.b0 + 0.04, py1 = o.b0 + (o.b1 - o.b0) * 0.6, pb = span(o.a0 - 0.14, o.a1 + 0.14, py0, py1, pf, 0.016);
  op.plate.c = { ...pb, m: 'metal', ray: false, noTop: true, barr: op.id, o: { ...pb } }; COL.push(op.plate.c);
  SURV.open.push(op);
  return op;
}
const survCollapse = (c) => { c.x0 = c.x1 = c.y0 = c.y1 = c.z0 = c.z1 = 1e6; };
function survBoardSet(op, s, on) { const c = s.c; if (on) Object.assign(c, c.o); else survCollapse(c); }
/* Avant le réseau des bots : planches, tôles et meubles repliés (le réseau passe partout) ; après : les nœuds des portes à fermer, les meubles à
   leur place (NAV.pblock) */
function survNavOpen() { for (const op of SURV.open) { for (const s of op.slots) survBoardSet(op, s, false); survCollapse(op.plate.c); } for (const p of SURV.props) if (p.c) survCollapse(p.c); }
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
  for (const p of SURV.props) survPropPlace(p);
  survPropNav();
}
/* Les nœuds du réseau qu'un meuble couvre (son bord à moins de 36 cm du centre du nœud, au même étage) : fermés aux bots et aux morts */
function survPropNav() {
  SURV.navDirty = false;
  if (!NAV.nx) return;
  const N = NAV.count || NAV.nx.length;
  if (!NAV.pblock || NAV.pblock.length !== N) NAV.pblock = new Int16Array(N); else NAV.pblock.fill(0);
  const r = NAV_R - 0.06;
  for (const p of SURV.props) {
    if (p.hp <= 0 || p.carried || p.y < -10) continue;
    const b = survPropBox(p);
    for (let cz = Math.floor(b.z0 - r - NAV.z0); cz <= Math.floor(b.z1 + r - NAV.z0); cz++) for (let cx = Math.floor(b.x0 - r - NAV.x0); cx <= Math.floor(b.x1 + r - NAV.x0); cx++) {
      if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
      for (const id of NAV.cells[cz * NAV.W + cx]) {
        const y = NAV.ny[id]; if (y < p.y - 0.5 || y > p.y + 0.5) continue;
        const x = NAV.nx[id], z = NAV.nz[id], qx = clamp(x, b.x0, b.x1), qz = clamp(z, b.z0, b.z1);
        if ((x - qx) ** 2 + (z - qz) ** 2 < r * r) NAV.pblock[id] = p.id + 1;
      }
    }
  }
  for (const z of ZOMBIES) if (z.alive && !z.zNet) z.zRepT = Math.min(z.zRepT, 0.15); // (les chemins en cours passent peut-être par là)
}
/* Une ouverture est fermée dès qu'une planche y est clouée, qu'une tôle la couvre, ou qu'un meuble la bloque */
function survOpenShut(op) { return op.plate.hp > 0 || op.slots.some((s) => s.hp > 0) || !!(op.prop && op.prop.hp > 0); }
function survOpenClear(op) { return !survOpenShut(op); }
const survOpenHp = (op) => op.slots.reduce((a, s) => a + Math.max(0, s.hp), 0) + Math.max(0, op.plate.hp) + (op.prop && op.prop.hp > 0 ? op.prop.hp : 0);
function survBGated(id) { const g = NAV.bgate ? NAV.bgate[id] : 0; return (g > 0 && survOpenShut(SURV.open[g - 1])) || (!!NAV.pblock && NAV.pblock[id] > 0); }
/* Coût d'un nœud fermé pour un chemin « soft » (findPath, 03-nav.js) : ce qu'il faudrait abattre ; une brèche fermée (autres modes) reste fermée */
function survSoftCost(id) {
  const g = NAV.gate[id]; if (g > 0 && BRCH.open && !BRCH.open[g - 1]) return -1;
  let c = 0;
  const pb = NAV.pblock ? NAV.pblock[id] : 0;
  if (pb) { const p = SURV.props[pb - 1]; c += 2.5 + p.hp / 45 + p.crowd * 1.5; }
  const bg = NAV.bgate ? NAV.bgate[id] : 0;
  if (bg) { const op = SURV.open[bg - 1]; if (survOpenShut(op)) c += 3 + survOpenHp(op) / 45 + Math.max(0, op.crowd - 2) * 3; }
  return c;
}
/* L'obstacle d'un nœud fermé : { t: 'prop', p } ou { t: 'open', op } */
function survObstacleOf(id) {
  const pb = NAV.pblock ? NAV.pblock[id] : 0; if (pb) return { t: 'prop', p: SURV.props[pb - 1], op: null };
  const bg = NAV.bgate ? NAV.bgate[id] : 0; if (bg && survOpenShut(SURV.open[bg - 1])) return { t: 'open', op: SURV.open[bg - 1], p: null };
  return null;
}
/* Ancres d'une ouverture : devant (dehors) et derrière (dedans), au sol, à 65 cm du mur ; lat : décalage le long du mur (plusieurs morts) */
function survOpenAnchor(op, side, out, lat = 0) {
  const s = side === 'out' ? op.out : -op.out, d = op.t / 2 + 0.65, m = (op.a0 + op.a1) / 2 + lat;
  if (op.axis === 'x') out.set(m, 0, op.fixed + s * d); else out.set(op.fixed + s * d, 0, m);
  out.y = groundHeight(out.x, out.z, 1.2, 0.25);
  return out;
}
function survOpenFace(op, out) { const m = (op.a0 + op.a1) / 2; return op.axis === 'x' ? out.set(m, 1.2, op.fixed) : out.set(op.fixed, 1.2, m); }
/* Le côté (dehors, dedans) d'un point par rapport à une ouverture */
function survOpenSide(op, p) { const d = op.axis === 'x' ? p.z - op.fixed : p.x - op.fixed; return d * op.out >= 0 ? 'out' : 'in'; }
/* Distance à plat d'un point à l'ouverture (au segment de sa face) */
function survOpenDist(op, p) {
  const a = clamp(op.axis === 'x' ? p.x : p.z, op.a0, op.a1), b = op.axis === 'x' ? p.z - op.fixed : p.x - op.fixed;
  return hyp((op.axis === 'x' ? p.x : p.z) - a, Math.max(0, Math.abs(b) - op.t / 2));
}
/* Distance à plat d'un point au meuble (au bord de sa boîte) */
function survPropDist(p, q) { const b = survPropBox(p), x = clamp(q.x, b.x0, b.x1), z = clamp(q.z, b.z0, b.z1); return hyp(q.x - x, q.z - z); }
/* L'ouverture qu'un mort attaque pour atteindre g : du bâtiment de g, la moins coûteuse pour lui (distance, ce qui la ferme, les morts qui s'y
   pressent déjà) ; une ouverture libre d'abord */
function survOpenFor(e, g, only) {
  const room = survRoomAt(g); let best = null, bd = 1e9;
  for (const op of SURV.open) {
    if (room && op.room !== room) continue;
    if (only && op.kind !== only) continue;
    if (survOpenSide(op, e.pos) === survOpenSide(op, g)) continue; // (déjà du côté de sa proie : cette ouverture ne le rapproche de rien)
    const a = survOpenAnchor(op, survOpenSide(op, e.pos), _sbA), clear = survOpenClear(op);
    const d = hyp(a.x - e.pos.x, a.z - e.pos.z) * (clear ? 0.5 : 1) + (op.kind === 'fenetre' ? 2 : 0) + (clear ? 0 : survOpenHp(op) / 60) + Math.max(0, op.crowd - (op.kind === 'portail' ? 3 : 2)) * 4;
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
const _sbA = new V3(), _sbB = new V3(), _sbC = new V3();
/* Un coup de mort sur une ouverture : la tôle d'abord, puis la planche du haut, puis le meuble posé derrière */
function survOpenHit(op, dmg, by) {
  if (!survLocal()) return;
  const P = op.plate;
  if (P.hp > 0) { P.hp -= dmg; survPlateFx(op, P.hp <= 0); if (P.hp <= 0) survPlateRemove(op); else survPlateLook(op); survPub('b', op.id); return; }
  const s = op.slots.filter((x) => x.hp > 0).sort((a, b) => b.y - a.y)[0];
  if (s) { s.hp -= dmg; survBoardFx(op, s, s.hp <= 0); if (s.hp <= 0) survBoardRemove(op, s); else survBoardLook(op, s); survPub('b', op.id); return; }
  if (op.prop && op.prop.hp > 0) survPropHit(op.prop, dmg, by, null);
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
/* ---------- Tôles ---------- */
function survPlateMesh(op) {
  const P = op.plate; if (P.mesh) return P.mesh;
  const T = survMats(), g = new THREE.Group(), c = P.c.o, L = op.axis === 'x' ? c.x1 - c.x0 : c.z1 - c.z0, H = c.y1 - c.y0;
  const body = rb(g, T[5], 0, 0, 0, L, H, 0.02, 0.003); body.userData.body = true;
  for (let i = 0; i < 6; i++) rb(g, T[6], -L / 2 + (i + 0.5) * (L / 6), 0, 0.012, 0.035, H * 0.98, 0.012, 0.002); // ondes de la tôle
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) rb(g, T[6], sx * (L / 2 - 0.06), sy * (H / 2 - 0.06), 0.02, 0.03, 0.03, 0.02, 0.006); // clous
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2); g.rotation.y = op.axis === 'x' ? 0 : Math.PI / 2;
  scene.add(g); P.mesh = g; return g;
}
function survPlateLook(op) {
  const P = op.plate, m = survPlateMesh(op), k = P.max ? P.hp / P.max : 1;
  m.visible = P.hp > 0;
  for (const o of m.children) if (o.userData.body) o.material = BARR.mats[k < 0.3 ? 7 : k < 0.65 ? 6 : 5];
  m.rotation.z = (k < 0.65 ? 0.035 : 0) + (k < 0.3 ? 0.07 : 0) * (op.id % 2 ? 1 : -1); // cabossée, de travers
}
function survPlateAdd(op) { const P = op.plate; P.max = BARR.plateHp; P.hp = P.max; Object.assign(P.c, P.c.o); survPlateLook(op); }
function survPlateRemove(op) { const P = op.plate; P.hp = 0; survCollapse(P.c); if (P.mesh) P.mesh.visible = false; }
function survPlateFx(op, broke) {
  const c = op.plate.c.o, p = _sbA.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2);
  for (let i = 0; i < (broke ? 14 : 5); i++) FX.add.spawn(p.x + rand(-0.4, 0.4), p.y + rand(-0.3, 0.3), p.z + rand(-0.4, 0.4), rand(-2, 2), rand(0.5, 3), rand(-2, 2), rand(0.15, 0.4), 0.03, 0.01, 4, 2.6, 1.1, 1, 0, 9, 0.5);
  sfxBarr(p, broke ? 'tear' : 'clang');
}
/* ---------- Meubles lourds ---------- */
function survProp(kind, x, y, z, ry) {
  const D = SURV_PROPS[kind] || SURV_PROPS.bookcase;
  const p = { id: SURV.props.length, kind, x, y, z, ry, w: D.w, h: D.h, dd: D.d, hp: D.hp, max: D.hp, low: !!D.low, op: null, carried: null, mesh: null, c: null, home: { x, y, z, ry }, shake: 0, look: -1, crowd: 0 };
  const b = survPropBox(p); p.c = { ...b, m: 'wood', ray: false, noTop: true, sprop: p.id, o: { ...b } }; COL.push(p.c);
  SURV.props.push(p);
  return p;
}
function survPropBox(p) { const sw = Math.abs(Math.sin(p.ry)) > 0.5, hx = (sw ? p.dd : p.w) / 2, hz = (sw ? p.w : p.dd) / 2; return { x0: p.x - hx, x1: p.x + hx, y0: p.y, y1: p.y + p.h, z0: p.z - hz, z1: p.z + hz }; }
function survPropMesh(p) {
  if (p.mesh) return p.mesh;
  const T = survMats(), g = new THREE.Group(), W = p.w, H = p.h, D = p.dd, body = (m) => { m.userData.body = true; return m; };
  if (p.kind === 'bookcase') {
    body(rb(g, T[1], 0, H / 2, 0, W, H, D, 0.01));
    for (let i = 1; i < 5; i++) rb(g, T[0], 0, (i * H) / 5, -D / 2 + 0.02, W - 0.06, 0.025, 0.04, 0.004);
    for (let i = 0; i < 9; i++) { const sh = Math.floor(i / 2.4), x = -0.38 + (i % 3) * 0.3; rb(g, BARR.mats[i % 3], x, (sh * H) / 5 + 0.15, -D / 2 + 0.12, 0.22, 0.24, 0.16, 0.01); }
  } else if (p.kind === 'wardrobe') {
    body(rb(g, T[1], 0, H / 2 + 0.04, 0, W, H - 0.08, D, 0.012)); rb(g, T[2], 0, 0.04, 0, W - 0.04, 0.08, D - 0.04, 0.005);
    rb(g, T[2], 0, H / 2, -D / 2 - 0.002, 0.012, H - 0.2, 0.01, 0.002); // jointure des deux portes
    for (const sx of [-1, 1]) { rb(g, T[0], sx * W / 4, H / 2, -D / 2 - 0.004, W / 2 - 0.12, H - 0.36, 0.01, 0.004); rb(g, T[6], sx * 0.05, H * 0.52, -D / 2 - 0.02, 0.02, 0.12, 0.02, 0.005); }
    rb(g, T[0], 0, H - 0.02, 0, W + 0.04, 0.04, D + 0.04, 0.006); // corniche
  } else if (p.kind === 'dresser') {
    body(rb(g, T[1], 0, H / 2 + 0.03, 0, W, H - 0.06, D, 0.01)); rb(g, T[0], 0, H - 0.015, 0, W + 0.03, 0.03, D + 0.03, 0.005);
    for (let i = 0; i < 3; i++) { const y = 0.16 + i * ((H - 0.2) / 3); rb(g, T[0], 0, y + 0.1, -D / 2 - 0.004, W - 0.08, (H - 0.3) / 3, 0.012, 0.004); for (const sx of [-1, 1]) rb(g, T[6], sx * 0.28, y + 0.1, -D / 2 - 0.016, 0.07, 0.016, 0.016, 0.004); }
  } else { // canapé : socle, assise, dossier, accoudoirs, coussins
    body(rb(g, T[3], 0, 0.22, 0.02, W, 0.3, D - 0.04, 0.03)); rb(g, T[2], 0, 0.035, 0, W - 0.1, 0.07, D - 0.12, 0.01);
    for (let i = 0; i < 3; i++) rb(g, T[i === 1 ? 4 : 3], -W / 3 + (i * W) / 3, 0.43, -0.04, W / 3 - 0.04, 0.12, D - 0.28, 0.04);
    rb(g, T[3], 0, 0.6, D / 2 - 0.1, W, 0.5, 0.2, 0.04);
    for (const sx of [-1, 1]) rb(g, T[3], sx * (W / 2 - 0.09), 0.5, 0, 0.18, 0.32, D, 0.04);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g); p.mesh = g; return g;
}
/* Aspect selon ses points de vie : fendu (plus sombre), éclaté (de travers) ; un coup le fait trembler */
function survPropLook(p) {
  const m = survPropMesh(p), k = p.max ? p.hp / p.max : 1, st = k < 0.33 ? 2 : k < 0.66 ? 1 : 0;
  if (p.look !== st) {
    p.look = st;
    const fab = p.kind === 'couch';
    for (const o of m.children) if (o.userData.body) o.material = BARR.mats[fab ? (st ? 4 : 3) : st === 2 ? 2 : st === 1 ? 2 : 1];
  }
}
function survPropPlace(p) {
  const m = survPropMesh(p); m.position.set(p.x, p.y, p.z); m.rotation.set(0, p.ry, 0); m.visible = p.hp > 0;
  survPropLook(p);
  if (p.c) { Object.assign(p.c.o, survPropBox(p)); if (p.hp > 0 && !p.carried) Object.assign(p.c, p.c.o); else survCollapse(p.c); }
}
/* Les meubles qui tremblent sous les coups (chaque image) */
function survPropAnim(dt) {
  for (const p of SURV.props) {
    if (!p.mesh || p.carried || p.hp <= 0) continue;
    const k = p.max ? p.hp / p.max : 1, lean = k < 0.33 ? 0.05 : k < 0.66 ? 0.02 : 0;
    if (p.shake <= 0 && !lean) continue;
    p.shake = Math.max(0, p.shake - dt * 3.5);
    const j = Math.sin(MATCH.time * 61 + p.id) * 0.035 * p.shake;
    p.mesh.rotation.set(lean * (p.id % 2 ? 1 : -1) + j, p.ry, j * 0.6);
    p.mesh.position.set(p.x + j * 0.5, p.y, p.z - j * 0.3);
  }
}
/* Un coup sur un meuble : il s'abîme, tremble ; quand il cède (sous la moitié de ses points de vie, ou d'un coup de brute) il recule de
   quelques centimètres si la place est libre derrière ; à zéro il éclate */
function survPropHit(p, dmg, by, dir) {
  if (!survLocal() || p.hp <= 0 || p.carried) return;
  p.hp -= dmg; p.shake = 1;
  const c = _sbC.set(p.x, p.y + Math.min(1.2, p.h * 0.6), p.z);
  for (let i = 0; i < 4; i++) FX.smoke.spawn(c.x + rand(-0.3, 0.3), c.y, c.z + rand(-0.3, 0.3), rand(-1, 1), rand(0.2, 1.5), rand(-1, 1), rand(0.25, 0.5), 0.03, 0.02, 0.42, 0.33, 0.25, 1, 1, 9, 0.5);
  sfxBarr(c, 'thud');
  if (p.hp <= 0) { survPropBreak(p); return; }
  if (dir && (p.hp < p.max * 0.5 || (by && by.zk === 'brute'))) survPropShove(p, dir.x, dir.z, by && by.zk === 'brute' ? 0.28 : 0.09);
  survPropLook(p); survPub('p', p.id);
}
/* Pousser un meuble de d mètres dans la direction (dx, dz), s'il y a la place (rien du décor, aucun autre meuble, le même sol) */
function survPropShove(p, dx, dz, d) {
  const l = hyp(dx, dz); if (l < 1e-3 || p.op) return false;
  const nx = p.x + (dx / l) * d, nz = p.z + (dz / l) * d, ox = p.x, oz = p.z;
  p.x = nx; p.z = nz; const b = survPropBox(p); p.x = ox; p.z = oz;
  for (const c of queryBoxes(b.x0, b.z0, b.x1, b.z1)) {
    if (c === p.c || c.ray || c.y1 <= b.y0 + 0.05 || c.y0 >= b.y1) continue;
    if (c.x1 > b.x0 + 0.01 && c.x0 < b.x1 - 0.01 && c.z1 > b.z0 + 0.01 && c.z0 < b.z1 - 0.01) return false;
  }
  if (Math.abs(groundHeight(nx, nz, p.y + 0.3, 0.2) - p.y) > 0.12) return false;
  p.x = nx; p.z = nz; survPropPlace(p); buildHash(); SURV.navDirty = true; sfxBarr(_sbA.set(p.x, p.y + 0.3, p.z), 'drag');
  return true;
}
function survPropBreak(p) {
  const c = _sbC.set(p.x, p.y + p.h * 0.5, p.z);
  for (let i = 0; i < 22; i++) FX.smoke.spawn(c.x + rand(-0.5, 0.5), c.y + rand(-0.4, 0.4), c.z + rand(-0.5, 0.5), rand(-2, 2), rand(0.3, 2.5), rand(-2, 2), rand(0.3, 0.8), 0.03, 0.02, 0.42, 0.33, 0.25, 1, 1, 9, 0.5);
  sfxBarr(c, 'break');
  p.hp = 0; if (p.op) { p.op.prop = null; p.op = null; } if (p.carried === PL.ent) SACT.carry = null; p.carried = null; p.y = -50;
  survPropPlace(p); buildHash(); survPropNav(); survPub('p', p.id);
}
/* ---------- Réserves et objectifs ---------- */
function survCache(kind, x, y, z, ry) {
  const c = { id: SURV.caches.length, kind, x, y, z, ry, left: 0, max: 0, rt: 0 };
  if (kind === 'planks') DECOR.place(PF.plankStack(2.2, 0.9, 0.55), x, y, z, ry);
  else if (kind === 'metal') { DECOR.save().color([0.5, 0.52, 0.54]).local(1).move(x, y, z).rotY(ry); for (let i = 0; i < 4; i++) DECOR.boxB('steel', -0.7, 0.7, i * 0.025, i * 0.025 + 0.02, -0.45 + i * 0.02, 0.45 + i * 0.02, { bevel: 0.004 }); DECOR.restore(); DECOR.col(x - 0.75, x + 0.75, y, y + 0.1, z - 0.5, z + 0.5, 'metal'); }
  else if (kind !== 'ammo') { DECOR.save().color(kind === 'tools' ? [0.62, 0.16, 0.12] : [0.4, 0.42, 0.44]).local(1).move(x, y, z).rotY(ry); DECOR.boxB('steel', -0.25, 0.25, 0, kind === 'tools' ? 0.22 : 0.14, -0.13, 0.13, { bevel: 0.01 }); DECOR.restore(); }
  SURV.caches.push(c);
  return c;
}
function survObjective(kind, x, z) { SURV.objs.push({ kind, x, z, done: false, t: 0 }); }
/* Nouvelle carte : registres vidés (mapUnload) */
function survClear() {
  survAmmoClear(); for (const c of SURV.caches) if (c.mesh) scene.remove(c.mesh);
  for (const op of SURV.open) { for (const s of op.slots) if (s.mesh) scene.remove(s.mesh); if (op.plate.mesh) scene.remove(op.plate.mesh); }
  for (const p of SURV.props) if (p.mesh) scene.remove(p.mesh);
  SURV.open.length = 0; SURV.props.length = 0; SURV.caches.length = 0; SURV.objs.length = 0; NAV.bgate = null; NAV.pblock = null;
}

/* ---------- Matériaux de l'équipe ---------- */
const SURV_RES = { planks: 0, tools: false, nails: false, metal: 0 };
/* Début d'une partie de survie : planches de départ, réserves pleines, ouvertures vides, meubles à leur place */
function survBarrReset() {
  SURV_RES.planks = 6; SURV_RES.tools = false; SURV_RES.nails = false; SURV_RES.metal = 0;
  for (const c of SURV.caches) c.left = c.kind === 'planks' ? 8 : c.kind === 'metal' ? 4 : c.kind === 'ammo' ? c.max : 1;
  for (const op of SURV.open) { op.prop = null; op.crowd = 0; for (const s of op.slots) survBoardRemove(op, s); survPlateRemove(op); }
  for (const p of SURV.props) { Object.assign(p, p.home); p.hp = p.max; p.op = null; p.carried = null; p.shake = 0; p.look = -1; survPropPlace(p); }
  for (const o of SURV.objs) { o.done = false; o.t = 0; }
  buildHash(); survPropNav();
}

/* ---------- Action (une touche) : ce qu'il y a à faire ici ---------- */
const SACT = { cur: null, t: 0, dur: 0, carry: null, hint: '' };
/* La meilleure action à portée du joueur, ou null : { k, label, dur, run() } */
function survActionAt(e) {
  if (!e.alive || SURV_DOWN.me) return null;
  const p = e.pos, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), R = BARR.reach;
  if (SACT.carry) return { k: 'drop', label: _t('Poser le meuble'), dur: 0, run: () => survPropDrop(e) };
  let best = null, bs = 1e9;
  const consider = (a, x, z, extra = 0, y = null) => { if (y !== null && Math.abs(y - p.y) > 1.2) return; const dx = x - p.x, dz = z - p.z, d = hyp(dx, dz); if (d > R + extra) return; const f = (dx * fx + dz * fz) / (d || 1), s = d - f * 0.8; if (s < bs) { bs = s; best = a; } };
  const tl = survToolK(e);
  for (const op of SURV.open) {
    const m = survOpenFace(op, _sbA); if (Math.abs(m.y - 1.2 - p.y) > 1.5) continue;
    const hurt = (op.plate.hp > 0 && op.plate.hp < op.plate.max * 0.95) || op.slots.some((s) => s.hp > 0 && s.hp < s.max * 0.95), free = op.slots.find((s) => s.hp <= 0);
    if (hurt) consider({ k: 'fix', op, label: _t('Réparer la barricade'), dur: BARR.fixT * tl, run: () => survReq('fix', op.id) }, m.x, m.z, 0.3);
    else if (free && SURV_RES.planks > 0) consider({ k: 'nail', op, label: _t('Clouer une planche ({0})', SURV_RES.planks), dur: BARR.nailT * tl, run: () => survReq('nail', op.id) }, m.x, m.z, 0.3);
    else if (!free && op.plate.hp <= 0 && SURV_RES.metal > 0) consider({ k: 'plate', op, label: _t('Renforcer avec une tôle ({0})', SURV_RES.metal), dur: BARR.plateT * tl, run: () => survReq('plate', op.id) }, m.x, m.z, 0.3);
  }
  for (const c of SURV.caches) if (c.left > 0 && survCacheUseful(c)) consider({ k: 'take', label: survCacheLabel(c), dur: BARR.takeT, run: () => survReq('take', c.id) }, c.x, c.z, 0, c.y);
  for (const q of SURV.props) if (q.hp > 0 && !q.carried) consider({ k: 'carry', label: _t('Pousser le meuble'), dur: 0, run: () => survPropTake(e, q) }, q.x, q.z, 0.3 + q.w * 0.25, q.y);
  const ob = survObjAction(e); if (ob) consider(ob, ob.x, ob.z, 0.5);
  const rv = survReviveAction(e); if (rv) consider(rv, rv.x, rv.z, 0.4);
  return best;
}
function survCacheLabel(c) {
  return c.kind === 'planks' ? _t('Prendre des planches') : c.kind === 'tools' ? _t('Prendre la caisse à outils') : c.kind === 'drop' ? _t('Prendre le ravitaillement')
    : c.kind === 'metal' ? _t('Prendre une tôle') : c.kind === 'ammo' ? _t('Prendre des munitions ({0})', c.left) : _t('Prendre les clous');
}
const survToolK = (e) => (SURV_RES.tools ? 0.62 : 1) * (survRoleOf(e) === 'engineer' ? 0.6 : 1);
/* La touche : lance l'action à portée, ou annule celle en cours ; vrai si elle a servi (sinon la touche garde son rôle : ramasser une arme) */
function survUse() {
  if (!survOn()) return false;
  if (SACT.cur) { SACT.cur = null; return true; }
  const a = survActionAt(PL.ent); if (!a) return false;
  if (!a.dur) { a.run(); return true; }
  SACT.cur = a; SACT.t = 0; SACT.dur = a.dur; sfxBarr(PL.ent.pos, a.k === 'nail' || a.k === 'fix' || a.k === 'plate' ? 'hammer' : 'take');
  return true;
}
/* Chaque image : progression de l'action (annulée si l'on s'éloigne, court ou meurt), meuble porté, invite */
function survActTick(dt) {
  const e = PL.ent;
  if (SACT.carry) survCarryTick(e, dt);
  if (SURV.navDirty) survPropNav();
  survPropAnim(dt);
  const a = SACT.cur;
  if (a) {
    const still = survActionAt(e);
    if (!e.alive || SURV_DOWN.me || !still || still.k !== a.k || (still.op && still.op !== a.op) || hyp(e.vel.x, e.vel.z) > 3.2) SACT.cur = null;
    else {
      SACT.t += dt;
      if ((a.k === 'nail' || a.k === 'fix' || a.k === 'plate') && Math.floor(SACT.t * 3.2) !== Math.floor((SACT.t - dt) * 3.2)) sfxBarr(e.pos, 'tap');
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
  survCollapse(q.c); sfxBarr(e.pos, 'drag'); survPropNav(); survPub('p', q.id);
}
function survCarryTick(e, dt) {
  const q = SACT.carry; if (!q || !e.alive || q.hp <= 0) { if (q) survPropDrop(e); return; }
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), r = 0.55 + Math.max(q.w, q.dd) * 0.5;
  q.x = e.pos.x + fx * r; q.z = e.pos.z + fz * r; q.y = e.pos.y; q.ry = Math.round(e.yaw / (Math.PI / 2)) * (Math.PI / 2);
  const m = survPropMesh(q); m.position.set(q.x, q.y, q.z); m.rotation.set(0, q.ry, 0); m.visible = true;
  e.vel.x *= 1 - Math.min(1, dt * 8) * 0.45; e.vel.z *= 1 - Math.min(1, dt * 8) * 0.45;
}
/* Poser : contre une ouverture, de l'intérieur, il s'y range (calé sur l'ancre du dedans) et devient une couche de la barricade ; ailleurs, posé
   là où il est s'il y a la place, sinon ramené contre soi (jamais dans un mur ni dans un autre meuble) */
function survPropDrop(e) {
  const q = SACT.carry; if (!q) return; SACT.carry = null; q.carried = null;
  const near = survPropSettle(q, e, null);
  // un invité : la place choisie chez lui part chez l'hôte, qui la vérifie et la publie (jusqu'en 6.1.0, le meuble ne bougeait que chez l'invité)
  if (!survLocal()) { q.dropT = MATCH.time; survPropPlace(q); sfxBarr(e.pos, 'drop'); netEvent({ k: 'sq', a: 'drop', o: q.id, x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2), r: +q.ry.toFixed(3), op: near ? near.id : -1 }); return; }
  survPropPlace(q); buildHash(); survPropNav(); sfxBarr(e.pos, 'drop'); survPub('p', q.id);
}
/* Chez l'hôte : un invité pose le meuble qu'il porte (la place qu'il propose, s'il en est près ; sinon la règle de toujours, contre lui) */
function survPropDropNet(ev, by) {
  const q = SURV.props[ev.o | 0]; if (!q || q.carried !== by) return;
  const x = +ev.x, z = +ev.z, y = +ev.y;
  if (Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(y) && hyp(x - by.pos.x, z - by.pos.z) < 3.2) { q.x = x; q.z = z; q.y = y; q.ry = Math.round((+ev.r || 0) / (Math.PI / 2)) * (Math.PI / 2); }
  q.carried = null;
  survPropSettle(q, by, ev.op >= 0 ? SURV.open[ev.op | 0] || null : null);
  survPropPlace(q); buildHash(); survPropNav(); survPub('p', q.id);
}
/* Où le meuble se pose : contre une ouverture (force : celle-là, si elle est à portée), sinon là s'il tient, sinon contre le porteur, sinon à sa
   dernière place libre. Rend l'ouverture, ou null */
function survPropSettle(q, e, force) {
  let near = null, nd = 1.4;
  for (const op of SURV.open) { if (op.prop || (force && op !== force)) continue; const a = survOpenAnchor(op, 'in', _sbB), d = hyp(a.x - q.x, a.z - q.z); if (d < nd && Math.abs(a.y - e.pos.y) < 0.6) { nd = d; near = op; } }
  if (near) { const a = survOpenAnchor(near, 'in', _sbB), back = 0.22; q.x = a.x + (near.axis === 'z' ? near.out * back : 0); q.z = a.z + (near.axis === 'x' ? near.out * back : 0); q.ry = near.axis === 'x' ? 0 : Math.PI / 2; near.prop = q; q.op = near; }
  q.y = groundHeight(q.x, q.z, e.pos.y + 0.4, 0.2);
  if (!near && !survPropFits(q)) { // pas la place : on le pose contre soi, sinon à sa dernière place libre
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); let ok = false;
    for (const r of [0.5, 0.35]) { q.x = e.pos.x + fx * (r + Math.max(q.w, q.dd) * 0.5); q.z = e.pos.z + fz * (r + Math.max(q.w, q.dd) * 0.5); q.y = groundHeight(q.x, q.z, e.pos.y + 0.4, 0.2); if (survPropFits(q)) { ok = true; break; } }
    if (!ok) { Object.assign(q, q.last || q.home); }
  }
  q.last = { x: q.x, y: q.y, z: q.z, ry: q.ry };
  return near;
}
/* Le meuble tient-il là : rien du décor ni d'autre meuble dans sa boîte (les planches et la tôle d'une ouverture comptent), un sol sous lui */
function survPropFits(q) {
  const b = survPropBox(q);
  for (const c of queryBoxes(b.x0, b.z0, b.x1, b.z1)) {
    if (c === q.c || c.ray || c.y1 <= b.y0 + 0.08 || c.y0 >= b.y1 - 0.02) continue;
    if (c.x1 > b.x0 + 0.02 && c.x0 < b.x1 - 0.02 && c.z1 > b.z0 + 0.02 && c.z0 < b.z1 - 0.02) return false;
  }
  for (const [x, z] of [[b.x0 + 0.1, b.z0 + 0.1], [b.x1 - 0.1, b.z1 - 0.1], [b.x0 + 0.1, b.z1 - 0.1], [b.x1 - 0.1, b.z0 + 0.1]]) if (Math.abs(groundHeight(x, z, q.y + 0.3, 0.05) - q.y) > 0.35) return false;
  return true;
}
/* Demande à l'hôte (en solo et chez l'hôte : appliquée tout de suite) */
function survReq(k, id) { if (survLocal()) survApply(k, id, PL.ent); else survNetReq(k, id); }
function survApply(k, id, by) {
  if (k === 'nail') { const op = SURV.open[id], s = op && op.slots.find((x) => x.hp <= 0); if (!s || SURV_RES.planks <= 0) return; SURV_RES.planks--; survBoardAdd(op, s); sfxBarr(survOpenFace(op, _sbA), 'nail'); survStat(by, 'boards'); survPub('b', id); survPub('r'); }
  else if (k === 'fix') {
    const op = SURV.open[id]; if (!op) return;
    // la pièce la plus abîmée remise à neuf
    let w = null, wk = 0.95;
    if (op.plate.hp > 0 && op.plate.hp / op.plate.max < wk) { w = 'plate'; wk = op.plate.hp / op.plate.max; }
    for (const s of op.slots) if (s.hp > 0 && s.hp / s.max < wk) { w = s; wk = s.hp / s.max; }
    if (!w) return;
    if (w === 'plate') { op.plate.hp = op.plate.max; survPlateLook(op); } else { w.hp = w.max; survBoardLook(op, w); }
    sfxBarr(survOpenFace(op, _sbA), 'nail'); survStat(by, 'repairs'); survPub('b', id);
  } else if (k === 'plate') { const op = SURV.open[id]; if (!op || op.plate.hp > 0 || SURV_RES.metal <= 0) return; SURV_RES.metal--; survPlateAdd(op); sfxBarr(survOpenFace(op, _sbA), 'clang'); survStat(by, 'plates'); survPub('b', id); survPub('r'); }
  else if (k === 'take') {
    const c = SURV.caches[id]; if (!c || c.left <= 0) return;
    if (c.kind === 'planks') { const n = Math.min(2, c.left); c.left -= n; SURV_RES.planks += n; hudMsgTo(by, _t('+{0} planches', n)); }
    else if (c.kind === 'tools') { c.left = 0; SURV_RES.tools = true; hudMsgTo(by, _t('Caisse à outils trouvée, les réparations vont plus vite')); }
    else if (c.kind === 'metal') { c.left--; SURV_RES.metal++; hudMsgTo(by, _t('+1 tôle, de quoi renforcer une ouverture barricadée')); }
    else if (c.kind === 'ammo') { if (!survAmmoBoxTake(c, by)) return; }
    else if (c.kind === 'drop') { if (!survDropTake(c, by)) return; }
    else { c.left = 0; SURV_RES.nails = true; hudMsgTo(by, _t('Clous trouvés, les planches tiennent mieux')); }
    survPub('r');
  } else if (k === 'carry') { const q = SURV.props[id]; if (q && !q.carried && q.hp > 0) { q.carried = by; if (q.op) { q.op.prop = null; q.op = null; } survCollapse(q.c); survPropNav(); survPub('p', id); } }
  else if (k === 'loot') survLootTake(id, by);
}

/* ---------- Sons (synthèse) : coups de marteau, planche qui craque, qui éclate, meuble traîné, tôle ---------- */
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
  else if (kind === 'clang') { tn(o, t, 0.45, 310, 290, 'square', 0.07, 0.002); tn(o, t, 0.6, 523, 505, 'triangle', 0.08, 0.002); nz(o, t, 0.12, 'bandpass', 3200, 2400, 4, 0.22, 0.001); }
  else if (kind === 'tear') { nz(o, t, 0.5, 'bandpass', 2600, 900, 2, 0.4, 0.002); tn(o, t, 0.5, 240, 120, 'sawtooth', 0.08, 0.002); tn(o, t + 0.1, 0.4, 470, 300, 'square', 0.05, 0.002); }
}
