/* ==========================================================================
   CHIEN ROBOT (Breachline) : série d'éliminations à 9 (KSDEF.dog), unité de 08h-unites.js
   Un robot quadrupède bas sur pattes, une petite tourelle sur le dos. Il se déplie à côté de son maître (1,2 s), le suit (à 2 ou 3 m, en
   courant quand il est loin), repère le soldat ennemi visible le plus proche à moins de 26 m, tourne sa tourelle vers lui et tire par
   rafales (traçante lourde un coup sur deux). Il se rapproche d'une cible trop lointaine, va voir où elle a disparu, revient au maître
   quand il n'y a plus personne. Il trotte : pattes avant gauche et arrière droite ensemble, puis les deux autres ; chaque pied reste posé
   au sol tant qu'il porte (cinématique inverse à deux segments, genoux vers l'arrière). 50 s de service, 200 points de vie ; à bout, il
   s'arrête, crépite et bipe une seconde, puis s'autodétruit (4 m, 110), ce qui laisse le temps de s'écarter.
   Navigation : le réseau des bots (findPath), le contrôleur de collisions du décor (collideCircle, groundHeight) ; coincé, il repart par un
   autre chemin, puis bondit, puis réapparaît près de son maître.
   Réseau : le propriétaire simule ; les autres pairs suivent sa position et sa visée publiées, ses pattes s'animent d'après son allure.
   ========================================================================== */
const DOG = { life: 50, hp: 200, deploy: 1.2, r: 0.42, walk: 2.4, run: 5.2, turn: 5, range: 26, near: 9, far: 18, rate: 10, burst: 8, pause: 0.45, dmg: [13, 8], fall: [8, 26], sigma: 0.016,
  thigh: 0.3, shin: 0.3, h: 0.5, swing: 0.2, lift: 0.09, step: 0.16, boom: 4, boomDmg: 110, die: 1.1 };
const DOG_HIPS = [[-0.16, -0.31], [0.16, -0.31], [-0.16, 0.31], [0.16, 0.31]]; // avant gauche, avant droite, arrière gauche, arrière droite (repère : -z vers l'avant)
const _dgX = new V3(), _dgY = new V3(), _dgZ = new V3(), _dgW = new V3();
let DOG_MAT = null;
function dogMats() {
  if (DOG_MAT) return DOG_MAT;
  const M = gunMaterials();
  DOG_MAT = { body: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x4a4e38, roughness: 0.6, metalness: 0.35 })), dark: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.5, metalness: 0.55 })),
    joint: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.3, metalness: 0.85 })), rubber: M.rubber, lens: new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.06, metalness: 0.9 }),
    green: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.2, 3.5, 0.6) }), red: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(5, 0.25, 0.15) }) };
  return DOG_MAT;
}
function dogBuild() {
  const T = dogMats(), root = new THREE.Group(), body = new THREE.Group(), legs = [];
  root.add(body);
  rb(body, T.body, 0, 0, 0, 0.32, 0.15, 0.74, 0.03); rb(body, T.dark, 0, -0.06, 0, 0.26, 0.06, 0.6, 0.02);                // caisse, ventre
  for (const z of [-0.2, 0, 0.2]) rb(body, T.dark, 0, 0.078, z, 0.27, 0.012, 0.16, 0.004);                                 // plaques du dos
  rb(body, T.dark, 0, 0.02, -0.4, 0.22, 0.11, 0.1, 0.025); cy(body, T.lens, 0, 0.03, -0.452, 0.026, 0.012, Math.PI / 2);    // tête et sa caméra
  const eye = rb(body, T.green, 0, 0.065, -0.445, 0.14, 0.012, 0.008, 0.003);                                                // bandeau de la tête (allié / ennemi)
  rb(body, T.dark, 0, 0.0, 0.4, 0.2, 0.1, 0.08, 0.02); cy(body, T.joint, 0.09, 0.12, 0.3, 0.004, 0.22, 0);                  // batterie, antenne
  const turret = new THREE.Group(); turret.position.set(0, 0.1, -0.02); body.add(turret);
  cy(turret, T.joint, 0, 0.02, 0, 0.06, 0.04, 0); rb(turret, T.body, 0, 0.07, 0.02, 0.11, 0.07, 0.16, 0.012); rb(turret, T.dark, 0.075, 0.06, 0.04, 0.05, 0.06, 0.1, 0.008);
  const gun = new THREE.Group(); gun.position.set(0, 0.07, -0.04); turret.add(gun);
  cz(gun, T.dark, 0, 0, -0.1, 0.022, 0.12); cz(gun, T.joint, 0, 0, -0.26, 0.009, 0.26); cz(gun, T.dark, 0, 0, -0.39, 0.015, 0.03);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.41); gun.add(muzzle);
  for (const [hx, hz] of DOG_HIPS) {
    const hip = new THREE.Group(); hip.position.set(hx, -0.03, hz); body.add(hip);
    cy(hip, T.joint, 0, 0, 0, 0.04, 0.07, 0, 0, Math.PI / 2);
    rb(hip, T.body, Math.sign(hx) * 0.025, -DOG.thigh / 2, 0, 0.055, DOG.thigh, 0.075, 0.018);
    const knee = new THREE.Group(); knee.position.set(Math.sign(hx) * 0.025, -DOG.thigh, 0); hip.add(knee);
    cy(knee, T.joint, 0, 0, 0, 0.026, 0.06, 0, 0, Math.PI / 2);
    rb(knee, T.dark, 0, -DOG.shin / 2, 0, 0.038, DOG.shin, 0.045, 0.014);
    part(knee, new THREE.SphereGeometry(1, 10, 8), T.rubber, 0, -DOG.shin, 0, 0.032, 0.03, 0.032);
    legs.push({ hip, knee });
  }
  root.traverse((o) => { if (o.isMesh && o.material !== T.green && o.material !== T.red) o.castShadow = true; });
  return { root, body, turret, gun, muzzle, legs, eye };
}
/* Patte : le pied (dans le repère de la hanche : y vers le bas négatif, z vers l'arrière positif, x de côté) atteint par la hanche (tangage,
   écartement) et le genou ; genou vers l'arrière, comme les robots quadrupèdes */
function dogLeg(L, x, y, z) {
  const a = DOG.thigh, b = DOG.shin, yy = -y, d = clamp(Math.hypot(z, yy), 0.12, a + b - 1e-3);
  const phi = Math.atan2(-z, yy), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), be = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  L.hip.rotation.set(phi - al, 0, clamp(Math.atan2(x, yy), -0.35, 0.35)); L.knee.rotation.x = Math.PI - be;
}
function dogMake(u) {
  const m = dogBuild(); u.m = m; u.mesh = m.root; m.root.position.copy(u.pos); m.root.rotation.y = u.yaw; scene.add(m.root);
  Object.assign(u, { vel: new V3(), path: null, pathI: 0, pathT: 0, goal: null, tgt: null, lost: null, lostT: 0, aimY: u.yaw, aimP: 0, fireT: 0, burstN: 0, n: 0, firing: false,
    bob: 0, stuckT: 0, prog: new V3().copy(u.pos), progT: 0, hopT: 0, vy: 0, last: 0, feet: [], dieT: 0, sparkT: 0, stepT: 0, pair: 0 });
  for (let i = 0; i < 4; i++) { const p = dogFootHome(u, i, 0, new V3()); u.feet.push({ p: p.clone(), a: p.clone(), b: p.clone(), air: false, t: 0 }); }
  dogPose(u, 0);
  if (u.local) sfxDog(u.pos, 'boot');
}
/* Place de repos d'un pied (monde) : sous sa hanche, avancée de ahead dans le sens de l'allure */
function dogFootHome(u, i, ahead, out) {
  const s = Math.sin(u.yaw), c = Math.cos(u.yaw), x = DOG_HIPS[i][0] * 1.15, z = DOG_HIPS[i][1] - ahead;
  out.set(u.pos.x + c * x + s * z, 0, u.pos.z - s * x + c * z); out.y = groundHeight(out.x, out.z, u.pos.y + 0.4);
  return out;
}
/* Trot : la paire diagonale la plus loin de sa place part quand l'autre est posée ; pieds en arc, posés au sol */
function dogGait(u, dt) {
  const sp = hyp(u.vel.x, u.vel.z), sw = DOG.swing * (sp > 3.5 ? 0.75 : 1);
  for (const f of u.feet) {
    if (!f.air) continue;
    f.t += dt; const k = clamp(f.t / sw, 0, 1), e = k * k * (3 - 2 * k);
    f.p.lerpVectors(f.a, f.b, e); f.p.y += Math.sin(k * Math.PI) * DOG.lift * (0.5 + 0.5 * Math.min(1, f.a.distanceTo(f.b) / 0.3));
    if (k >= 1) { f.air = false; f.p.copy(f.b); }
  }
  if (u.feet.some((f) => f.air)) return;
  const pairs = [[0, 3], [1, 2]], P = pairs[u.pair], fw = -(u.vel.x * Math.sin(u.yaw) + u.vel.z * Math.cos(u.yaw)), ahead = sp > 0.2 ? clamp(fw * sw * 0.9, -0.2, 0.25) : 0;
  let far = 0; const homes = P.map((i) => { const h = dogFootHome(u, i, ahead, new V3()); h.x += u.vel.x * sw * 0.5; h.z += u.vel.z * sw * 0.5; h.y = groundHeight(h.x, h.z, u.pos.y + 0.4); far = Math.max(far, hyp(u.feet[i].p.x - h.x, u.feet[i].p.z - h.z)); return h; });
  if (far > (sp > 0.2 ? DOG.step : 0.06)) {
    P.forEach((i, k) => { const f = u.feet[i]; f.air = true; f.t = 0; f.a.copy(f.p); f.b.copy(homes[k]); });
    u.pair = 1 - u.pair; if (sp > 0.5 && u.local && Math.random() < 0.5) sfxDog(u.pos, 'step');
  }
}
/* Pose : corps à hauteur, tangage d'après les pieds avant et arrière, pattes en cinématique inverse ; tête : bandeau allié ou ennemi */
function dogPose(u, dt) {
  const m = u.m, dep = u.state === 'deploy' ? smoothstep(0, 1, u.t / DOG.deploy) : 1;
  const fy = (u.feet[0].p.y + u.feet[1].p.y) / 2, ry = (u.feet[2].p.y + u.feet[3].p.y) / 2, gy = (fy + ry) / 2;
  const air = u.feet.some((f) => f.air), sp = hyp(u.vel.x, u.vel.z);
  u.bob = damp(u.bob, air ? 0.02 : -0.01 * Math.min(1, sp / 3), 14, dt || 0.016);
  const h = gy + (DOG.h * (0.35 + 0.65 * dep)) + u.bob + (u.hopY || 0);
  m.root.position.set(u.pos.x, 0, u.pos.z); m.root.rotation.y = u.yaw;
  m.body.position.y = h; m.body.rotation.x = clamp(Math.atan2(fy - ry, 0.62), -0.5, 0.5); m.body.rotation.z = u.state === 'dying' ? Math.sin(u.t * 40) * 0.03 : 0;
  m.turret.rotation.y = angDiff(u.yaw, u.aimY); m.gun.rotation.x = u.aimP; m.gun.position.z = damp(m.gun.position.z, -0.04, 20, dt || 0.016);
  m.eye.material = !u.owner || allied(u.owner, PL.ent) ? DOG_MAT.green : DOG_MAT.red;
  m.eye.visible = u.state !== 'dying' || (u.t % 0.2) < 0.1;
  const s = Math.sin(u.yaw), c = Math.cos(u.yaw);
  u.feet.forEach((f, i) => {
    // pied dans le repère du corps (lacet seul), puis relatif à la hanche
    const dx = f.p.x - u.pos.x, dz = f.p.z - u.pos.z, lx = c * dx - s * dz, lz = s * dx + c * dz, ly = f.p.y - h - (-0.03);
    if (u.state === 'deploy' && dep < 1) { dogLeg(m.legs[i], 0, -(DOG.thigh + DOG.shin) * (0.4 + 0.5 * dep), 0.12 * (1 - dep)); return; } // dépliage : pattes repliées sous le corps
    dogLeg(m.legs[i], lx - DOG_HIPS[i][0], ly, lz - DOG_HIPS[i][1]);
  });
}
/* Mouvement vers une vitesse voulue, collisions du décor (cercle de 0,42 m), sol, petit bond pour se décoincer */
function dogMove(u, want, dt) {
  const k = 1 - Math.exp(-6 * dt); u.vel.x += (want.x - u.vel.x) * k; u.vel.z += (want.z - u.vel.z) * k;
  u.pos.x += u.vel.x * dt; u.pos.z += u.vel.z * dt;
  const p = _dgX.set(u.pos.x, u.pos.y, u.pos.z); collideCircle(p, DOG.r, 0.75); u.pos.x = p.x; u.pos.z = p.z;
  const g = groundHeight(u.pos.x, u.pos.z, u.pos.y + 0.45, DOG.r * 0.7);
  if (u.hopT > 0) { u.hopT -= dt; u.vy -= 19 * dt; u.hopY = Math.max(0, (u.hopY || 0) + u.vy * dt); if (u.hopY <= 0 && u.vy < 0) { u.hopT = 0; u.hopY = 0; } }
  u.pos.y = damp(u.pos.y, g, 18, dt);
  const sp = hyp(u.vel.x, u.vel.z); if (sp > 0.3) { const wy = Math.atan2(-u.vel.x, -u.vel.z); u.yaw += clamp(angDiff(u.yaw, wy), -DOG.turn * dt, DOG.turn * dt); }
}
/* Suivre un chemin du réseau des bots vers g (refait toutes les 0,8 s, ou si g a bougé) ; renvoie la vitesse voulue */
function dogPathTo(u, g, speed, stopAt, out) {
  const d = hyp(g.x - u.pos.x, g.z - u.pos.z);
  if (d < stopAt) { u.path = null; return out.set(0, 0, 0); }
  if (!u.path || u.pathT <= 0 || !u.goal || u.goal.distanceTo(g) > 1.5) {
    u.pathT = 0.8; u.goal = (u.goal || new V3()).copy(g);
    u.path = NAV.nx ? findPath(u.pos, g) : null; u.pathI = 1;
  }
  let tx = g.x, tz = g.z;
  if (u.path && u.path.length > 1) {
    while (u.pathI < u.path.length - 1 && hyp(u.path[u.pathI].x - u.pos.x, u.path[u.pathI].z - u.pos.z) < 0.6) u.pathI++;
    const w = u.path[Math.min(u.pathI, u.path.length - 1)]; tx = w.x; tz = w.z;
  }
  const dx = tx - u.pos.x, dz = tz - u.pos.z, l = Math.hypot(dx, dz) || 1, v = speed * clamp((d - stopAt) / 1.5, 0.35, 1);
  return out.set((dx / l) * v, 0, (dz / l) * v);
}
function dogCanSee(u, e, eye) { return e.alive && !e.inMecha && e !== u.owner && !allied(e, u.owner) && e.pos.distanceTo(u.pos) < DOG.range && !smokeBlocks(eye, entChest(e, _dgY)) && (lineClear(eye, entChest(e, _dgY)) || lineClear(eye, entHead(e, _dgY))); }
function dogTick(u, dt) {
  if (u.state === 'dying') { dogDying(u, dt); return; }
  u.pathT -= dt;
  if (u.state === 'deploy') { dogGait(u, dt); dogPose(u, dt); if (u.t >= DOG.deploy) { u.state = 'live'; u.t = 0; sfxDog(u.pos, 'on'); } return; }
  if (u.t > DOG.life) { u.expired = true; unitKill(u); return; }
  if (u.hp < u.hpMax * 0.3 && (u.sparkT -= dt) <= 0) { u.sparkT = rand(0.15, 0.5); const p = _dgY.set(u.pos.x, u.pos.y + 0.55, u.pos.z); for (let i = 0; i < 4; i++) FX.add.spawn(p.x, p.y, p.z, rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5), rand(0.1, 0.3), 0.025, 0.008, 3, 2.4, 1, 1, 0, 10, 0.4); FX.smoke.spawn(p.x, p.y, p.z, 0, 0.6, 0, 1.5, 0.12, 0.7, 0.15, 0.15, 0.15, 0.5, 0, 0, 0.5); }
  const eye = _dgZ.set(u.pos.x, u.pos.y + 0.75, u.pos.z);
  // cible : le soldat ennemi visible le plus proche (on garde la précédente tant qu'elle reste visible)
  let tgt = u.tgt && dogCanSee(u, u.tgt, eye) ? u.tgt : null;
  if (!tgt) { let bd = 1e9; for (const e of entities) { const d = e.pos.distanceTo(u.pos); if (d < bd && dogCanSee(u, e, eye)) { bd = d; tgt = e; } } }
  if (tgt !== u.tgt && tgt) sfxDog(u.pos, 'lock');
  if (u.tgt && !tgt && u.tgt.alive) { u.lost = (u.lost || new V3()).copy(u.tgt.pos); u.lostT = 4; }
  u.tgt = tgt;
  // déplacement : vers la cible (trop loin), là où elle a disparu, sinon près du maître
  const want = _dgW;
  if (tgt) { const d = tgt.pos.distanceTo(u.pos); if (d > DOG.far) dogPathTo(u, tgt.pos, DOG.run, DOG.near, want); else want.set(0, 0, 0); }
  else if (u.lost && (u.lostT -= dt) > 0) dogPathTo(u, u.lost, DOG.run, 1.5, want);
  else {
    const o = u.owner, home = o && o.alive ? _dgY.set(o.pos.x + Math.cos(o.yaw) * 1.3 + Math.sin(o.yaw) * 1.6, o.pos.y, o.pos.z - Math.sin(o.yaw) * 1.3 + Math.cos(o.yaw) * 1.6) : (u.guard || (u.guard = u.pos.clone()));
    const d = hyp(home.x - u.pos.x, home.z - u.pos.z);
    dogPathTo(u, home, d > 6 ? DOG.run : DOG.walk, 1.2, want);
  }
  dogMove(u, want, dt);
  dogUnstick(u, want, dt);
  // tourelle : vers la cible, ou droit devant ; tir par rafales quand elle est alignée
  let wy = u.yaw, wp = 0;
  if (tgt) { const c = entChest(tgt, _dgY), dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z; wy = Math.atan2(-dx, -dz); wp = Math.atan2(dy, Math.hypot(dx, dz)); }
  const da = angDiff(u.aimY, wy); u.aimY += clamp(da, -4 * dt, 4 * dt); u.aimP += clamp(wp - u.aimP, -3 * dt, 3 * dt);
  u.firing = !!tgt && Math.abs(da) < 0.08;
  if (u.firing) {
    u.fireT -= dt;
    while (u.fireT <= 0) { if (u.burstN >= DOG.burst) { u.burstN = 0; u.fireT += DOG.pause; break; } u.fireT += 1 / DOG.rate; u.burstN++; dogShoot(u, tgt, true); }
  } else { u.fireT = Math.max(0, u.fireT); u.burstN = 0; }
  dogGait(u, dt); dogPose(u, dt);
}
/* Coincé : pas de progrès en 1,5 s, un autre chemin ; en 3 s, un bond ; en 6 s, il réapparaît près du maître */
function dogUnstick(u, want, dt) {
  const moving = hyp(want.x, want.z) > 0.5;
  if (!moving || u.pos.distanceTo(u.prog) > 0.5) { u.prog.copy(u.pos); u.progT = 0; return; }
  u.progT += dt;
  if (u.progT > 1.5 && u.progT - dt <= 1.5) u.pathT = 0;
  if (u.progT > 3 && u.hopT <= 0 && u.progT - dt <= 3) { u.hopT = 0.6; u.vy = 4.5; u.vel.x = want.x; u.vel.z = want.z; }
  if (u.progT > 6 && u.owner && u.owner.alive) {
    const id = NAV.nx ? navNode(u.owner.pos.x + 1.5, u.owner.pos.y, u.owner.pos.z + 1.5) : -1;
    if (id >= 0) { FX.smoke.spawn(u.pos.x, u.pos.y + 0.4, u.pos.z, 0, 0.5, 0, 1, 0.3, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 1); u.pos.set(NAV.nx[id], NAV.ny[id], NAV.nz[id]); for (let i = 0; i < 4; i++) { dogFootHome(u, i, 0, u.feet[i].p); u.feet[i].air = false; } }
    u.prog.copy(u.pos); u.progT = 0; u.path = null;
  }
}
function dogShoot(u, tgt, local) {
  u.m.root.updateMatrixWorld(true);
  const from = u.m.muzzle.getWorldPosition(new V3()), aim = tgt ? entChest(tgt, new V3()) : from.clone().add(_dgY.set(-Math.sin(u.aimY), Math.sin(u.aimP), -Math.cos(u.aimY)).multiplyScalar(20));
  const dir = aim.sub(from).normalize(), s = DOG.sigma;
  dir.x += (Math.random() + Math.random() - 1) * s * 2; dir.y += (Math.random() + Math.random() - 1) * s * 2; dir.z += (Math.random() + Math.random() - 1) * s * 2; dir.normalize();
  const w = rayWorld(from.x, from.y, from.z, dir.x, dir.y, dir.z, DOG.range + 10, 1), wt = w ? w.t : DOG.range + 10;
  const wb = w ? w.box : null, wp = w ? w.prop : null, wn = w ? new V3(w.nx, w.ny, w.nz) : null, wm = w ? w.m : null;
  const eh = local ? rayEntities(from, dir, wt, u.owner) : null, uz = local && !eh ? rayUnits(u.owner, from, dir, wt) : null;
  const endT = eh ? eh.t : uz ? uz.t : wt, end = from.clone().addScaledVector(dir, endT);
  if (u.n++ % 2 === 0) FX.heavy.add(from, end, 320);
  FX.flash.spawn(from.x, from.y, from.z, 0, 0, 0, 0.035, 0.35, 0.2, 3, 2.2, 1.2, 1, 0);
  sfxGun('smg', from, u); heavyNearMiss(u.owner, from, dir, endT);
  u.m.gun.position.z = -0.015; // recul du canon (il revient en place, dogPose)
  if (!local) return;
  const f = clamp((endT - DOG.fall[0]) / (DOG.fall[1] - DOG.fall[0]), 0, 1), dmg = lerp(DOG.dmg[0], DOG.dmg[1], f);
  if (eh) {
    bloodFx(end, dir, eh.part === 'head');
    eh.ent.lastForce = { dir: dir.clone(), mag: 3, lift: 1.5, part: eh.part };
    applyDamage(eh.ent, dmg * (eh.part === 'head' ? 1.3 : eh.part === 'legs' ? 0.8 : 1), u.owner, NET_WSPECIAL.dog, eh.part === 'head', dir, u.pos, -1);
  } else if (uz) unitDamage(uz.u, dmg, u.owner, 'heavy');
  else if (wp) propShotLocal(wp, end, dir, dmg, u.owner);
  else if (w && !dmgWorldShot(wb, end, dir, dmg, u.owner, 'heavy')) impactFx(end, wn, wm, false);
}
function dogRemote(u, dt) {
  if (u.state === 'dying') { dogDying(u, dt); return; }
  if (u.npos) { const k = 1 - Math.exp(-dt * 10); u.vel.set((u.npos.x - u.pos.x) * 10, 0, (u.npos.z - u.pos.z) * 10); u.pos.lerp(u.npos, k); u.yaw += angDiff(u.yaw, u.nyaw) * k; }
  const k = 1 - Math.exp(-dt * 12); u.aimY += angDiff(u.aimY, u.netY || u.yaw) * k; u.aimP += ((u.netP || 0) - u.aimP) * k;
  if (u.state === 'deploy' && u.t >= DOG.deploy) u.state = 'live';
  if (u.firing) { u.fireT -= dt; while (u.fireT <= 0) { u.fireT += 1 / DOG.rate; dogShoot(u, null, false); } }
  dogGait(u, dt); dogPose(u, dt);
}
/* À bout de points de vie : il s'arrête, crépite, bipe de plus en plus vite, puis s'autodétruit */
function dogDie(u, silent) {
  if (silent) { u.gone = true; return; }
  if (u.expired) { u.gone = true; FX.smoke.spawn(u.pos.x, u.pos.y + 0.4, u.pos.z, 0, 0.5, 0, 1.2, 0.3, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 1); return; } // fin de service : il se replie (disparaît dans un nuage)
  u.state = 'dying'; u.dieT = DOG.die; u.firing = false; u.vel.set(0, 0, 0);
  if (u.local && u.owner === PL.ent) hudMsg(_t('Chien robot détruit'), 'enemy', 1.6);
}
function dogDying(u, dt) {
  const before = u.dieT; u.dieT -= dt;
  if (Math.floor(before * 6) !== Math.floor(u.dieT * 6)) sfxDog(u.pos, 'beep');
  const p = _dgY.set(u.pos.x, u.pos.y + 0.5, u.pos.z);
  if (Math.random() < 0.6) for (let i = 0; i < 3; i++) FX.add.spawn(p.x, p.y, p.z, rand(-2, 2), rand(0.5, 3), rand(-2, 2), rand(0.1, 0.3), 0.03, 0.01, 3.5, 2.6, 1.2, 1, 0, 10, 0.4);
  dogPose(u, dt);
  if (u.dieT > 0) return;
  u.gone = true;
  explode(p.clone(), u.owner || DMG_NOBODY, NET_WSPECIAL.dog, DOG.boom, DOG.boomDmg, -1);
  dmgDebrisFx(p, 0.6);
}
function dogPub(u) { return [+u.aimY.toFixed(2), +u.aimP.toFixed(2), u.firing ? 1 : 0, u.state === 'live' ? 1 : 0]; }
function dogNet(u, a) { u.netY = +a[0] || 0; u.netP = +a[1] || 0; u.firing = !!a[2]; if (a[3] && u.state === 'deploy') u.state = 'live'; }
UNIT_KINDS.dog = { hp: DOG.hp, r: 0.45, h: 0.5, make: dogMake, tick: dogTick, remote: dogRemote, die: dogDie, pub: dogPub, net: dogNet, dmgK: (t) => (t === 'blast' ? 1.5 : t === 'heavy' ? 1.2 : 0.8) };

/* ---------- Appel ---------- */
/* Le chien arrive à côté du maître, sur un nœud du réseau des bots dégagé */
function dogDeploy(e) {
  if (!NAV.nx) return false;
  const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
  for (const [ox, oz] of [[1.4, 1.2], [-1.4, 1.2], [0, 2], [1.8, -0.6], [-1.8, -0.6]]) {
    const x = e.pos.x + c * ox + s * oz, z = e.pos.z - s * ox + c * oz, id = navNode(x, e.pos.y, z);
    if (id < 0 || hyp(NAV.nx[id] - x, NAV.nz[id] - z) > 1.5) continue;
    for (const old of unitsOf(e, 'dog')) { old.hp = 0; unitKill(old); }
    unitSpawn('dog', e, new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]), e.yaw);
    return true;
  }
  return false;
}
function useDog() {
  if (!PL.ks.dog || !PL.ent.alive) return;
  if (!dogDeploy(PL.ent)) { hudMsg(_t('Impossible de poser ici')); sfxMech('empty'); return; }
  PL.ks.dog = false; updateStreakHud();
  sfxAnnounce('dog_on');
}
function botDog(b) { if (b.alive) dogDeploy(b); }
function sfxDog(p, kind) {
  if (!AU.ready || p.distanceTo(camera.position) > 40) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.08, kind === 'step' ? 0.25 : 0.7, 1, 3);
  if (kind === 'boot') { nz(o, t, 0.6, 'bandpass', 900, 1800, 1.4, 0.2, 0.05); tn(o, t + 0.8, 0.12, 660, 990, 'triangle', 0.15, 0.01); }
  else if (kind === 'on') { tn(o, t, 0.08, 990, 990, 'sine', 0.12, 0.003); tn(o, t + 0.1, 0.1, 1480, 1480, 'sine', 0.12, 0.003); }
  else if (kind === 'lock') { tn(o, t, 0.06, 1800, 2400, 'square', 0.05, 0.002); }
  else if (kind === 'beep') { tn(o, t, 0.06, 2600, 2600, 'square', 0.09, 0.002); }
  else { nz(o, t, 0.05, 'bandpass', rand(1500, 2800), 1400, 2, 0.12, 0.002); tn(o, t, 0.04, 160, 90, 'sine', 0.15, 0.002); } // pas : servo et appui
}
