/* ==========================================================================
   LES MORTS (Breachline, survie : 09ia-survie.js) : des soldats de la liste des entités (entities), du camp 2, que les balles, les grenades,
   la tourelle, le chien, les mines et les roquettes touchent comme n'importe quel ennemi (mêmes zones de touche, tête comprise, même ragdoll
   à la mort). Ce qui change : leur corps (tenues civiles déchirées, visage gris, sans équipement : SKINS.z*), leur démarche, et leur tête.
   Cinq sortes (ZKIND) :
     shambler   le plus courant : lent, une jambe qui traîne, les bras tendus devant lui ; dangereux en nombre ;
     runner     un infecté rapide qui fonce et frappe vite ;
     crawler    un corps brisé qui rampe, bas sur le sol : on le voit tard ;
     brute      grand, lourd, il encaisse ; il charge les derniers mètres et défonce les barricades ;
     screamer   rare : quand il voit un vivant, il hurle ; les morts à 40 m accourent, et quelques autres sortent du bois.
   Ce qu'ils font : sans proie, ils errent et marchent vers la maison (là où vivent les vivants) ; ils repèrent un vivant à la vue (26 m la
   nuit, 7 m à l'odeur, sans ligne de vue), entendent les tirs (55 m, 15 m pour une arme silencieuse) et les explosions (90 m), et vont voir ;
   ils suivent le réseau des bots (findPath), s'écartent les uns des autres (ils se répartissent autour de leur proie) et frappent au
   contact. Quand le chemin vers leur proie est fermé (une porte clouée, des meubles poussés), ils vont à l'ouverture la plus proche
   (survOpenings, 08m-barricades.js) et arrachent les planches une à une ; une fenêtre ouverte, ils l'enjambent. Une balle les fait
   tressaillir, un gros coup les fait chanceler, une explosion les renverse (ragdoll s'ils en meurent).
   Coût : la simulation et l'animation tournent chez l'hôte (en solo : ici) ; au-delà de 40 m de tout vivant, un mort ne repasse son
   chemin que toutes les 3 s et n'anime que son tronc à mi-cadence. ZOMBIE.max morts debout à la fois ; la réserve (ZOMBIES) est créée au
   départ de la partie et réutilisée (pas de corps construit en pleine vague).
   Réseau : 09ia-survie.js (l'hôte publie positions, sortes et états ; les invités annoncent leurs touches).
   ========================================================================== */
const ZKIND = {
  shambler: { hp: 100, spd: [0.95, 1.45], dmg: 20, rate: 1.35, reach: 1.25, barr: 1, k: 1, score: 60, skins: ['zfarmer', 'zcivil', 'zworker'], lean: 0.3 },
  runner: { hp: 70, spd: [4.6, 5.4], dmg: 13, rate: 0.75, reach: 1.2, barr: 0.8, k: 0.98, score: 90, skins: ['zcivil', 'zworker'], lean: 0.5 },
  crawler: { hp: 55, spd: [0.65, 0.95], dmg: 11, rate: 1.0, reach: 1.05, barr: 0.4, k: 1, score: 70, skins: ['zfarmer', 'zcivil'], lean: 1.35, low: true },
  brute: { hp: 460, spd: [1.35, 1.65], charge: 3.6, dmg: 38, rate: 1.9, reach: 1.6, barr: 3.5, k: 1.06, score: 250, skins: ['zworker'], lean: 0.22 },
  screamer: { hp: 85, spd: [2.0, 2.4], dmg: 10, rate: 1.1, reach: 1.2, barr: 0.5, k: 0.95, score: 150, skins: ['zcivil'], lean: 0.35, scream: true },
};
const ZOMBIE = { max: 24, pool: 30, sight: 26, smell: 7, hear: 55, hearQuiet: 15, boom: 90, scream: 40, sep: 0.62, r: 0.32, far: 40, stuck: 2.2 };
const ZOMBIES = [];
const _zA = new V3(), _zB = new V3(), _zC = new V3(), _zD = new V3(), _zE = new V3(), _zQ = new THREE.Quaternion(), _zQ2 = new THREE.Quaternion(), _zEu = new THREE.Euler();
const ZL = []; for (let i = 0; i < 15; i++) ZL.push(new V3()); // articulations en repère local (x à droite, y en haut, -z devant)

/* Tenues des morts : vêtements civils (motif de toile délavée), visage, sans gilet ni bandes de reconnaissance */
const ZGEAR = { vest: '#3a3630', pouch: '#3a3630', helm: '#3a3630', glove: '#8e9684', boot: '#3b342c', sole: '#221f1b', belt: '#3f3a33', poly: '#2e2b27', cup: '#3f3a33', knee: '#3f3a33', knit: '#8e9684', mask: '#5a5a52', lens: '#0c0e10', patch: '#2e2b27', symc: '#8e9684' };
const ZPARTS = { face: true, glasses: false, vest: false, tags: false, patch: false };
/* Toile unie un peu salie (pas de motif de camouflage : des vêtements), quelques taches de sang séché et de terre */
const zCloth = (base, soft) => ({ style: 'poly', base, soft, mid: ['#3a1612', '#4a2a1a', '#2a2420'], n: [5, 4, 3], branch: [], hi: base });
SKINS.zfarmer = { name: 'zfarmer', role: '', seed: 141, sym: 'L', parts: ZPARTS, gear: ZGEAR, tone: [[0.7, 0.76, 0.68], [0.7, 0.76, 0.68]], camo: zCloth('#3d4b63', ['#44526b', '#38445a']) }; // salopette de toile bleue
SKINS.zcivil = { name: 'zcivil', role: '', seed: 557, sym: 'L', parts: ZPARTS, gear: ZGEAR, tone: [[0.7, 0.76, 0.68], [0.7, 0.76, 0.68]], camo: zCloth('#6b645a', ['#736b60', '#625c52']) }; // chemise et pantalon gris-brun
SKINS.zworker = { name: 'zworker', role: '', seed: 883, sym: 'L', parts: ZPARTS, gear: ZGEAR, tone: [[0.7, 0.76, 0.68], [0.7, 0.76, 0.68]], camo: zCloth('#7a5a36', ['#82613b', '#6f5231']) }; // bleu de travail délavé, roux
const ZSKINS = ['zfarmer', 'zcivil', 'zworker'];
/* Une fois par partie de survie : les géométries des tenues des morts (pas de corps construit en pleine vague) */
function zombiePrebuild() { for (const s of ZSKINS) { soldierGeometry(s, 'hi'); soldierGeometry(s, 'lo'); soldierMaterial(s, 1); } }

/* ---------- Réserve ---------- */
function zombieMake() {
  const z = {
    id: entities.length, name: _t('Mort'), team: 2, isPlayer: false, isZombie: true, pos: new V3(), vel: new V3(), vy: 0, yaw: 0, pitch: 0,
    alive: false, off: true, health: 0, crouch: false, crouchAmt: 0, kills: 0, deaths: 0, score: 0, assists: 0, streak: 0, lastShotT: -9, protT: 0,
    dmgBy: new Map(), lastForce: null, aw: new Map(), respawnT: Infinity, onGround: true, eyeH: 1.5, spawnAt: 0, skin: 'zfarmer', weapon: ZWEAPON, mag: 0,
    zk: 'shambler', zs: 'wander', zt: 0, zTgt: null, zGoal: new V3(), zPath: null, zPathI: 0, zRepT: 0, zAtkT: 0, zAtk: 0, zStag: 0, zFlinch: 0, zOp: null, zClimb: 0,
    zSpd: 1, zPh: 0, zSeed: 0, zProg: new V3(), zProgT: 0, zHeard: null, zHeardT: -99, zScream: false, zFar: false, zAnimT: 0, zNet: null, zHeadOff: false, zLimb: 0,
  };
  z.model = makeSoldier('zfarmer', 1, null); z.model.root.visible = false;
  entities.push(z); ZOMBIES.push(z);
  return z;
}
/* Arme d'un mort (pour les champs que les autres systèmes lisent) */
const ZWEAPON = { id: 'zombie', key: null, name: 'Morsure', cat: 'melee', fam: 'melee', ai: {}, mag: 0, reserve: 0, loud: false, silent: true, rpm: 60 };
function zombiePoolReady() { zombiePrebuild(); while (ZOMBIES.length < ZOMBIE.pool) zombieMake(); }
/* Fin de la partie de survie : la réserve quitte la liste des entités (les autres modes ne voient jamais de morts) */
function zombiePoolClear() {
  for (const z of ZOMBIES) { if (z.model) { z.model.rag = null; scene.remove(z.model.root); } const i = entities.indexOf(z); if (i >= 0) entities.splice(i, 1); }
  ZOMBIES.length = 0;
  entities.forEach((e, i) => { e.id = i; });
}
const zombiesUp = () => ZOMBIES.filter((z) => z.alive);
/* Un mort sort de la réserve : sorte, tenue, points de vie, place et cap */
function zombieSpawn(kind, x, z, yaw, mul = {}) {
  const e = ZOMBIES.find((q) => q.off && q.respawnT === Infinity); if (!e) return null;
  const K = ZKIND[kind] || ZKIND.shambler, R = Math.random;
  e.zk = kind; e.off = false; e.alive = true; e.health = K.hp * (mul.hp || 1); e.maxHp = e.health; e.zDmg = K.dmg * (mul.dmg || 1);
  e.zSpd = lerp(K.spd[0], K.spd[1], R()) * (mul.spd || 1); e.zPh = R(); e.zSeed = R(); e.zScream = false; e.zLimb = R() < 0.5 ? 1 : -1;
  e.pos.set(x, groundHeight(x, z, 2, 0.3), z); e.vel.set(0, 0, 0); e.vy = 0; e.yaw = yaw; e.spawnAt = MATCH.time;
  e.zs = 'wander'; e.zt = 0; e.zTgt = null; e.zPath = null; e.zRepT = R() * 0.5; e.zAtkT = 0; e.zAtk = 0; e.zStag = 0; e.zFlinch = 0; e.zOp = null; e.zClimb = 0; e.zHeard = null;
  e.zProg.copy(e.pos); e.zProgT = 0; e.dmgBy.clear(); e.lastForce = null; e.respawnT = 0; e.zHeadOff = false;
  const skin = K.skins[Math.floor(R() * K.skins.length)]; e.skin = skin; soldierLook(e.model, skin, 1);
  e.model.root.scale.setScalar(1); e.model.rag = null; e.model.sink = 0; e.model.root.visible = true; e.model.cyc = undefined;
  zombiePose(e, 0); layoutSoldier(e.model, true);
  return e;
}
/* Retour à la réserve (corps enfoncé dans le sol, ou fin de vague) */
function zombieStow(e) { e.alive = false; e.off = true; e.respawnT = Infinity; e.model.rag = null; e.model.root.visible = false; e.zTgt = null; e.zPath = null; }

/* ---------- Boucle (chez l'hôte et en solo) ---------- */
function zombieTick(e, dt, now) {
  if (e.off) return;
  if (!e.alive) {
    // à terre : ragdoll, puis le corps s'enfonce et rejoint la réserve
    e.respawnT -= dt; animSoldier(e, dt);
    if (e.respawnT <= 0 || !Number.isFinite(e.model.J[0].x + e.model.J[0].y)) zombieStow(e); // (un corps dont le ragdoll part à l'infini est rangé)
    return;
  }
  if (e.zNet) { zombieRemote(e, dt); return; }
  const K = ZKIND[e.zk];
  e.zt += dt; e.zAtkT -= dt; e.zStag = Math.max(0, e.zStag - dt); e.zFlinch = damp(e.zFlinch, 0, 6, dt);
  const near = zombieNearest(e);
  e.zFar = !near || near.d > ZOMBIE.far;
  zombieSense(e, near, now);
  // grimpe par une fenêtre ouverte : un pas scripté de l'ancre du dehors à celle du dedans
  if (e.zClimb > 0) { zombieClimbStep(e, dt); zombieAnimate(e, dt); return; }
  let speed = e.zSpd * (e.zStag > 0 ? 0.15 : 1);
  let goal = null, face = null;
  const T = e.zTgt;
  if (T && T.alive) {
    const tp = T.pos, d = hyp(tp.x - e.pos.x, tp.z - e.pos.z), dy = Math.abs(tp.y - e.pos.y);
    if (K.charge && d < 9) speed = Math.max(speed, K.charge * (e.zStag > 0 ? 0.2 : 1));
    if (K.scream && !e.zScream && d < 30) zombieScream(e);
    if (d < K.reach && dy < 1.3 && lineClear(_zA.set(e.pos.x, e.pos.y + 1.1, e.pos.z), _zB.set(tp.x, tp.y + 1.0, tp.z))) { // au contact : il frappe
      face = tp; speed = 0;
      if (e.zAtkT <= 0 && e.zStag <= 0) { e.zAtkT = K.rate; e.zAtk = 1; zombieHit(e, T); }
    } else goal = zombieRoute(e, tp, dt);
  } else {
    // sans proie : vers ce qu'il a entendu, sinon vers la maison (ou une ouverture), en errant un peu
    goal = e.zHeard && now - e.zHeardT < 20 ? zombieRoute(e, e.zHeard, dt) : zombieRoute(e, survHomeOf(e), dt);
    speed *= 0.75;
  }
  if (e.zOp && e.zs === 'breach') { // à l'ouverture fermée : il arrache les planches
    face = survOpenFace(e.zOp, _zC); speed = 0;
    if (e.zAtkT <= 0 && e.zStag <= 0) { e.zAtkT = K.rate * 0.9; e.zAtk = 1; survOpenHit(e.zOp, e.zDmg * K.barr * 2.4, e); }
    if (survOpenClear(e.zOp)) { if (e.zOp.kind === 'fenetre') zombieClimbStart(e, e.zOp); e.zs = 'hunt'; e.zOp = null; }
  }
  zombieSteer(e, goal, face, speed, dt);
  zombieMove(e, dt);
  zombieAnimate(e, dt);
}
/* Vivant le plus proche (joueurs et compagnons) */
function zombieNearest(e) {
  // (un survivant à terre n'attire les morts que s'il ne reste que lui)
  let best = null, bd = 1e9; const up = entities.some((p) => p.alive && !p.isZombie && !p.off && !p.downed && p.team !== 2);
  for (const p of entities) { if (!p.alive || p.isZombie || p.off || p.team === 2 || (p.downed && up)) continue; const d = hyp(p.pos.x - e.pos.x, p.pos.z - e.pos.z) + Math.abs(p.pos.y - e.pos.y) * 2; if (d < bd) { bd = d; best = p; } }
  return best ? { e: best, d: bd } : null;
}
/* Perception : vue (champ large, la nuit), odeur, bruits ; la proie gardée tant qu'elle n'est pas perdue depuis 6 s */
function zombieSense(e, near, now) {
  if ((e.zSenseT = (e.zSenseT || 0) - 1) > 0) return; e.zSenseT = e.zFar ? 20 : 6; // une fois toutes les quelques images
  if (near) {
    const p = near.e, d = near.d, eye = _zA.set(e.pos.x, e.pos.y + (ZKIND[e.zk].low ? 0.5 : 1.55), e.pos.z);
    const see = d < ZOMBIE.smell || (d < ZOMBIE.sight && lineClear(eye, entChest(p, _zB)));
    if (see) { if (e.zTgt !== p) zombieGroan(e, 'spot'); e.zTgt = p; e.zLostT = now; e.zs = e.zs === 'wander' ? 'hunt' : e.zs; }
    else if (e.zTgt && now - (e.zLostT || 0) > 6) e.zTgt = null;
  }
  // bruits : le dernier tir ou la dernière explosion à portée
  for (let i = soundEvents.length - 1; i >= Math.max(0, soundEvents.length - 6); i--) {
    const s = soundEvents[i]; if (now - s.t > 1.2 || s.team === 2) continue;
    const r = s.loud && !s.who ? ZOMBIE.boom : s.quiet ? ZOMBIE.hearQuiet : s.loud ? ZOMBIE.boom : ZOMBIE.hear, d = s.pos.distanceTo(e.pos);
    if (d < r) { e.zHeard = (e.zHeard || new V3()).copy(s.pos); e.zHeardT = now; break; }
  }
}
/* Route vers g : le réseau des bots ; si le chemin est fermé (barricade, meubles), l'ouverture la plus proche (on la casse ou on l'enjambe) */
function zombieRoute(e, g, dt) {
  e.zRepT -= dt;
  if (e.zRepT <= 0) { // (sans chemin trouvé, on attend aussi la prochaine recherche : un chemin introuvable cherché à chaque image coûtait tout)
    e.zRepT = (e.zFar ? 3 : rand(0.9, 1.6));
    e.zPath = NAV.nx ? findPath(e.pos, g) : null; e.zPathI = 1; e.zOp = null; e.zs = e.zTgt ? 'hunt' : 'wander';
    if (!e.zPath && NAV.nx) {
      // chemin fermé : une ouverture du bâtiment où se trouve la proie, la plus proche de lui
      const op = survOpenFor(e, g);
      if (op) {
        const a = survOpenAnchor(op, 'out', _zD);
        if (hyp(a.x - e.pos.x, a.z - e.pos.z) < 0.7) { e.zs = 'breach'; e.zOp = op; e.zPath = null; return null; }
        e.zPath = findPath(e.pos, a); e.zPathI = 1; e.zOp = op; e.zs = 'toOpen';
        if (survOpenClear(op) && op.kind !== 'fenetre') e.zs = 'hunt';
      }
    }
  }
  if (e.zs === 'toOpen' && e.zOp) {
    const a = survOpenAnchor(e.zOp, 'out', _zD);
    if (hyp(a.x - e.pos.x, a.z - e.pos.z) < 0.6) { e.zs = 'breach'; e.zPath = null; return null; }
  }
  const P = e.zPath;
  if (P && P.length > 1) {
    while (e.zPathI < P.length - 1 && hyp(P[e.zPathI].x - e.pos.x, P[e.zPathI].z - e.pos.z) < 0.6) e.zPathI++;
    const n = P[Math.min(e.zPathI, P.length - 1)]; return _zE.set(n.x, n.y, n.z);
  }
  return e.zs === 'toOpen' && e.zOp ? survOpenAnchor(e.zOp, 'out', _zE) : _zE.copy(g);
}
/* Direction voulue, cap, et séparation : les morts s'écartent les uns des autres (ils se répartissent autour de la proie) */
function zombieSteer(e, goal, face, speed, dt) {
  let dx = 0, dz = 0;
  if (goal) { dx = goal.x - e.pos.x; dz = goal.z - e.pos.z; const l = hyp(dx, dz); if (l > 0.05) { dx /= l; dz /= l; } else dx = dz = 0; }
  // séparation (au plus 12 voisins regardés)
  let sx = 0, sz = 0, n = 0;
  for (const o of ZOMBIES) {
    if (o === e || !o.alive || n > 12) continue;
    const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d2 = ox * ox + oz * oz;
    if (d2 < ZOMBIE.sep * ZOMBIE.sep && d2 > 1e-6 && Math.abs(o.pos.y - e.pos.y) < 1) { const d = Math.sqrt(d2), k = (ZOMBIE.sep - d) / ZOMBIE.sep; sx += (ox / d) * k; sz += (oz / d) * k; n++; }
  }
  const wx = dx * speed + sx * 2.2, wz = dz * speed + sz * 2.2;
  e.vel.x = damp(e.vel.x, wx, e.zk === 'runner' ? 6 : 4, dt); e.vel.z = damp(e.vel.z, wz, e.zk === 'runner' ? 6 : 4, dt);
  const look = face ? Math.atan2(-(face.x - e.pos.x), -(face.z - e.pos.z)) : hyp(e.vel.x, e.vel.z) > 0.2 ? Math.atan2(-e.vel.x, -e.vel.z) : e.yaw;
  e.yaw += Math.atan2(Math.sin(look - e.yaw), Math.cos(look - e.yaw)) * (1 - Math.exp(-dt * (e.zk === 'runner' ? 9 : 4)));
}
/* Déplacement : collisions du décor par pas de 25 cm (comme les soldats), sol, gravité ; coincé : nouveau chemin et un écart de côté */
function zombieMove(e, dt) {
  const mx = e.vel.x * dt, mz = e.vel.z * dt, n = Math.min(6, Math.max(1, Math.ceil(hyp(mx, mz) / 0.25))), h = ZKIND[e.zk].low ? 0.9 : 1.75;
  for (let k = 0; k < n; k++) { e.pos.x += mx / n; e.pos.z += mz / n; collideCircle(e.pos, ZOMBIE.r, h); }
  e.vy -= 19 * dt; e.pos.y += e.vy * dt;
  const g = groundHeight(e.pos.x, e.pos.z, e.pos.y + 0.1, 0.25);
  if (e.pos.y <= g) { e.pos.y = g; e.vy = 0; e.onGround = true; } else if (e.pos.y - g < STEP + 0.05 && e.vy <= 0) { e.pos.y = g; e.vy = 0; e.onGround = true; } else e.onGround = false;
  if ((e.zProgT += dt) > ZOMBIE.stuck) {
    if (e.zs !== 'breach' && e.zs !== 'wander' && e.zProg.distanceTo(e.pos) < 0.5 && hyp(e.vel.x, e.vel.z) > 0.1) { e.zRepT = 0; e.vel.x += rand(-2, 2); e.vel.z += rand(-2, 2); }
    e.zProgT = 0; e.zProg.copy(e.pos);
  }
}
/* Coup : sur un vivant à portée (dégâts pesés par la difficulté de la survie) */
function zombieHit(e, T) {
  const dir = _zA.set(T.pos.x - e.pos.x, 0.2, T.pos.z - e.pos.z).normalize();
  zombieGroan(e, 'attack');
  if (T.isRemote) survBiteRemote(e, T, e.zDmg, dir); // (un joueur distant applique le coup chez lui, 09ia-survie.js)
  else applyDamage(T, e.zDmg, e, 'Zombie', false, dir.clone(), e.pos.clone());
  sfxZombieHit(T.pos);
}
/* Le hurleur : il appelle les morts à 40 m vers sa proie, et quelques autres sortent du bois (09ia-survie.js) */
function zombieScream(e) {
  e.zScream = true; e.zStag = Math.max(e.zStag, 1.2); zombieGroan(e, 'scream');
  for (const o of ZOMBIES) if (o.alive && o !== e && o.pos.distanceTo(e.pos) < ZOMBIE.scream) { o.zTgt = e.zTgt; o.zRepT = 0; }
  survScreamCall(e);
}
/* Fenêtre ouverte : enjambée en 1,1 s de l'ancre du dehors à celle du dedans */
function zombieClimbStart(e, op) {
  e.zClimb = 1.1; e.zClimbOp = op; e.zClimbA = survOpenAnchor(op, 'out', new V3()); e.zClimbB = survOpenAnchor(op, 'in', new V3());
  e.yaw = Math.atan2(-(e.zClimbB.x - e.zClimbA.x), -(e.zClimbB.z - e.zClimbA.z)); e.vel.set(0, 0, 0); zombieGroan(e, 'climb');
}
function zombieClimbStep(e, dt) {
  e.zClimb -= dt; const k = smoothstep(0, 1, 1 - e.zClimb / 1.1), op = e.zClimbOp;
  e.pos.lerpVectors(e.zClimbA, e.zClimbB, k); e.pos.y = lerp(e.zClimbA.y, e.zClimbB.y, k) + Math.sin(k * Math.PI) * (op.b0 + 0.1);
  if (e.zClimb <= 0) { e.zClimb = 0; e.pos.copy(e.zClimbB); e.pos.y = groundHeight(e.pos.x, e.pos.z, e.pos.y + 0.3, 0.25); e.zPath = null; e.zRepT = 0; }
}
/* Touché (applyDamage, 09-game.js) : tressaillement ; un gros coup ou une explosion le fait chanceler */
function zombieHurt(e, dmg, head) {
  e.zFlinch = Math.min(1, e.zFlinch + (head ? 0.8 : 0.45));
  if (dmg > 35 || (e.zk !== 'brute' && dmg > 22 && Math.random() < 0.35)) e.zStag = Math.max(e.zStag, e.zk === 'brute' ? 0.35 : rand(0.4, 0.8));
  if (Math.random() < 0.3) zombieGroan(e, 'hurt');
}
/* Mort (killEnt, 09-game.js) : ragdoll dans le sens du coup, corps laissé 5 s, points au tueur */
function zombieDie(e, a, weapon, head, dir) {
  e.alive = false; e.health = 0; e.respawnT = 5; e.zTgt = null; e.zPath = null;
  if (!e.lastForce) e.lastForce = { dir: dir.clone().normalize(), mag: e.zk === 'brute' ? 1.5 : 2.6, lift: 0.8, part: head ? 'head' : 'body' };
  e.model.rag = null;
  if (Math.random() < 0.5) zombieGroan(e, 'die');
  survZombieKilled(e, a, weapon, head);
}

/* ---------- Corps : démarche, bras, tête ---------- */
function zombieAnimate(e, dt) {
  // loin de tout vivant : une image sur deux (le corps se voit à peine dans la brume)
  if (e.zFar && (e.zAnimT = (e.zAnimT || 0) + dt) < 0.066) return;
  const d = e.zFar ? e.zAnimT : dt; e.zAnimT = 0;
  zombiePose(e, d); layoutSoldier(e.model, true);
}
function zombiePose(e, dt) {
  const S = e.model, J = S.J, L = ZL, K = ZKIND[e.zk], k = K.k, v = hyp(e.vel.x, e.vel.z), t = (S.t = (S.t || 0) + dt), low = !!K.low;
  for (let i = 0; i < 15; i++) S.Jp[i].copy(J[i]);
  if (dt > 0) S.pdt = dt;
  S.cyc = 0;
  // pas : la phase avance avec la vitesse (foulée courte et traînante pour le mort qui marche, longue pour celui qui court)
  const stride = e.zk === 'runner' ? 1.25 : e.zk === 'brute' ? 0.8 : low ? 0.5 : 0.55;
  e.zPh += (v / Math.max(0.3, stride)) * dt * 0.5 + (v < 0.1 ? 0 : 0);
  const ph = e.zPh * TAU, mv = clamp(v / 1.2, 0, 1), atk = (e.zAtk = Math.max(0, e.zAtk - dt * 2.2)), fl = e.zFlinch, st = e.zStag > 0 ? 1 : 0;
  const lean = K.lean + fl * -0.25 + st * Math.sin(t * 9) * 0.08 + (e.zClimb > 0 ? 0.5 : 0), sway = Math.sin(t * 1.3 + e.zSeed * 6) * 0.06;
  const pel = low ? 0.34 : (SD.pel - 0.06 - Math.abs(Math.sin(ph)) * 0.03 * mv) * k;
  L[J_PEL].set(sway * 0.3, pel, 0);
  // tronc penché en avant, la tête qui tombe sur le côté
  const tl = SD.trunk * k, ca = Math.cos(lean), sa = Math.sin(lean);
  L[J_CHE].set(sway, pel + tl * ca, -tl * sa);
  const ht = 0.19 * k, hl = lean + 0.15 + Math.sin(t * 0.7 + e.zSeed) * 0.08, tilt = 0.25 * Math.sin(e.zSeed * 9) + st * 0.2;
  L[J_HEAD].set(L[J_CHE].x + Math.sin(tilt) * 0.06, L[J_CHE].y + ht * Math.cos(hl), L[J_CHE].z - ht * Math.sin(hl) - 0.02);
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx), sh = L[b.jSh].set(L[J_CHE].x + sx * SD.shX * k, L[J_CHE].y + SD.shY * k, L[J_CHE].z + SD.shZ);
    // bras : tendus devant (marcheur), qui battent (coureur), qui tirent le corps (rampant) ; le coup : levés, puis abattus
    const ap = ph + (sx > 0 ? 0 : Math.PI);
    if (low) _zA.set(sh.x + sx * 0.12, 0.05, sh.z - 0.42 - Math.max(0, Math.sin(ap)) * 0.25);
    else if (e.zk === 'runner') _zA.set(sh.x + sx * 0.18, sh.y - 0.25 + Math.sin(ap) * 0.15 * mv, sh.z - 0.25 - Math.cos(ap) * 0.35 * mv);
    else _zA.set(sh.x + sx * (0.06 + 0.04 * Math.sin(t * 1.1 + sx)), sh.y - 0.05 + Math.sin(t * 1.7 + sx * 2 + e.zSeed * 4) * 0.06, sh.z - 0.5);
    if (atk > 0) { const a = 1 - atk, up = a < 0.4 ? a / 0.4 : 1 - (a - 0.4) / 0.6; _zA.set(sh.x + sx * 0.08, sh.y + up * 0.35 - (1 - up) * 0.2, sh.z - 0.35 - (1 - up) * 0.25); }
    _zB.copy(sh).add(_zC.set(sx * 0.35, -0.4, 0.05));
    ik2(sh, _zA, SD.ua * k, SD.fa * k, _zB, L[b.jEl], L[b.jHa]);
    // jambes : pieds au sol sur la phase, une jambe qui traîne chez le marcheur
    const hip = L[b.jHi].set(L[J_PEL].x + sx * SD.hipX * k, pel + SD.hipY * k, 0), lp = ph + (sx > 0 ? Math.PI : 0), drag = e.zk === 'shambler' && sx === e.zLimb ? 0.3 : 1;
    if (low) _zA.set(hip.x + sx * 0.14, 0.08, hip.z + 0.75 + Math.sin(lp) * 0.08);
    else _zA.set(hip.x + sx * 0.03, Math.max(0, Math.cos(lp)) * (e.zk === 'runner' ? 0.2 : 0.09) * mv * drag, hip.z - Math.sin(lp) * stride * 0.5 * mv * (drag < 1 ? 0.6 : 1));
    _zB.copy(hip).add(_zC.set(0, -0.3, -0.6));
    ik2(hip, _zA, SD.thigh * k, SD.shin * k, _zB, L[b.jKn], L[b.jFt]);
  }
  // en repère du monde ; orientation de la tête (cap, penché, incliné)
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw), P = e.pos;
  for (let i = 0; i < 15; i++) { const l = L[i]; J[i].set(P.x + l.x * cy + l.z * sy, P.y + l.y, P.z - l.x * sy + l.z * cy); }
  _zEu.set(-hl * 0.6, e.yaw, tilt, 'YXZ'); _zQ.setFromEuler(_zEu);
  S.headQ = (S.headQ || new THREE.Quaternion()).copy(_zQ).multiply(soldierRest().q[SB.HEA]);
}
/* Mort d'un invité : position et cap reçus de l'hôte, lissés ; le corps s'anime d'après sa vitesse */
function zombieRemote(e, dt) {
  const N = e.zNet, k = 1 - Math.exp(-dt * 10);
  const ox = e.pos.x, oz = e.pos.z;
  e.pos.x += (N.x - e.pos.x) * k; e.pos.z += (N.z - e.pos.z) * k; e.pos.y += (N.y - e.pos.y) * k;
  e.yaw += Math.atan2(Math.sin(N.yaw - e.yaw), Math.cos(N.yaw - e.yaw)) * k;
  e.vel.set((e.pos.x - ox) / Math.max(dt, 1e-3), 0, (e.pos.z - oz) / Math.max(dt, 1e-3));
  if (N.atk) { e.zAtk = 1; N.atk = 0; }
  e.zFar = false; e.zFlinch = damp(e.zFlinch, 0, 6, dt);
  zombieAnimate(e, dt);
}

/* ---------- Sons : grognements, coups, hurlement (synthèse : rien d'enregistré, rien sous licence) ---------- */
function zombieGroan(e, kind) {
  if (!AU.ready) return;
  const p = _zA.set(e.pos.x, e.pos.y + 1.5, e.pos.z), d = p.distanceTo(camera.position); if (d > 45) return;
  if (!auAfford || !auAfford(3, d)) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.25, kind === 'scream' ? 1.4 : 0.9, 1, 3), base = (e.zk === 'brute' ? 70 : e.zk === 'runner' ? 140 : 105) * (0.85 + e.zSeed * 0.3);
  if (kind === 'scream') { tn(o, t, 1.4, 620, 900, 'sawtooth', 0.14, 0.05); nz(o, t, 1.3, 'bandpass', 1800, 2600, 3, 0.18, 0.06); tn(o, t + 0.05, 1.2, 640, 860, 'square', 0.05, 0.05); return; }
  const dur = kind === 'attack' ? 0.45 : kind === 'die' ? 0.9 : kind === 'spot' ? 0.8 : 0.6;
  tn(o, t, dur, base * 1.1, base * (kind === 'die' ? 0.6 : 0.85), 'sawtooth', kind === 'attack' ? 0.11 : 0.07, 0.04);
  nz(o, t, dur, 'bandpass', base * 6, base * 4.5, 2.2, kind === 'attack' ? 0.12 : 0.08, 0.05);
}
/* Grognements de fond : de temps en temps un mort proche ou lointain gémit (la direction s'entend) */
function zombieAmbience(dt) {
  if ((ZAMB.t -= dt) > 0) return;
  ZAMB.t = rand(0.8, 2.4);
  const up = ZOMBIES.filter((z) => z.alive); if (!up.length) return;
  zombieGroan(up[Math.floor(Math.random() * up.length)], 'groan');
}
const ZAMB = { t: 2 };
function sfxZombieHit(p) {
  if (!AU.ready || p.distanceTo(camera.position) > 30) return;
  const t = AU.ctx.currentTime, o = auOut(p, 0.1, 0.9, 1, 3);
  nz(o, t, 0.12, 'lowpass', 1400, 400, 1, 0.35, 0.002); tn(o, t, 0.12, 160, 70, 'sine', 0.3, 0.002);
}
