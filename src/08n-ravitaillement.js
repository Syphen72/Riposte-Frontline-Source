/* ==========================================================================
   RAVITAILLEMENT (Breachline, survie : 09ia-survie.js) : les munitions de la survie.
   La pénurie doit tendre la partie sans la condamner : on économise, on change d'arme, on fouille, mais ce sont les morts de plus en plus
   nombreux qui finissent par l'emporter, pas un chargeur vide. Chaque arme reçoit sa propre munition, en part de sa réserve pleine (une
   caisse donne autant de chargeurs de fusil que de cartouches de fusil à pompe à proportion ; un lance-roquettes, moitié moins).
   Les sources, de la plus sûre à la plus risquée :
   - fin de vague : chacun remet chaque arme à une part de sa réserve pleine (70, 55, 45 % selon la difficulté, un peu plus aux vagues
     avancées) ; toutes les cinq vagues, le plein ;
   - caisses de munitions (CURMAP.def.ammo : à l'étage, sous le fenil, l'appentis, la véranda) : 2 prises chacune (3 à partir de trois
     survivants), une prise revient au bout d'un temps (50, 65, 80 s, plus vite à plusieurs), toutes à la fin de la vague. Chaque caisse est
     posée sur un nœud libre du réseau (les tests vérifient qu'elle est atteignable, ni dans un mur ni sous un meuble) ;
   - la caisse de la salle (SURV_AMMO) : le plein contre des points ;
   - cartouchières laissées par les morts : une chance sur 12 à 20 selon la difficulté, plus quand l'équipe est à court (sa réserve
     moyenne, que chaque invité annonce), trois fois plus pour une brute ; posées sur le nœud libre le plus proche du corps, 35 s ;
   - récompenses : le plein à toute l'équipe pour un objectif rempli, une caisse pour un équipier relevé, une cartouchière toutes les quatre
     réparations ;
   - largage : à partir de la vague 4, une vague sur deux, une caisse tombe à 17-25 m de la maison (fumée rouge, fusée éclairante, son
     entendu des morts) : le plein et une grenade pour chacun qui va la chercher, des planches et une tôle pour l'équipe ;
   - secours : à sec (plus une cartouche dans aucune arme) depuis 5 s, on trouve un chargeur et demi d'arme de poing au fond d'une poche
     (une fois toutes les 40 s) ; le couteau reste toujours.
   En ligne : l'hôte tient les caisses, les cartouchières et le largage (il les publie dans son paquet d'état), un invité demande ('sq' loot
   ou take) et l'hôte lui envoie sa part ('ag') : chacun applique les munitions à ses propres armes.
   ========================================================================== */
const SAMMO_K = {
  wave: [0.7, 0.55, 0.45], box: 0.38, pouch: [0.18, 0.14, 0.11], drop: [0.085, 0.065, 0.05],
  boxMax: 2, boxRe: [50, 65, 80], lootLife: 35, lootMax: 8, lootR: 1.15, emAfter: 5, emCd: 40, airFrom: 4, airEvery: 2,
};
const SAMMO = { loot: [], lootId: 1, emT: 0, emCd: 0, lowT: 0, teamF: 1, afT: 0, afSent: -1, mats: null, reqT: 0, dropTaken: -1, dropFx: 0, stats: { box: 0, pouch: 0, wave: 0, full: 0, drop: 0, emergency: 0, rounds: 0 } };
const _saA = new V3();

/* ---------- Armes du joueur ---------- */
const ammoMaxOf = (w) => Math.max(w.def.mag, Math.round(w.def.reserve || w.def.mag * 3));
const ammoUsable = (w) => !!(w && w.def && w.def.mag > 0 && w.def.cat !== 'melee');
/* Part des munitions qui restent (chargeurs et réserves de toutes les armes, sur leur plein) */
function ammoFracOf(ent) {
  const S = ent && ent.arms && ent.arms.slots; if (!S) return 1;
  let have = 0, max = 0;
  for (const w of S) { if (!ammoUsable(w)) continue; have += w.mag + w.reserve; max += w.def.mag + ammoMaxOf(w); }
  return max ? clamp(have / max, 0, 1) : 1;
}
const ammoEmpty = (ent) => { const S = ent.arms && ent.arms.slots; return !!S && S.every((w) => !ammoUsable(w) || w.mag + w.reserve <= 0); };
/* Les munitions arrivent chez le joueur : kind 'wave' (remise à niveau de fin de vague), 'box', 'pouch', 'full', 'drop', 'emergency', 'nade' */
function survAmmoApply(kind) {
  const S = PL.ent.arms && PL.ent.arms.slots; if (!S || !PL.ent.alive) return 0;
  const D = clamp(SV.diff | 0, 0, 2); let got = 0;
  const side = S.find((w) => ammoUsable(w) && w.def.cat === 'pistol') || S.filter(ammoUsable).slice(-1)[0];
  for (const w of S) {
    if (!ammoUsable(w)) continue;
    const max = ammoMaxOf(w), room = Math.max(0, max - w.reserve), boom = w.def.cat === 'launcher' ? 0.5 : 1; let n = 0;
    if (kind === 'wave') n = Math.max(0, Math.ceil(max * (SAMMO_K.wave[D] + Math.min(0.2, Math.max(0, SV.wave - 1) * 0.015))) - w.reserve);
    else if (kind === 'full' || kind === 'drop') n = room;
    else if (kind === 'box') n = Math.ceil(Math.max(w.def.mag, max * SAMMO_K.box) * boom);
    else if (kind === 'pouch') n = Math.ceil(Math.max(w.def.mag * 0.5, max * SAMMO_K.pouch[D]) * boom);
    else if (kind === 'emergency' && w === side) n = Math.ceil(w.def.mag * 1.5);
    n = Math.min(room, n);
    if (n > 0) { w.reserve += n; got += n; }
  }
  const nmax = 3; let nd = 0;
  if ((kind === 'nade' || kind === 'drop' || kind === 'full') && (PL.nades || 0) < nmax) { nd = kind === 'full' ? Math.max(0, 2 - (PL.nades || 0)) : 1; PL.nades = (PL.nades || 0) + nd; updateStreakHud(); }
  SAMMO.stats[kind] = (SAMMO.stats[kind] || 0) + 1; SAMMO.stats.rounds += got;
  if (got || nd) {
    if (kind !== 'wave') sfxMech('pickup');
    const txt = kind === 'emergency' ? _t('Au fond d\u0027une poche, un chargeur de secours') : kind === 'nade' ? _t('+1 grenade') : nd ? _t('+{0} munitions, +{1} grenade', got, nd) : _t('+{0} munitions', got);
    hudMsg(txt, 'xp', kind === 'emergency' ? 3 : 1.8);
  }
  return got + nd;
}
/* L'hôte (ou le solo) donne : au joueur local tout de suite, à un invité par un événement */
function survAmmoGrant(by, kind) {
  if (by === PL.ent) return survAmmoApply(kind);
  if (by && by.isRemote && survLocal()) netEvent({ k: 'ag', to: netIdOf(by), a: kind });
  return 1;
}
function survAmmoGrantAll(kind) { survAmmoApply(kind); if (MATCH.online && survLocal()) for (const e of NET.remotes.values()) if (!e.off) netEvent({ k: 'ag', to: netIdOf(e), a: kind }); }
/* Une caisse, une cartouchière, un largage servent-ils au joueur (sinon on les laisse aux équipiers) */
function survCacheUseful(c) {
  if (c.kind === 'ammo') return ammoFracOf(PL.ent) < 0.97;
  if (c.kind === 'drop') return SAMMO.dropTaken !== SV.dropId;
  return true;
}

/* ---------- Caisses de munitions ---------- */
/* À la construction de la carte : les caisses (une boîte de collision, d'équerre) et la place du largage (index stable pour le réseau) */
function survAmmoSpots(L) {
  for (const a of L || []) {
    const c = survCache('ammo', a[0], a[1], a[2], a[3] || 0); c.max = SAMMO_K.boxMax; c.left = c.max;
    const sw = Math.abs(Math.sin(c.ry)) > 0.5, hx = sw ? 0.21 : 0.31, hz = sw ? 0.31 : 0.21;
    DECOR.col(c.x - hx, c.x + hx, c.y, c.y + 0.36, c.z - hz, c.z + hz, 'wood');
  }
  const d = survCache('drop', 0, -50, 0, 0); d.left = 0; d.claims = new Set(); d.t = 0;
}
function survAmmoMats() {
  if (SAMMO.mats) return SAMMO.mats;
  const mk = (c, r = 0.8, m = 0, em = 0) => { const M = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); if (em) { M.emissive = new THREE.Color(em); M.emissiveIntensity = 1; } return csmMaterial(M); };
  SAMMO.mats = { olive: mk(0x4b5132, 0.85), dark: mk(0x2d3020, 0.9), brass: mk(0xb08a3a, 0.4, 0.8), tag: mk(0xd8cf9a, 0.7, 0, 0x2a2410), red: mk(0x9a1a12, 0.5, 0, 0xff3a1a), nade: mk(0x3c4530, 0.7, 0.2) };
  return SAMMO.mats;
}
/* Caisse : coffre vert, couvercle, cartouches visibles tant qu'il en reste, étiquette pâle (se voit la nuit) */
function survAmmoBoxMesh(c) {
  if (c.mesh) return c.mesh;
  const T = survAmmoMats(), g = new THREE.Group();
  rb(g, T.olive, 0, 0.15, 0, 0.6, 0.3, 0.4, 0.012); rb(g, T.dark, 0, 0.005, 0, 0.62, 0.01, 0.42, 0.002);
  for (const sx of [-1, 1]) rb(g, T.dark, sx * 0.31, 0.2, 0, 0.02, 0.05, 0.12, 0.004);
  rb(g, T.tag, 0, 0.17, -0.201, 0.3, 0.07, 0.004, 0.001);
  const fill = new THREE.Group(); for (let i = 0; i < 6; i++) rb(fill, T.brass, -0.2 + (i % 3) * 0.2, 0.31, -0.08 + Math.floor(i / 3) * 0.16, 0.14, 0.04, 0.1, 0.004); g.add(fill); g.userData.fill = fill;
  const lid = new THREE.Group(); lid.position.set(0, 0.3, 0.2); rb(lid, T.olive, 0, 0.02, -0.2, 0.6, 0.04, 0.4, 0.01); g.add(lid); g.userData.lid = lid;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(c.x, c.y, c.z); g.rotation.y = c.ry; scene.add(g); c.mesh = g;
  return g;
}
function survAmmoBoxLook(c) { const m = survAmmoBoxMesh(c); m.userData.fill.visible = c.left > 0; m.userData.lid.rotation.x = c.left > 0 ? -1.9 : 0; }
function survAmmoBoxTake(c, by) {
  if (c.left <= 0) return false;
  c.left--; if (c.rt <= 0) c.rt = SAMMO_K.boxRe[clamp(SV.diff | 0, 0, 2)];
  survAmmoGrant(by, 'box'); survAmmoBoxLook(c); sfxBarr(_saA.set(c.x, c.y + 0.3, c.z), 'take');
  return true;
}

/* ---------- Cartouchières des morts ---------- */
function survLootRoll(z) {
  if (!survLocal() || SV.phase === 'over') return;
  const D = clamp(SV.diff | 0, 0, 2), low = clamp((0.45 - SAMMO.teamF) / 0.35, 0, 1);
  let p = SAMMO_K.drop[D] * (1 + low * 1.6) * (z.zk === 'brute' ? 3 : 1) * (1 + Math.min(0.5, SV.wave * 0.025));
  if (SAMMO.loot.length >= SAMMO_K.lootMax) p *= 0.25;
  if (Math.random() > p) return;
  // sur le nœud libre du réseau le plus proche du corps (jamais dans un mur ni sous un meuble : navNode écarte les nœuds fermés)
  const id = navNode(z.pos.x, z.pos.y + 0.2, z.pos.z); if (id < 0) return;
  const x = NAV.nx[id], y = NAV.ny[id], zz = NAV.nz[id]; if (hyp(x - z.pos.x, zz - z.pos.z) > 1.8) return;
  survLootAdd(x + rand(-0.15, 0.15), y, zz + rand(-0.15, 0.15), Math.random() < 0.15 ? 'nade' : 'ammo');
}
function survLootAdd(x, y, z, k, id) {
  const l = { id: id || SAMMO.lootId++, x, y, z, k, t: SAMMO_K.lootLife, mesh: null, req: 0 };
  if (id && id >= SAMMO.lootId) SAMMO.lootId = id + 1;
  SAMMO.loot.push(l); survLootMesh(l); survPub();
  return l;
}
function survLootMesh(l) {
  const T = survAmmoMats(), g = new THREE.Group();
  if (l.k === 'nade') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), T.nade); b.scale.set(1, 1.25, 1); b.position.y = 0.07; g.add(b); rb(g, T.dark, 0, 0.145, 0, 0.03, 0.03, 0.03, 0.004); }
  else { rb(g, T.olive, 0, 0.06, 0, 0.26, 0.12, 0.16, 0.012); rb(g, T.tag, 0, 0.07, -0.081, 0.12, 0.04, 0.003, 0.001); for (let i = 0; i < 4; i++) rb(g, T.brass, -0.09 + i * 0.06, 0.135, 0, 0.018, 0.03, 0.018, 0.003); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(l.x, l.y, l.z); scene.add(g); l.mesh = g;
}
function survLootRemove(l) { const i = SAMMO.loot.indexOf(l); if (i >= 0) SAMMO.loot.splice(i, 1); if (l.mesh) scene.remove(l.mesh); l.mesh = null; }
/* Chez l'hôte : un survivant la ramasse (vérifié : elle existe, il en est près) */
function survLootTake(id, by) {
  const l = SAMMO.loot.find((q) => q.id === id); if (!l || !by) return;
  if (hyp(by.pos.x - l.x, by.pos.z - l.z) > 2.6 || Math.abs(by.pos.y - l.y) > 1.6) return;
  survLootRemove(l); survAmmoGrant(by, l.k === 'nade' ? 'nade' : 'pouch'); survPub();
}
/* Paquet d'état reçu : la liste des cartouchières de l'hôte */
function survLootSync(L) {
  if (!Array.isArray(L)) return;
  const ids = new Set();
  for (const a of L) { if (!Array.isArray(a)) continue; const id = a[0] | 0; ids.add(id); if (!SAMMO.loot.some((l) => l.id === id)) survLootAdd((+a[1] || 0) / 20, (+a[2] || 0) / 20, (+a[3] || 0) / 20, a[4] ? 'nade' : 'ammo', id); }
  for (const l of SAMMO.loot.slice()) if (!ids.has(l.id)) survLootRemove(l);
}

/* ---------- Largage ---------- */
/* Une caisse tombe à 17-25 m de la maison, dehors, sur un nœud libre que les vivants peuvent rejoindre ; fumée rouge, et les morts l'entendent */
function survAirdrop() {
  if (!survLocal()) return;
  const c = SURV.caches.find((q) => q.kind === 'drop'); if (!c) return;
  const H = survStanding()[0] || PL.ent;
  for (let k = 0; k < 24; k++) {
    const a = Math.random() * TAU, r = rand(17, 25), id = navNode(Math.cos(a) * r, 0, Math.sin(a) * r); if (id < 0) continue;
    const x = NAV.nx[id], z = NAV.nz[id], y = NAV.ny[id];
    if (survRoomAt(_saA.set(x, 0, z)) || hyp(x, z) < 15 || Math.abs(x) > 29 || Math.abs(z) > 30) continue;
    if (H && !findPath(H.pos, new V3(x, y, z))) continue;
    c.x = x; c.y = y; c.z = z; c.left = 1; c.t = 90; c.claims = new Set(); c.first = true;
    SV.drop = [+x.toFixed(2), +z.toFixed(2)]; SV.dropId = (SV.dropId || 0) + 1; SV.dirty = true;
    survDropMesh(x, z);
    soundEvents.push({ pos: new V3(x, 1, z), team: 0, who: null, t: MATCH.time, loud: true }); while (soundEvents.length > 60) soundEvents.shift();
    const dir = Math.abs(x) > Math.abs(z) ? (x > 0 ? _t('l\u0027est') : _t('l\u0027ouest')) : z > 0 ? _t('le sud') : _t('le nord');
    survAnnounce(_t('Ravitaillement largué vers {0}, des munitions pour tous', dir), 'xp', new V3(x, 2, z));
    survPub();
    return;
  }
}
/* Le largage pris : le plein et une grenade pour chacun (une fois), des planches et une tôle pour l'équipe au premier */
function survDropTake(c, by) {
  const key = by === PL.ent ? '@host' : netIdOf(by); if (!c.claims) c.claims = new Set();
  if (c.claims.has(key)) return false;
  c.claims.add(key); survAmmoGrant(by, 'drop');
  if (by !== PL.ent && by && by.isRemote) netEvent({ k: 'ag', to: netIdOf(by), a: 'dropmark', d: SV.dropId });
  else SAMMO.dropTaken = SV.dropId;
  if (c.first) { c.first = false; SURV_RES.planks += 3; SURV_RES.metal += 1; hudMsgTo(by, _t('+3 planches, +1 tôle pour l\u0027équipe')); }
  if (c.claims.size >= survHumans().length) survDropEnd(c);
  return true;
}
function survDropEnd(c) { c.left = 0; SV.drop = null; SV.dirty = true; if (SV.dropMesh) SV.dropMesh.visible = false; }
/* Le maillage du largage : la caisse militaire, sa fusée rouge (la fumée monte chaque image, survAmmoTick) */
function survDropMesh(x, z) {
  if (!SV.dropMesh) {
    const g = new THREE.Group(), T = survAmmoMats();
    rb(g, T.olive, 0, 0.32, 0, 1.0, 0.64, 0.7, 0.02); rb(g, T.dark, 0, 0.66, 0, 1.02, 0.04, 0.72, 0.01);
    for (const sx of [-1, 1]) rb(g, T.dark, sx * 0.42, 0.32, 0, 0.06, 0.66, 0.72, 0.01);
    rb(g, T.tag, 0, 0.36, -0.352, 0.5, 0.16, 0.004, 0.001);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), T.red); fl.position.set(0.6, 0.11, 0.2); fl.rotation.z = 0.5; g.add(fl);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); SV.dropMesh = g;
  }
  SV.dropMesh.position.set(x, groundHeight(x, z, 2, 0.3), z); SV.dropMesh.visible = true;
}
/* Paquet d'état reçu : le largage de l'hôte ([x, z, numéro] ou rien) */
function survDropSync(d) {
  const c = SURV.caches.find((q) => q.kind === 'drop'); if (!c) return;
  if (Array.isArray(d)) {
    const x = +d[0] || 0, z = +d[1] || 0, id = d[2] | 0;
    if (!SV.drop || SV.dropId !== id) { SV.drop = [x, z]; SV.dropId = id; c.x = x; c.z = z; c.y = groundHeight(x, z, 2, 0.3); survDropMesh(x, z); }
  } else if (SV.drop) { SV.drop = null; if (SV.dropMesh) SV.dropMesh.visible = false; }
}

/* ---------- Chaque image ---------- */
function survAmmoTick(dt) {
  if (!survOn()) return;
  const e = PL.ent, F = ammoFracOf(e);
  // secours : à sec depuis 5 s
  SAMMO.emCd -= dt;
  SAMMO.emT = e.alive && !e.downed && SV.phase !== 'over' && ammoEmpty(e) ? SAMMO.emT + dt : 0;
  if (SAMMO.emT > SAMMO_K.emAfter && SAMMO.emCd <= 0) { SAMMO.emT = 0; SAMMO.emCd = SAMMO_K.emCd; survAmmoApply('emergency'); }
  // à court : où trouver de quoi tirer (une fois toutes les 45 s)
  if ((SAMMO.lowT -= dt) <= 0 && e.alive && SV.phase === 'wave' && F < 0.12) { SAMMO.lowT = 45; hudMsg(_t('Munitions basses : des caisses à l\u0027étage, sous le fenil, dans l\u0027appentis et sur la véranda'), 'enemy', 3.5); }
  // un invité annonce sa réserve à l'hôte (le taux des cartouchières suit l'équipe)
  if (MATCH.online && !survLocal() && (SAMMO.afT -= dt) <= 0) { SAMMO.afT = 3; if (Math.abs(F - SAMMO.afSent) > 0.05) { SAMMO.afSent = F; netEvent({ k: 'af', f: +F.toFixed(2) }); } }
  // cartouchières : on marche dessus (si elles servent)
  SAMMO.reqT -= dt;
  for (const l of SAMMO.loot.slice()) {
    if (l.mesh) { l.mesh.rotation.y += dt * 1.2; l.mesh.position.y = l.y + 0.02 + Math.sin(MATCH.time * 3 + l.id) * 0.015; }
    if (!e.alive || e.downed || hyp(e.pos.x - l.x, e.pos.z - l.z) > SAMMO_K.lootR || Math.abs(e.pos.y - l.y) > 1.2) continue;
    if (l.k === 'nade' ? (PL.nades || 0) >= 3 : F > 0.97) continue;
    if (survLocal()) survLootTake(l.id, e);
    else if (SAMMO.reqT <= 0 && MATCH.time - l.req > 0.6) { l.req = MATCH.time; SAMMO.reqT = 0.15; survNetReq('loot', l.id); }
  }
  // le largage fume
  if (SV.drop && SV.dropMesh && SV.dropMesh.visible && (SAMMO.dropFx -= dt) <= 0) {
    SAMMO.dropFx = 0.12; const p = SV.dropMesh.position;
    FX.smoke.spawn(p.x + 0.6, p.y + 0.25, p.z + 0.2, rand(-0.2, 0.2), rand(1.4, 2.2), rand(-0.2, 0.2), rand(3.5, 5), 0.25, 1.6, 0.75, 0.16, 0.12, 0.55, 0, -0.1, 0.3);
    if (Math.random() < 0.5) FX.add.spawn(p.x + 0.6, p.y + 0.22, p.z + 0.2, rand(-0.3, 0.3), rand(0.3, 1), rand(-0.3, 0.3), 0.3, 0.08, 0.02, 4, 0.8, 0.4, 1, 0, 3, 0.5);
  }
  if (survLocal()) survAmmoHostTick(dt);
}
/* Chez l'hôte : caisses qui se rechargent, cartouchières qui disparaissent, largage qui s'éteint, réserve de l'équipe, largage garanti */
function survAmmoHostTick(dt) {
  const H = survHumans(); let f = 0, n = 0;
  for (const h of H) { if (!h.alive) continue; f += h === PL.ent ? ammoFracOf(h) : (h.svAmmo === undefined ? 0.5 : h.svAmmo); n++; }
  SAMMO.teamF = n ? f / n : 1;
  const D = clamp(SV.diff | 0, 0, 2), k = 0.6 + 0.4 * Math.max(1, SV.players);
  for (const c of SURV.caches) {
    if (c.kind === 'ammo') {
      c.max = SAMMO_K.boxMax + (SV.players >= 3 ? 1 : 0);
      if (c.left < c.max) { c.rt -= dt * k; if (c.rt <= 0) { c.left++; c.rt = c.left < c.max ? SAMMO_K.boxRe[D] : 0; survAmmoBoxLook(c); survPub(); } }
    } else if (c.kind === 'drop' && c.left > 0 && (c.t -= dt) <= 0) survDropEnd(c);
  }
  for (const l of SAMMO.loot.slice()) if ((l.t -= dt) <= 0) { survLootRemove(l); survPub(); }
  // largage garanti : à partir de la vague 4, une vague sur deux, quand un bon tiers de la vague est sorti
  if (SV.phase === 'wave' && !SV.airDone && SV.wave >= SAMMO_K.airFrom && (SV.wave - SAMMO_K.airFrom) % SAMMO_K.airEvery === 0) {
    const C = SV.comp, tot = C ? C.n + C.brutes : 1;
    if (tot - SV.toSpawn >= tot * 0.35) { SV.airDone = true; survAirdrop(); }
  }
}
/* Début d'une partie, nouvelle carte */
function survAmmoReset() {
  for (const l of SAMMO.loot.slice()) survLootRemove(l);
  Object.assign(SAMMO, { emT: 0, emCd: 0, lowT: 0, teamF: 1, afT: 0, afSent: -1, reqT: 0, dropTaken: -1, dropFx: 0 });
  for (const k in SAMMO.stats) SAMMO.stats[k] = 0;
  for (const c of SURV.caches) { if (c.kind === 'ammo') { c.max = SAMMO_K.boxMax; c.left = c.max; c.rt = 0; survAmmoBoxLook(c); } else if (c.kind === 'drop') { c.left = 0; c.claims = new Set(); } }
  SV.drop = null; SV.dropId = 0; SV.airDone = false; if (SV.dropMesh) SV.dropMesh.visible = false;
}
/* Fin de vague : les caisses de munitions refaites */
function survAmmoWaveClear() { for (const c of SURV.caches) if (c.kind === 'ammo') { c.left = c.max; c.rt = 0; survAmmoBoxLook(c); } }
function survAmmoClear() {
  for (const l of SAMMO.loot) if (l.mesh) scene.remove(l.mesh);
  SAMMO.loot.length = 0;
  if (SV.dropMesh) { scene.remove(SV.dropMesh); SV.dropMesh = null; }
}
