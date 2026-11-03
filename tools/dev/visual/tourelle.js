/* Banc de la tourelle automatique (série sentry, src/08j-tourelle.js) : node tourelle.js [dossier de captures]   (MAP=sable ; PAGE=autre version)
   Déploiement, tir sur un ennemi visible (il meurt), aucun tir sur un allié, un bot ennemi qui la prend pour cible (elle perd des points),
   une roquette qui la détruit. Le modèle et ses mouvements (novembre 2026) : patins au sol pendant tout le dépliage, une vingtaine de
   maillages au plus, tête sans à-coup (jamais plus vite que sa vitesse bornée), recul du canon et diode rouge au tir, avarie sous la moitié
   de ses points, épave qui reste le temps de fumer sans être touchée puis disparaît, tourelle à court qui se replie et disparaît, points de
   vie publiés au réseau. Avec un dossier : captures du dépliage, de la veille, du tir, de l'avarie et de l'épave. */
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
      // d'un point dégagé, à 14 m, qui voit la tourelle (avant novembre 2026, on tirait de l'intérieur d'un bloc : le rayon ignorait la boîte de départ)
      const aimAt = new V3(t.pos.x, t.pos.y + 0.6, t.pos.z); let o = null;
      for (let k = 0; k < 16 && !o; k++) { const a = (k / 16) * TAU, c = new V3(t.pos.x + Math.sin(a) * 14, 0, t.pos.z + Math.cos(a) * 14); c.y = groundHeight(c.x, c.z, 3, 0.3) + 1.2; if (lineClear(c, aimAt)) o = c; }
      if (!o) { fail('aucun point dégagé d’où tirer la roquette sur la tourelle'); return out; }
      const dir = aimAt.clone().sub(o).normalize();
      rocketFire(foes[0], o, dir, WEAPONS.rpg7); tick(1);
      out.roquette = t.dead ? 'détruite' : Math.round(t.hp) + ' pv';
      if (!t.dead) fail('roquette sur la tourelle : elle tient (' + Math.round(t.hp) + ' pv)');
    }
    // modèle : patins au sol pendant le dépliage, maillages, tête sans à-coup, recul et diode au tir
    clearUnits(); for (const e of entities) if (!e.isPlayer) put(e, 30, 60);
    PL.ks.sentry = true; useSentry(); const u = UNITS.find((x) => x.kind === 'turret' && !x.dead);
    let padWorst = 0, meshes = 0; u.m.root.traverse((o) => { if (o.isMesh) meshes++; });
    const pw = new V3();
    for (let i = 0; i < 70; i++) { tick(1 / 30); u.m.root.updateMatrixWorld(true); for (const L of u.m.legs) { L.pad.getWorldPosition(pw); padWorst = Math.max(padWorst, Math.abs(pw.y - groundHeight(pw.x, pw.z, pw.y + 0.3))); } }
    out.modele = { maillages: meshes, patins: +padWorst.toFixed(3), etat: u.state };
    if (meshes > 28) fail('tourelle trop lourde : ' + meshes + ' maillages');
    if (padWorst > 0.04) fail('un patin quitte le sol pendant le dépliage (' + padWorst.toFixed(3) + ' m)');
    let jump = 0, y0 = u.aimY; tick(3, () => { const d = Math.abs(Math.atan2(Math.sin(u.aimY - y0), Math.cos(u.aimY - y0))); jump = Math.max(jump, d); y0 = u.aimY; });
    const w = foes[2] || foes[0]; put(w, u.pos.x - 6, u.pos.z - 8); let rec = 0, ledFire = false, jump2 = 0; y0 = u.aimY;
    tick(2.5, () => { w.health = 1e9; w.alive = true; rec = Math.max(rec, u.recoil); ledFire = ledFire || u.m.led.material === SENTRY_MAT.led.fire; const d = Math.abs(Math.atan2(Math.sin(u.aimY - y0), Math.cos(u.aimY - y0))); jump2 = Math.max(jump2, d); y0 = u.aimY; });
    out.mouvements = { veilleMax: +jump.toFixed(3), poursuiteMax: +jump2.toFixed(3), recul: +rec.toFixed(3), diodeRouge: ledFire };
    if (jump > 0.85 / 30 + 1e-3 || jump2 > SENTRY.yawSpd / 30 + 1e-3) fail('la tête tourne par à-coups (' + jump.toFixed(3) + ' / ' + jump2.toFixed(3) + ' rad par image)');
    if (rec < 0.02) fail('pas de recul du canon au tir'); if (!ledFire) fail('la diode ne passe pas au rouge au tir');
    put(w, 30, 60);
    // avarie, puis destruction : l'épave reste, ne prend plus les coups, puis disparaît
    u.hp = SENTRY.hp * 0.3; tick(0.5); const fxk = u.hpk; out.avarie = +fxk.toFixed(2);
    if (!(fxk < 0.5)) fail('les points de vie de la tourelle ne se reportent pas sur son avarie');
    if (sentryPub(u).length < 5 || sentryPub(u)[4] !== 3) fail('les points de vie de la tourelle ne sont pas publiés (' + JSON.stringify(sentryPub(u)) + ')');
    unitDamage(u, 1e4, foes[0], 'raw'); tick(3); const hitDead = rayUnits(foes[0], new V3(u.pos.x, u.pos.y + 0.6, u.pos.z + 5), new V3(0, 0, -1), 20);
    out.epave = { morte: u.dead, partie: !!u.gone, touchee: !!hitDead };
    if (!u.dead || u.gone) fail('détruite, la tourelle ne laisse pas d’épave (morte ' + u.dead + ', partie ' + !!u.gone + ')'); if (hitDead) fail('l’épave prend encore les coups');
    tick(5.5); if (!u.gone) fail('l’épave ne disparaît pas'); tick(0.2);
    // à court : elle se replie et disparaît
    PL.ks.sentry = true; useSentry(); const q = UNITS.find((x) => x.kind === 'turret' && !x.dead); tick(2.5); q.ammo = 0; tick(0.1);
    out.aCourt = { morte: q.dead, epave: !!q.wreck }; tick(2.2); out.aCourt.partie = !!q.gone;
    if (!q.dead || q.wreck || !q.gone) fail('à court de munitions, la tourelle ne se replie pas puis ne disparaît pas (' + JSON.stringify(out.aCourt) + ')');
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
    // planche : dépliage, veille, tir, avarie, épave, vus de près
    const shot = async (name, f) => { await page.evaluate(f); await page.evaluate(() => { PL.ent.health = 100; const U = FinalShader.uniforms; U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0; }); await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, name), timeout: 240000 }); };
    const cam = `(t, d, h, a) => { camera.position.set(t.pos.x + Math.sin(a) * d, t.pos.y + h, t.pos.z + Math.cos(a) * d); camera.lookAt(t.pos.x, t.pos.y + 0.55, t.pos.z); camera.fov = 45; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }`;
    const step = `(n, f) => { for (let i = 0; i < n; i++) { MATCH.time += 1 / 30; if (f) f(); updateUnits(1 / 30); updateFx(1 / 30); } }`;
    await shot('tourelle-depliage.png', `(() => { const cam = ${cam}, step = ${step}; clearUnits(); for (const e of entities) if (!e.isPlayer) { e.alive = false; e.model.root.visible = false; } PL.ks.sentry = true; useSentry(); const t = UNITS.find((u) => u.kind === 'turret'); window.__t = t; step(30); cam(t, 2.3, 1.0, 2.2); })()`);
    await shot('tourelle-veille.png', `(() => { const cam = ${cam}, step = ${step}, t = window.__t; step(80); cam(t, 2.0, 1.05, 0.9); })()`);
    await shot('tourelle-tir.png', `(() => { const cam = ${cam}, step = ${step}, t = window.__t, v = entities.find((e) => !e.isPlayer && !allied(e, PL.ent)); v.alive = true; v.health = 1e9; v.model.root.visible = true; v.pos.set(t.pos.x - 3, 0, t.pos.z - 11); for (let k = 0; k < 4; k++) poseSoldier(v, 1 / 30); step(42, () => { v.health = 1e9; PL.ent.health = 1e9; }); window.__v = v; cam(t, 1.7, 1.0, -2.3); })()`);
    await shot('tourelle-avarie.png', `(() => { const cam = ${cam}, step = ${step}, t = window.__t, v = window.__v; v.alive = false; v.model.root.visible = false; t.hp = SENTRY.hp * 0.2; step(40); cam(t, 2.1, 1.1, 1.6); })()`);
    await shot('tourelle-epave.png', `(() => { const cam = ${cam}, step = ${step}, t = window.__t; unitDamage(t, 1e4, null, 'raw'); step(50); cam(t, 2.0, 1.2, 0.6); })()`);
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('tourelle : rien à signaler');
})();
