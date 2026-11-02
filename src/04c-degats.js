/* ==========================================================================
   DÉGÂTS DU DÉCOR (Breachline) : interface commune des objets du décor que les tirs et les explosions abîment, à côté des props
   physiques (04b-physprops.js), qui gardent la leur (points de vie, propShot, propBlast).
   - Vitres des fenêtres de façade (fausses pièces, matière window) : une balle ou un souffle les brise. La vitre brisée garde des éclats
     dans son cadre et montre la pièce sans reflet (02c-materials.js, WIN_ROOM). Les immeubles sont pleins : l'effet est visuel, mais
     l'état reste et se synchronise.
   - Véhicules garés (voitures, camions) : points de vie, fumée claire puis noire et flammes, embrasement, explosion qui blesse et casse
     autour, épave calcinée qui brûle. L'épave prend la place de la voiture, avec ses propres collisions (plus basses).
   - Barils rouges, bouteilles de gaz, jerricans rouges (props) : percés, ils flambent un instant puis explosent ; le souffle perce les
     voisins, d'où les explosions en chaîne.
   Qui décide : une vitre, celui qui la brise (annonce 'gb') ; un véhicule ou un baril, l'hôte, seul juge des points de vie (les tirs des
   autres lui parviennent : 'vh', et 'prop' pour les props), qui annonce l'embrasement ('vb', 'bx'). L'explosion blesse sur la machine de
   celui qui a porté le dernier coup (explode, 07-bots.js). Un joueur qui arrive en cours de partie reçoit l'état du décor avec les états
   de l'hôte ('ws', toutes les 2,5 s).
   Types de dégâts : 'bullet' (armes des soldats), 'heavy' (hélicoptère, mecha, tourelle, chien robot), 'blast' (souffle).
   ========================================================================== */
const DMG = { panes: [], pgrid: new Map(), veh: [], fires: [], gbOut: [], gbT: 0, wsT: 0, snd: 0 };
const DMG_VEH = { car: 300, truck: 520, bullet: 0.45, heavy: 1, blast: 1.6, burn: 3.2, r: 7.5, dmg: 170, wreckFire: 16 };
/* Propriétaire neutre d'une explosion dont l'auteur est parti : explode ne blesse personne (isRemote), seuls les effets jouent */
const DMG_NOBODY = { team: -2, isRemote: true, name: '', pos: new V3(), alive: false };
function dmgAuth() { return !MATCH.online || NET.role === 'host'; }
/* Morts sans killcam ni distance à l'écran de mort (l'auteur n'a pas tiré lui-même) : explosions du décor, engins de Breachline */
function wsNoCam(w) { const W = NET_WSPECIAL; return w === W.veh || w === W.boom || w === W.mine || w === W.claymore; }
function dmgLocal(e) { return !!e && !e.isRemote; }
const _dgA = new V3(), _dgB = new V3(), _dgC = new V3(), _dgM = new THREE.Matrix4();

/* ---------- Vitres ---------- */
/* Une vitre de façade, posée par windowJoinery (02d-archi.js) au travers de Maker.paneAdd : centre, axe du mur, normale vers la rue,
   demi-largeur et demi-hauteur. Ses sommets dans le maillage fusionné des vitres sont retrouvés après la construction (dmgMapReady). */
function glassAdd(c, t, n, w, h) {
  const p = { id: DMG.panes.length, c: new V3(c[0], c[1], c[2]), t: new V3(t[0], t[1], t[2]).normalize(), n: new V3(n[0], n[1], n[2]).normalize(), u: new V3(), hw: w / 2, hh: h / 2, broken: false, mesh: null, vi: null };
  p.u.crossVectors(p.n, p.t).normalize();
  DMG.panes.push(p);
  const k = Math.floor(p.c.x / 4) * 1000 + Math.floor(p.c.z / 4);
  let a = DMG.pgrid.get(k); if (!a) DMG.pgrid.set(k, a = []); a.push(p);
}
/* Vitre qui contient le point (x, y, z) : à moins de dd de son plan (côté rue jusqu'à front), dans son cadre à m près */
function glassAt(x, y, z, back, front, m) {
  const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = DMG.pgrid.get((cx + i) * 1000 + cz + j); if (!a) continue;
    for (const p of a) {
      const dx = x - p.c.x, dy = y - p.c.y, dz = z - p.c.z, d = dx * p.n.x + dy * p.n.y + dz * p.n.z;
      if (d < -back || d > front) continue;
      if (Math.abs(dx * p.t.x + dy * p.t.y + dz * p.t.z) > p.hw + m || Math.abs(dx * p.u.x + dy * p.u.y + dz * p.u.z) > p.hh + m) continue;
      return p;
    }
  }
  return null;
}
/* Fin de construction : chaque sommet du maillage des vitres est rattaché à sa vitre (les maillages fusionnés gardent leurs tableaux
   de position et de couleur, finalizeWorld) */
function glassMap() {
  for (const mesh of WORLD.win) {
    const P = mesh.geometry.attributes.position.array, n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const p = glassAt(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], 0.04, 0.04, 0.03);
      if (!p || (p.mesh && p.mesh !== mesh)) continue;
      if (!p.mesh) { p.mesh = mesh; p.vi = []; }
      p.vi.push(i);
    }
  }
}
/* Brise (ou répare, on = false) une vitre : le canal vert de ses sommets porte l'état (lampe + 2 x brisée), relu par WIN_ROOM */
function glassSet(p, on) {
  if (p.broken === on) return false;
  p.broken = on;
  if (p.mesh) {
    const a = p.mesh.geometry.attributes.color, A = a.array, u = p.mesh.userData;
    for (const i of p.vi) { A[i * 3 + 1] += on ? 2 : -2; u.d0 = Math.min(u.d0 === undefined ? 1e9 : u.d0, i); u.d1 = Math.max(u.d1 === undefined ? -1 : u.d1, i); }
  }
  return true;
}
/* Envoi des sommets modifiés au GPU, une fois par image (plusieurs vitres brisées dans la même image : une seule plage) */
function glassFlush() {
  for (const mesh of WORLD.win) {
    const u = mesh.userData; if (u.d1 === undefined || u.d1 < 0) continue;
    const a = mesh.geometry.attributes.color; a.updateRange.offset = u.d0 * 3; a.updateRange.count = (u.d1 - u.d0 + 1) * 3; a.needsUpdate = true;
    u.d0 = undefined; u.d1 = undefined;
  }
}
/* Éclats d'une vitre qui cède en P (k : violence ; 0 : sans effet) : verre qui scintille et tombe en pluie, poussière claire, tintement */
function glassFx(p, P, k) {
  const n = 6 + Math.round(10 * k * Math.min(1.5, p.hw * p.hh * 4));
  for (let i = 0; i < n; i++) {
    const a = rand(-p.hw, p.hw), b = rand(-p.hh, p.hh), x = p.c.x + p.t.x * a + p.u.x * b, y = p.c.y + p.u.y * b, z = p.c.z + p.t.z * a + p.u.z * b, out = rand(0.5, 2.6) * k;
    FX.add.spawn(x, y, z, p.n.x * out + rand(-0.6, 0.6), rand(-0.5, 1.2), p.n.z * out + rand(-0.6, 0.6), rand(0.45, 0.9), 0.035, 0.012, 2.0, 2.4, 2.7, 1, 0.3, 13, 0.6);
  }
  for (let i = 0; i < 4; i++) FX.smoke.spawn(P.x, P.y, P.z, p.n.x * rand(0.3, 1.1) * k, rand(-0.6, 0.2), p.n.z * rand(0.3, 1.1) * k, rand(0.35, 0.7), 0.025, 0.012, 0.8, 0.86, 0.9, 1, 0.8, 12, 0.4);
  FX.smoke.spawn(P.x, P.y, P.z, p.n.x * 0.4, 0.15, p.n.z * 0.4, 0.8, 0.12, 0.55, 0.85, 0.88, 0.9, 0.2, 0, 0, 1.4, rand(-1, 1));
  sfxPropBreak(P, 'glass');
}
/* Une balle arrive dans une ouverture vitrée (le point touché est sur le nu de la façade, la vitre au fond de son embrasure) */
function glassShot(p, end, dir, shooter) {
  if (p.broken) { FX.smoke.spawn(end.x, end.y, end.z, -dir.x * 0.3, 0.1, -dir.z * 0.3, 0.5, 0.05, 0.25, 0.3, 0.28, 0.26, 0.35, 0, 0, 1.6); return; } // la pièce derrière : une bouffée sombre, sans trou dans le vide
  const P = _dgC.copy(end).addScaledVector(dir, Math.max(0, (end.x - p.c.x) * p.n.x + (end.y - p.c.y) * p.n.y + (end.z - p.c.z) * p.n.z) / Math.max(0.2, -(dir.x * p.n.x + dir.y * p.n.y + dir.z * p.n.z)));
  glassSet(p, true); glassFx(p, P, 1);
  if (MATCH.online && shooter && (shooter === PL.ent || shooter.netBot)) DMG.gbOut.push(p.id);
}
/* Souffle : les vitres tournées vers l'explosion, à moins de r, sans mur plein entre elles et le centre (le rayon s'arrête au nu de la
   façade, une embrasure plus loin que la vitre : on tolère 0,8 m) ; les six premières avec tous leurs éclats */
function glassBlast(p, r) {
  if (!DMG.panes.length) return;
  const c0x = Math.floor((p.x - r) / 4), c1x = Math.floor((p.x + r) / 4), c0z = Math.floor((p.z - r) / 4), c1z = Math.floor((p.z + r) / 4);
  let fx = 0;
  for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
    const a = DMG.pgrid.get(i * 1000 + j); if (!a) continue;
    for (const g of a) {
      if (g.broken) continue;
      const dx = g.c.x - p.x, dy = g.c.y - p.y, dz = g.c.z - p.z, d = hyp3(dx, dy, dz);
      if (d > r || dx * g.n.x + dy * g.n.y + dz * g.n.z > 0.2) continue; // vitre de dos : l'explosion est dans la pièce d'à côté
      const h = rayWorld(p.x, p.y + 0.3, p.z, dx / d, (dy - 0.3) / d, dz / d, d, 2);
      if (h && h.t < d - 0.8) continue;
      glassSet(g, true);
      if (fx++ < 6) glassFx(g, g.c, 1.4 * (1 - d / r) + 0.4);
    }
  }
}

/* ---------- Véhicules ---------- */
/* Cible de construction d'un véhicule vivant : comme un prefab, des tampons par matière ; les collisions passent par colShape, l'occlusion
   (éclairage cuit) et les lampes vont à la carte */
class DmgTarget {
  constructor() { this.parts = new Map(); }
  buf(mat, cls) { const k = mat + '|' + cls; let p = this.parts.get(k); if (!p) this.parts.set(k, p = { mat, cls, g: new GeoBuf(512, 1024, LIVING.has(mat)) }); return p.g; }
  col() {}
  occ(b, k) { OCC.push({ ...b, k }); }
  pcol() {}
  dynAdd(d) { return propSpawn(d.t, d.x, d.y, d.z, d.ry, d.o); }
  lamp(l) { LAMPS.push(l); }
  fabric() {}
}
function dmgGroup(T) {
  const g = new THREE.Group(); g.name = 'vehicule';
  for (const p of T.parts.values()) {
    if (!p.g.ni) continue; const mat = MAT[p.mat]; if (!mat) continue;
    const mesh = new THREE.Mesh(p.g.geometry(), mat);
    mesh.castShadow = p.cls === 0 && !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noReceive; mesh.matrixAutoUpdate = false; mesh.userData.noPrepass = true;
    if (mat.userData.noAO) mesh.userData.noAO = true;
    g.add(mesh);
  }
  mapAdd(g);
  return g;
}
/* Collisions d'un prefab de véhicule posé là : colShape, puis chaque boîte ajoutée est rattachée au véhicule (le tir sait ce qu'il touche) */
function dmgCols(rec, pf, x, y, z, rot) {
  const n0 = COL.length; colShape(x, y, z, rot, pf.vcols, 'metal');
  const out = COL.slice(n0); for (const c of out) { c.veh = rec; c.o = [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1]; }
  return out;
}
function dmgColsOn(list, on) { for (const c of list) { if (on) { c.x0 = c.o[0]; c.x1 = c.o[1]; c.y0 = c.o[2]; c.y1 = c.o[3]; c.z0 = c.o[4]; c.z1 = c.o[5]; } else { c.x0 = c.x1 = c.z0 = c.z1 = 1e6; c.y0 = c.y1 = -1e6; } } }
/* Pose d'un véhicule destructible (vehicle, 02g-vehicles.js) : le véhicule et son épave sont deux groupes, l'épave cachée ; leurs
   collisions sont toutes posées avant buildHash, celles de l'épave retirées ensuite (dmgMapReady) */
function vehReg(pf, x, y, z, rot, o) {
  const wpf = pf.wreckOf();
  const rec = { id: DMG.veh.length, kind: pf.truck ? 'truck' : 'car', hpMax: 0, hp: 0, state: 0, by: null, t: 0, burnT: 0, fireT: 0, smokeT: 0, alarm: false, last: -9,
    g: null, w: null, cols: null, wcols: null, c: new V3(), hood: new V3(), r: 2, lift: 0 };
  rec.hpMax = rec.hp = rec.kind === 'truck' ? DMG_VEH.truck : DMG_VEH.car;
  for (const [P, key] of [[pf, 'g'], [wpf, 'w']]) {
    const T = new DmgTarget(); new Maker(T).place(P, x, y, z, rot, Object.assign({}, key === 'w' ? null : o, { nocol: true }));
    rec[key] = dmgGroup(T);
  }
  rec.w.visible = false;
  rec.cols = dmgCols(rec, pf, x, y, z, rot); rec.wcols = dmgCols(rec, wpf, x, y, z, rot);
  let x0 = 1e9, x1 = -1e9, y1 = 0, z0 = 1e9, z1 = -1e9;
  for (const c of rec.cols) { x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); z0 = Math.min(z0, c.z0); z1 = Math.max(z1, c.z1); }
  rec.c.set((x0 + x1) / 2, y + y1 * 0.5, (z0 + z1) / 2); rec.r = Math.max(x1 - x0, z1 - z0) / 2;
  // le moteur : sur le premier tronçon des collisions du modèle (capot d'une voiture, caisse d'un 4x4), à un huitième de son long côté avant (-z du modèle)
  const h = pf.vcols[0]; rec.hood.set((h[0] + h[1]) / 2, h[3] + 0.05, h[4] + (h[5] - h[4]) * 0.12).applyMatrix4(_dgM.makeRotationY(rot).setPosition(x, y, z));
  DMG.veh.push(rec);
}
/* Dégâts sur un véhicule. by : l'auteur ; P : point touché (effets) */
function vehDamage(rec, dmg, by) {
  if (rec.state !== 0 || !(dmg > 0)) return;
  rec.hp -= dmg; rec.last = MATCH.time; if (by) rec.by = by;
  if (!rec.alarm && rec.kind === 'car' && rec.hp < rec.hpMax * 0.85) { rec.alarm = true; sfxCarAlarm(rec.c); }
  if (rec.hp <= 0 && dmgAuth()) { vehIgnite(rec, by || rec.by); if (MATCH.online) netEvent({ k: 'vb', n: rec.id, by: rec.by ? netIdOf(rec.by) : '' }, PL.ent); }
}
/* Tir sur un véhicule : le tireur local l'annonce (les autres pairs, l'hôte surtout, comptent les mêmes points) */
function vehShot(rec, dmg, shooter) {
  vehDamage(rec, dmg, shooter);
  if (MATCH.online && shooter && (shooter === PL.ent || shooter.netBot)) netEvent({ k: 'vh', n: rec.id, d: Math.round(dmg) }, shooter);
}
function vehBlast(p, r, maxDmg, owner) {
  for (const rec of DMG.veh) {
    if (rec.state !== 0) continue;
    const d = Math.max(0, p.distanceTo(rec.c) - rec.r * 0.6), R = r + rec.r * 0.5;
    if (d > R) continue;
    vehDamage(rec, maxDmg * DMG_VEH.blast * Math.pow(1 - d / R, 0.8), owner);
  }
}
/* Embrasement : le véhicule brûle quelques secondes, puis explose (vehBoom) */
function vehIgnite(rec, by) {
  if (rec.state !== 0) return;
  rec.state = 1; rec.burnT = DMG_VEH.burn; rec.hp = 0; if (by) rec.by = by;
  sfxIgnite(rec.hood);
}
function vehBoom(rec) {
  rec.state = 2; rec.fireT = DMG_VEH.wreckFire; rec.lift = 0.7;
  rec.g.visible = false; rec.w.visible = true; dmgColsOn(rec.cols, false); dmgColsOn(rec.wcols, true);
  const p = _dgA.copy(rec.c); p.y += 0.4;
  dmgDebrisFx(p, 1.2);
  explode(p, rec.by || DMG_NOBODY, NET_WSPECIAL.veh, DMG_VEH.r, DMG_VEH.dmg, -1);
  flashLight(p, 9, 22, 0.5, 0xffa040);
}
/* Remise à neuf (nouvelle partie) */
function vehReset(rec) {
  rec.state = 0; rec.hp = rec.hpMax; rec.by = null; rec.alarm = false; rec.burnT = rec.fireT = rec.lift = 0;
  rec.g.visible = true; rec.w.visible = false; rec.w.position.y = 0; dmgColsOn(rec.cols, true); dmgColsOn(rec.wcols, false);
}
/* Fumée, flammes et épave qui brûle (une image) */
function vehTick(rec, dt) {
  const f = rec.hp / rec.hpMax;
  if (rec.state === 0) {
    if (f < 0.65 && (rec.smokeT -= dt) <= 0) {
      const dark = f < 0.35; rec.smokeT = dark ? 0.07 : 0.22;
      const g = dark ? 0.12 : 0.55, p = rec.hood;
      FX.smoke.spawn(p.x + rand(-0.25, 0.25), p.y, p.z + rand(-0.25, 0.25), rand(-0.15, 0.15), rand(0.7, 1.4), rand(-0.15, 0.15), rand(2.2, 3.6), 0.3, dark ? 2.2 : 1.5, g, g * 0.97, g * 0.94, dark ? 0.6 : 0.35, 0, 0, 0.35, rand(-1, 1));
      if (dark) dmgFlame(p, 0.5);
      if (dark && Math.random() < 0.08) for (let i = 0; i < 5; i++) FX.add.spawn(p.x, p.y, p.z, rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5), rand(0.2, 0.5), 0.03, 0.01, 3, 1.6, 0.5, 1, 0, 10, 0.5);
    }
  } else if (rec.state === 1) {
    rec.burnT -= dt;
    const k = 1 - rec.burnT / DMG_VEH.burn;
    for (let i = 0; i < 3; i++) dmgFlame(_dgB.set(rec.hood.x + rand(-0.45, 0.45), rec.hood.y - 0.1, rec.hood.z + rand(-0.45, 0.45)), 0.8 + k * 1.1);
    if (Math.random() < 0.5) dmgFlame(_dgB.set(rec.c.x + rand(-0.6, 0.6), 0.15, rec.c.z + rand(-0.6, 0.6)), 0.5 + k * 0.6); // et dessous : le réservoir
    if (Math.random() < 0.4) FX.smoke.spawn(rec.hood.x, rec.hood.y + 0.6, rec.hood.z, rand(-0.2, 0.2), rand(1.2, 2), rand(-0.2, 0.2), 3.5, 0.5, 2.8, 0.08, 0.08, 0.08, 0.65, 0, 0, 0.3, rand(-1, 1));
    dmgCrackle(rec.hood, dt, 0.6 + k);
    if (rec.burnT <= 0) vehBoom(rec);
  } else {
    if (rec.lift > 0) { rec.lift = Math.max(0, rec.lift - dt * 2.2); rec.w.position.y = Math.sin(rec.lift / 0.7 * Math.PI) * 0.45; }
    if (rec.fireT > 0) {
      rec.fireT -= dt; const k = clamp(rec.fireT / DMG_VEH.wreckFire, 0, 1);
      if (Math.random() < 0.3 + 0.6 * k) dmgFlame(_dgB.set(rec.c.x + rand(-rec.r, rec.r) * 0.5, rec.c.y + 0.2, rec.c.z + rand(-rec.r, rec.r) * 0.5), 0.5 + k);
      if (Math.random() < 0.25 + 0.3 * k) FX.smoke.spawn(rec.c.x + rand(-0.5, 0.5), rec.c.y + 0.8, rec.c.z + rand(-0.5, 0.5), rand(-0.2, 0.2), rand(1, 1.8), rand(-0.2, 0.2), rand(3, 5), 0.5, 3.2, 0.07, 0.07, 0.07, 0.6 * k + 0.15, 0, 0, 0.25, rand(-1, 1));
      dmgCrackle(rec.c, dt, k);
    } else if (Math.random() < 0.05) FX.smoke.spawn(rec.c.x, rec.c.y + 0.5, rec.c.z, 0, 0.6, 0, 4, 0.4, 2.4, 0.2, 0.2, 0.2, 0.3, 0, 0, 0.2, rand(-1, 1)); // épave qui fume encore
  }
}

/* ---------- Barils, bouteilles de gaz, jerricans ---------- */
/* Ce qui explose parmi les props posés (propSpawn, 02k-dynprops.js) : le baril rouge, la bouteille de gaz, le jerrican rouge.
   hp : points de vie après la résistance du type (hold) ; fire : durée de la flamme avant l'explosion ; r, dmg : l'explosion */
function propBoomOf(type, o) {
  const t = o && o.tint, red = !!t && t[0] > 0.5 && t[1] < 0.32 && t[2] < 0.3;
  if (type === 'barrel' && red) return { r: 6.5, dmg: 140, hp: 60, fire: 1.5 };
  if (type === 'gasBottle') return { r: 5, dmg: 115, hp: 35, fire: 0.9 };
  if (type === 'jerrycan' && red) return { r: 3.8, dmg: 90, hp: 25, fire: 1.1 };
  return null;
}
/* Points de vie épuisés (propShot, propBlast) : l'hôte allume la mèche */
function propBoomCheck(b, by) {
  if (b.lit || !dmgAuth()) return;
  propIgnite(b, by);
  if (MATCH.online) netEvent({ k: 'bx', n: b.id, by: by ? netIdOf(by) : '' }, PL.ent);
}
function propIgnite(b, by) {
  if (b.lit || b.state === 0) return;
  b.lit = MATCH.time; DMG.fires.push({ b, by: by || null, t: b.boom.fire });
  sfxIgnite(b.p);
}
function propBoomTick(f, dt) {
  const b = f.b; f.t -= dt;
  if (b.state === 0) return true;
  dmgFlame(_dgB.set(b.p.x, b.p.y + b.rad * 0.6, b.p.z), 0.45);
  if (Math.random() < 0.5) FX.add.spawn(b.p.x, b.p.y + b.rad, b.p.z, rand(-1, 1), rand(2, 4), rand(-1, 1), rand(0.2, 0.4), 0.04, 0.01, 3, 1.8, 0.6, 1, 0, 9, 0.4);
  dmgCrackle(b.p, dt, 0.8);
  if (f.t > 0) return false;
  const p = b.p.clone(); propHide(b);
  dmgDebrisFx(p, 0.7);
  explode(p, f.by || DMG_NOBODY, NET_WSPECIAL.boom, b.boom.r, b.boom.dmg, -1);
  return true;
}

/* ---------- Effets communs ---------- */
function dmgFlame(p, k) {
  FX.add.spawn(p.x + rand(-0.12, 0.12) * k, p.y, p.z + rand(-0.12, 0.12) * k, rand(-0.25, 0.25), rand(1.2, 2.4) * (0.6 + k * 0.4), rand(-0.25, 0.25), rand(0.3, 0.6), 0.32 * k + 0.12, 0.06, 4.6, 1.9, 0.5, 1, 0, -1.5, 0.6);
  if (Math.random() < 0.35) FX.add.spawn(p.x, p.y + 0.1, p.z, rand(-0.1, 0.1), rand(0.6, 1.2), rand(-0.1, 0.1), rand(0.2, 0.35), 0.55 * k + 0.15, 0.2, 2.6, 0.9, 0.2, 0.7, 0, 0, 1.2); // cœur du feu, plus large
}
/* Débris enflammés et fumée noire d'une grosse explosion (véhicule, baril) : en plus de explosionFx */
function dmgDebrisFx(p, k) {
  for (let i = 0; i < 18 * k; i++) FX.add.spawn(p.x, p.y, p.z, rand(-6, 6) * k, rand(3, 9) * k, rand(-6, 6) * k, rand(0.6, 1.3), 0.08, 0.03, 3, 1.4, 0.4, 1, 0.4, 14, 0.4);
  for (let i = 0; i < 14 * k; i++) FX.smoke.spawn(p.x, p.y, p.z, rand(-5, 5) * k, rand(2, 7) * k, rand(-5, 5) * k, rand(0.7, 1.4), 0.07, 0.05, 0.08, 0.07, 0.06, 1, 0.8, 14, 0.5);
  for (let i = 0; i < 6; i++) FX.smoke.spawn(p.x + rand(-1, 1), p.y + rand(0, 1.5), p.z + rand(-1, 1), rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5), rand(3, 5), 1, 4.5, 0.06, 0.06, 0.06, 0.7, 0, 0, 0.6, rand(-1, 1));
}
/* Crépitement d'un feu proche : petits claquements de bruit, de moins en moins près de la caméra */
function dmgCrackle(p, dt, k) {
  if (!AU.ready || Math.random() > dt * 9 * k) return;
  const d = p.distanceTo(camera.position); if (d > 32) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.2, 0.55 * k, 1, 4);
  nz(o, t, rand(0.015, 0.04), 'bandpass', rand(700, 2600), rand(500, 1500), 1.4, rand(0.25, 0.6), 0.001);
  if (Math.random() < 0.3) nz(o, t, 0.3, 'lowpass', 400, 160, 0.7, 0.25, 0.05); // souffle du feu
}

/* Balle lourde qui frôle le joueur local (hélicoptère, mecha, tourelle, chien robot) : sifflement, et la visée se trouble (PL.suppress),
   comme sous les balles des bots (fireRay) ; de quoi savoir d'où vient le feu même sans voir la traçante */
function heavyNearMiss(owner, origin, dir, endT) {
  if (!PL.ent.alive || !owner || owner === PL.ent || allied(owner, PL.ent)) return;
  const ph = entHead(PL.ent, _dgB), t = clamp((ph.x - origin.x) * dir.x + (ph.y - origin.y) * dir.y + (ph.z - origin.z) * dir.z, 0, endT);
  const cp = _dgC.set(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t);
  if (t > 3 && cp.distanceTo(ph) < 2.2) { if (Math.random() < 0.55) sfxWhiz(cp); PL.suppress = Math.min(1, PL.suppress + 0.3); }
}

/* ---------- Liaison avec les tirs, les explosions et la partie ---------- */
/* Une balle touche le décor (box : la boîte de collision touchée, RAYHIT.box ; end : point touché). Renvoie vrai si l'impact est pris en
   charge ici (vitre : pas de trou de balle sur la façade), faux si le tireur doit jouer son effet d'impact habituel */
function dmgWorldShot(box, end, dir, dmg, shooter, type = 'bullet') {
  if (box && box.veh) { vehShot(box.veh, dmg * (type === 'heavy' ? DMG_VEH.heavy : DMG_VEH.bullet), shooter); return false; }
  if (DMG.panes.length && (!box || !box.prop)) {
    if (dir.x * dir.x + dir.z * dir.z < 1e-4) return false;
    const p = glassAt(end.x, end.y, end.z, 0.05, 0.75, 0.01);
    if (p && dir.x * p.n.x + dir.y * p.n.y + dir.z * p.n.z < 0) { glassShot(p, end, dir, shooter); return true; }
  }
  return false;
}
/* Explosion en p (explode, chez tous les pairs) : vitres, véhicules */
function dmgBlast(p, r, maxDmg, owner) {
  glassBlast(p, r * 1.6);
  vehBlast(p, r, maxDmg, owner);
}
/* Une image de partie */
function dmgTick(dt) {
  for (const rec of DMG.veh) vehTick(rec, dt);
  for (let i = DMG.fires.length - 1; i >= 0; i--) if (propBoomTick(DMG.fires[i], dt)) DMG.fires.splice(i, 1);
  glassFlush();
  if (!MATCH.online) return;
  if (DMG.gbOut.length && (DMG.gbT -= dt) <= 0) { DMG.gbT = 0.2; netEvent({ k: 'gb', n: DMG.gbOut.splice(0, 40) }, PL.ent); }
}
/* Fin de construction de la carte (09a-loading.js, après buildHash) : vitres rattachées à leurs sommets, collisions des épaves retirées */
function dmgMapReady() {
  glassMap();
  for (const rec of DMG.veh) dmgColsOn(rec.wcols, false);
}
/* Nouvelle partie : tout est remis à neuf */
function dmgReset() {
  for (const p of DMG.panes) glassSet(p, false);
  glassFlush();
  for (const rec of DMG.veh) vehReset(rec);
  DMG.fires.length = 0; DMG.gbOut.length = 0; DMG.wsT = 0;
}
/* Carte déchargée (ses maillages partent avec la racine de la carte) */
function dmgClear() {
  DMG.panes.length = 0; DMG.pgrid.clear(); WORLD.win.length = 0; DMG.veh.length = 0; DMG.fires.length = 0; DMG.gbOut.length = 0;
}

/* ---------- Réseau ---------- */
const DMG_EVENTS = new Set(['gb', 'vh', 'vb', 'bx']);
function dmgNetIn(e, ev) {
  if (ev.k === 'gb' && Array.isArray(ev.n)) {
    let fx = 0;
    for (const i of ev.n.slice(0, 40)) { const p = DMG.panes[i | 0]; if (p && glassSet(p, true) && fx++ < 6) glassFx(p, p.c, 1); }
  } else if (ev.k === 'vh') {
    const rec = DMG.veh[ev.n | 0]; if (rec) vehDamage(rec, clamp(+ev.d || 0, 0, 400), e);
  } else if (ev.k === 'vb') {
    const rec = DMG.veh[ev.n | 0]; if (rec) vehIgnite(rec, (ev.by && netEntity(ev.by)) || null);
  } else if (ev.k === 'bx') {
    const b = PHYS.bodies[ev.n | 0]; if (b && b.boom) propIgnite(b, (ev.by && netEntity(ev.by)) || null);
  }
}
/* État du décor joint aux états de l'hôte : toutes les 2,5 s (vitres brisées en bits, véhicules, props explosés) */
function dmgNetSnap(dt) {
  if ((DMG.wsT -= dt) > 0) return undefined;
  DMG.wsT = 2.5;
  const g = new Uint8Array((DMG.panes.length + 7) >> 3); let any = false;
  for (const p of DMG.panes) if (p.broken) { g[p.id >> 3] |= 1 << (p.id & 7); any = true; }
  let s = ''; if (any) for (let i = 0; i < g.length; i++) s += String.fromCharCode(g[i]);
  const v = DMG.veh.map((r) => r.state).join(''), x = [];
  for (const b of PHYS.bodies) if (b.boom && b.lit && b.state === 0) x.push(b.id);
  return { g: any ? btoa(s) : '', v, x };
}
/* Chez un invité : ce que l'hôte montre et qui manque ici est appliqué sans effet (ce qui s'est passé avant l'arrivée) */
function dmgNetSnapIn(ws) {
  if (!ws || typeof ws !== 'object') return;
  if (typeof ws.g === 'string' && ws.g) {
    let s = ''; try { s = atob(ws.g); } catch (e) { s = ''; }
    for (let i = 0; i < s.length && i * 8 < DMG.panes.length; i++) { const c = s.charCodeAt(i); if (c) for (let k = 0; k < 8; k++) if (c & (1 << k)) { const p = DMG.panes[i * 8 + k]; if (p) glassSet(p, true); } }
  }
  if (typeof ws.v === 'string') for (let i = 0; i < ws.v.length && i < DMG.veh.length; i++) {
    const rec = DMG.veh[i], st = ws.v.charCodeAt(i) - 48;
    if (st === 2 && rec.state === 0) { rec.state = 2; rec.hp = 0; rec.fireT = 0; rec.g.visible = false; rec.w.visible = true; dmgColsOn(rec.cols, false); dmgColsOn(rec.wcols, true); }
    else if (st >= 1 && rec.state === 0) vehIgnite(rec, null);
  }
  if (Array.isArray(ws.x)) for (const n of ws.x.slice(0, 200)) { const b = PHYS.bodies[n | 0]; if (b && b.boom && !b.lit && b.state !== 0) { b.lit = MATCH.time; propHide(b); } }
}

/* ---------- Sons ---------- */
/* Alarme de voiture : deux tons qui alternent quelques secondes, au véhicule */
function sfxCarAlarm(p) {
  if (!AU.ready || p.distanceTo(camera.position) > 60) return;
  const t = AU.ctx.currentTime + 0.05, o = auOut(p, 0.25, 0.5, 1, 6);
  for (let i = 0; i < 14; i++) { const f = i % 2 ? 700 : 940; tn(o, t + i * 0.32, 0.28, f, f * 0.98, 'square', 0.05, 0.01); tn(o, t + i * 0.32, 0.28, f * 0.5, f * 0.49, 'triangle', 0.08, 0.01); }
}
/* Mise à feu : le « whoomp » d'un réservoir qui s'enflamme */
function sfxIgnite(p) {
  if (!AU.ready || p.distanceTo(camera.position) > 70) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.35, 1.1, 1, 5);
  nz(o, t, 0.5, 'lowpass', 900, 180, 0.8, 0.8, 0.02); tn(o, t, 0.4, 120, 55, 'sine', 0.6, 0.01); nz(o, t + 0.05, 0.9, 'bandpass', 1200, 500, 0.6, 0.25, 0.1);
}
