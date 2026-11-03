/* ==========================================================================
   TOURELLE AUTOMATIQUE (Breachline) : série d'éliminations à 5 (KSDEF.sentry), unité posée de 08h-unites.js
   Posée 1,4 m devant soi (sol presque plat, pas contre un mur), elle se déplie en 2,2 s, puis elle balaie, accroche le soldat ennemi visible
   le plus proche à moins de 32 m (0,45 s de verrouillage, un faisceau rouge vers sa cible, un bip), le suit et tire des rafales (9 coups par
   seconde, traçante lourde un coup sur deux, 14 points à 10 m, 9 à 32 m). Elle s'arrête au bout de 75 s ou de 240 coups, et se détruit sous
   260 points de dégâts (les explosions comptent double). Ses victimes ne comptent pas pour les séries. Les bots la voient comme une menace
   et la prennent pour cible quand ils n'ont pas de soldat en vue (unitsBotsTick, 08h-unites.js).
   Modèle (refait en novembre 2026, retour du propriétaire : à côté du chien robot, la tourelle faisait prototype) : trépied bas à jambes
   télescopiques et patins, moyeu, mât qui sort au déploiement, couronne d'orientation cerclée de la couleur du camp (vert allié, rouge
   ennemi, lisible de tous les côtés), fourche à tourillons apparents, berceau de l'arme (culasse, bouclier incliné, capteur à deux objectifs
   et sa diode d'état, caisse de munitions et couloir d'alimentation sur le flanc gauche, coffret à ailettes à l'arrière), canon à manchon,
   ailettes et frein de bouche, qui recule à chaque coup. Mêmes matières que le chien (une même famille de machines). Les pièces fixes de
   chaque partie mobile sont fusionnées par matière, une fois, et partagées par toutes les tourelles : une vingtaine d'appels de rendu.
   Ce qu'elle montre : dépliage (les jambes s'écartent en s'allongeant, pieds au sol ; le mât monte ; la tête pivote de l'arrière vers l'avant
   en relevant le canon ; la diode clignote), veille (balayages amortis entre des pauses, diode verte qui respire), accrochage (la tête rattrape
   sa cible par un ressort amorti, accélération et vitesse bornées ; diode orange qui clignote, faisceau), tir (diode rouge, recul du canon,
   ressaut du berceau, flamme de bouche, douilles éjectées à droite), avarie (sous la moitié de ses points : étincelles ; sous le tiers : fumée
   par le coffret ; sous le quart : diode et visée qui hésitent), destruction (claquement, la diode s'éteint, le canon pique du nez, la tête
   tourne sur son élan, l'épave noircie fume 6 s puis s'enfonce) ; à court de munitions ou de temps, elle s'éteint et se replie.
   Réseau : le propriétaire simule, vise et blesse ; les autres pairs suivent son orientation et ses points de vie publiés et rejouent les
   rafales (traçantes, recul, douilles) et les avaries.
   ========================================================================== */
const SENTRY = { deploy: 2.2, life: 75, ammo: 240, range: 32, lock: 0.45, rate: 9, yawSpd: 3, pitchSpd: 2, yawAcc: 16, pitchAcc: 12, dmg: [14, 9], fall: [10, 32], sigma: 0.012, hp: 260, eye: 0.86, wreck: 6 };
const _stA = new V3(), _stB = new V3(), _stC = new V3();
let SENTRY_MAT = null, SENTRY_TPL = null;
function sentryMats() {
  if (SENTRY_MAT) return SENTRY_MAT;
  const D = dogMats(), M = gunMaterials(), emi = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r, g, b) });
  SENTRY_MAT = { body: D.body, dark: D.dark, joint: D.joint, rubber: D.rubber, lens: D.lens, ink: M.ink,
    charred: csmMaterial(new THREE.MeshStandardMaterial({ color: 0x1b1917, roughness: 0.92, metalness: 0.25 })),
    ally: emi(0.2, 3.2, 0.6), enemy: emi(4.5, 0.25, 0.15),
    led: { scan: emi(0.25, 2.8, 0.5), dim: emi(0.06, 0.7, 0.14), lock: emi(4.2, 2.2, 0.15), fire: emi(5, 0.35, 0.2), off: emi(0.03, 0.03, 0.03) },
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 0.1, 0.06), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }) };
  return SENTRY_MAT;
}
/* Pièces fixes d'un groupe fusionnées par matière (mergeGunParts) ; les pièces nommées (diode, bande du camp) restent à part */
function sentryMerge(g) {
  const by = new Map();
  for (const c of g.children.slice()) {
    if (!c.isMesh || c.name) continue;
    c.updateMatrix(); let l = by.get(c.material); if (!l) by.set(c.material, l = []); l.push({ geo: c.geometry, m: c.matrix.clone() }); g.remove(c);
  }
  for (const [mat, parts] of by) { const m = new THREE.Mesh(mergeGunParts(parts), mat); m.castShadow = true; g.add(m); }
}
/* Gabarit (construit une fois) : racine au sol, face à -z. Hiérarchie : jambes (charnière, tube bas, patin), mât > lacet > tangage > canon */
const SENTRY_LEGS = [Math.PI, Math.PI / 3, -Math.PI / 3]; // une jambe derrière, deux devant de part et d'autre du canon
function sentryTemplate() {
  if (SENTRY_TPL) return SENTRY_TPL;
  const T = sentryMats(), root = new THREE.Group(), vcy = (p, mat, x, y, z, r, len) => cy(p, mat, x, y, z, r, len, 0), xcy = (p, mat, x, y, z, r, len) => cy(p, mat, x, y, z, r, len, 0, 0, Math.PI / 2);
  const hub = new THREE.Group(); root.add(hub);
  vcy(hub, T.dark, 0, 0.375, 0, 0.085, 0.25); vcy(hub, T.body, 0, 0.31, 0, 0.096, 0.06); vcy(hub, T.dark, 0, 0.502, 0, 0.06, 0.012);
  SENTRY_LEGS.forEach((a, i) => {
    rb(hub, T.body, Math.sin(a) * 0.085, 0.31, Math.cos(a) * 0.085, 0.05, 0.045, 0.034, 0.006, 0, a, 0); // chape de la charnière
    const leg = new THREE.Group(); leg.position.set(Math.sin(a) * 0.1, 0.31, Math.cos(a) * 0.1); leg.rotation.y = a; root.add(leg);
    const hinge = new THREE.Group(); hinge.name = 'hinge' + i; leg.add(hinge);
    xcy(hinge, T.dark, 0, 0, 0, 0.02, 0.06);
    rb(hinge, T.body, 0, -0.15, 0, 0.054, 0.3, 0.054, 0.014); rb(hinge, T.dark, 0, -0.285, 0, 0.062, 0.03, 0.062, 0.006); rb(hinge, T.dark, 0, -0.06, 0.022, 0.022, 0.07, 0.008, 0.003);
    const lower = new THREE.Group(); lower.name = 'lower' + i; hinge.add(lower);
    vcy(lower, T.joint, 0, -0.13, 0, 0.02, 0.26);
    const pad = new THREE.Group(); pad.name = 'pad' + i; pad.position.y = -0.28; lower.add(pad);
    vcy(pad, T.rubber, 0, 0.012, 0, 0.056, 0.024); vcy(pad, T.rubber, 0, 0.032, 0, 0.026, 0.03);
    for (const g of [hinge, lower, pad]) sentryMerge(g);
  });
  sentryMerge(hub);
  const mast = new THREE.Group(); mast.name = 'mast'; root.add(mast);
  vcy(mast, T.dark, 0, 0.47, 0, 0.064, 0.18); vcy(mast, T.joint, 0, 0.548, 0, 0.068, 0.018); vcy(mast, T.dark, 0, 0.575, 0, 0.13, 0.035);
  const yaw = new THREE.Group(); yaw.name = 'yaw'; yaw.position.y = 0.595; yaw.scale.setScalar(1.25); mast.add(yaw); // tête à l'échelle 1,25 : la machine se lit à distance
  vcy(yaw, T.body, 0, 0.02, 0, 0.12, 0.04);
  const band = vcy(yaw, T.ally, 0, 0.02, 0, 0.1235, 0.014); band.name = 'band';
  rb(yaw, T.dark, 0, 0.05, 0.01, 0.2, 0.02, 0.2, 0.006);
  for (const s of [-1, 1]) { rb(yaw, T.body, s * 0.1, 0.11, 0, 0.028, 0.14, 0.14, 0.008); xcy(yaw, T.joint, s * 0.118, 0.105, 0, 0.038, 0.016); xcy(yaw, T.dark, s * 0.128, 0.105, 0, 0.016, 0.01); }
  rb(yaw, T.body, -0.178, 0.1, 0.03, 0.08, 0.12, 0.17, 0.01); rb(yaw, T.dark, -0.178, 0.165, 0.03, 0.084, 0.012, 0.174, 0.003); rb(yaw, T.joint, -0.22, 0.13, 0.03, 0.006, 0.03, 0.04, 0.002); // caisse de munitions, couvercle, loquet
  rb(yaw, T.dark, -0.13, 0.152, 0.0, 0.05, 0.022, 0.07, 0.004, 0, 0, -0.45); // couloir d'alimentation
  rb(yaw, T.dark, 0, 0.1, 0.12, 0.15, 0.08, 0.06, 0.008); for (let k = 0; k < 4; k++) rb(yaw, T.joint, -0.05 + k * 0.033, 0.1, 0.153, 0.008, 0.06, 0.008, 0.002); // coffret et ailettes
  const pitch = new THREE.Group(); pitch.name = 'pitch'; pitch.position.y = 0.105; yaw.add(pitch);
  rb(pitch, T.dark, 0, 0, -0.02, 0.11, 0.1, 0.32, 0.012); rb(pitch, T.body, 0, 0.058, -0.04, 0.118, 0.022, 0.26, 0.008);
  for (const s of [-1, 1]) rb(pitch, T.body, s * 0.06, 0, -0.03, 0.012, 0.08, 0.24, 0.004);
  rb(pitch, T.body, 0, 0.02, -0.19, 0.25, 0.19, 0.02, 0.008, -0.26, 0, 0); // bouclier incliné
  for (const s of [-1, 1]) rb(pitch, T.body, s * 0.13, 0.015, -0.155, 0.018, 0.16, 0.085, 0.005, 0, -s * 0.38, 0);
  cz(pitch, T.dark, 0, 0, -0.205, 0.03, 0.02);
  rb(pitch, T.dark, 0.07, 0.066, -0.075, 0.03, 0.012, 0.05, 0.003); rb(pitch, T.body, 0.07, 0.1, -0.075, 0.065, 0.06, 0.1, 0.012); // capteur
  cz(pitch, T.lens, 0.062, 0.1, -0.127, 0.017, 0.012); cz(pitch, T.lens, 0.088, 0.112, -0.127, 0.008, 0.01);
  const led = rb(pitch, T.led.scan, 0.07, 0.137, -0.122, 0.045, 0.008, 0.006, 0.002); led.name = 'led';
  rb(pitch, T.dark, 0.0565, 0.005, -0.04, 0.004, 0.03, 0.06, 0.001); // fenêtre d'éjection
  const eye = new THREE.Object3D(); eye.name = 'eye'; eye.position.set(0.062, 0.1, -0.135); pitch.add(eye);
  const barrel = new THREE.Group(); barrel.name = 'barrel'; barrel.position.z = -0.2; pitch.add(barrel);
  cz(barrel, T.dark, 0, 0, -0.2, 0.02, 0.4); for (let k = 0; k < 4; k++) cz(barrel, T.joint, 0, 0, -0.05 - k * 0.04, 0.026, 0.012);
  cz(barrel, T.dark, 0, 0, -0.43, 0.025, 0.06); for (const s of [-1, 1]) rb(barrel, T.dark, s * 0.02, 0, -0.43, 0.012, 0.03, 0.02, 0.002);
  const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle'; muzzle.position.z = -0.465; barrel.add(muzzle);
  for (const g of [mast, yaw, pitch, barrel]) sentryMerge(g);
  root.traverse((o) => { if (o.isMesh && o.name) o.castShadow = false; });
  SENTRY_TPL = root; return root;
}
function sentryBuild() {
  const root = sentryTemplate().clone(true), get = (n) => root.getObjectByName(n);
  const m = { root, mast: get('mast'), yaw: get('yaw'), pitch: get('pitch'), barrel: get('barrel'), muzzle: get('muzzle'), eye: get('eye'), led: get('led'), band: get('band'), legs: [] };
  for (let i = 0; i < 3; i++) m.legs.push({ hinge: get('hinge' + i), lower: get('lower' + i), pad: get('pad' + i) });
  m.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4, 1, true), SENTRY_MAT.beam); m.beam.visible = false; scene.add(m.beam);
  return m;
}
function sentryMake(u) {
  const m = sentryBuild(); u.m = m; u.mesh = m.root; m.root.position.copy(u.pos); m.root.rotation.y = u.yaw; scene.add(m.root);
  Object.assign(u, { aimY: u.yaw + Math.PI, aimP: -0.7, vY: 0, vP: 0, tgt: null, lockT: 0, fireT: 0, ammo: SENTRY.ammo, firing: false, n: 0, recoil: 0, kick: 0,
    scY: u.yaw, scP: -0.03, scT: 0.4, servoT: -9, fxT: 0, hpk: 1, dieT: 0, planted: false, mastK: 0, legK: 0 });
  m.band.material = !u.owner || allied(u.owner, PL.ent) ? SENTRY_MAT.ally : SENTRY_MAT.enemy;
  sentryPose(u, 0);
  if (u.local) sfxSentry(u.pos, 'deploy');
}
function sentryMuzzle(u, out) { u.m.root.updateMatrixWorld(true); return u.m.muzzle.getWorldPosition(out); }
/* Jambes à k (0 repliées, 1 posées) : le tube bas sort pendant que la jambe s'écarte, le patin reste au sol (hauteur de charnière constante) */
function sentryLegs(m, k) {
  const D = 0.3 + 0.22 * k, sp = Math.acos(clamp(0.3 / D, -1, 1));
  for (const L of m.legs) { L.hinge.rotation.x = -sp; L.lower.position.y = -0.02 - 0.22 * k; L.pad.rotation.x = sp; }
}
const easeBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
/* Pose de l'image : déploiement d'après le temps, puis orientation, recul ; la diode du dépliage */
function sentryPose(u, dt) {
  const m = u.m, T = SENTRY_MAT;
  if (u.state === 'deploy') {
    const k = clamp(u.t / SENTRY.deploy, 0, 1), kL = smoothstep(0, 0.45, k), kM = k < 0.35 ? 0 : easeBack(clamp((k - 0.35) / 0.37, 0, 1)), kH = smoothstep(0.55, 0.92, k);
    u.legK = kL; u.mastK = kM; u.aimY = u.yaw + Math.PI * (1 - kH); u.aimP = -0.7 * (1 - kH) + Math.sin(kH * Math.PI) * 0.08;
    if (kL >= 1 && !u.planted) { u.planted = true; sentryPlantFx(u); }
    m.led.material = u.t < 1.5 ? T.led.off : (u.t * 7) % 1 < 0.5 ? T.led.scan : T.led.off;
  }
  sentryLegs(m, u.legK);
  m.mast.position.y = 0.12 * u.mastK;
  u.recoil = damp(u.recoil, 0, 22, dt); u.kick = damp(u.kick, 0, 16, dt);
  m.yaw.rotation.y = u.aimY - u.yaw + (u.firing ? (Math.random() - 0.5) * 0.006 : 0);
  m.pitch.rotation.x = u.aimP + u.kick;
  m.barrel.position.z = -0.2 + u.recoil;
}
/* Diode d'état : veille (vert qui respire), accrochage (orange qui clignote), tir (rouge) ; sous le quart de ses points, elle hésite */
function sentryLed(u) {
  const L = SENTRY_MAT.led;
  let mat = u.firing ? L.fire : u.tgt ? ((u.t * 9) % 1 < 0.5 ? L.lock : L.off) : (Math.sin(u.t * 3) > 0 ? L.scan : L.dim);
  if (u.hpk < 0.25 && Math.random() < 0.18) mat = L.off;
  u.m.led.material = mat;
}
/* Ressort amorti vers (wy, wp) : vitesse et accélération bornées, plus doux en veille ; renvoie l'écart en lacet */
function sentrySpring(u, wy, wp, fast, dt) {
  const K = fast ? 70 : 20, C = 2 * Math.sqrt(K), aY = fast ? SENTRY.yawAcc : 5, aP = fast ? SENTRY.pitchAcc : 4, mY = fast ? SENTRY.yawSpd : 0.85, mP = fast ? SENTRY.pitchSpd : 0.6;
  const eY = Math.atan2(Math.sin(wy - u.aimY), Math.cos(wy - u.aimY)), eP = wp - u.aimP;
  u.vY = clamp(u.vY + clamp(K * eY - C * u.vY, -aY, aY) * dt, -mY, mY); u.aimY += u.vY * dt;
  u.vP = clamp(u.vP + clamp(K * eP - C * u.vP, -aP, aP) * dt, -mP, mP); u.aimP += u.vP * dt;
  return eY;
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
  if (u.state === 'dead') { sentryDying(u, dt); return; }
  if (u.state === 'deploy') { sentryPose(u, dt); if (u.t >= SENTRY.deploy) { u.state = 'live'; u.t = 0; u.legK = 1; u.mastK = 1; sfxSentry(u.pos, 'on'); } return; }
  if (u.state !== 'live') return;
  if (u.t > SENTRY.life || u.ammo <= 0) { u.hp = 0; u.expired = true; unitKill(u); return; }
  u.hpk = clamp(u.hp / SENTRY.hp, 0, 1);
  const eye = _stC.set(u.pos.x, u.pos.y + SENTRY.eye, u.pos.z), tgt = sentryPick(u, eye);
  if (tgt !== u.tgt) { u.tgt = tgt; u.lockT = 0; if (tgt) sfxSentry(u.pos, 'lock'); }
  let wy, wp;
  if (tgt) {
    const c = entChest(tgt, _stA), dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z;
    wy = Math.atan2(-dx, -dz); wp = Math.atan2(dy, Math.hypot(dx, dz)); u.lockT += dt;
  } else {
    // veille : un point de balayage tiré au hasard toutes les 1,3 à 2,6 s, rejoint en douceur, puis une pause ; un léger tremblé de recherche
    if ((u.scT -= dt) <= 0) { u.scT = rand(1.3, 2.6); u.scY = u.yaw + rand(-1.15, 1.15); u.scP = rand(-0.09, 0.05); }
    wy = u.scY + Math.sin(u.t * 7.3) * 0.006; wp = u.scP;
  }
  if (u.hpk < 0.25 && Math.random() < dt * 0.9) u.vY *= -0.3; // avarie : la tête hésite
  const da = sentrySpring(u, wy, wp, !!tgt, dt);
  if (Math.abs(u.vY) > 1.6 && u.t - u.servoT > 0.7) { u.servoT = u.t; sfxSentry(u.pos, 'servo'); }
  u.firing = !!tgt && Math.abs(da) < 0.06 && u.lockT >= SENTRY.lock;
  sentryPose(u, dt); sentryLed(u); sentryBeam(u, tgt); sentryHurtFx(u, dt);
  if (u.firing) { u.fireT -= dt; while (u.fireT <= 0 && u.ammo > 0) { u.fireT += 1 / SENTRY.rate; u.ammo--; sentryShoot(u, tgt, true); } } else u.fireT = Math.max(0, u.fireT);
}
/* Faisceau de visée (laser rouge) du capteur vers la cible : il clignote pendant l'accrochage, reste fixe pendant le tir */
function sentryBeam(u, tgt) {
  const b = u.m.beam;
  if (!tgt || u.state !== 'live' || (!u.firing && (u.t * 10) % 1 < 0.35)) { b.visible = false; return; }
  u.m.root.updateMatrixWorld(true);
  const a = u.m.eye.getWorldPosition(_stA), c = entChest(tgt, _stB), d = a.distanceTo(c);
  b.visible = true; b.scale.set(1, d, 1); b.position.copy(a).add(c).multiplyScalar(0.5);
  b.quaternion.setFromUnitVectors(_stC.set(0, 1, 0), c.clone().sub(a).normalize());
}
/* Un coup : du canon, dispersion gaussienne ; le propriétaire seul touche et blesse. Recul, ressaut, flamme, douille, traçante */
function sentryShoot(u, tgt, local) {
  const from = sentryMuzzle(u, new V3()), aim = tgt ? entChest(tgt, new V3()) : from.clone().add(_stB.set(-Math.sin(u.aimY) * Math.cos(u.aimP), Math.sin(u.aimP), -Math.cos(u.aimY) * Math.cos(u.aimP)).multiplyScalar(20));
  const dir = aim.sub(from).normalize(), s = SENTRY.sigma;
  dir.x += (Math.random() + Math.random() - 1) * s * 2; dir.y += (Math.random() + Math.random() - 1) * s * 2; dir.z += (Math.random() + Math.random() - 1) * s * 2; dir.normalize();
  const w = rayWorld(from.x, from.y, from.z, dir.x, dir.y, dir.z, SENTRY.range + 10, 1), wt = w ? w.t : SENTRY.range + 10;
  const wb = w ? w.box : null, wp = w ? w.prop : null, wn = w ? new V3(w.nx, w.ny, w.nz) : null, wm = w ? w.m : null;
  const eh = local ? rayEntities(from, dir, wt, u.owner) : null, uz = local && !eh ? rayUnits(u.owner, from, dir, wt) : null;
  const endT = eh ? eh.t : uz ? uz.t : wt, end = from.clone().addScaledVector(dir, endT);
  u.recoil = 0.04; u.kick = 0.014 * (0.7 + Math.random() * 0.6);
  if (u.n++ % 2 === 0) FX.heavy.add(from, end, 320);
  if (from.distanceTo(camera.position) < 80) { muzzleWorldFx(from, dir, false, 1.15); sentryCasing(u); }
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
/* Douille chaude éjectée à droite de la culasse */
function sentryCasing(u) {
  const p = u.m.pitch.localToWorld(_stA.set(0.07, 0.005, -0.04)), ca = Math.cos(u.aimY), sa = Math.sin(u.aimY), sp = rand(1.4, 2.4);
  FX.add.spawn(p.x, p.y, p.z, ca * sp + rand(-0.3, 0.3), rand(1.2, 2.2), -sa * sp + rand(-0.3, 0.3), 0.55, 0.022, 0.016, 1.6, 1.05, 0.35, 0.9, 0.15, 9.8, 0.4);
}
/* Pieds posés : un peu de poussière sous chaque patin, un claquement */
function sentryPlantFx(u) {
  for (const a of SENTRY_LEGS) { const ga = u.yaw + a, x = u.pos.x + Math.sin(ga) * 0.52, z = u.pos.z + Math.cos(ga) * 0.52; FX.smoke.spawn(x, u.pos.y + 0.04, z, Math.sin(ga) * 0.4, 0.15, Math.cos(ga) * 0.4, 0.7, 0.08, 0.35, 0.55, 0.52, 0.48, 0.35, 0, 0, 1.5); }
  sfxSentry(u.pos, 'clunk');
}
/* Avarie : étincelles sous la moitié de ses points, fumée par le coffret sous le tiers */
function sentryHurtFx(u, dt) {
  if (u.hpk >= 0.5 || (u.fxT -= dt) > 0) return;
  u.fxT = rand(0.25, 0.8) * (u.hpk < 0.25 ? 0.5 : 1);
  const p = u.m.pitch.localToWorld(_stA.set(rand(-0.05, 0.05), 0.04, rand(-0.1, 0.08)));
  for (let i = 0; i < 4; i++) FX.add.spawn(p.x, p.y, p.z, rand(-1.5, 1.5), rand(0.8, 2.5), rand(-1.5, 1.5), rand(0.15, 0.4), 0.03, 0.01, 4, 2.6, 1.1, 1, 0, 9, 0.5);
  if (u.hpk < 0.35) { const q = u.m.yaw.localToWorld(_stB.set(0, 0.12, 0.15)); FX.smoke.spawn(q.x, q.y, q.z, rand(-0.1, 0.1), rand(0.4, 0.7), rand(-0.1, 0.1), rand(1.2, 2), 0.06, 0.4, 0.18, 0.17, 0.16, 0.5, 0, 0, 0.8, rand(-1, 1)); }
}
function sentryRemote(u, dt) {
  if (u.state === 'dead') { sentryDying(u, dt); return; }
  if (u.npos) u.pos.copy(u.npos);
  if (u.state === 'live') {
    u.legK = 1; u.mastK = 1;
    const k = 1 - Math.exp(-dt * 12), dy = Math.atan2(Math.sin(u.netY - u.aimY), Math.cos(u.netY - u.aimY));
    u.vY = (dy * k) / Math.max(dt, 1e-3); u.aimY += dy * k; u.aimP += (u.netP - u.aimP) * k;
    u.tgt = u.firing ? u : null; // (pas de cible connue ici : la diode suit l'état publié)
  }
  sentryPose(u, dt); if (u.state === 'live') sentryLed(u); sentryHurtFx(u, dt);
  u.m.beam.visible = false;
  if (u.firing) { u.fireT -= dt; while (u.fireT <= 0) { u.fireT += 1 / SENTRY.rate; sentryShoot(u, null, false); } }
}
/* Fin : détruite (claquement, épave noircie qui fume puis s'enfonce) ou à court (elle s'éteint et se replie). L'unité reste le temps de la
   séquence (u.dead : plus visée ni touchée), puis disparaît (u.gone) */
function sentryDie(u, silent) {
  u.m.beam.visible = false; scene.remove(u.m.beam);
  u.dieT = 0; u.wreck = !u.expired && !silent; u.firing = false; u.vP = 0; u.m.led.material = SENTRY_MAT.led.off;
  if (u.wreck) {
    const p = u.m.pitch.getWorldPosition(_stA);
    explosionFx(p, 0.4); sfxExplosion(p, 0.5);
    for (let i = 0; i < 18; i++) FX.add.spawn(p.x, p.y, p.z, rand(-3, 3), rand(1, 5), rand(-3, 3), rand(0.3, 0.8), 0.04, 0.01, 3, 2, 0.6, 1, 0, 12, 0.5);
    u.m.root.traverse((o) => { if (o.isMesh && !o.name) o.material = SENTRY_MAT.charred; });
    u.m.band.material = SENTRY_MAT.led.off; u.vY += rand(-4, 4);
  } else if (!silent) sfxSentry(u.pos, 'down');
  if (silent) u.gone = true;
  if (u.local && u.owner === PL.ent && !silent) hudMsg(u.expired ? _t('Tourelle à court') : _t('Tourelle détruite'), u.expired ? '' : 'enemy', 1.6);
}
function sentryDying(u, dt) {
  u.dieT += dt; const m = u.m;
  if (u.wreck) {
    // le canon pique du nez avec un rebond, la tête tourne sur son élan, le mât s'affaisse ; fumée, quelques étincelles ; puis l'épave s'enfonce
    u.vP += (-0.85 - u.aimP) * 60 * dt - u.vP * 5 * dt; u.aimP += u.vP * dt; u.vY *= Math.exp(-1.6 * dt); u.aimY += u.vY * dt;
    u.mastK = damp(u.mastK, 0.55, 6, dt);
    if ((u.fxT -= dt) <= 0) {
      u.fxT = 0.16; const q = m.pitch.getWorldPosition(_stB);
      FX.smoke.spawn(q.x, q.y, q.z, rand(-0.15, 0.15), rand(0.5, 0.9), rand(-0.15, 0.15), rand(1.6, 2.6), 0.1, 0.6, 0.12, 0.11, 0.1, 0.6, 0, 0, 0.7, rand(-1, 1));
      if (u.dieT < 1.6 && Math.random() < 0.5) for (let i = 0; i < 3; i++) FX.add.spawn(q.x, q.y, q.z, rand(-2, 2), rand(1, 3), rand(-2, 2), rand(0.2, 0.5), 0.03, 0.01, 4, 2.4, 1, 1, 0, 9, 0.5);
    }
    if (u.dieT > SENTRY.wreck) m.root.position.y = u.pos.y - (u.dieT - SENTRY.wreck) * 0.35;
    if (u.dieT > SENTRY.wreck + 1.2) u.gone = true;
  } else {
    // à court : canon qui s'abaisse, tête ramenée vers l'avant, mât rentré, jambes repliées
    u.aimP = damp(u.aimP, -0.6, 3, dt); u.aimY += Math.atan2(Math.sin(u.yaw - u.aimY), Math.cos(u.yaw - u.aimY)) * (1 - Math.exp(-3 * dt));
    u.mastK = damp(u.mastK, 0, 3.5, dt); if (u.dieT > 0.6) u.legK = damp(u.legK, 0, 4, dt);
    if (u.dieT > 1.9) u.gone = true;
  }
  sentryPose(u, dt);
}
function sentryPub(u) { return [+u.aimY.toFixed(2), +u.aimP.toFixed(2), u.firing ? 1 : 0, u.state === 'live' ? 1 : 0, Math.round(clamp(u.hp / SENTRY.hp, 0, 1) * 10)]; }
function sentryNet(u, a) { u.netY = +a[0] || 0; u.netP = +a[1] || 0; u.firing = !!a[2]; if (a[3] && u.state === 'deploy') { u.state = 'live'; u.t = 0; } u.hpk = a[4] === undefined ? 1 : clamp((+a[4] || 0) / 10, 0, 1); }
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
  else if (kind === 'servo') { nz(o, t, 0.16, 'bandpass', 1500, 2600, 4, 0.05, 0.02); tn(o, t, 0.16, 210, 260, 'sawtooth', 0.018, 0.02); } // moteur d'orientation qui force
  else if (kind === 'clunk') { nz(o, t, 0.08, 'lowpass', 900, 300, 1, 0.3, 0.002); tn(o, t, 0.1, 120, 70, 'sine', 0.25, 0.002); } // pieds verrouillés
  else if (kind === 'down') { tn(o, t, 0.5, 700, 160, 'sine', 0.1, 0.01); nz(o, t + 0.1, 0.6, 'bandpass', 900, 400, 1.2, 0.08, 0.05); } // extinction, repli
}
