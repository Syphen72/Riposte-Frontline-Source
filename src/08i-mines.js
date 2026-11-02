/* ==========================================================================
   MINES (Breachline) : mine bondissante et claymore, deux équipements posés au sol (NADE_TYPES : mine, claymore), unités de 08h-unites.js
   Posées devant soi (touche de la grenade : un geste bref vers le sol), elles s'arment en 1,6 s. Un ennemi qui approche :
   - mine bondissante : à moins de 2,2 m autour, elle saute à hauteur de hanche (0,32 s, un déclic) puis explose (4,5 m, 150) ;
   - claymore : à moins de 3,2 m dans le cône de 70° qu'elle regarde, vue dégagée, elle projette ses billes vers l'avant (7 m, 165
     au plus dans le cône ; peu derrière).
   Un mecha ennemi qui passe dessus prend une charge antichar. Les alliés ne les déclenchent pas (en chacun pour soi, seul le poseur).
   Parades : la diode rouge clignote, la claymore trace deux faisceaux rouges, un bip doux prévient à moins de 4 m ; une balle les détruit
   sans explosion, un souffle tout proche les fait sauter (pour le compte du poseur). Deux de chaque au plus par joueur (la plus ancienne part).
   Réseau : le poseur simule et décide (unité), l'explosion est annoncée aux autres ('mt') qui en jouent les effets.
   ========================================================================== */
const MINE = { arm: 1.6, r: 2.2, jump: 0.32, blast: 4.5, dmg: 150, max: 2, anti: 520 };
const CLAY = { arm: 1.6, range: 3.2, cone: Math.cos(35 * Math.PI / 180), reach: 7, dmg: 165, max: 2 };
const _mnA = new V3(), _mnB = new V3(), _mnC = new V3();
let MINE_MAT = null;
function mineMats(M) {
  if (MINE_MAT) return MINE_MAT;
  MINE_MAT = { body: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x4a4f33, roughness: 0.7, metalness: 0.2 })), dark: M.dark, metal: M.metal,
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(6, 0.25, 0.15) }),
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.5, 0.08, 0.05), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }) };
  return MINE_MAT;
}
/* Modèle (repère : posée au sol en y = 0, la claymore regarde vers -z) ; k : échelle (en main : réduite) */
function mineBuild(g, M, type, k = 1) {
  const T = mineMats(M);
  if (type === 'claymore') {
    // face avant bombée (trois pans), dos plat, deux paires de pieds en ciseaux, l'œilleton de visée dessus
    for (const [x, ry] of [[-0.075, 0.28], [0, 0], [0.075, -0.28]]) rb(g, T.body, x * k, 0.115 * k, 0, 0.082 * k, 0.085 * k, 0.034 * k, 0.006 * k, 0, ry, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, T.dark, sx * 0.08 * k, 0.04 * k, sz * 0.02 * k, 0.004 * k, 0.09 * k, 0, 0, sz * sx * 0.35);
    rb(g, T.dark, 0, 0.165 * k, 0, 0.02 * k, 0.012 * k, 0.012 * k, 0.002 * k);
    g.userData.led = rb(g, T.led, 0.05 * k, 0.163 * k, 0.012 * k, 0.008 * k, 0.006 * k, 0.006 * k, 0.002 * k);
  } else {
    // disque olive, ceinture plus sombre, fusée à trois antennes, la diode sur le flanc
    cy(g, T.body, 0, 0.035 * k, 0, 0.1 * k, 0.07 * k, 0);
    cy(g, T.dark, 0, 0.012 * k, 0, 0.104 * k, 0.018 * k, 0);
    cy(g, T.metal, 0, 0.078 * k, 0, 0.018 * k, 0.018 * k, 0);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; cy(g, T.metal, Math.cos(a) * 0.012 * k, 0.1 * k, Math.sin(a) * 0.012 * k, 0.0025 * k, 0.03 * k, 0, 0, 0); }
    g.userData.led = rb(g, T.led, 0.098 * k, 0.045 * k, 0, 0.006 * k, 0.008 * k, 0.008 * k, 0.002 * k);
  }
  g.traverse((o) => { if (o.isMesh && o.material !== T.led) o.castShadow = true; });
  return g;
}
function mineFwd(u, out) { return out.set(-Math.sin(u.yaw), 0, -Math.cos(u.yaw)); }
function mineMake(u) {
  const g = new THREE.Group(); mineBuild(g, gunMaterials(), u.kind);
  g.position.copy(u.pos); g.rotation.y = u.yaw; scene.add(g); u.mesh = g; u.led = g.userData.led; u.beepT = 0; u.trigT = 0; u.boom = false;
  if (u.kind === 'claymore') { // faisceaux : deux fils rouges à 15 cm du sol, ouverts de 25 degrés de part et d'autre, jusqu'à la portée
    u.beams = [];
    for (const a of [-0.44, 0.44]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, CLAY.range, 4, 1, true), MINE_MAT.beam), p = new THREE.Group();
      b.rotation.set(Math.PI / 2, 0, 0); b.position.set(0, 0.15, -CLAY.range / 2); p.rotation.y = a; p.add(b); g.add(p); u.beams.push(b);
    }
  }
  if (u.local) sfxMineArm(u.pos, false);
}
/* Clignotement de la diode, faisceaux, bip doux pour un ennemi tout près (le joueur de cette machine) */
function mineIdle(u, dt) {
  if (u.led) u.led.visible = u.state === 'armed' ? (u.t % 1.1) < 0.12 : u.state === 'trig' || (u.t % 0.3) < 0.15;
  if (u.beams) for (const b of u.beams) b.visible = u.state === 'armed';
  const me = PL.ent;
  if (u.state === 'armed' && me.alive && me !== u.owner && !allied(me, u.owner) && (u.beepT -= dt) <= 0 && me.pos.distanceTo(u.pos) < 4) { u.beepT = 0.7; sfxMineBeep(u.pos); }
}
/* Ce qui la déclenche : un ennemi vivant dans sa zone (soldat), ou un mecha ennemi au-dessus */
function mineVictim(u) {
  const f = mineFwd(u, _mnA);
  for (const e of entities) {
    if (!e.alive || e === u.owner || allied(e, u.owner) || e.inMecha) continue;
    const dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z, dy = e.pos.y - u.pos.y, d = Math.hypot(dx, dz);
    if (Math.abs(dy) > 1.3) continue;
    if (u.kind === 'mine') { if (d < MINE.r) return e; continue; }
    if (d > CLAY.range || d < 0.05 || (dx * f.x + dz * f.z) / d < CLAY.cone) continue;
    if (lineClear(_mnB.set(u.pos.x, u.pos.y + 0.15, u.pos.z), entChest(e, _mnC))) return e;
  }
  for (const me of MECHAS) if (me.state === 'fight' && !allied(me.owner, u.owner) && Math.hypot(me.pos.x - u.pos.x, me.pos.z - u.pos.z) < 2.4) return me;
  return null;
}
function mineTick(u, dt) {
  mineIdle(u, dt);
  if (u.state === 'deploy') { if (u.t >= (u.kind === 'claymore' ? CLAY.arm : MINE.arm)) { u.state = 'armed'; sfxMineArm(u.pos, true); } return; }
  if (u.state === 'armed') {
    const v = mineVictim(u);
    if (v) { u.state = 'trig'; u.trigT = u.kind === 'mine' ? MINE.jump : 0.06; u.victim = v; sfxMineTrig(u.pos); }
    return;
  }
  if (u.state === 'trig') {
    u.trigT -= dt;
    if (u.kind === 'mine') u.mesh.position.y = u.pos.y + (1 - u.trigT / MINE.jump) * 0.75; // elle bondit
    if (u.trigT <= 0) mineBoom(u);
  }
}
function mineRemote(u, dt) {
  if (u.npos) { u.pos.copy(u.npos); u.mesh.position.copy(u.pos); u.yaw = u.nyaw; u.mesh.rotation.y = u.yaw; }
  mineIdle(u, dt);
  if (u.state === 'trig' && u.kind === 'mine') u.mesh.position.y = u.pos.y + Math.min(0.75, (u.t - (u.trigAt || u.t)) / MINE.jump * 0.75);
}
/* Explosion chez le poseur : dégâts, effets, annonce */
function mineBoom(u) {
  if (u.boom) return;
  u.boom = true;
  const p = u.kind === 'mine' ? new V3(u.pos.x, u.pos.y + 0.75, u.pos.z) : new V3(u.pos.x, u.pos.y + 0.15, u.pos.z);
  if (MATCH.online && (u.owner === PL.ent || u.owner.netBot)) netEvent({ k: 'mt', u: u.uid, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), f: +u.yaw.toFixed(2), c: u.kind === 'claymore' ? 1 : 0 }, u.owner);
  mineBoomFx(u.kind, p, u.yaw, u.owner, true);
  if (u.victim && u.victim.state === 'fight' && u.victim.m) mechaDamage(u.victim, MINE.anti, u.owner); // charge antichar sous un mecha
  unitKill(u);
}
/* Effets (et dégâts chez le poseur) : la mine bondissante passe par explode ; la claymore souffle peu autour et frappe dans son cône */
function mineBoomFx(kind, p, yaw, owner, local) {
  if (kind === 'mine') { explode(p, owner, NET_WSPECIAL.mine, MINE.blast, MINE.dmg, -1); return; }
  explode(p, owner, NET_WSPECIAL.claymore, 2.2, 45, -1);
  const f = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (let i = 0; i < 70; i++) { const a = rand(-0.62, 0.62), s = rand(14, 32), c = Math.cos(a), sn = Math.sin(a); FX.add.spawn(p.x, p.y, p.z, (f.x * c - f.z * sn) * s, rand(-1, 3), (f.z * c + f.x * sn) * s, rand(0.08, 0.22), 0.025, 0.008, 3.5, 2.4, 1.2, 1, 0, 6, 0.2); }
  for (let i = 0; i < 10; i++) { const a = rand(-0.6, 0.6), s = rand(2, 7), c = Math.cos(a), sn = Math.sin(a); FX.smoke.spawn(p.x, p.y, p.z, (f.x * c - f.z * sn) * s, rand(0.2, 1.2), (f.z * c + f.x * sn) * s, rand(1.2, 2.4), 0.3, 1.8, 0.4, 0.38, 0.35, 0.55, 0, 0, 1.4, rand(-1, 1)); }
  if (!local || !owner || owner.isRemote) return;
  for (const e of entities) {
    if (!e.alive || (allied(e, owner) && e !== owner)) continue;
    const ch = entChest(e, new V3()), d = ch.distanceTo(p); if (d > CLAY.reach || d < 0.01) continue;
    const dot = ((ch.x - p.x) * f.x + (ch.z - p.z) * f.z) / Math.max(0.01, Math.hypot(ch.x - p.x, ch.z - p.z));
    const inCone = dot > Math.cos(42 * Math.PI / 180);
    if (!inCone && d > 2.5) continue;
    if (!lineClear(p, ch) && !lineClear(p, entHead(e, new V3()))) continue;
    const dmg = inCone ? CLAY.dmg * Math.pow(1 - d / CLAY.reach, 0.7) + 15 : 30 * (1 - d / 2.5);
    const dir = ch.clone().sub(p).normalize(); e.lastForce = { dir, mag: 10, lift: 3, part: 'body', radial: true };
    applyDamage(e, dmg, owner, NET_WSPECIAL.claymore, false, dir, p, -1);
  }
}
/* Fin : explosée (rien à ajouter), détruite par une balle (petit claquement, sans dégâts), ou par un souffle tout proche (elle saute) */
function mineDie(u, silent) {
  if (!u.boom && !silent && u.local && u.lastType === 'blast') { mineBoom(u); u.gone = true; return; }
  if (!u.boom && !silent) {
    for (let i = 0; i < 8; i++) FX.add.spawn(u.pos.x, u.pos.y + 0.1, u.pos.z, rand(-2, 2), rand(1, 3), rand(-2, 2), rand(0.15, 0.35), 0.03, 0.01, 3, 2.2, 0.8, 1, 0, 12, 0.6);
    FX.smoke.spawn(u.pos.x, u.pos.y + 0.1, u.pos.z, 0, 0.4, 0, 1, 0.12, 0.6, 0.45, 0.43, 0.4, 0.5, 0, 0, 1.4); sfxImpact(u.pos, 'metal');
  }
  u.gone = true;
}
function minePub(u) { return [u.state === 'armed' ? 1 : u.state === 'trig' ? 2 : 0]; }
function mineNet(u, a) {
  const s = a[0] | 0;
  if (s >= 1 && u.state === 'deploy') u.state = 'armed';
  if (s === 2 && u.state !== 'trig') { u.state = 'trig'; u.trigAt = u.t; }
}
UNIT_KINDS.mine = { hp: 20, r: 0.18, h: 0.05, make: mineMake, tick: mineTick, remote: mineRemote, die: mineDie, pub: minePub, net: mineNet, dmgK: (t) => (t === 'blast' ? 3 : 1) };
UNIT_KINDS.claymore = { hp: 20, r: 0.16, h: 0.11, make: mineMake, tick: mineTick, remote: mineRemote, die: mineDie, pub: minePub, net: mineNet, dmgK: (t) => (t === 'blast' ? 3 : 1) };
/* Explosion annoncée par le poseur ('mt') */
function mineNetBoom(e, ev) {
  const u = UNITS.find((x) => x.owner === e && x.uid === (ev.u | 0) && !x.local);
  const p = new V3(clamp(+ev.x || 0, -300, 300), clamp(+ev.y || 0, -20, 80), clamp(+ev.z || 0, -300, 300));
  const kind = u ? u.kind : ev.c ? 'claymore' : 'mine';
  if (u) { u.boom = true; unitKill(u); }
  mineBoomFx(kind, p, +ev.f || 0, e, false);
}

/* ---------- Pose ---------- */
/* Où se pose une mine : 0,9 m devant le poseur, sur un sol presque plat, sans mur entre son œil et l'endroit */
function minePlaceAt(e, out) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), eye = entEye(e, _mnB);
  const tx = e.pos.x + fx * 0.9, tz = e.pos.z + fz * 0.9, ty = e.pos.y + 1;
  const h = rayWorld(tx, ty, tz, 0, -1, 0, 2.2, 2);
  if (!h || h.ny < 0.75 || h.m === 'water') return null;
  out.set(tx, ty - h.t + 0.005, tz);
  if (!lineClear(eye, _mnC.set(out.x, out.y + 0.2, out.z))) return null;
  return out;
}
function minePlaceStart() {
  if (!minePlaceAt(PL.ent, _mnA)) { hudMsg(_t('Impossible de poser ici')); sfxMech('empty'); return; }
  PL.nadeState = 'place'; PL.nadeT = 0; PL.nadeThrown = false; PL.nadeQueued = false;
  VM.lowerTarget = 1; VM.lowerRate = 10; PL.reload = null; VM.action = null; PL.vpP -= 0.35;
  sfxMech('ads');
}
/* La mine quitte la main (joueur : à mi-geste, état 'place' de updatePlayer ; bot : tout de suite) */
function minePlaceNow(e) {
  const p = minePlaceAt(e, new V3());
  if (!p) { if (e.isPlayer) hudMsg(_t('Impossible de poser ici')); return false; }
  const kind = e.isPlayer ? PL.nadeType : e.nadeType;
  const mine = unitsOf(e, kind); if (mine.length >= (kind === 'claymore' ? CLAY.max : MINE.max)) { mine[0].boom = true; unitKill(mine[0]); }
  unitSpawn(kind, e, p, e.yaw);
  if (e.isPlayer) PL.nades--; else e.nades--;
  return true;
}

/* ---------- Sons ---------- */
function sfxMineArm(p, on) {
  if (!AU.ready || p.distanceTo(camera.position) > 25) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.05, 0.6, 1, 3);
  if (!on) { nz(o, t, 0.02, 'bandpass', 2400, 1800, 2, 0.4); tn(o, t, 0.06, 420, 300, 'sine', 0.3); return; } // posée : un déclic, le choc sur le sol
  for (let i = 0; i < 2; i++) tn(o, t + i * 0.13, 0.07, 2100, 2100, 'sine', 0.12, 0.002); // armée : deux bips
}
function sfxMineBeep(p) { if (!AU.ready) return; const t = AU.ctx.currentTime, o = auOut(p, 0.05, 0.35, 1, 2); tn(o, t, 0.05, 2600, 2600, 'sine', 0.08, 0.002); }
function sfxMineTrig(p) {
  if (!AU.ready || p.distanceTo(camera.position) > 40) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.1, 1, 1, 4);
  nz(o, t, 0.015, 'highpass', 3000, 3000, 0.8, 0.6, 0.0005); tn(o, t, 0.12, 1800, 900, 'square', 0.12, 0.001); nz(o, t + 0.02, 0.2, 'lowpass', 900, 300, 0.8, 0.35, 0.01);
}
