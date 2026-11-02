/* Banc de la tourelle automatique (série sentry, src/08j-tourelle.js) : node tourelle.js [dossier de captures]   (MAP=sable ; PAGE=autre version)
   Déploiement, tir sur un ennemi visible (il meurt), aucun tir sur un allié, un bot ennemi qui la prend pour cible (elle perd des points),
   une roquette qui la détruit. Avec un dossier : une capture de la tourelle qui tire. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    const tick = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { MATCH.time += 1 / 30; if (f) f(); updateUnits(1 / 30); updateRockets(1 / 30); updateFx(1 / 30); } };
    const put = (e, x, z, yaw) => { e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, 0, z); e.vel.set(0, 0, 0); e.yaw = yaw || 0; e.visible = false; e.target = null; if (e.model) { e.model.root.visible = true; for (let k = 0; k < 4; k++) poseSoldier(e, 1 / 30); e.model.root.updateMatrixWorld(true); } };
    LOCK.fallback = true; startMatch({});
    const foes = entities.filter((e) => !e.isPlayer && !allied(e, PL.ent)), friends = entities.filter((e) => !e.isPlayer && allied(e, PL.ent));
    for (const e of entities) if (!e.isPlayer) put(e, 30, 60);
    put(PL.ent, 0, 24, 0); PL.ent.health = 1e9;
    PL.ks.sentry = true; useSentry();
    const t = UNITS.find((u) => u.kind === 'turret');
    if (!t) { fail('tourelle non posée'); return out; }
    tick(2.5); out.etat = t.state;
    if (t.state !== 'live') fail('tourelle non déployée après 2,5 s (' + t.state + ')');
    if (PL.ks.sentry) fail('la série reste disponible après la pose');
    // un allié devant : elle ne tire pas
    if (friends[0]) { put(friends[0], t.pos.x + 0.5, t.pos.z - 10); const a0 = t.ammo; tick(2, () => { friends[0].health = 100; }); if (t.ammo !== a0) fail('la tourelle tire sur un allié'); put(friends[0], 30, 60); }
    // un ennemi à 12 m devant : il meurt
    const v = foes[0]; put(v, t.pos.x + 1, t.pos.z - 12); const a1 = t.ammo; tick(4);
    out.ennemi = { vivant: v.alive, pv: Math.round(v.health), coups: a1 - t.ammo };
    if (v.alive) fail('ennemi à 12 m devant la tourelle : il survit (' + Math.round(v.health) + ' pv)');
    // un bot ennemi invulnérable qui la voit : il la prend pour cible
    const b = foes[1] || foes[0]; put(b, t.pos.x - 2, t.pos.z - 9); const hp0 = t.hp; tick(3, () => { b.health = 1e9; b.alive = true; b.visible = false; b.target = null; });
    out.botContreTourelle = { avant: hp0, apres: Math.round(t.hp), mort: t.dead };
    if (!(t.hp < hp0) && !t.dead) fail('un bot ennemi qui voit la tourelle ne lui tire pas dessus');
    put(b, 30, 60);
    // une roquette : elle est détruite
    if (!t.dead) {
      const o = new V3(t.pos.x + 14, 1.2, t.pos.z + 3), dir = new V3(t.pos.x, t.pos.y + 0.6, t.pos.z).sub(o).normalize();
      rocketFire(foes[0], o, dir, WEAPONS.rpg7); tick(1);
      out.roquette = t.dead ? 'détruite' : Math.round(t.hp) + ' pv';
      if (!t.dead) fail('roquette sur la tourelle : elle tient (' + Math.round(t.hp) + ' pv)');
    }
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT) {
    await page.evaluate(() => {
      document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
      const foes = entities.filter((e) => !e.isPlayer && !allied(e, PL.ent));
      clearUnits(); PL.ent.pos.set(0, 0, 24); PL.ent.yaw = 0; PL.ks.sentry = true; useSentry();
      const t = UNITS.find((u) => u.kind === 'turret'), v = foes[0];
      v.alive = true; v.health = 1e9; v.pos.set(t.pos.x + 2, 0, t.pos.z - 14); v.model.root.visible = true;
      for (let i = 0; i < 90; i++) { MATCH.time += 1 / 30; v.health = 1e9; poseSoldier(v, 1 / 30); updateUnits(1 / 30); updateFx(1 / 30); }
      MATCH.state = 'capture'; VM.root.visible = false;
      camera.position.set(t.pos.x + 2.2, 1.3, t.pos.z + 2.4); camera.lookAt(t.pos.x, 0.6, t.pos.z - 3); camera.fov = 60; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, 'tourelle.png'), timeout: 240000 });
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('tourelle : rien à signaler');
})();
