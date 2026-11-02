/* ==========================================================================
   ROQUETTES (Breachline) : le projectile du lance-roquettes (RPG-7, 06ob-lanceurs.js)
   La roquette part à 62 m/s, tombe un peu (3 m/s²), laisse une traînée de fumée et une flamme de propulseur. Elle s'arme après 6 m :
   avant, un impact ne fait qu'un choc (60 points sur un soldat touché de plein fouet, rien autour) ; armée, elle explose (explode : 5,5 m,
   130 au centre), et un coup direct frappe fort les engins : hélicoptère, mecha, drone, véhicule (puis le décor : vitres, murs à brèche).
   Après 4 s de vol, elle explose en l'air.
   Réseau : le tireur simule sa roquette, qui seule touche et blesse ; il annonce le départ ('rk' : position, vitesse) et le point
   d'explosion ('rkx'). Les autres pairs font voler une copie qui s'arrête au premier obstacle sans exploser, et l'explosion arrive par
   'rkx' (effets seulement : explode ne blesse que chez le tireur).
   ========================================================================== */
const ROCKET = { speed: 62, g: 3, arm: 6, life: 4, r: 5.5, dmg: 130, dud: 60, heli: 230, mecha: 700, drone: 999, veh: 220 };
const ROCKETS = [];
const _rkA = new V3(), _rkB = new V3(), _rkC = new V3(), _rkQ = new THREE.Quaternion(), _rkF = new V3(0, 0, -1);
/* Départ d'une roquette : p, point de départ ; dir, direction ; def, l'arme (RPG-7) */
function rocketFire(ent, p, dir, def) {
  const rk = { owner: ent, def, p: p.clone(), v: dir.clone().multiplyScalar(ROCKET.speed), t: 0, dist: 0, life: ent.spawnAt, local: !ent.isRemote, id: 0, mesh: rocketMesh(), smokeT: 0, snd: null, done: false, wait: 0 };
  rk.mesh.position.copy(p); scene.add(rk.mesh);
  rk.snd = rocketHiss(p);
  rocketLaunchFx(p, dir, ent);
  if (MATCH.online && rk.local && (ent.isPlayer || ent.netBot)) {
    const ev = { k: 'rk', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +rk.v.x.toFixed(2), vy: +rk.v.y.toFixed(2), vz: +rk.v.z.toFixed(2) };
    netEvent(ev, ent); rk.id = ev.i;
  }
  ROCKETS.push(rk);
  soundEvents.push({ pos: p.clone(), team: ent.team, who: ent, t: MATCH.time, loud: true }); if (soundEvents.length > 60) soundEvents.shift();
  return rk;
}
/* Copie d'une roquette tirée par un autre joueur ('rk') */
function rocketNetIn(e, ev) {
  if (ROCKETS.filter((r) => r.owner === e).length > 4) return;
  const p = new V3(clamp(+ev.px || 0, -300, 300), clamp(+ev.py || 0, -20, 80), clamp(+ev.pz || 0, -300, 300)), v = new V3(+ev.vx || 0, +ev.vy || 0, +ev.vz || 0);
  if (!(v.lengthSq() > 1)) return;
  const rk = rocketFire(e, p, v.normalize(), WEAPONS.rpg7); rk.local = false; rk.id = ev.i | 0;
}
/* Explosion annoncée par le tireur ('rkx') : la copie part de là */
function rocketNetEnd(e, ev) {
  const rk = ROCKETS.find((r) => r.owner === e && r.id === (ev.r | 0) && !r.done);
  const p = new V3(clamp(+ev.x || 0, -300, 300), clamp(+ev.y || 0, -20, 80), clamp(+ev.z || 0, -300, 300));
  if (rk) rocketEnd(rk);
  if (ev.a) explode(p, e, WEAPONS.rpg7.name, ROCKET.r, ROCKET.dmg, -1); else rocketDudFx(p);
}
function rocketEnd(rk) {
  rk.done = true; scene.remove(rk.mesh); if (rk.snd) { rocketHissStop(rk.snd); rk.snd = null; }
}
/* Une image : vol, traînée, impacts (sous-pas de 2 cm à 62 m/s : au plus 1,3 m par pas) */
function updateRockets(dt) {
  for (let i = ROCKETS.length - 1; i >= 0; i--) {
    const rk = ROCKETS[i];
    if (rk.done) { ROCKETS.splice(i, 1); continue; }
    if (rk.wait > 0) { rk.wait -= dt; if (rk.wait <= 0) { rocketDudFx(rk.p); rocketEnd(rk); } continue; } // copie arrêtée : l'annonce du tireur n'est pas venue
    let left = dt;
    while (left > 1e-5 && !rk.done && rk.wait <= 0) {
      const h = Math.min(left, 0.02); left -= h;
      rk.v.y -= ROCKET.g * h; rk.t += h;
      const sp = rk.v.length(), d = _rkA.copy(rk.v).divideScalar(sp), seg = sp * h;
      rocketStep(rk, d, seg);
      if (rk.t >= ROCKET.life && !rk.done) rocketBoom(rk, rk.p.clone(), null, rk.local);
    }
    if (rk.done) continue;
    rk.mesh.position.copy(rk.p); _rkQ.setFromUnitVectors(_rkF, _rkB.copy(rk.v).normalize()); rk.mesh.quaternion.copy(_rkQ);
    rocketTrail(rk, dt);
    if (rk.snd) rocketHissMove(rk.snd, rk.p);
  }
}
/* Un pas : le segment de vol contre le décor, les soldats et les engins (le tireur seul) ; sinon le décor seul */
function rocketStep(rk, d, seg) {
  const o = rk.p, w = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, seg, 1);
  let t = w ? w.t : seg, hit = null;
  const wb = w ? { box: w.box, prop: w.prop, nx: w.nx, ny: w.ny, nz: w.nz, m: w.m } : null; // (RAYHIT est partagé : copié avant les autres rayons)
  if (rk.local) {
    const eh = rayEntities(o, d, t, rk.owner); if (eh) { t = eh.t; hit = { ent: eh.ent, part: eh.part }; }
    const hz = rayHelis(rk.owner, o, d, t); if (hz) { t = hz.t; hit = { heli: hz.heli }; }
    const dz = DRONES.length ? rayDrones(rk.owner, o, d, t) : null; if (dz) { t = dz.t; hit = { drone: dz.d }; }
    const mz = MECHAS.length ? rayMechas(rk.owner, o, d, t) : null; if (mz) { t = mz.t; hit = { mecha: mz.me }; }
    const uz = rayUnits(rk.owner, o, d, t); if (uz) { t = uz.t; hit = { unit: uz.u }; }
  }
  rk.dist += t;
  if (!hit && !(w && t >= w.t - 1e-6)) { o.addScaledVector(d, t); return; }
  const p = o.clone().addScaledVector(d, Math.max(0, t - 0.12));
  if (!rk.local) { o.copy(p); rk.wait = 0.6; rk.mesh.visible = false; return; } // copie : le tireur annoncera où elle a explosé
  if (!hit) hit = { world: wb };
  rocketBoom(rk, p, hit, rk.dist >= ROCKET.arm, d);
}
/* Impact (ou fin de vol) chez le tireur : explosion si la roquette est armée, simple choc sinon ; coup direct sur un engin */
function rocketBoom(rk, p, hit, armed, d) {
  rocketEnd(rk);
  const own = rk.owner, name = rk.def.name;
  if (MATCH.online && (own.isPlayer || own.netBot)) netEvent({ k: 'rkx', r: rk.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), a: armed ? 1 : 0 }, own);
  if (!armed) {
    rocketDudFx(p);
    if (hit && hit.ent) { hit.ent.lastForce = { dir: d.clone(), mag: 9, lift: 3, part: hit.part }; applyDamage(hit.ent, ROCKET.dud, own, name, false, d, undefined, rk.life); }
    return;
  }
  if (hit) {
    if (hit.heli) heliDamage(hit.heli, ROCKET.heli, own);
    else if (hit.drone) fpvDamage(hit.drone, ROCKET.drone, own);
    else if (hit.mecha) mechaDamage(hit.mecha, ROCKET.mecha, own);
    else if (hit.unit) unitDamage(hit.unit, ROCKET.veh, own, 'blast');
    else if (hit.world && hit.world.box && hit.world.box.veh) vehShot(hit.world.box.veh, ROCKET.veh, own);
    else if (hit.world && hit.world.prop) propShotLocal(hit.world.prop, p, d, 200, own);
  }
  explode(p, own, name, ROCKET.r, ROCKET.dmg, rk.life);
}
/* Départ : flamme et souffle arrière (le souffle s'en va derrière le tireur), fumée qui reste, coup sourd */
function rocketLaunchFx(p, dir, ent) {
  for (let i = 0; i < 10; i++) FX.add.spawn(p.x, p.y, p.z, dir.x * rand(4, 12) + rand(-1, 1), dir.y * rand(4, 12) + rand(-0.5, 1), dir.z * rand(4, 12) + rand(-1, 1), rand(0.06, 0.14), 0.16, 0.04, 4, 2.2, 0.8, 1, 0, 0, 3);
  const back = _rkC.copy(p).addScaledVector(dir, -1.3);
  for (let i = 0; i < 12; i++) FX.smoke.spawn(back.x, back.y, back.z, -dir.x * rand(2, 7) + rand(-1, 1), rand(-0.2, 0.8), -dir.z * rand(2, 7) + rand(-1, 1), rand(1.2, 2.4), 0.3, rand(1.2, 2.2), 0.82, 0.8, 0.76, 0.5, 0, 0, 1.6, rand(-1, 1));
  for (let i = 0; i < 6; i++) FX.add.spawn(back.x, back.y, back.z, -dir.x * rand(5, 10), rand(0, 1), -dir.z * rand(5, 10), rand(0.08, 0.16), 0.25, 0.1, 3.5, 1.6, 0.5, 0.8, 0, 0, 3);
  flashLight(p, 6, 10, 0.08, 0xffb060);
  sfxRocketLaunch(p, ent);
}
function rocketTrail(rk, dt) {
  const tail = _rkC.copy(rk.v).normalize().multiplyScalar(-0.22).add(rk.p);
  FX.add.spawn(tail.x, tail.y, tail.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), 0.05, 0.13, 0.04, 4.5, 2.6, 1.2, 1, 0, 0, 0);
  rk.smokeT -= dt;
  while (rk.smokeT <= 0) { rk.smokeT += 0.016; FX.smoke.spawn(tail.x + rand(-0.05, 0.05), tail.y + rand(-0.05, 0.05), tail.z + rand(-0.05, 0.05), rand(-0.15, 0.15), rand(0.05, 0.3), rand(-0.15, 0.15), rand(1.6, 2.6), 0.12, rand(0.7, 1.1), 0.78, 0.77, 0.74, 0.42, 0, 0, 0.7, rand(-1, 1)); }
}
/* Roquette non armée qui heurte : étincelles, éclats, un choc métallique */
function rocketDudFx(p) {
  for (let i = 0; i < 10; i++) FX.add.spawn(p.x, p.y, p.z, rand(-3, 3), rand(0.5, 3.5), rand(-3, 3), rand(0.15, 0.4), 0.03, 0.01, 3, 2, 0.8, 1, 0, 12, 0.6);
  FX.smoke.spawn(p.x, p.y, p.z, 0, 0.4, 0, 1.2, 0.2, 0.9, 0.5, 0.48, 0.45, 0.5, 0, 0, 1.2, rand(-1, 1));
  sfxImpact(p, 'metal');
}
function clearRockets() { for (const rk of ROCKETS) rocketEnd(rk); ROCKETS.length = 0; }

/* ---------- Sons ---------- */
/* Départ : claquement, souffle grave, sifflement qui s'éloigne */
function sfxRocketLaunch(p, ent) {
  if (!AU.ready) return;
  const own = ent && ent.isPlayer, t = AU.ctx.currentTime + (own ? 0 : Math.min(p.distanceTo(camera.position) / 343, 0.3)), o = own ? uiOut(1.4) : auOut(p, 0.5, 2.2, 1, 6, AU.wpn);
  nz(o, t, 0.02, 'highpass', 1800, 1800, 0.8, 0.9, 0.0005);
  nz(o, t, 0.6, 'lowpass', 1400, 120, 0.7, 1.1, 0.004); tn(o, t, 0.45, 95, 38, 'sine', 1.2, 0.003);
  nz(o, t + 0.04, 1.1, 'bandpass', 2600, 900, 0.8, 0.45, 0.05);
}
/* Sifflement du propulseur : bruit en boucle, passe-bande, panoramique qui suit la roquette */
function rocketHiss(p) {
  if (!AU.ready || !AU.noise) return null;
  const ctx = AU.ctx, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), pan = ctx.createPanner(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = AU.noise; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
  pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 5; pan.rolloffFactor = 1.1;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
  s.connect(bp); bp.connect(pan); pan.connect(g); g.connect(AU.bus); s.start(t, Math.random());
  const E = { s, bp, pan, g }; rocketHissMove(E, p); return E;
}
function rocketHissMove(E, p) { const P = E.pan; if (P.positionX) { P.positionX.value = p.x; P.positionY.value = p.y; P.positionZ.value = p.z; } else P.setPosition(p.x, p.y, p.z); }
function rocketHissStop(E) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  E.g.gain.cancelScheduledValues(t); E.g.gain.setTargetAtTime(0.0001, t, 0.04);
  try { E.s.stop(t + 0.3); } catch (e) { /* déjà arrêtée */ }
  setTimeout(() => { for (const n of [E.g, E.pan, E.bp]) n.disconnect(); }, 600);
}
