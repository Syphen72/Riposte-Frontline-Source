/* ==========================================================================
   SURVIE EN COOPÉRATION (Breachline, novembre 2026) : MODES.zombie. De 1 à 4 survivants (des compagnons bots en solo, au choix) tiennent une
   ferme la nuit contre des vagues de morts (07g-zombies.js), en la barricadant (08m-barricades.js).
   Déroulement : une préparation (35 s, puis 25 s entre deux vagues) pour fouiller la ferme, prendre des planches et clouer ; puis une vague,
   qui finit quand son dernier mort tombe. Chaque vague est plus nombreuse et plus mêlée (rampants dès la 2, coureurs dès la 3, hurleurs dès
   la 4, une brute toutes les deux vagues dès la 5) ; le nombre suit celui des survivants et la difficulté. Entre deux vagues : de quoi
   recharger (08n-ravitaillement.js : munitions, caisses, cartouchières, largages, secours), deux planches, et aux vagues 5, 15 et 25 une
   tourelle, aux vagues 10 et 20 le chien robot (les seuls équipements avancés : rares, ils ne règlent pas une horde à eux seuls).
   Objectifs : rétablir le courant (le groupe électrogène de la grange : la cour et la grange s'éclairent), réparer le pick-up (il faut la
   caisse à outils de l'appentis). Partie à objectif (limite de vagues) : une fois la dernière vague tenue, courant et pick-up réparés, on fuit
   en tenant 5 s près du pick-up. Sans fin (limite 0) : on tient tant qu'on peut.
   Évènements, toujours annoncés : une horde qui sort du bois d'un côté (avec son cri, du bon côté), le groupe électrogène qui cale (noir
   complet, on le relance), un ravitaillement largué au loin (en plus de celui, garanti, d'une vague sur deux à partir de la 4).
   Une carte de survie règle le reste (surv dans sa définition) : ses textes (préparation, fuite), son véhicule, ses entrées nommées où
   arrivent les hordes, ses murs qui cèdent, ses zones de largage, le poids de ses vagues, et le siège (siege : les morts qui ne sentent
   personne marchent sur les entrées du bâtiment des vivants, chacun la sienne, et les forcent). La galerie (6.3) y ajoute le poste de
   sécurité (rideaux coupe-feu d'une aile, avec le courant) et la cage de la réserve (avec les outils).
   À terre plutôt que mort : un survivant à bout de vie tombe, rampe, tire encore ; un équipier le relève (3 s) ; une fois par partie, il se
   relève seul (adrénaline) ; au bout de 30 s, il meurt, regarde les autres, et revient à la vague suivante. Plus personne debout : fin.
   Points : par mort abattu (selon sa sorte, plus en pleine tête), par planche clouée, réparation, équipier relevé, objectif ; ils paient les
   munitions à la caisse de la cuisine. Statistiques de fin : vagues tenues, morts, têtes, relevés, planches, réparations, objectifs.
   Réseau (le cadre existant : l'hôte décide) : l'hôte simule les morts, la vague, les réserves, les planches et les meubles, et publie le tout
   dans son paquet d'état (sv : 10 fois par seconde les morts, une fois par seconde le reste, tout de suite après un changement) ; un invité
   annonce ses touches sur les morts ('zh'), ses demandes (clouer, réparer, prendre, pousser : 'sq'), qu'il est à terre ('dn') ou qu'il relève
   quelqu'un ('rv'). L'hôte parti, celui qui le remplace reprend les morts où ils sont (rien n'est simulé deux fois). Arrivée en cours de
   partie : le paquet d'état contient tout.
   ========================================================================== */
MODES.zombie = {
  name: _t('Survie'), btn: _t('Survie'), sub: _t('Survie en coopération'), teams: _t('De 1 à 4 survivants contre les morts'), lim: _t('Vagues à tenir'), unit: _t('vagues'),
  limits: [10, 15, 25, 0], key: 'limitZombie', respawn: 1e9, botRespawn: 1e9, prot: 0, ban: ['grapple'], noKs: true,
  hint: _t('Barricadez les lieux et tenez les vagues. La touche d\u0027action cloue une planche, répare, pousse un meuble, ferme un rideau ou relève un équipier.'),
};
MODE_IDS.push('zombie');
/* Mode et carte compatibles : la survie sur une carte qui l'accueille, les autres modes ailleurs (une carte de survie n'a pas de bases) */
function modeMapOk(id, map) {
  const D = MAP_DEFS[map]; if (!D) return id === 'tdm';
  if (id === 'zombie') return !!D.zombie;
  if (D.only && !D.only.includes(id)) return false;
  return id !== 'dom' || !!D.dom;
}
const SVDIFF = [{ hp: 0.8, dmg: 0.65, spd: 0.92, n: 0.8 }, { hp: 1, dmg: 0.9, spd: 1, n: 1 }, { hp: 1.15, dmg: 1.15, spd: 1.06, n: 1.2 }];
const SV = { on: false, phase: 'prep', wave: 0, t: 0, toSpawn: 0, spawnT: 0, limit: 10, diff: 1, players: 1, evT: 60, power: false, truck: false, ext: 0, result: '', horde: null, blackT: 0, hudT: 0, pubT: 0, dirty: true, kills: 0, mates: 0, drop: null, dropId: 0, airDone: false, lamps: [], stuckN: 0, unstuck: 0, vaults: 0, shoves: 0 };
const SURV_DOWN = { me: false, t: 0, self: 1, revT: 0, lastBy: null };
const SVSTAT = { kills: 0, heads: 0, revives: 0, boards: 0, repairs: 0, plates: 0, objs: 0, points: 0, downs: 0, bestWave: 0 };
const survOn = () => MATCH.mode === 'zombie' && SV.on;
/* Réglages de survie de la carte chargée (surv de sa définition ; la ferme n'en a presque pas : ses textes sont ceux par défaut) */
const survDef = () => (CURMAP.def && CURMAP.def.surv) || {};
const survLocal = () => !MATCH.online || NET.role === 'host';
/* Spécialités (classes de la survie, facultatives) : la classe équipée en donne une (09n-armurerie.js : Démolition, sinon d'après l'arme) */
function survRoleOf(e) {
  if (e !== PL.ent) return '';
  const c = (CLASSES[Settings.loadout] || {}).name || '';
  return /Démolition/.test(c) ? 'demo' : /Médecin|Soutien/.test(c) ? 'medic' : /Ingénieur|Génie/.test(c) ? 'engineer' : 'assault';
}

/* ---------- Début et fin ---------- */
function survStart() {
  Object.assign(SV, { on: true, phase: 'prep', wave: 0, t: 35, toSpawn: 0, spawnT: 0, limit: MATCH.limit || 0, diff: clamp(Settings.difficulty | 0, 0, 2), evT: rand(70, 110), power: false, truck: false, ext: 0, result: '', horde: null, blackT: 0, hudT: 0, pubT: 0, dirty: true, kills: 0, drop: null, dropId: 0, airDone: false, stuckN: 0, unstuck: 0, vaults: 0, shoves: 0 });
  if (MATCH.online) SV.diff = clamp((NET.cfg.diff === undefined ? Settings.difficulty : NET.cfg.diff) | 0, 0, 2);
  Object.assign(SURV_DOWN, { me: false, t: 0, self: 1, revT: 0, lastBy: null });
  for (const k in SVSTAT) SVSTAT[k] = 0;
  zombiePoolReady(); for (const z of ZOMBIES) zombieStow(z);
  survBarrReset(); survAmmoReset(); SVK.soft = survDef().softK || 1;
  MATCH.timeLeft = 1e9;
  SV.lampBase = null; survLights(false); survHudMake();
  hudMsg(survDef().prep || _t('Préparez la ferme avant la nuit'), 'xp', 4);
}
function survEnd() { SV.on = false; SACT.cur = null; SACT.carry = null; survHudRemove(); zombiePoolClear(); FinalShader.uniforms.uDesat.value = 0; if (SV.lampBase !== null && SV.lampBase !== undefined) WMU.uVolL.value.x = SV.lampBase; SV.lampBase = null; }
/* Soldats en jeu : aucun ennemi ; en solo, les compagnons choisis (alliés), en ligne aucun */
function survRoster() {
  const mates = MATCH.online ? 0 : clamp(Settings.survMates | 0, 0, 3); let n = 0;
  for (const e of entities) {
    if (e.isPlayer || e.isZombie || e.isRemote) continue;
    const on = e.team === PL.ent.team && n < mates; if (on) n++;
    e.off = !on; if (!on) { e.alive = false; e.respawnT = Infinity; e.target = null; e.model.rag = null; e.model.root.visible = false; }
  }
  SV.mates = n;
}
const survHumans = () => entities.filter((e) => (e.isPlayer || e.isRemote) && !e.off);
/* Vivants debout (à terre ne compte pas) */
const survStanding = () => survHumans().filter((e) => e.alive && !e.downed);

/* ---------- Boucle ---------- */
function survTick(dt) {
  if (!SV.on) return;
  // un seul camp : tous les survivants (les équipes du salon ne comptent pas en survie)
  if (PL.ent.team !== 0) { PL.ent.team = 0; soldierLookAll(); }
  for (const e of NET.remotes.values()) if (e.team !== 0) { e.team = 0; soldierLookAll(); }
  // la tourelle et le chien des paliers : toujours parmi les séries de la classe (sinon on ne pourrait pas les appeler)
  if (!PL.ksSel.includes('sentry') || !PL.ksSel.includes('dog')) { PL.ksSel = ksFill(['sentry', 'dog'].concat(PL.ksSel)); updateStreakHud(); }
  survActTick(dt); survDownTick(dt); zombieAmbience(dt); survLightsTick(dt); survAmmoTick(dt);
  if (survLocal()) {
    for (const z of ZOMBIES) if (z.zNet) z.zNet = null; // (hôte remplacé : on reprend les morts où ils sont)
    survCrowdTick(); survDirector(dt);
  }
  if ((SV.hudT -= dt) <= 0) { SV.hudT = 0.12; survHud(); }
  FinalShader.uniforms.uDesat.value = Settings.survNoir ? 0.92 : 0;
}
/* Combien de morts visent chaque obstacle (les chemins évitent l'ouverture où d'autres se pressent déjà) */
function survCrowdTick() {
  for (const op of SURV.open) op.crowd = 0;
  for (const p of SURV.props) p.crowd = 0;
  for (const z of ZOMBIES) if (z.alive && z.zOb) { if (z.zOb.op) z.zOb.op.crowd++; else if (z.zOb.p) z.zOb.p.crowd++; }
}
function survDirector(dt) {
  SV.players = Math.max(1, survHumans().length);
  if (SV.phase === 'over') return;
  if (SV.phase === 'prep') {
    SV.t -= dt;
    if (SV.t <= 0) survWaveStart();
  } else if (SV.phase === 'wave') {
    survSpawnTick(dt); survEventTick(dt); survStragglers(dt);
    if (SV.toSpawn <= 0 && !zombiesUp().length && !SV.horde) survWaveClear();
  } else if (SV.phase === 'extract') {
    survSpawnTick(dt);
    const T = SURV.objs.find((o) => o.kind === 'truck'), near = T ? survStanding().filter((e) => hyp(e.pos.x - T.x, e.pos.z - T.z) < 4.5) : [];
    SV.ext = near.length && near.length >= Math.min(2, survStanding().length) ? SV.ext + dt : Math.max(0, SV.ext - dt * 0.5);
    if (SV.ext >= 5) survOver('win');
  }
  // fin : plus personne debout, et personne à terre qui se relèvera seul (l'adrénaline en attente)
  const H = survHumans(), up = H.some((e) => e.alive && !e.downed), pend = H.some((e) => e.alive && e.downed && (e === PL.ent ? SURV_DOWN.revT > 0 : !!e.dnRev));
  if (SV.phase !== 'over' && SV.wave > 0 && H.length && !up && !pend) survOver('loss');
}
/* Les derniers morts d'une vague (tous sortis, il en reste au plus 15 %, depuis 15 s) : ils savent où sont les vivants et viennent les chercher.
   Sans quoi un mort qui forçait une issue de secours à l'autre bout de la galerie, loin de tout bruit, faisait durer la vague des minutes */
function survStragglers(dt) {
  const up = zombiesUp(), C = SV.comp, few = C && SV.toSpawn <= 0 && up.length && up.length <= Math.max(2, Math.ceil((C.n + C.brutes) * 0.15));
  SV.fewT = few ? (SV.fewT || 0) + dt : 0;
  if (SV.fewT < 15) return;
  const H = survStanding(); if (!H.length) return;
  for (const z of up) if (!z.zTgt && !z.zNet) { let h = H[0], bd = 1e9; for (const p of H) { const d = p.pos.distanceTo(z.pos); if (d < bd) { bd = d; h = p; } } z.zTgt = h; z.zLostT = MATCH.time + 30; z.zs = z.zs === 'wander' ? 'hunt' : z.zs; z.zRepT = 0; }
}
/* Composition d'une vague : nombre, parts de chaque sorte */
function survWaveComp(w) {
  const D = SVDIFF[SV.diff], n = Math.round((5 + w * 3.2 + w * w * 0.16) * (0.55 + 0.45 * SV.players) * D.n * (survDef().waveK || 1));
  const mix = { shambler: 1, crawler: w >= 2 ? 0.18 : 0, runner: w >= 3 ? Math.min(0.5, 0.1 + w * 0.03) : 0, screamer: w >= 4 ? 0.05 : 0 };
  const brutes = w >= 5 ? Math.floor((w - 3) / 2) : 0;
  return { n, mix, brutes };
}
function survWaveStart() {
  SV.wave++; SV.phase = 'wave'; const C = survWaveComp(SV.wave); SV.comp = C; SV.toSpawn = C.n + C.brutes; SV.brutes = C.brutes; SV.spawnT = 2; SV.dirty = true; SV.airDone = false;
  SVSTAT.bestWave = Math.max(SVSTAT.bestWave, SV.wave - 1);
  survRespawnAll();
  survAnnounce(_t('Vague {0}', SV.wave), 'wave');
}
function survWaveClear() {
  SV.phase = 'prep'; SV.t = 25; SV.dirty = true; SVSTAT.bestWave = Math.max(SVSTAT.bestWave, SV.wave);
  SURV_RES.planks += 2; survAmmoWaveClear(); survPub('r');
  survAnnounce(_t('Vague {0} tenue', SV.wave), 'clear');
  survResupplyMe();
  if (SV.limit > 0 && SV.wave >= SV.limit) {
    const D = survDef();
    if (SV.power && SV.truck) { SV.phase = 'extract'; SV.toSpawn = 999; SV.comp = survWaveComp(SV.wave + 2); SV.ext = 0; survAnnounce(D.flee || _t('Fuyez : tous au pick-up'), 'wave'); if (D.onExtract) D.onExtract(); }
    else hudMsg(D.need || _t('Pour fuir, rétablissez le courant et réparez le pick-up'), 'xp', 5);
  }
}
/* Les morts sortent du bois : à un point d'apparition loin des vivants et hors de leur vue si possible, par groupes de 1 à 3 */
function survSpawnTick(dt) {
  if ((SV.spawnT -= dt) > 0 || SV.toSpawn <= 0) return;
  const cap = Math.min(ZOMBIE.max, 12 + SV.players * 3 + Math.floor(SV.wave / 2));
  const up = zombiesUp().length; if (up >= cap) { SV.spawnT = 0.5; return; }
  SV.spawnT = Math.max(0.35, 1.8 - SV.wave * 0.08) * (SV.phase === 'extract' ? 0.6 : 1);
  const n = Math.min(SV.toSpawn, cap - up, 1 + Math.floor(Math.random() * 3)), P = survSpawnPoint(SV.horde ? SV.horde.side : null);
  for (let i = 0; i < n; i++) {
    let kind = 'shambler';
    if (SV.brutes > 0 && Math.random() < 0.35) { kind = 'brute'; SV.brutes--; }
    else { const m = SV.comp.mix, r = Math.random() * (m.shambler + m.crawler + m.runner + m.screamer); kind = r < m.shambler ? 'shambler' : r < m.shambler + m.crawler ? 'crawler' : r < m.shambler + m.crawler + m.runner ? 'runner' : 'screamer'; }
    const D = SVDIFF[SV.diff], z = zombieSpawn(kind, P[0] + rand(-1.5, 1.5), P[1] + rand(-1.5, 1.5), Math.atan2(P[0], P[1]), { hp: D.hp * (1 + Math.max(0, SV.wave - 6) * 0.04), dmg: D.dmg, spd: D.spd });
    if (z) { SV.toSpawn--; if (SV.horde && SV.horde.n > 0) { SV.horde.n--; if (SV.horde.n <= 0) SV.horde = null; } }
  }
}
function survSpawnPoint(side) {
  const L = (CURMAP.def && CURMAP.def.zspawns) || [[0, 30]], H = survStanding().length ? survStanding() : survHumans();
  let best = null, bs = -1e9;
  for (const p of L) {
    if (side && side.pt && hyp(p[0] - side.pt[0], p[1] - side.pt[1]) > 34) continue; // (une horde vers une entrée nommée : les points de son côté)
    if (side && !side.pt && Math.sign(p[side.ax === 'x' ? 0 : 1]) !== side.s) continue;
    let dmin = 1e9, seen = 0;
    for (const h of H) { const d = hyp(p[0] - h.pos.x, p[1] - h.pos.z); dmin = Math.min(dmin, d); if (d < 35 && lineClear(_svA.set(p[0], 1.5, p[1]), _svB.set(h.pos.x, h.pos.y + 1.5, h.pos.z))) seen++; }
    const s = (dmin > 16 ? 10 : -20) - seen * 6 + Math.random() * 8 - Math.abs(dmin - 28) * 0.15;
    if (s > bs) { bs = s; best = p; }
  }
  return best || L[0];
}
const _svA = new V3(), _svB = new V3();
/* Le hurleur appelle : quelques morts de plus sortent du bois, du côté du hurleur */
function survScreamCall(z) {
  if (!survLocal() || SV.phase === 'over') return;
  SV.toSpawn += 3 + Math.floor(SV.wave / 3); survAnnounce(_t('Un hurlement : d\u0027autres arrivent'), 'warn', z.pos);
}
/* ---------- Évènements ---------- */
function survEventTick(dt) {
  if (SV.wave < 3 || (SV.evT -= dt) > 0) return;
  SV.evT = rand(70, 120);
  // (une horde sur deux ; le noir si le courant est là, sinon une horde ; un largage une fois sur quatre : sans courant, il en tombait un sur deux)
  let r = Math.random(); if (r >= 0.5 && r < 0.75 && !SV.power) r = 0;
  // un mur qui cède (la galerie : un pan du couloir de service s'effondre, une entrée de plus pour toute la partie), à la place d'une horde
  const D = survDef(), walls = SV.wave >= 5 && D.breaks ? D.breaks().filter((w) => !BRCH.open[w.id]) : [];
  if (r < 0.2 && walls.length) {
    const w = walls[Math.floor(Math.random() * walls.length)], b = BRCH.list[w.id];
    breachSet(b, true, true); if (MATCH.online) netEvent({ k: 'wb', n: b.id }, PL.ent);
    SV.horde = { side: { pt: [w.x, w.z] }, n: 4 + Math.floor(SV.wave / 2) }; SV.toSpawn += SV.horde.n; SV.spawnT = 4;
    survAnnounce(_t('{0} s\u0027effondre', w.n), 'warn', b.c.clone());
  } else if (r < 0.5) {
    let side, name, at;
    if (D.hordes) { const h = D.hordes[Math.floor(Math.random() * D.hordes.length)]; side = { pt: [h.x, h.z] }; name = h.n; at = new V3(h.x, 2, h.z); }
    else {
      side = Math.random() < 0.5 ? { ax: 'x', s: Math.random() < 0.5 ? -1 : 1 } : { ax: 'z', s: Math.random() < 0.5 ? -1 : 1 };
      name = side.ax === 'z' ? (side.s > 0 ? _t('le sud') : _t('le nord')) : side.s > 0 ? _t('l\u0027est') : _t('l\u0027ouest');
      at = new V3(side.ax === 'x' ? side.s * 30 : 0, 2, side.ax === 'z' ? side.s * 30 : 0);
    }
    SV.horde = { side, n: 6 + Math.floor(SV.wave / 2) }; SV.toSpawn += SV.horde.n; SV.spawnT = 6;
    survAnnounce(_t('Une horde arrive par {0}', name), 'warn', at);
  } else if (r < 0.75) { SV.blackT = 25; survLights(false); survAnnounce(_t('Le groupe électrogène cale'), 'warn'); const g = SURV.objs.find((o) => o.kind === 'power'); if (g) g.done = false; SV.power = false; SV.dirty = true; }
  else if (!SV.drop) survAirdrop();
}
/* Fin de la partie : victoire (extraction) ou défaite (plus personne debout) */
function survOver(res) {
  if (SV.phase === 'over') return;
  SV.phase = 'over'; SV.result = res; SV.dirty = true; SVSTAT.bestWave = Math.max(SVSTAT.bestWave, res === 'win' ? SV.wave : SV.wave - 1);
  if (survLocal()) matchFinish();
}
function survOutcome() {
  const w = Math.max(0, SVSTAT.bestWave);
  return SV.result === 'win' ? { result: 'win', winner: 0, sub: _t('Extraction réussie après {0} vagues', w) } : { result: 'loss', winner: -1, sub: _t('Tous les survivants sont tombés, {0} vagues tenues', w) };
}
function survKicker() { return SV.result === 'win' ? _t('Extraction') : _t('Fin de la survie'); }
/* Résultats : une tuile par chiffre */
function survEndFill() {
  const st = (v, l, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`;
  $('endStats').innerHTML = st(SVSTAT.bestWave, _t('Vagues tenues'), 'hi') + st(SVSTAT.points, _t('Points')) + st(SVSTAT.kills, _t('Morts abattus')) + st(SVSTAT.heads, _t('En pleine tête'))
    + st(SVSTAT.revives, _t('Équipiers relevés')) + st(SVSTAT.boards, _t('Planches clouées')) + st(SVSTAT.repairs, _t('Réparations')) + st(SVSTAT.objs, _t('Objectifs'));
}

/* ---------- Points et statistiques ---------- */
function survPoints(n, label, cls) { SVSTAT.points += n; xpPopup('+' + n, label, cls || ''); }
function survStat(by, k) { if (by === PL.ent) survStatMine(k); else if (by && by.isRemote && survLocal()) netEvent({ k: 'ss', to: netIdOf(by), s: k }); }
function survStatMine(k) {
  if (!hasKey(SVSTAT, k)) return;
  SVSTAT[k]++;
  if (k === 'boards') survPoints(10, _t('Planche')); else if (k === 'repairs') survPoints(5, _t('Réparation')); else if (k === 'plates') survPoints(15, _t('Tôle')); else if (k === 'objs') survPoints(300, _t('Objectif'));
  if (k === 'repairs' && SVSTAT.repairs % 4 === 0) survAmmoApply('pouch'); // (toutes les quatre réparations, une cartouchière)
}
function survZombieKilled(z, a, weapon, head) {
  SV.kills++; SV.dirty = true;
  z.zKiller = a ? netIdOf(a) : ''; z.zKillHead = !!head;
  if (a === PL.ent) survKillCredit(z.zk, head);
  survLootRoll(z);
  void weapon;
}
function survKillCredit(kind, head) {
  SVSTAT.kills++; if (head) SVSTAT.heads++;
  const K = ZKIND[kind] || ZKIND.shambler;
  survPoints(K.score + (head ? 40 : 0), head ? _t('En pleine tête') : _t('Mort abattu'), head ? 'head' : '');
}
/* Entre deux vagues : de quoi recharger (une part de la réserve pleine de chaque arme, le plein toutes les cinq vagues : 08n-ravitaillement.js),
   une grenade ; tourelle et chien aux paliers. (Jusqu'en 6.1.0, ceci et la caisse de la salle lisaient arms.weapons, qui n'existe pas : les
   armes sont dans arms.slots, rien n'était jamais rendu.) */
function survResupplyMe() {
  survAmmoApply(SV.wave > 0 && SV.wave % 5 === 0 ? 'full' : 'wave');
  PL.nades = Math.max(PL.nades || 0, 1);
  if (SV.wave % 10 === 5) { PL.ks.sentry = true; hudMsg(_t('Une tourelle est prête'), 'xp', 3); }
  if (SV.wave % 10 === 0) { PL.ks.dog = true; hudMsg(_t('Le chien robot est prêt'), 'xp', 3); }
  updateStreakHud();
}
/* Retour des morts au début de la vague : survivants tombés et compagnons */
function survRespawnAll() {
  if (!PL.ent.alive) { respawnPlayer(); hideDeathScreen(); }
  for (const e of entities) if (!e.isPlayer && !e.isRemote && !e.isZombie && !e.off && !e.alive) spawnEntity(e);
}
function hudMsgTo(by, text) { if (by === PL.ent) hudMsg(text, 'xp', 2.2); else if (by && by.isRemote && survLocal()) netEvent({ k: 'sm', to: netIdOf(by), m: text }); }

/* ---------- Objectifs (groupe électrogène, pick-up) ---------- */
function survObjAction(e) {
  const D = survDef();
  let best = null, bd = 1e9; const near = (o, a) => { if (o.y !== undefined && Math.abs(o.y - e.pos.y) > 1.6) return; const d = hyp(e.pos.x - o.x, e.pos.z - o.z); if (d < bd) { bd = d; best = a; } };
  for (const o of SURV.objs) {
    const i = SURV.objs.indexOf(o), run = () => survReq('obj', i);
    if (o.kind === 'lock') { // le poste de sécurité : les rideaux coupe-feu d'une aile, dans un sens ou dans l'autre (avec le courant)
      near(o, SV.power ? { k: 'obj', x: o.x, z: o.z, label: o.done ? o.open : o.close, dur: 1.5, run } : { k: 'obj', x: o.x, z: o.z, label: _t('Le poste de sécurité est sans courant'), dur: 0, run: () => {} });
      continue;
    }
    if (o.done) continue;
    if (o.kind === 'power') near(o, { k: 'obj', x: o.x, z: o.z, label: _t('Démarrer le groupe électrogène'), dur: 6 * survToolK(e), run });
    else if (o.kind === 'truck' && (SURV_RES.tools || SV.truck)) near(o, { k: 'obj', x: o.x, z: o.z, label: D.truckLabel || _t('Réparer le pick-up'), dur: 9 * survToolK(e), run });
    else if (o.kind === 'cage') near(o, SURV_RES.tools ? { k: 'obj', x: o.x, z: o.z, label: _t('Forcer la cage de la réserve'), dur: 5 * survToolK(e), run } : { k: 'obj', x: o.x, z: o.z, label: _t('La cage est cadenassée, il faut des outils'), dur: 0, run: () => {} });
  }
  if (best) return best;
  const ammo = survBuyPoint(); if (hyp(e.pos.x - ammo.x, e.pos.z - ammo.z) < 2.2 && Math.abs((ammo.y || 0) - e.pos.y) < 1.6) return { k: 'ammo', x: ammo.x, z: ammo.z, label: _t('Munitions ({0} points)', ammo.cost), dur: 0.8, run: () => survBuyAmmo() };
  return null;
}
const SURV_AMMO = { x: -1.0, z: 3.6, cost: 250 }; // la caisse de munitions de la salle, près de la porte (fermeHouse)
const survBuyPoint = () => survDef().buy || SURV_AMMO; // (la galerie : le comptoir de l'armurerie du magasin de sport)
/* Le poste de sécurité : les rideaux coupe-feu et les portes coupe-feu d'une aile (wing), baissés ou levés */
function survLockSet(o) {
  for (const op of SURV.open) {
    if (!op.gate || op.wing !== o.w || op.gate.hp <= 0) continue;
    if (o.done && survGateBlocked(op)) continue; // (quelqu'un dans le passage : ce rideau-là reste levé)
    if (op.gate.down !== o.done) { survGateSet(op, o.done); sfxBarr(survOpenFace(op, _svA), op.gate.type === 'door' ? 'door' : 'roll'); }
  }
  survAnnounce(o.done ? o.sealed : o.opened, o.done ? 'clear' : 'warn'); survPub('b');
}
function survBuyAmmo() {
  const B = survBuyPoint();
  if (SVSTAT.points < B.cost) { hudMsg(_t('Pas assez de points'), 'enemy', 1.6); return; }
  if (ammoFracOf(PL.ent) > 0.97 && (PL.nades || 0) >= 2) { hudMsg(_t('Munitions pleines'), 'xp', 1.4); return; }
  SVSTAT.points -= B.cost;
  survAmmoApply('full'); sfxBarr(PL.ent.pos, 'take');
}
function survObjDone(i, by) {
  const o = SURV.objs[i]; if (!o) return;
  if (o.kind === 'lock') { if (!SV.power) return; o.done = !o.done; SV.dirty = true; survLockSet(o); if (!o.once) { o.once = true; survStat(by, 'objs'); } return; }
  if (o.done) return;
  if (o.kind === 'truck' && !SURV_RES.tools) return;
  if (o.kind === 'cage') { // la cage de la réserve : planches, tôles, clous, et les caisses de munitions remplies
    if (!SURV_RES.tools) return;
    o.done = true; SV.dirty = true; SURV_RES.planks += 6; SURV_RES.metal += 2; SURV_RES.nails = true;
    for (const c of SURV.caches) if (c.kind === 'ammo') { c.left = c.max; survAmmoBoxLook(c); }
    survAnnounce(_t('La cage est ouverte, planches, tôles, clous et munitions'), 'clear'); survPub('r'); survStat(by, 'objs');
    return;
  }
  o.done = true; SV.dirty = true;
  if (o.kind === 'power') { SV.power = true; SV.blackT = 0; survLights(true); survAnnounce(_t('Le courant revient'), 'clear'); }
  else { SV.truck = true; survAnnounce(survDef().truckDone || _t('Le pick-up démarre'), 'clear'); }
  survAmmoGrantAll('full'); // (un objectif rempli : le plein pour toute l'équipe)
  survStat(by, 'objs');
}

/* ---------- À terre, relevé ---------- */
/* Un coup qui tuerait le joueur en survie : il tombe à terre (vrai : le coup est pris) ; à terre, un coup retire du temps */
function survDownCheck(v, dmg, a) {
  if (v !== PL.ent || !survOn()) return false;
  if (SURV_DOWN.me) { SURV_DOWN.t -= dmg / 12; SURV_DOWN.lastBy = a; return true; }
  if (dmg < v.health) return false;
  SURV_DOWN.me = true; SURV_DOWN.t = 30; SURV_DOWN.revT = SURV_DOWN.self > 0 ? 5 : -1; SURV_DOWN.lastBy = a; SVSTAT.downs++;
  v.health = 1; v.downed = true; PL.reload = null;
  if (MATCH.online) netEvent({ k: 'dn', s: 1, r: SURV_DOWN.revT > 0 ? 1 : 0 });
  hudMsg(SURV_DOWN.self > 0 ? _t('À terre : l\u0027adrénaline vous relève dans un instant') : _t('À terre : un équipier peut vous relever'), 'enemy', 3);
  sfxHurt(60);
  return true;
}
function survDownTick(dt) {
  const e = PL.ent;
  if (!SURV_DOWN.me) return;
  SURV_DOWN.t -= dt;
  if (SURV_DOWN.revT > 0 && (SURV_DOWN.revT -= dt) <= 0) { SURV_DOWN.self--; survRevive(0.4); return; }
  if (SURV_DOWN.t <= 0 || !e.alive) { SURV_DOWN.me = false; e.downed = false; e.health = 1; if (MATCH.online) netEvent({ k: 'dn', s: 0 }); if (e.alive) killEnt(e, SURV_DOWN.lastBy || e, 'Zombie', false, new V3(0, 0, 1)); }
}
function survRevive(k) {
  const e = PL.ent; if (!SURV_DOWN.me) return;
  SURV_DOWN.me = false; e.downed = false; e.health = Math.round(100 * k);
  if (MATCH.online) netEvent({ k: 'dn', s: 0 });
  hudMsg(_t('Debout'), 'xp', 1.4);
}
function survReviveAction(e) {
  for (const o of entities) {
    if (o === e || !o.alive || !o.downed || !o.isRemote) continue;
    return { k: 'revive', x: o.pos.x, z: o.pos.z, label: _t('Relever {0}', o.name), dur: survRoleOf(e) === 'medic' ? 1.8 : 3, run: () => { netEvent({ k: 'rv', to: netIdOf(o) }); SVSTAT.revives++; survPoints(100, _t('Équipier relevé')); survAmmoApply('box'); } };
  }
  return null;
}
/* Mort pour de bon : on regarde un équipier debout en attendant la vague suivante (vue de derrière son épaule) */
function survSpectate(dt) {
  if (!survOn() || PL.ent.alive || PL.deathT < 2.5) return false;
  const L = survStanding().filter((e) => e !== PL.ent); if (!L.length) return false;
  const t = L[Math.floor((PL.deathT / 6) % L.length)], yaw = t.isRemote ? t.yaw || 0 : t.yaw, b = _svA.set(Math.sin(yaw) * 3.2, 1.9, Math.cos(yaw) * 3.2);
  camera.position.lerp(_svB.set(t.pos.x + b.x, t.pos.y + b.y, t.pos.z + b.z), 1 - Math.exp(-dt * 5)); camera.lookAt(t.pos.x, t.pos.y + 1.4, t.pos.z);
  $('deathBy').innerHTML = `<small>${esc(_t('Vous revenez à la prochaine vague'))}</small><b class="ally">${esc(t.name)}</b>`;
  return true;
}

/* ---------- Lumières : le courant, le noir ----------
   Les lampes du décor sont cuites dans le volume de lumière (02e-light.js) ; leur force commune (uVolL.x) suit le courant : sans lui, des
   lampes à pétrole (30 %), le groupe électrogène en marche, toutes (100 %), et des ampoules qui vacillent ; le groupe qui cale, le noir,
   avec quelques sursauts. */
function survLights(on) { SV.lightsOn = on; if (SV.lampBase === undefined || SV.lampBase === null) SV.lampBase = WMU.uVolL.value.x; }
function survLightsTick(dt) {
  if (SV.lampBase === undefined || SV.lampBase === null) return;
  let k = SV.lightsOn ? (Math.random() < 0.02 ? 0.45 : 1) : survDef().dim || 0.3; // (sans courant : lampes à pétrole, à la galerie l'éclairage de secours)
  if (SV.blackT > 0) { SV.blackT -= dt; k = Math.random() < 0.05 ? 0.4 : 0.02; }
  WMU.uVolL.value.x = damp(WMU.uVolL.value.x, SV.lampBase * k, SV.blackT > 0 ? 30 : 9, dt);
}

/* ---------- Annonces, HUD ---------- */
function survAnnounce(text, kind, pos) {
  hudMsg(text, kind === 'warn' ? 'enemy' : 'xp', 3.5);
  if (!AU.ready) return;
  const t = AU.ctx.currentTime, o = pos ? auOut(pos, 0.5, 1.6, 1, 30) : AU.bus;
  if (kind === 'wave') { tn(o, t, 1.6, 82, 74, 'sawtooth', 0.12, 0.3); tn(o, t, 1.6, 123, 110, 'sawtooth', 0.07, 0.3); nz(o, t, 1.6, 'lowpass', 400, 200, 1, 0.12, 0.3); }
  else if (kind === 'warn') { tn(o, t, 1.2, 420, 300, 'sawtooth', 0.08, 0.1); nz(o, t, 1.2, 'bandpass', 900, 600, 2, 0.12, 0.1); }
  else { tn(o, t, 0.25, 520, 520, 'sine', 0.08, 0.01); tn(o, t + 0.22, 0.4, 780, 780, 'sine', 0.08, 0.01); }
}
function survHudMake() {
  survHudRemove();
  const d = document.createElement('div'); d.id = 'survHud';
  d.innerHTML = '<div class="sv-w"><b id="svWave"></b><span id="svInfo"></span></div><div class="sv-r"><span id="svPl"></span><span id="svPts"></span></div><div class="sv-team" id="svTeam"></div><div class="sv-act" id="svAct"><i></i><span></span></div><div class="sv-drop" id="svDrop"><i>\u2191</i><span></span></div>';
  const st = document.createElement('style'); st.id = 'survCss';
  st.textContent = '#survHud{position:fixed;inset:0;pointer-events:none;font-family:inherit;color:#e8e4da;z-index:5}'
    + '#survHud .sv-w{position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center;text-shadow:0 2px 6px #000}'
    + '#survHud .sv-w b{display:block;font-size:22px;letter-spacing:.12em;text-transform:uppercase;color:#d9cdb2}#survHud .sv-w span{font-size:13px;opacity:.85}'
    + '#survHud .sv-r{position:absolute;top:14px;right:18px;display:flex;gap:14px;font-size:14px;text-shadow:0 2px 4px #000}'
    + '#survHud .sv-team{position:absolute;top:120px;left:14px;font-size:12px;display:flex;flex-direction:column;gap:4px}#survHud .sv-team div{display:flex;gap:6px;align-items:center}'
    + '#survHud .sv-team i{display:inline-block;width:60px;height:5px;background:#333;position:relative}#survHud .sv-team i b{position:absolute;left:0;top:0;bottom:0;background:var(--ally,#8fd16a)}'
    + '#survHud .sv-team .down{color:#e4473b}#survHud .sv-act{position:absolute;left:50%;top:62%;transform:translateX(-50%);display:none;align-items:center;gap:8px;font-size:15px;text-shadow:0 2px 4px #000}'
    + '#survHud .sv-drop{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:6px;font-size:13px;color:#f0a090;text-shadow:0 2px 4px #000}#survHud .sv-drop.on{display:flex}#survHud .sv-drop i{font-style:normal;display:inline-block}'
    + '#survHud .sv-act.on{display:flex}#survHud .sv-act i{width:28px;height:28px;border-radius:50%;background:conic-gradient(#d9cdb2 var(--p,0%),rgba(255,255,255,.15) 0)}';
  document.head.appendChild(st); document.body.appendChild(d);
}
function survHudRemove() { for (const id of ['survHud', 'survCss']) { const el = document.getElementById(id); if (el) el.remove(); } }
function survHud() {
  const w = document.getElementById('svWave'); if (!w) return;
  const left = SV.toSpawn + zombiesUp().length;
  if (SV.phase === 'prep') { w.textContent = SV.wave ? _t('Vague {0} tenue', SV.wave) : _t('Préparation'); $('svInfo').textContent = _t('Prochaine vague dans {0} s', Math.max(0, Math.ceil(SV.t))); }
  else if (SV.phase === 'extract') { const D = survDef(); w.textContent = _t('Extraction'); $('svInfo').textContent = SV.ext > 0 ? (D.holdTxt || _t('Tenez près du pick-up : {0} s')).replace('{0}', Math.max(0, Math.ceil(5 - SV.ext))) : D.joinTxt || _t('Rejoignez le pick-up'); }
  else if (SV.phase === 'over') { w.textContent = SV.result === 'win' ? _t('Extraction') : _t('Fin de la survie'); $('svInfo').textContent = ''; }
  else { w.textContent = _t('Vague {0}', SV.wave); $('svInfo').textContent = _t('{0} morts restants', left); }
  $('svPl').textContent = _t('{0} planches', SURV_RES.planks) + (SURV_RES.metal ? ' · ' + _t('{0} tôles', SURV_RES.metal) : '') + (SURV_RES.tools ? ' · ' + _t('outils') : '') + (SURV_RES.nails ? ' · ' + _t('clous') : '');
  // le largage : sa distance et sa direction, par rapport au regard
  const dr = $('svDrop');
  if (dr) {
    const on = !!SV.drop && SAMMO.dropTaken !== SV.dropId && PL.ent.alive;
    dr.classList.toggle('on', on);
    if (on) { const dx = SV.drop[0] - PL.ent.pos.x, dz = SV.drop[1] - PL.ent.pos.z, a = Math.atan2(-dx, -dz) - PL.ent.yaw; dr.lastChild.textContent = _t('Ravitaillement : {0} m', Math.round(hyp(dx, dz))); dr.firstChild.style.transform = 'rotate(' + (-a).toFixed(2) + 'rad)'; }
  }
  $('svPts').textContent = _t('{0} points', SVSTAT.points);
  $('svTeam').innerHTML = survHumans().filter((e) => e !== PL.ent).map((e) => `<div class="${e.downed ? 'down' : ''}"><i><b style="width:${e.alive ? Math.round(clamp(e.health, 0, 100)) : 0}%"></b></i>${esc(e.name)}${e.downed ? ' · ' + esc(_t('à terre')) : !e.alive ? ' · ' + esc(_t('mort')) : ''}</div>`).join('');
  const a = $('svAct'), cur = SACT.cur;
  a.classList.toggle('on', !!SACT.hint && PL.ent.alive);
  if (SACT.hint) { a.lastChild.textContent = (cur ? '' : actGlyph('pick') + ' ') + SACT.hint; a.firstChild.style.setProperty('--p', cur ? Math.round((SACT.t / SACT.dur) * 100) + '%' : '0%'); }
  if (SURV_DOWN.me) { w.textContent = _t('À terre'); $('svInfo').textContent = _t('{0} s', Math.max(0, Math.ceil(SURV_DOWN.t))); }
}

/* ---------- Réseau (09c-net.js) ---------- */
/* Paquet d'état de l'hôte : morts (dix fois par seconde), le reste chaque seconde ou après un changement */
function survNetSnap(now) {
  if (!SV.on) return undefined;
  const s = { ph: SV.phase, w: SV.wave, t: Math.round(SV.t), n: SV.toSpawn, ex: Math.round(SV.ext * 10) / 10, res: SV.result };
  if (!SV.zT || now - SV.zT > 95) {
    SV.zT = now; s.z = [];
    ZOMBIES.forEach((z, i) => { if (z.off && !z.zSent) return; z.zSent = !z.off; s.z.push([i, Object.keys(ZKIND).indexOf(z.zk), Math.round(z.pos.x * 20), Math.round(z.pos.y * 20), Math.round(z.pos.z * 20), Math.round(z.yaw * 100), z.alive ? 1 : 0, z.zAtk > 0.9 ? 1 : 0, z.alive ? 0 : z.zKiller || '', z.zKillHead ? 1 : 0, ZSKINS.indexOf(z.skin)]); });
  }
  if (SV.dirty || !SV.bT || now - SV.bT > 1000) {
    // ouvertures : points de vie des planches, puis le meuble posé derrière (-1 : aucun), puis la tôle, puis le vantail (points de vie, fermé).
    // Toutes chaque seconde (s.b) ; entre deux, celles qui ont changé seulement (s.bx : [numéro, ...]) : la galerie en a 75, envoyées dix fois par
    // seconde en pleine vague, c'était l'essentiel du paquet
    const full = !SV.bT || now - SV.bT > 1000 || SV.bAll;
    if (full) { SV.bT = now; s.b = SURV.open.map(survOpenOut); } else if (SV.bDirty && SV.bDirty.size) s.bx = [...SV.bDirty].filter((i) => SURV.open[i]).map((i) => [i].concat(survOpenOut(SURV.open[i])));
    SV.dirty = false; SV.bAll = false; if (SV.bDirty) SV.bDirty.clear();
    s.p = SURV.props.map((p) => [Math.round(p.x * 20), Math.round(p.z * 20), Math.round(p.ry * 100), Math.max(0, Math.round(p.hp)), p.carried ? netIdOf(p.carried) : '', Math.round(p.y * 20)]);
    s.r = [SURV_RES.planks, SURV_RES.tools ? 1 : 0, SURV_RES.nails ? 1 : 0, SV.power ? 1 : 0, SV.truck ? 1 : 0, SV.blackT > 0 ? 1 : 0, SURV_RES.metal];
    s.c = SURV.caches.map((c) => c.left); s.o = SURV.objs.map((o) => (o.done ? 1 : 0)); s.d = SV.drop ? [SV.drop[0], SV.drop[1], SV.dropId] : 0;
    s.l = SAMMO.loot.map((l) => [l.id, Math.round(l.x * 20), Math.round(l.y * 20), Math.round(l.z * 20), l.k === 'nade' ? 1 : 0]);
  }
  return s;
}
function survNetSnapIn(s) {
  if (!SV.on || survLocal() || !s || typeof s !== 'object') return;
  const was = SV.phase;
  SV.phase = typeof s.ph === 'string' ? s.ph : SV.phase; SV.wave = s.w | 0; SV.t = +s.t || 0; SV.toSpawn = s.n | 0; SV.ext = +s.ex || 0; SV.result = typeof s.res === 'string' ? s.res : '';
  if (was === 'wave' && SV.phase === 'prep') { survResupplyMe(); SVSTAT.bestWave = Math.max(SVSTAT.bestWave, SV.wave); }
  if (was === 'prep' && SV.phase === 'wave' && !PL.ent.alive) { respawnPlayer(); hideDeathScreen(); }
  if (SV.phase === 'over' && was !== 'over') { SVSTAT.bestWave = Math.max(SVSTAT.bestWave, SV.result === 'win' ? SV.wave : SV.wave - 1); }
  if (Array.isArray(s.z)) for (const a of s.z) {
    if (!Array.isArray(a)) continue;
    const z = ZOMBIES[a[0] | 0]; if (!z) continue;
    const kind = Object.keys(ZKIND)[a[1] | 0] || 'shambler', x = (+a[2] || 0) / 20, y = (+a[3] || 0) / 20, zz = (+a[4] || 0) / 20, yaw = (+a[5] || 0) / 100;
    if (a[6]) {
      if (z.off || !z.alive) { zombieSpawn(kind, x, zz, yaw); z.zNet = { x, y, z: zz, yaw, atk: 0 }; const sk = ZSKINS[a[10] | 0]; if (sk) { z.skin = sk; soldierLook(z.model, sk, 1); } }
      z.zNet = z.zNet || {}; Object.assign(z.zNet, { x, y, z: zz, yaw }); if (a[7]) z.zNet.atk = 1;
    } else if (z.alive && !z.off) {
      const dir = _svA.set(z.vel.x, 0, z.vel.z); if (dir.lengthSq() < 1e-4) dir.set(Math.sin(z.yaw), 0, Math.cos(z.yaw)); dir.normalize().negate();
      z.lastForce = { dir: dir.clone(), mag: 2.2, lift: 0.8, part: a[9] ? 'head' : 'body' }; z.alive = false; z.health = 0; z.respawnT = 5; z.model.rag = null;
      if (a[8] && a[8] === NET.me) survKillCredit(kind, !!a[9]);
    }
  }
  if (Array.isArray(s.b)) s.b.forEach((L, i) => survOpenIn(SURV.open[i], L));
  if (Array.isArray(s.bx)) for (const a of s.bx) if (Array.isArray(a)) survOpenIn(SURV.open[a[0] | 0], a.slice(1));
  if (Array.isArray(s.p)) {
    let moved = false;
    s.p.forEach((a, i) => {
      const p = SURV.props[i]; if (!p || !Array.isArray(a) || p.carried === PL.ent) return;
      const hp = clamp(+a[3] || 0, 0, p.max), x = (+a[0] || 0) / 20, z = (+a[1] || 0) / 20, y = (+a[5] || 0) / 20;
      if (hp < p.hp && hp > 0) p.shake = 1;
      if (p.hp > 0 && hp <= 0) { const c = _svA.set(p.x, p.y + p.h * 0.5, p.z); for (let k = 0; k < 18; k++) FX.smoke.spawn(c.x + rand(-0.5, 0.5), c.y + rand(-0.4, 0.4), c.z + rand(-0.5, 0.5), rand(-2, 2), rand(0.3, 2.5), rand(-2, 2), rand(0.3, 0.8), 0.03, 0.02, 0.42, 0.33, 0.25, 1, 1, 9, 0.5); sfxBarr(c, 'break'); }
      if (x !== p.x || z !== p.z || y !== p.y || hp !== p.hp) moved = true;
      // (le meuble que l'on vient de poser : un paquet parti avant que l'hôte l'ait reçu le dit encore porté, on ne le reprend pas en main)
      if (a[4] === NET.me && p.dropT && MATCH.time - p.dropT < 1.5) return;
      p.x = x; p.z = z; p.y = y; p.ry = (+a[2] || 0) / 100; p.hp = hp; p.carried = a[4] ? (a[4] === NET.me ? PL.ent : NET.remotes.get(a[4]) || null) : null;
      if (p.carried === PL.ent) SACT.carry = p;
      survPropPlace(p);
    });
    if (moved) SURV.navDirty = true; // (chaque meuble posé range sa boîte à sa nouvelle place : survPropPlace)
  }
  if (Array.isArray(s.r)) { SURV_RES.planks = s.r[0] | 0; SURV_RES.tools = !!s.r[1]; SURV_RES.nails = !!s.r[2]; const pw = !!s.r[3]; if (pw !== SV.power) survLights(pw); SV.power = pw; SV.truck = !!s.r[4]; SV.blackT = s.r[5] ? Math.max(SV.blackT, 1) : 0; SURV_RES.metal = s.r[6] | 0; }
  if (Array.isArray(s.c)) s.c.forEach((n, i) => { const c = SURV.caches[i]; if (c) { const was = c.left; c.left = n | 0; if (c.kind === 'ammo' && was !== c.left) survAmmoBoxLook(c); } });
  if (Array.isArray(s.o)) s.o.forEach((d, i) => { if (SURV.objs[i]) SURV.objs[i].done = !!d; });
  if (s.d !== undefined) survDropSync(s.d);
  if (s.l !== undefined) survLootSync(s.l);
}
/* Une ouverture dans le paquet de l'hôte : planches, meuble posé derrière, tôle, vantail ; chez l'invité, l'état reçu */
const survOpenOut = (op) => op.slots.map((x) => Math.round(x.hp)).concat([op.prop ? op.prop.id : -1, Math.round(op.plate.hp)], op.gate ? [Math.round(op.gate.hp), op.gate.down ? 1 : 0] : []);
function survOpenIn(op, L) {
  if (!op || !Array.isArray(L)) return;
  op.slots.forEach((x, j) => { const hp = +L[j] || 0; if (hp > 0 && x.hp <= 0) { survBoardAdd(op, x); x.hp = hp; survBoardLook(op, x); } else if (hp <= 0 && x.hp > 0) { survBoardFx(op, x, true); survBoardRemove(op, x); } else if (hp > 0 && hp !== x.hp) { if (hp < x.hp) survBoardFx(op, x, false); x.hp = hp; survBoardLook(op, x); } });
  const pid = L.length > op.slots.length ? +L[op.slots.length] : -1; op.prop = pid >= 0 ? SURV.props[pid | 0] || null : null;
  const ph = +L[op.slots.length + 1] || 0, P = op.plate;
  if (ph > 0 && P.hp <= 0) { survPlateAdd(op); P.hp = ph; survPlateLook(op); } else if (ph <= 0 && P.hp > 0) { survPlateFx(op, true); survPlateRemove(op); } else if (ph > 0 && ph !== P.hp) { if (ph < P.hp) survPlateFx(op, false); P.hp = ph; survPlateLook(op); }
  const G = op.gate;
  if (G && L.length > op.slots.length + 3) {
    const gh = Math.max(0, +L[op.slots.length + 2] || 0), gd = !!L[op.slots.length + 3];
    if (gh < G.hp) survGateFx(op, gh <= 0);
    G.hp = gh; if (gd !== G.down || (gh <= 0 && G.down)) survGateSet(op, gd); else survGateLook(op);
  }
}
/* L'hôte a changé quelque chose à publier tout de suite */
function survPub(kind, id) {
  SV.dirty = true; if (MATCH.online && NET.role === 'host') NET.flush = true;
  if (kind === 'b') { if (id === undefined) SV.bAll = true; else (SV.bDirty || (SV.bDirty = new Set())).add(id); } // (les ouvertures changées : survNetSnap n'envoie qu'elles)
}
/* Un invité demande (clouer, réparer, prendre, pousser, objectif) */
function survNetReq(k, id) { netEvent({ k: 'sq', a: k, o: id | 0 }); }
/* Touche d'un invité sur un mort : annoncée à l'hôte (qui décompte), la croix tout de suite chez le tireur */
function survNetZombieHit(z, dmg, a, head, dir) {
  if (a !== PL.ent) return;
  netEvent({ k: 'zh', z: ZOMBIES.indexOf(z), d: Math.round(dmg), h: head ? 1 : 0, x: +(dir ? dir.x : 0).toFixed(2), y: +(dir ? dir.y : 0).toFixed(2), zz: +(dir ? dir.z : 0).toFixed(2) });
  hitFeedback(head, false); z.zFlinch = Math.min(1, z.zFlinch + 0.5);
}
/* Événements reçus (netEventIn) : vrai s'ils sont de la survie */
function survNetEvent(e, ev) {
  if (!SV.on) return false;
  if (ev.k === 'zh') { if (!survLocal()) return true; const z = ZOMBIES[ev.z | 0]; if (z && z.alive) applyDamage(z, clamp(+ev.d || 0, 0, 400), e, 'net', !!ev.h, new V3(+ev.x || 0, +ev.y || 0, +ev.zz || 0), null); return true; }
  if (ev.k === 'sq') {
    if (!survLocal()) return true;
    if (ev.a === 'obj') survObjDone(ev.o | 0, e); else if (ev.a === 'drop') survPropDropNet(ev, e);
    else if (ev.a === 'gshot') { const op = SURV.open[ev.o | 0]; if (op && op.gate && op.gate.type === 'glass') survGateHit(op, clamp(+ev.d || 0, 0, 400)); }
    else if (['nail', 'fix', 'take', 'carry', 'plate', 'loot', 'gate'].includes(ev.a)) survApply(ev.a, ev.o | 0, e);
    return true;
  }
  if (ev.k === 'ag') { if (ev.to === NET.me && typeof ev.a === 'string') { if (ev.a === 'dropmark') SAMMO.dropTaken = ev.d | 0; else if (ev.a === 'med') survMedApply(); else if (['wave', 'box', 'pouch', 'full', 'drop', 'emergency', 'nade'].includes(ev.a)) survAmmoApply(ev.a); } return true; }
  if (ev.k === 'af') { if (survLocal()) e.svAmmo = clamp(+ev.f || 0, 0, 1); return true; }
  if (ev.k === 'dn') { e.downed = !!ev.s; e.dnRev = !!ev.r; return true; }
  if (ev.k === 'rv') { if (ev.to === NET.me) survRevive(0.5); return true; }
  if (ev.k === 'zb') { if (ev.to === NET.me && PL.ent.alive) { const z = ZOMBIES[ev.z | 0] || PL.ent; applyDamage(PL.ent, clamp(+ev.d || 0, 0, 80), z, 'Zombie', false, new V3(+ev.x || 0, 0.2, +ev.zz || 0), z.pos.clone()); } return true; }
  if (ev.k === 'ss') { if (ev.to === NET.me) survStatMine(ev.s); return true; }
  if (ev.k === 'sm') { if (ev.to === NET.me && typeof ev.m === 'string') hudMsg(ev.m.slice(0, 80), 'xp', 2.2); return true; }
  return false;
}
/* Coup d'un mort sur un joueur distant (chez l'hôte) : envoyé à sa machine, qui l'applique */
function survBiteRemote(z, T, dmg, dir) { netEvent({ k: 'zb', to: netIdOf(T), z: ZOMBIES.indexOf(z), d: Math.round(dmg), x: +dir.x.toFixed(2), zz: +dir.z.toFixed(2) }); }
/* Où errent les morts sans proie : vers les vivants (le directeur sait où ils sont, les morts « les sentent ») ; s'il est dans un bâtiment, une des
   ouvertures de ce bâtiment (chaque mort la sienne : ils font le tour), sinon quelques mètres autour de lui. (Une ouverture de n'importe quel
   bâtiment de la carte, jusqu'ici : un mort pouvait tourner autour de l'appentis toute la vague, la vague ne finissait pas.) */
function survHomeOf(e) {
  let h = null, bd = 1e9; for (const p of survHumans()) { if (!p.alive) continue; const d = hyp(p.pos.x - e.pos.x, p.pos.z - e.pos.z) - (p.downed ? 0 : 3); if (d < bd) { bd = d; h = p; } }
  if (!h) { const op = SURV.open[(e.zSeed * SURV.open.length) | 0]; return op ? survOpenAnchor(op, 'out', _svA) : _svA.set(0, 0, 0); }
  // le siège (la galerie) : il va vers les vivants, ou force une entrée quand rien d'ouvert n'y mène
  if (survDef().siege) {
    const hb = survBldAt(h.pos), zb = survBldAt(e.pos), a = e.zSeed * TAU, toH = _svB.set(h.pos.x + Math.cos(a) * 2.5, h.pos.y, h.pos.z + Math.sin(a) * 2.5);
    // dehors, et aucun chemin ouvert vers les vivants : il marche sur l'une des entrées (plutôt l'une des plus proches, choisie une fois, gardée
    // jusqu'à ce qu'il arrive), par son côté du dedans : le chemin passe par elle et il la force. Un chemin ouvert vers eux (une entrée a cédé) : il
    // le prend. (Viser le dedans d'une entrée close quand une autre était ouverte l'envoyait faire le tour par celle-ci ; entre deux coups de feu
    // entendus, qui l'attiraient ailleurs, il allait et venait le long du mur sans jamais entrer)
    if (hb && zb !== hb && !survOpenReach(e.pos, toH)) {
      const L = SURV.open.filter((o) => o.ext && o.bld === hb && !survOpenWalled(o));
      if (L.length) {
        if (e.zHomeSeed !== e.zSeed || !L.includes(SURV.open[e.zHomeOp])) { L.sort((p, q) => survOpenDist(p, e.pos) - survOpenDist(q, e.pos)); e.zHomeOp = L[Math.min(L.length - 1, Math.floor(e.zSeed * e.zSeed * L.length))].id; e.zHomeSeed = e.zSeed; }
        const op = SURV.open[e.zHomeOp];
        if (!survOpenClear(op)) return survOpenAnchor(op, 'in', _svA);
      }
    }
    if (hb) return _svA.copy(toH);
  }
  const room = survRoomAt(h.pos), L = room ? SURV.open.filter((o) => o.room === room) : null;
  if (L && L.length) return survOpenAnchor(L[(e.zSeed * L.length) | 0], 'out', _svA);
  const a = e.zSeed * TAU; return _svA.set(h.pos.x + Math.cos(a) * 3, h.pos.y, h.pos.z + Math.sin(a) * 3);
}
/* Apparition d'un survivant : à l'une des places de la carte (la maison), la plus dégagée */
function survSpawnSpot(e) {
  const L = (CURMAP.def && CURMAP.def.spawns) || [[0, 0]];
  let best = L[0], bs = -1e9;
  for (const p of L) { let dmin = 1e9; for (const o of entities) if (o !== e && o.alive && !o.isZombie) dmin = Math.min(dmin, hyp(o.pos.x - p[0], o.pos.z - p[1])); const s = Math.min(dmin, 6) + Math.random(); if (s > bs) { bs = s; best = p; } }
  return spawnSpot(e, best[0], best[1], null);
}
