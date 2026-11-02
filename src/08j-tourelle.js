/* ==========================================================================
   TOURELLE AUTOMATIQUE (Breachline) : série d'éliminations à 5 (KSDEF.sentry), unité posée de 08h-unites.js
   Posée 1,4 m devant soi (sol presque plat, pas contre un mur), elle se déplie en 2,2 s : pieds écartés, tête qui monte, voyant allumé.
   Puis elle balaie lentement, accroche le soldat ennemi visible le plus proche à moins de 32 m (0,45 s de verrouillage, un faisceau rouge
   vers sa cible, un bip), le suit (tête 3 rad/s, canon 2 rad/s) et tire des rafales (9 coups par seconde, traçante lourde un coup sur deux,
   14 points à 10 m, 9 à 32 m). Elle s'arrête au bout de 75 s ou de 240 coups, et se détruit sous 260 points de dégâts (les explosions
   comptent double). Son voyant est vert pour vos alliés, rouge pour vos ennemis. Ses victimes ne comptent pas pour les séries.
   Les bots la voient comme une menace et la prennent pour cible quand ils n'ont pas de soldat en vue (unitsBotsTick, 08h-unites.js).
   Réseau : le propriétaire simule, vise et blesse ; les autres pairs suivent son orientation publiée et rejouent les rafales (traçantes).
   ========================================================================== */
const SENTRY = { deploy: 2.2, life: 75, ammo: 240, range: 32, lock: 0.45, rate: 9, yawSpd: 3, pitchSpd: 2, dmg: [14, 9], fall: [10, 32], sigma: 0.012, hp: 260, scan: 0.6 };
const _stA = new V3(), _stB = new V3(), _stC = new V3(), _stM = new THREE.Matrix4();
let SENTRY_MAT = null;
function sentryMats() {
  if (SENTRY_MAT) return SENTRY_MAT;
  const M = gunMaterials();
  SENTRY_MAT = { body: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x4d5236, roughness: 0.62, metalness: 0.3 })), dark: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.55, metalness: 0.5 })), metal: M.metal,
    green: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.2, 4, 0.6) }), red: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(5, 0.25, 0.15) }),
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 0.1, 0.06), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.06, metalness: 0.9 }) };
  return SENTRY_MAT;
}
/* Modèle : trépied, pivot, tête (boîtier, caisse de munitions, capteur, canon) ; la tête tourne en lacet, le berceau du canon en tangage */
function sentryBuild(u) {
  const T = sentryMats(), root = new THREE.Group(), legs = [], head = new THREE.Group(), cradle = new THREE.Group();
  for (let i = 0; i < 3; i++) { const l = new THREE.Group(); l.rotation.y = i * 2.094; cy(l, T.dark, 0, -0.2, 0.18, 0.018, 0.5, 0.7); rb(l, T.dark, 0, -0.44, 0.34, 0.06, 0.02, 0.09, 0.006); root.add(l); legs.push(l); }
  cy(root, T.body, 0, 0, 0, 0.07, 0.12, 0); cy(root, T.metal, 0, 0.08, 0, 0.04, 0.06, 0);
  head.position.y = 0.12; root.add(head);
  rb(head, T.body, 0, 0.1, 0.02, 0.2, 0.16, 0.3, 0.02); rb(head, T.dark, 0.14, 0.08, 0.05, 0.08, 0.12, 0.2, 0.01); // boîtier, caisse de munitions à droite
  cy(head, T.lens, 0, 0.2, -0.08, 0.035, 0.04, 0); rb(head, T.dark, 0, 0.2, -0.04, 0.08, 0.03, 0.08, 0.008); // capteur sur le dessus
  const lamp = rb(head, T.green, -0.09, 0.19, 0.12, 0.02, 0.02, 0.02, 0.004);
  cradle.position.set(0, 0.1, -0.12); head.add(cradle);
  rb(cradle, T.dark, 0, 0, -0.05, 0.07, 0.07, 0.16, 0.008); cz(cradle, T.metal, 0, 0, -0.36, 0.014, 0.5); cz(cradle, T.dark, 0, 0, -0.18, 0.026, 0.1); cz(cradle, T.dark, 0, 0, -0.6, 0.02, 0.05);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.64); cradle.add(muzzle);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4, 1, true), T.beam); beam.visible = false; scene.add(beam);
  root.traverse((o) => { if (o.isMesh && o.material !== T.green && o.material !== T.red) o.castShadow = true; });
  return { root, legs, head, cradle, muzzle, lamp, beam };
}
function sentryMake(u) {
  const m = sentryBuild(u); u.m = m; u.mesh = m.root; m.root.position.copy(u.pos); m.root.position.y += 0.47; m.root.rotation.y = u.yaw; scene.add(m.root);
  u.aimY = u.yaw; u.aimP = 0; u.tgt = null; u.lockT = 0; u.fireT = 0; u.ammo = SENTRY.ammo; u.firing = false; u.scanT = 0; u.n = 0; u.beepT = 0;
  if (u.local) sfxSentry(u.pos, 'deploy');
}
function sentryMuzzle(u, out) { u.m.root.updateMatrixWorld(true); return u.m.muzzle.getWorldPosition(out); }
/* Pose : jambes repliées puis écartées, tête qui monte (état deploy) */
function sentryPose(u) {
  const k = u.state === 'deploy' ? smoothstep(0, 1, u.t / SENTRY.deploy) : 1, m = u.m;
  for (const l of m.legs) l.rotation.x = (1 - k) * 0.9;
  m.root.position.y = u.pos.y + 0.47 * (0.55 + 0.45 * k);
  m.head.rotation.y = u.aimY - u.yaw; m.cradle.rotation.x = u.aimP;
  m.lamp.material = !u.owner || allied(u.owner, PL.ent) ? SENTRY_MAT.green : SENTRY_MAT.red;
  m.lamp.visible = u.state !== 'dead' && (u.state !== 'deploy' || (u.t % 0.4) < 0.2);
}
/* Cible : le soldat ennemi vivant le plus proche, vu du capteur, à portée (le précédent est gardé tant qu'il reste visible) */
function sentryCanSee(u, e, eye) { return e.alive && !e.inMecha && !allied(e, u.owner) && e !== u.owner && e.pos.distanceTo(u.pos) < SENTRY.range && !smokeBlocks(eye, entChest(e, _stB)) && (lineClear(eye, entChest(e, _stB)) || lineClear(eye, entHead(e, _stB))); }
function sentryPick(u, eye) {
  if (u.tgt && sentryCanSee(u, u.tgt, eye)) return u.tgt;
  let best = null, bd = 1e9;
  for (const e of entities) { const d = e.pos.distanceTo(u.pos); if (d < bd && sentryCanSee(u, e, eye)) { bd = d; best = e; } }
  return best;
}
function sentryTick(u, dt) {
  if (u.state === 'deploy') { sentryPose(u); if (u.t >= SENTRY.deploy) { u.state = 'live'; u.t = 0; sfxSentry(u.pos, 'on'); } return; }
  if (u.state !== 'live') return;
  if (u.t > SENTRY.life || u.ammo <= 0) { u.hp = 0; unitKill(u); return; }
  const eye = _stC.set(u.pos.x, u.pos.y + 0.75, u.pos.z), tgt = sentryPick(u, eye);
  if (tgt !== u.tgt) { u.tgt = tgt; u.lockT = 0; if (tgt) sfxSentry(u.pos, 'lock'); }
  let wy, wp;
  if (tgt) {
    const c = entChest(tgt, _stA), dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z;
    wy = Math.atan2(-dx, -dz); wp = Math.atan2(dy, Math.hypot(dx, dz));
    u.lockT += dt;
  } else { u.scanT += dt; wy = u.yaw + Math.sin(u.scanT * SENTRY.scan) * 1.2; wp = -0.05; }
  const da = Math.atan2(Math.sin(wy - u.aimY), Math.cos(wy - u.aimY));
  u.aimY += clamp(da, -SENTRY.yawSpd * dt, SENTRY.yawSpd * dt); u.aimP += clamp(wp - u.aimP, -SENTRY.pitchSpd * dt, SENTRY.pitchSpd * dt);
  const onT = tgt && Math.abs(da) < 0.07 && u.lockT >= SENTRY.lock;
  u.firing = !!onT;
  sentryPose(u); sentryBeam(u, tgt);
  if (onT) { u.fireT -= dt; while (u.fireT <= 0 && u.ammo > 0) { u.fireT += 1 / SENTRY.rate; u.ammo--; sentryShoot(u, tgt, true); } } else u.fireT = Math.max(0, u.fireT);
}
/* Faisceau de visée (laser rouge) du capteur vers la cible accrochée */
function sentryBeam(u, tgt) {
  const b = u.m.beam;
  if (!tgt || u.state !== 'live') { b.visible = false; return; }
  const a = sentryMuzzle(u, _stA), c = entChest(tgt, _stB), d = a.distanceTo(c);
  b.visible = true; b.scale.set(1, d, 1); b.position.copy(a).add(c).multiplyScalar(0.5);
  b.quaternion.setFromUnitVectors(_stC.set(0, 1, 0), c.clone().sub(a).normalize());
}
/* Un coup : du canon, dispersion gaussienne ; le propriétaire seul touche et blesse */
function sentryShoot(u, tgt, local) {
  const from = sentryMuzzle(u, new V3()), aim = tgt ? entChest(tgt, new V3()) : from.clone().add(_stB.set(-Math.sin(u.aimY), Math.sin(u.aimP), -Math.cos(u.aimY)).multiplyScalar(20));
  const dir = aim.sub(from).normalize(), s = SENTRY.sigma;
  dir.x += (Math.random() + Math.random() - 1) * s * 2; dir.y += (Math.random() + Math.random() - 1) * s * 2; dir.z += (Math.random() + Math.random() - 1) * s * 2; dir.normalize();
  const w = rayWorld(from.x, from.y, from.z, dir.x, dir.y, dir.z, SENTRY.range + 10, 1), wt = w ? w.t : SENTRY.range + 10;
  const wb = w ? w.box : null, wp = w ? w.prop : null, wn = w ? new V3(w.nx, w.ny, w.nz) : null, wm = w ? w.m : null;
  const eh = local ? rayEntities(from, dir, wt, u.owner) : null, uz = local && !eh ? rayUnits(u.owner, from, dir, wt) : null;
  const endT = eh ? eh.t : uz ? uz.t : wt, end = from.clone().addScaledVector(dir, endT);
  if (u.n++ % 2 === 0) FX.heavy.add(from, end, 320);
  FX.flash.spawn(from.x, from.y, from.z, 0, 0, 0, 0.04, 0.45, 0.25, 3, 2.2, 1.2, 1, 0);
  sfxGun('rifle', from, u); heavyNearMiss(u.owner, from, dir, endT);
  if (!local) return;
  const f = clamp((endT - SENTRY.fall[0]) / (SENTRY.fall[1] - SENTRY.fall[0]), 0, 1), dmg = lerp(SENTRY.dmg[0], SENTRY.dmg[1], f);
  if (eh) {
    bloodFx(end, dir, eh.part === 'head');
    eh.ent.lastForce = { dir: dir.clone(), mag: 3, lift: 1.5, part: eh.part };
    applyDamage(eh.ent, dmg * (eh.part === 'head' ? 1.3 : eh.part === 'legs' ? 0.8 : 1), u.owner, NET_WSPECIAL.turret, eh.part === 'head', dir, u.pos, -1);
  } else if (uz) unitDamage(uz.u, dmg, u.owner, 'heavy');
  else if (wp) propShotLocal(wp, end, dir, dmg, u.owner);
  else if (w && !dmgWorldShot(wb, end, dir, dmg, u.owner, 'heavy')) impactFx(end, wn, wm, false);
}
function sentryRemote(u, dt) {
  if (u.npos) u.pos.copy(u.npos);
  const k = 1 - Math.exp(-dt * 12);
  u.aimY += Math.atan2(Math.sin(u.netY - u.aimY), Math.cos(u.netY - u.aimY)) * k; u.aimP += (u.netP - u.aimP) * k;
  sentryPose(u);
  u.m.beam.visible = false;
  if (u.firing) { u.fireT -= dt; while (u.fireT <= 0) { u.fireT += 1 / SENTRY.rate; sentryShoot(u, null, false); } }
}
function sentryDie(u, silent) {
  u.m.beam.visible = false; scene.remove(u.m.beam);
  if (!silent) {
    const p = _stA.set(u.pos.x, u.pos.y + 0.7, u.pos.z);
    explosionFx(p, 0.55); sfxExplosion(p, 0.6);
    for (let i = 0; i < 14; i++) FX.add.spawn(p.x, p.y, p.z, rand(-3, 3), rand(1, 5), rand(-3, 3), rand(0.3, 0.8), 0.04, 0.01, 3, 2, 0.6, 1, 0, 12, 0.5);
    for (let i = 0; i < 4; i++) FX.smoke.spawn(p.x, p.y, p.z, rand(-0.5, 0.5), rand(0.8, 1.5), rand(-0.5, 0.5), rand(2, 3.5), 0.3, 1.6, 0.1, 0.1, 0.1, 0.6, 0, 0, 0.4, rand(-1, 1));
  }
  if (u.local && u.owner === PL.ent && !silent) hudMsg(u.ammo <= 0 || u.t > SENTRY.life ? _t('Tourelle à court') : _t('Tourelle détruite'), u.hp <= 0 && u.t <= SENTRY.life && u.ammo > 0 ? 'enemy' : '', 1.6);
  u.gone = true;
}
function sentryPub(u) { return [+u.aimY.toFixed(2), +u.aimP.toFixed(2), u.firing ? 1 : 0, u.state === 'live' ? 1 : 0]; }
function sentryNet(u, a) { u.netY = +a[0] || 0; u.netP = +a[1] || 0; u.firing = !!a[2]; if (a[3] && u.state === 'deploy') u.state = 'live'; }
UNIT_KINDS.turret = { hp: SENTRY.hp, r: 0.5, h: 0.6, make: sentryMake, tick: sentryTick, remote: sentryRemote, die: sentryDie, pub: sentryPub, net: sentryNet,
  dmgK: (t) => (t === 'blast' ? 2 : t === 'heavy' ? 1.3 : 0.75), free: (u) => { if (u.m) scene.remove(u.m.beam); } };

/* ---------- Appel ---------- */
/* Où poser la tourelle : 1,4 m devant, sur un sol presque plat, avec 0,6 m de libre autour */
function sentryPlaceAt(e, out) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), tx = e.pos.x + fx * 1.4, tz = e.pos.z + fz * 1.4, ty = e.pos.y + 1.2;
  const h = rayWorld(tx, ty, tz, 0, -1, 0, 2.4, 2);
  if (!h || h.ny < 0.8 || h.m === 'water') return null;
  out.set(tx, ty - h.t, tz);
  const hb = queryBoxes(tx - 0.55, tz - 0.55, tx + 0.55, tz + 0.55);
  for (const c of hb) if (!c.ray && !c.inv && c.y1 > out.y + 0.15 && c.y0 < out.y + 1.1 && c.x0 < tx + 0.55 && c.x1 > tx - 0.55 && c.z0 < tz + 0.55 && c.z1 > tz - 0.55) return null;
  if (!lineClear(entEye(e, _stB), _stC.set(out.x, out.y + 0.6, out.z))) return null;
  return out;
}
function sentryDeploy(e) {
  const p = sentryPlaceAt(e, new V3()); if (!p) return false;
  for (const old of unitsOf(e, 'turret')) unitKill(old);
  unitSpawn('turret', e, p, e.yaw);
  return true;
}
function useSentry() {
  if (!PL.ks.sentry || !PL.ent.alive) return;
  if (!sentryDeploy(PL.ent)) { hudMsg(_t('Impossible de poser ici')); sfxMech('empty'); return; }
  PL.ks.sentry = false; updateStreakHud();
  sfxAnnounce('sentry_on');
}
function botSentry(b) { if (b.alive) sentryDeploy(b); }

function sfxSentry(p, kind) {
  if (!AU.ready || p.distanceTo(camera.position) > 45) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.1, 0.8, 1, 4);
  if (kind === 'deploy') { for (let i = 0; i < 3; i++) nz(o, t + i * 0.55, 0.3, 'bandpass', 700 + i * 200, 1400, 1.2, 0.25, 0.04); tn(o, t + 1.9, 0.2, 300, 520, 'triangle', 0.15, 0.02); } // moteurs qui déplient
  else if (kind === 'on') { tn(o, t, 0.09, 880, 880, 'sine', 0.12, 0.003); tn(o, t + 0.12, 0.12, 1320, 1320, 'sine', 0.12, 0.003); }
  else if (kind === 'lock') { for (let i = 0; i < 3; i++) tn(o, t + i * 0.07, 0.05, 2200, 2200, 'square', 0.04, 0.002); }
}
