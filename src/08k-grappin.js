/* ==========================================================================
   GRAPPIN (Breachline) : un lance-grappin au poignet, pour tous les soldats du joueur (touche V, LB à la manette, bouton au doigt)
   Deux charges, chacune revient en 9 s. On vise un mur ou le dessus d'un bloc à moins de 34 m : le crochet ne prend que si un dessus où se
   tenir est à portée (au plus 2,8 m au-dessus du point visé, de la place pour un soldat debout, dans les limites de la carte, pas un toit
   en pente, au plus à 15 m du sol). Le crochet file (120 m/s), puis le câble tire le soldat vers lui (jusqu'à 21 m/s, en 0,4 s), en
   gardant un peu de contrôle de côté. Arrivé au bord, une détente le hisse au-dessus : la montée automatique du contrôleur (STEP) et la
   recherche du sol le posent sur le dessus, sans jamais le téléporter. Saut ou nouvel appui : on lâche le câble en gardant son élan (le
   saut ajoute une poussée vers le haut). Coincé, le câble lâche de lui-même.
   Réseau : la position suit comme d'habitude ; le câble des autres joueurs se dessine d'après le point d'accroche publié (p.gr).
   ========================================================================== */
const GRAP = { range: 34, hook: 120, speed: 21, ramp: 0.4, charges: 2, recharge: 9, maxH: 15, ledge: 2.8, snap: 0.8, stuck: 0.4, maxT: 3, side: 3 };
const _grA = new V3(), _grB = new V3(), _grC = new V3(), _grD = new V3();
const GR = { st: null, a: new V3(), to: new V3(), land: new V3(), top: 0, clear: 0, n: new V3(), from: new V3(), t: 0, flyD: 0, spd: 0, best: 1e9, bestT: 0, charges: GRAP.charges, cd: 0, rope: null, hook: null, jumpWas: false, aimOk: false, aimT: 0, remote: new Map() };
/* Visée du grappin depuis l'œil, regard f : renvoie { p, top, land } ou null */
function grappleAim(eye, f, feetY) {
  const h = rayWorld(eye.x, eye.y, eye.z, f.x, f.y, f.z, GRAP.range, 2);
  if (!h || !h.box || h.box.noTop || h.box.ray || h.box.inv || h.box.veh) return null;
  const b = h.box, p = _grA.set(eye.x + f.x * h.t, eye.y + f.y * h.t, eye.z + f.z * h.t), top = b.y1;
  if (top > GRAP.maxH || top < feetY + 0.9) return null;
  let lx, lz;
  if (h.ny > 0.7) { lx = p.x; lz = p.z; } // le dessus même
  else if (Math.abs(h.ny) < 0.3) { // un mur : le bord de son dessus, un peu en retrait
    if (top - p.y > GRAP.ledge) return null;
    lx = p.x - h.nx * 0.55; lz = p.z - h.nz * 0.55;
    if (b.x1 - b.x0 > 0.7) lx = clamp(lx, b.x0 + 0.3, b.x1 - 0.3);
    if (b.z1 - b.z0 > 0.7) lz = clamp(lz, b.z0 + 0.3, b.z1 - 0.3);
  } else return null; // un dessous
  if (lx < MAP.x0 + 0.4 || lx > MAP.x1 - 0.4 || lz < MAP.z0 + 0.4 || lz > MAP.z1 - 0.4) return null;
  const g = groundHeight(lx, lz, top + 0.3, 0.3);
  if (Math.abs(g - top) > 0.12 || ceilingAbove(lx, lz, top + 0.1) - top < 1.85) return null;
  // ce qu'il faut franchir au bord : le plus haut obstacle entre le mur et l'endroit où se poser (acrotère d'un toit plat)
  let clear = top;
  if (h.ny <= 0.7) for (const s of [0.12, 0.3, 0.45]) clear = Math.max(clear, groundHeight(p.x - h.nx * s, p.z - h.nz * s, top + 3, 0.15));
  if (clear - top > 1.4) return null;
  // le trajet du corps : de l'œil jusqu'au-dessus du bord (un demi-mètre devant le mur, la tête un mètre au-dessus de l'obstacle), puis vers l'endroit où se poser
  const to = grappleGoal(p, clear, lx, lz, h.ny > 0.7 ? 0 : h.nx, h.ny > 0.7 ? 0 : h.nz, new V3());
  if (!lineClear(eye, to) || !lineClear(to, _grD.set(lx, top + 1.2, lz))) return null;
  return { p: p.clone(), top, clear, land: new V3(lx, top, lz), nx: h.ny > 0.7 ? 0 : h.nx, nz: h.ny > 0.7 ? 0 : h.nz, to };
}
/* Point que vise l'œil pendant la traction : devant le mur et au-dessus du bord (mur), ou au-dessus de l'endroit où se poser (dessus) */
function grappleGoal(p, top, lx, lz, nx, nz, out) { return nx || nz ? out.set(p.x + nx * 0.5, top + 1.05, p.z + nz * 0.5) : out.set(lx, top + 1.65, lz); }
function grappleEye(out) { const e = PL.ent; return out.set(e.pos.x, e.pos.y + PL.eyeH, e.pos.z); }
/* Appui : lancer le crochet, ou lâcher le câble */
function grappleTry() {
  const e = PL.ent;
  if (GR.st) { grappleRelease(false); return; }
  if (!e.alive || MECHA_P.me || PILOT.d || KS.mode || KS.map.open || playHold() || PL.nadeState) return;
  if (GR.charges <= 0) { sfxMech('empty'); return; }
  const f = camFwd(_grB), aim = grappleAim(grappleEye(_grC), f, e.pos.y);
  if (!aim) { sfxMech('empty'); hudMsg(_t('Rien où accrocher le grappin')); return; }
  GR.charges--; if (GR.cd <= 0) GR.cd = GRAP.recharge;
  GR.st = 'fly'; GR.t = 0; GR.a.copy(aim.p); GR.land.copy(aim.land); GR.top = aim.top; GR.n.set(aim.nx, 0, aim.nz); GR.to.copy(aim.to); GR.clear = aim.clear;
  grappleHand(GR.from); GR.flyD = GR.from.distanceTo(GR.a); GR.spd = Math.max(4, hyp(e.vel.x, e.vel.z)); GR.best = 1e9; GR.bestT = 0;
  sfxGrapple('fire', e.pos); PL.vpP += 0.25; VM.rec.vy -= 0.3;
}
function grappleRelease(jump) {
  const e = PL.ent; if (!GR.st) return;
  if (jump && GR.st === 'pull') { e.vy = Math.min(Math.max(e.vy, 0), 6) + 4.5; // (élan vertical plafonné : un bond, pas une catapulte) e.onGround = false; sfxJump(surfaceAt(e.pos)); }
  GR.st = null; if (GR.rope) GR.rope.visible = false; if (GR.hook) GR.hook.visible = false;
  sfxGrapple('off', e.pos);
}
/* Point de départ du câble : le poignet gauche, en bas à gauche de la vue */
function grappleHand(out) {
  const f = camFwd(_grD), r = _grA.crossVectors(f, UP).normalize();
  return out.copy(camera.position).addScaledVector(f, 0.45).addScaledVector(r, -0.22).add(_grB.set(0, -0.2, 0));
}
/* Avant le contrôleur (updatePlayer) : la vitesse que donne le câble ; renvoie vrai si le grappin tient le soldat */
function grappleBefore(e, dt, I) {
  if (GR.charges < GRAP.charges) { GR.cd -= dt; if (GR.cd <= 0) { GR.charges++; GR.cd = GR.charges < GRAP.charges ? GRAP.recharge : 0; } }
  if (!GR.st) return false;
  if (!e.alive || MECHA_P.me || PILOT.d) { grappleRelease(false); return false; }
  GR.t += dt;
  const jumpNow = !!I.jump && !GR.jumpWas; GR.jumpWas = !!I.jump;
  if (GR.st === 'fly') {
    if (GR.t * GRAP.hook >= GR.flyD) { GR.st = 'pull'; GR.t = 0; sfxGrapple('hit', GR.a); FX.add.spawn(GR.a.x, GR.a.y, GR.a.z, 0, 0, 0, 0.08, 0.08, 0.02, 3, 2.4, 1.4, 1, 0); impactFx(GR.a, _grA.set(GR.n.x, 0, GR.n.z).normalize(), 'metal', false, true); }
    return false;
  }
  if (jumpNow) { grappleRelease(true); return false; }
  // tirer vers le point d'accroche (un peu au-dessus : la tête passe le bord), à vitesse croissante, avec un peu de contrôle de côté
  const eye = grappleEye(_grB), d = _grA.subVectors(GR.to, eye), dist = d.length();
  GR.spd = Math.min(GRAP.speed, GR.spd + (GRAP.speed / GRAP.ramp) * dt);
  d.divideScalar(dist || 1);
  const side = _grC.set(-d.z, 0, d.x).normalize(), cp = Math.cos(e.yaw), sp = Math.sin(e.yaw), sx = (I.mx || 0) * cp, sz = -(I.mx || 0) * sp;
  const lat = (sx * side.x + sz * side.z) * GRAP.side;
  e.vel.x = d.x * GR.spd + side.x * lat; e.vel.z = d.z * GR.spd + side.z * lat; e.vy = d.y * GR.spd + 19 * dt; e.onGround = false;
  I.jump = false; I.sprint = false;
  PL.fovK = Math.max(PL.fovK || 0, 3.5);
  // arrivée : la détente qui hisse au-dessus du bord, vers le point où se poser
  const feetToTop = GR.clear - e.pos.y;
  if (dist < GRAP.snap || (feetToTop < 0.6 && Math.hypot(GR.land.x - e.pos.x, GR.land.z - e.pos.z) < 1.6)) {
    const up = Math.max(0.45, feetToTop + 0.4), dx = GR.land.x - e.pos.x, dz = GR.land.z - e.pos.z, l = Math.hypot(dx, dz) || 1;
    e.vy = Math.sqrt(2 * 19 * up); e.vel.x = (dx / l) * 3.6; e.vel.z = (dz / l) * 3.6;
    GR.st = null; if (GR.rope) GR.rope.visible = false; if (GR.hook) GR.hook.visible = false;
    sfxGrapple('vault', e.pos); VM.vland -= 0.5; PL.vpP -= 0.35;
    return true;
  }
  // coincé (rien ne rapproche plus du point), ou trop long : le câble lâche
  if (dist < GR.best - 0.3) { GR.best = dist; GR.bestT = GR.t; } else if (GR.t - GR.bestT > GRAP.stuck || GR.t > GRAP.maxT) grappleRelease(false);
  return true;
}
/* Câble et crochet de la vue (après la caméra) ; câbles des autres joueurs */
function grappleDraw() {
  if (!GR.rope) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.5, metalness: 0.6 });
    GR.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 5, 1, true), mat); GR.rope.visible = false; GR.rope.frustumCulled = false; scene.add(GR.rope);
    GR.hook = grappleHookMesh(); GR.hook.visible = false; scene.add(GR.hook);
  }
  const on = !!GR.st && PL.ent.alive;
  GR.rope.visible = on; GR.hook.visible = on;
  if (on) {
    const a = grappleHand(_grC), b = GR.st === 'fly' ? _grD.copy(a).lerp(GR.a, clamp((GR.t * GRAP.hook) / Math.max(GR.flyD, 0.1), 0, 1)) : _grD.copy(GR.a);
    grappleSeg(GR.rope, a, b); GR.hook.position.copy(b); GR.hook.lookAt(a);
  }
  for (const [e, r] of GR.remote) { if (!e.net || !e.net.gr || !e.alive || MATCH.time - (e.net.grT || 0) > 0.4) { r.visible = false; continue; } r.visible = true; grappleSeg(r, _grC.set(e.pos.x, e.pos.y + 1.35, e.pos.z), _grD.fromArray(e.net.gr)); }
}
function grappleSeg(m, a, b) { const d = a.distanceTo(b); m.scale.set(1, Math.max(d, 0.01), 1); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, _grB.subVectors(b, a).normalize()); }
function grappleHookMesh() {
  const g = new THREE.Group(), M = gunMaterials();
  cz(g, M.dark, 0, 0, 0, 0.02, 0.09);
  for (let i = 0; i < 3; i++) { const p = new THREE.Group(); p.rotation.z = i * 2.094; rb(p, M.metal, 0, 0.03, 0.05, 0.012, 0.05, 0.012, 0.003, -0.6); g.add(p); }
  return g;
}
/* Réseau : le point d'accroche publié tant que le câble tire (netPresence) ; reçu (netApply), le câble d'un joueur distant */
function grapplePub() { return GR.st ? [+GR.a.x.toFixed(2), +GR.a.y.toFixed(2), +GR.a.z.toFixed(2)] : undefined; }
function grappleNet(e, gr) {
  if (!Array.isArray(gr) || gr.length !== 3 || !e.net) return;
  e.net.gr = gr.map((v) => clamp(+v || 0, -300, 300)); e.net.grT = MATCH.time;
  if (!GR.remote.has(e)) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1, true), new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.5, metalness: 0.6 })); r.frustumCulled = false; scene.add(r); GR.remote.set(e, r); }
}
/* Nouvelle partie, mort, sortie : câble rangé, charges pleines */
function grappleReset() { GR.st = null; GR.charges = GRAP.charges; GR.cd = 0; if (GR.rope) GR.rope.visible = false; if (GR.hook) GR.hook.visible = false; for (const r of GR.remote.values()) scene.remove(r); GR.remote.clear(); }
/* HUD : la touche puis une encoche par charge (pleine : prête) */
function grappleHud() { return `<span class="grap">${actGlyph('grapple')}${Array.from({ length: GRAP.charges }, (x, i) => `<b class="${i < GR.charges ? '' : 'off'}"></b>`).join('')}</span>`; }
/* Visée valable sous le réticule (le réticule le montre), relevée 10 fois par seconde */
function grappleAimTick(dt) {
  if ((GR.aimT -= dt) > 0) return GR.aimOk;
  GR.aimT = 0.1;
  const e = PL.ent; GR.aimOk = !GR.st && GR.charges > 0 && e.alive && !!grappleAim(grappleEye(_grC), camFwd(_grB), e.pos.y);
  return GR.aimOk;
}
function sfxGrapple(kind, p) {
  if (!AU.ready) return;
  const t = AU.ctx.currentTime, o = kind === 'hit' ? auOut(p, 0.1, 0.9, 1, 4) : uiOut(0.7);
  if (kind === 'fire') { nz(o, t, 0.05, 'bandpass', 1500, 900, 1, 0.5, 0.001); tn(o, t, 0.12, 220, 90, 'sine', 0.5, 0.002); nz(o, t + 0.02, 0.3, 'bandpass', 3200, 1800, 2, 0.18, 0.01); }
  else if (kind === 'hit') { nz(o, t, 0.02, 'highpass', 2600, 2600, 0.8, 0.6, 0.0005); tn(o, t, 0.08, 1400, 700, 'triangle', 0.25, 0.001); }
  else if (kind === 'vault') { nz(o, t, 0.12, 'lowpass', 1200, 300, 0.8, 0.35, 0.005); }
  else { nz(o, t, 0.06, 'bandpass', 2000, 1200, 1.2, 0.2, 0.002); }
}
