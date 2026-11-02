/* ==========================================================================
   UNITÉS POSÉES (Breachline) : ce qu'un joueur dépose et qui agit seul (tourelle, chien robot), avec une interface commune
   Une unité : { kind, owner, team, pos, yaw, hp, hpMax, r (rayon de touche), h (hauteur du centre de touche), state, local, uid, ... }.
   Le propriétaire la simule (sa machine, l'hôte pour un bot) ; les autres pairs en montrent une copie tenue à jour par l'état publié du
   propriétaire (p.u, netPresence), créée au premier état reçu (un joueur qui arrive en cours de partie la voit). Les coups des autres lui
   parviennent par 'uh' ; sa fin par 'ux'.
   - rayUnits(shooter, o, d, maxT) : la première unité ennemie touchée par un rayon ({ u, t }) ; unitDamage(u, dmg, by, type) : dégâts
   - unitsBlast(p, r, dmg, owner) : souffle (explode) ; updateUnits(dt) : une image ; clearUnits() : fin de partie
   Chaque type déclare ses fonctions dans UNIT_KINDS[kind] : { make(u), tick(u, dt), remote(u, dt), die(u), pub(u), net(u, a), dmgK(type) }.
   ========================================================================== */
const UNITS = [];
const UNIT_KINDS = {};
const _unA = new V3(), _unB = new V3();
let UNIT_UID = 1;
/* Pose d'une unité chez son propriétaire (o : champs propres au type) */
function unitSpawn(kind, owner, pos, yaw, o = {}) {
  const K = UNIT_KINDS[kind]; if (!K) return null;
  const u = Object.assign({ kind, owner, team: owner.team, pos: pos.clone(), yaw, hp: K.hp, hpMax: K.hp, r: K.r, h: K.h, state: 'deploy', t: 0, local: !owner.isRemote, uid: UNIT_UID++, last: 0, dead: false, mesh: null, by: null }, o);
  K.make(u);
  UNITS.push(u);
  return u;
}
function unitsOf(owner, kind) { return UNITS.filter((u) => u.owner === owner && (!kind || u.kind === kind) && !u.dead); }
/* Rayon contre les unités ennemies du tireur (sphère de touche au centre de l'unité) */
function rayUnits(shooter, o, d, maxT) {
  let best = maxT, hit = null;
  for (const u of UNITS) {
    if (u.dead || (shooter && (u.owner === shooter || allied(u.owner, shooter)))) continue;
    const cx = u.pos.x - o.x, cy = u.pos.y + u.h - o.y, cz = u.pos.z - o.z, b = cx * d.x + cy * d.y + cz * d.z;
    if (b < 0) continue;
    const q = cx * cx + cy * cy + cz * cz - b * b; if (q > u.r * u.r) continue;
    const t = b - Math.sqrt(u.r * u.r - q); if (t < best) { best = t; hit = u; }
  }
  return hit ? { u: hit, t: best } : null;
}
/* Dégâts : le propriétaire décompte ; un autre pair annonce le coup au propriétaire */
function unitDamage(u, dmg, by, type = 'bullet') {
  if (u.dead || !(dmg > 0)) return;
  const K = UNIT_KINDS[u.kind]; if (type !== 'raw' && K.dmgK) dmg *= K.dmgK(type); // raw : déjà pesé par le pair qui l'annonce
  if (!u.local) { if (MATCH.online && by && (by === PL.ent || by.netBot)) netEvent({ k: 'uh', to: netIdOf(u.owner), u: u.uid, d: Math.round(dmg) }, by); return; }
  u.hp -= dmg; u.last = MATCH.time; u.lastType = type; if (by) u.by = by;
  if (u.hp <= 0) unitKill(u);
}
function unitKill(u) {
  if (u.dead) return;
  u.dead = true; u.state = 'dead';
  UNIT_KINDS[u.kind].die(u);
  if (u.local && MATCH.online && (u.owner === PL.ent || u.owner.netBot)) netEvent({ k: 'ux', u: u.uid }, u.owner);
}
/* Souffle d'une explosion : chez le propriétaire de chaque unité seulement (les autres pairs rejouent l'explosion pour les effets) */
function unitsBlast(p, r, maxDmg, owner) {
  for (const u of UNITS) {
    if (u.dead || !u.local || (owner && owner !== u.owner && allied(owner, u.owner))) continue;
    const d = Math.max(0, _unA.set(u.pos.x, u.pos.y + u.h, u.pos.z).distanceTo(p) - u.r);
    if (d < r) unitDamage(u, maxDmg * Math.pow(1 - d / r, 0.9), owner, 'blast');
  }
}
function updateUnits(dt) {
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const u = UNITS[i], K = UNIT_KINDS[u.kind];
    u.t += dt;
    if (u.gone) { if (u.mesh) scene.remove(u.mesh); UNITS.splice(i, 1); continue; }
    if (u.local) K.tick(u, dt); else K.remote(u, dt);
  }
  if (MATCH.online) unitsNetGone();
  unitsBotsTick(dt);
}
/* Les bots et les unités ennemies : un bot qui n'a pas de soldat en vue tire sur l'unité ennemie qu'il voit (tourelle et chien à moins de
   30 m ; une mine, s'il la remarque, à moins de 9 m : sa diode la trahit), avec son arme, au rythme d'une rafale. Bots de cette machine seulement */
const UNIT_SEEN = { turret: 30, dog: 28, mine: 9, claymore: 9 };
function unitsBotsTick(dt) {
  if (!UNITS.length) return;
  for (const b of entities) {
    if (b.isPlayer || !b.alive || b.isRemote || (MATCH.online && !b.netBot) || b.inMecha || !b.model) continue;
    if (b.visible && b.target && b.target.alive) { b.uTgt = null; continue; } // un soldat en vue passe avant
    if ((b.uT -= dt) > 0) continue;
    const eye = entEye(b, _unA);
    let u = b.uTgt;
    if (!u || u.dead || u.pos.distanceTo(b.pos) > (UNIT_SEEN[u.kind] || 20) || !lineClear(eye, _unB.set(u.pos.x, u.pos.y + u.h, u.pos.z))) {
      u = null; let bd = 1e9;
      for (const x of UNITS) {
        if (x.dead || x.owner === b || allied(x.owner, b) || x.state === 'deploy') continue;
        const d = x.pos.distanceTo(b.pos), mine = x.kind === 'mine' || x.kind === 'claymore';
        if (d > (UNIT_SEEN[x.kind] || 20) || d > bd || (mine && Math.random() > 0.35)) continue;
        if (lineClear(eye, _unB.set(x.pos.x, x.pos.y + x.h, x.pos.z))) { u = x; bd = d; }
      }
    }
    if (u && u !== b.uTgt) { b.uTgt = u; b.uT = 0.5; continue; } // le temps de la remarquer et de viser
    b.uTgt = u;
    if (!u) { b.uT = 0.4; continue; }
    const w = armsW(b), def = w.def; if (w.mag <= 0 || def.rocket) { b.uT = 0.6; continue; }
    const c = _unB.set(u.pos.x, u.pos.y + u.h, u.pos.z), dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z;
    b.yaw = Math.atan2(-dx, -dz); b.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const muzzle = b.model.gun.localToWorld(b.model.muzzleLocal.clone()), dir = coneDir(c.clone().sub(eye).normalize(), 0.02);
    w.mag--; fireRay(b, eye.clone(), dir, def, muzzle, Math.random() < 0.6, b.dmgMul || 1);
    muzzleWorldFx(muzzle, dir, def.silent, def.feel ? def.feel.flash : 1); sfxGun(def.sound, muzzle, b); b.recoil = 0.05; b.lastShotT = MATCH.time;
    b.uT = (60 / def.rpm) * (def.auto ? 2.6 : 1.4); // des rafales courtes, pas le plein débit
  }
}
function clearUnits() { for (const u of UNITS) { if (u.mesh) scene.remove(u.mesh); if (UNIT_KINDS[u.kind].free) UNIT_KINDS[u.kind].free(u); } UNITS.length = 0; }

/* ---------- Réseau ---------- */
/* État publié par le propriétaire : [uid, type, x, y, z, yaw, ...propre au type] pour chacune de ses unités vivantes */
function unitsPub(owner) {
  const out = [];
  for (const u of UNITS) if (u.owner === owner && u.local && !u.dead && u.state !== 'gone') out.push([u.uid, u.kind, +u.pos.x.toFixed(2), +u.pos.y.toFixed(2), +u.pos.z.toFixed(2), +u.yaw.toFixed(2), ...UNIT_KINDS[u.kind].pub(u)]);
  return out.length ? out : undefined;
}
/* Chez les autres pairs : chaque unité publiée est créée au premier état reçu, puis suivie ; celle qui n'est plus publiée part au bout de 1,5 s */
function unitsNet(owner, list) {
  if (!Array.isArray(list)) return;
  for (const a of list.slice(0, 8)) {
    if (!Array.isArray(a) || typeof a[1] !== 'string' || !UNIT_KINDS[a[1]]) continue;
    const uid = a[0] | 0, pos = _unB.set(clamp(+a[2] || 0, -300, 300), clamp(+a[3] || 0, -20, 80), clamp(+a[4] || 0, -300, 300));
    let u = UNITS.find((x) => x.owner === owner && x.uid === uid && !x.local);
    if (!u) { u = unitSpawn(a[1], owner, pos, +a[5] || 0, { uid, local: false }); if (!u) continue; u.state = 'live'; }
    if (u.dead) continue;
    u.seen = MATCH.time; u.npos = (u.npos || new V3()).copy(pos); u.nyaw = +a[5] || 0;
    UNIT_KINDS[u.kind].net(u, a.slice(6));
  }
}
function unitsNetGone() { for (const u of UNITS) if (!u.local && !u.dead && u.seen !== undefined && MATCH.time - u.seen > 1.5) { u.dead = true; UNIT_KINDS[u.kind].die(u, true); } }
function unitsNetIn(e, ev) {
  if (ev.k === 'uh') { if (netLocal(ev.to)) { const u = UNITS.find((x) => x.uid === (ev.u | 0) && x.local); if (u) unitDamage(u, clamp(+ev.d || 0, 0, 500), e, 'raw'); } }
  else if (ev.k === 'ux') { const u = UNITS.find((x) => x.owner === e && x.uid === (ev.u | 0) && !x.local); if (u) unitKill(u); }
}
