/* Banc des mines (src/08i-mines.js, unités de src/08h-unites.js) : node mines.js   (MAP=sable ; PAGE=autre version)
   Classe Démolition (mines) : pose, armement, déclenchement par un ennemi (pas par un allié), claymore qui ne frappe que devant elle,
   balle qui détruit une mine sans explosion, souffle qui en fait sauter une. */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    const tick = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { MATCH.time += 1 / 30; updateUnits(1 / 30); } };
    const put = (e, x, z, yaw) => { e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, 0, z); e.vel.set(0, 0, 0); e.yaw = yaw || 0; if (e.model) { e.model.root.visible = true; for (let k = 0; k < 4; k++) poseSoldier(e, 1 / 30); e.model.root.updateMatrixWorld(true); } };
    LOCK.fallback = true; Settings.loadout = 4; startMatch({});
    const foes = entities.filter((e) => !e.isPlayer && !allied(e, PL.ent)), friends = entities.filter((e) => !e.isPlayer && allied(e, PL.ent));
    for (const e of entities) if (!e.isPlayer) put(e, 30, 60); // tout le monde au loin
    out.equipement = PL.nadeType + ' x' + PL.nades;
    if (PL.nadeType !== 'mine') fail('la classe Démolition ne porte pas de mines (' + PL.nadeType + ')');
    // pose devant le joueur, au milieu d'une rue
    put(PL.ent, 0, 20, 0); PL.ent.health = 1e9;
    if (!minePlaceNow(PL.ent)) fail('pose refusée au milieu de la rue');
    const m = UNITS.find((u) => u.kind === 'mine');
    out.pose = { unites: UNITS.length, reste: PL.nades, etat: m && m.state };
    if (!m) { fail('aucune mine posée'); return out; }
    tick(2); out.armee = m.state;
    if (m.state !== 'armed') fail('mine non armée après 2 s (' + m.state + ')');
    // un allié passe dessus : rien
    if (friends[0]) { put(friends[0], m.pos.x + 0.5, m.pos.z); tick(0.5); if (m.state !== 'armed') fail('un allié déclenche la mine'); put(friends[0], 30, 60); }
    // un ennemi s'approche : elle bondit et explose
    const v = foes[0]; put(v, m.pos.x + 1.2, m.pos.z); tick(1);
    out.ennemi = { mine: m.dead ? 'explosée' : m.state, vivant: v.alive, pv: Math.round(v.health) };
    if (!m.dead) fail('ennemi à 1,2 m : la mine ne part pas');
    if (v.alive && v.health > 40) fail('mine explosée sous un ennemi : ' + Math.round(v.health) + ' pv');
    // claymore : devant elle, oui ; derrière, non
    PL.nadeType = 'claymore'; PL.nades = 2; put(PL.ent, 0, 20, 0);
    minePlaceNow(PL.ent); const c = UNITS.find((u) => u.kind === 'claymore' && !u.dead); tick(2);
    if (!c || c.state !== 'armed') fail('claymore non armée');
    else {
      const b = foes[1] || foes[0]; put(b, c.pos.x, c.pos.z + 1.6); tick(0.5); // derrière (elle regarde vers -z)
      if (c.dead || c.state !== 'armed') fail('claymore déclenchée par un ennemi derrière elle');
      put(b, c.pos.x + 0.3, c.pos.z - 2.4); tick(0.5); // devant
      out.claymore = { etat: c.dead ? 'explosée' : c.state, vivant: b.alive, pv: Math.round(b.health) };
      if (!c.dead) fail('ennemi devant la claymore à 2,4 m : elle ne part pas');
      if (b.alive) fail('claymore : l’ennemi devant survit (' + Math.round(b.health) + ' pv)');
    }
    // une balle détruit une mine sans explosion (un ennemi tout près reste indemne)
    PL.nadeType = 'mine'; PL.nades = 2; put(PL.ent, 0, 20, 0); minePlaceNow(PL.ent); const m2 = UNITS.find((u) => u.kind === 'mine' && !u.dead); tick(2);
    const w = foes[0]; put(w, m2.pos.x + 3.5, m2.pos.z + 1.5);
    const o = new V3(m2.pos.x + 4, 1.6, m2.pos.z), d = new V3(m2.pos.x, m2.pos.y + 0.05, m2.pos.z).sub(o).normalize();
    fireRay(w, o, d, WEAPONS.m4, null, false); tick(0.3);
    out.balle = { mine: m2.dead ? (m2.boom ? 'explosée' : 'détruite') : m2.state, ennemi: Math.round(w.health) };
    if (!m2.dead) fail('balle dans la mine : elle tient');
    if (m2.boom) fail('balle dans la mine : elle explose au lieu d’être détruite');
    // un souffle tout proche la fait sauter
    PL.nades = 2; minePlaceNow(PL.ent); const m3 = UNITS.find((u) => u.kind === 'mine' && !u.dead); tick(2);
    explode(m3.pos.clone().add(new V3(1, 0.3, 0)), foes[0], 'Grenade', 7.5, 150); tick(0.2);
    out.souffle = m3.dead ? (m3.boom ? 'explosée' : 'détruite') : m3.state;
    if (!m3.boom) fail('grenade à 1 m d’une mine : elle ne saute pas');
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('mines : rien à signaler');
})();
