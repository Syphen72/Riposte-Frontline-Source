/* Banc du chien robot (série dog, src/08l-chien.js) : node chien.js [dossier de captures]   (MAP=sable ; PAGE=autre version)
   Dans la vraie boucle de partie (matchTick) : appel près du joueur, dépliage, suite du maître qui s'éloigne, tir sur un ennemi visible
   (il meurt), pieds posés au sol pendant la marche (aucun pied d'appui à plus de 12 cm du sol), aucune valeur non finie dans les pattes,
   autodestruction à bout de points de vie (un ennemi tout près est touché). Avec un dossier : le chien qui trotte, de profil. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    const foes = entities.filter((e) => !e.isPlayer && !allied(e, PL.ent));
    for (const e of entities) if (!e.isPlayer) { e.alive = false; e.respawnT = 1e9; }
    const put = (e, x, z) => { e.alive = true; e.health = 100; e.protT = 0; e.respawnT = 1e9; e.pos.set(x, 0, z); e.vel.set(0, 0, 0); if (e.model) { e.model.root.visible = true; for (let k = 0; k < 4; k++) poseSoldier(e, 1 / 30); e.model.root.updateMatrixWorld(true); } };
    let worstFoot = 0, bad = 0;
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { PL.ent.health = 1e9; if (f) f(i); matchTick(1 / 30, true); const d = UNITS.find((u) => u.kind === 'dog' && !u.gone); if (d && d.feet) { for (const ft of d.feet) { if (!ft.air) worstFoot = Math.max(worstFoot, Math.abs(ft.p.y - groundHeight(ft.p.x, ft.p.z, ft.p.y + 0.4))); } for (const L of d.m.legs) if (![L.hip.rotation.x, L.hip.rotation.z, L.knee.rotation.x].every(Number.isFinite)) bad++; } } };
    PL.ent.pos.set(0, 0, 24); PL.yaw = PL.ent.yaw = 0;
    PL.ks.dog = true; useDog();
    const d = UNITS.find((u) => u.kind === 'dog');
    if (!d) { fail('chien non appelé'); return out; }
    out.appel = { d: +d.pos.distanceTo(PL.ent.pos).toFixed(1), etat: d.state };
    run(1.5); if (d.state !== 'live') fail('chien non déplié après 1,5 s (' + d.state + ')');
    // le maître s'éloigne de 14 m le long de la rue : le chien suit
    run(6, () => { PL.ent.pos.z = Math.max(10, PL.ent.pos.z - 0.08); });
    out.suite = { maitre: +PL.ent.pos.z.toFixed(1), distance: +d.pos.distanceTo(PL.ent.pos).toFixed(1), pieds: +worstFoot.toFixed(3) };
    if (d.pos.distanceTo(PL.ent.pos) > 4.5) fail('le chien ne suit pas son maître (' + d.pos.distanceTo(PL.ent.pos).toFixed(1) + ' m)');
    if (worstFoot > 0.12) fail('un pied d’appui décolle du sol pendant la marche (' + worstFoot.toFixed(2) + ' m)');
    if (bad) fail('valeurs non finies dans les pattes (' + bad + ')');
    // un ennemi à 12 m devant le chien
    const v = foes[0]; put(v, d.pos.x + 1, d.pos.z - 12); run(5, () => { v.respawnT = 1e9; });
    out.combat = { vivant: v.alive, pv: Math.round(v.health) };
    if (v.alive) fail('ennemi à 12 m du chien : il survit (' + Math.round(v.health) + ' pv)');
    // à bout : autodestruction, qui touche un ennemi tout près
    const w = foes[1] || foes[0]; put(w, d.pos.x + 1.5, d.pos.z + 0.5);
    unitDamage(d, 1e4, w); out.fin = d.state;
    if (d.state !== 'dying') fail('à bout de points de vie, le chien ne s’autodétruit pas (' + d.state + ')');
    run(1.6, () => { w.respawnT = 1e9; if (w.alive) w.pos.set(d.pos.x + 1.5, 0, d.pos.z + 0.5); });
    out.explosion = { parti: !!d.gone, ennemi: w.alive ? Math.round(w.health) + ' pv' : 'mort' };
    if (!d.gone) fail('le chien est encore là après son autodestruction');
    if (w.alive && w.health > 60) fail('l’autodestruction ne touche pas l’ennemi à 1,5 m');
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT && !R.fails.length) {
    await page.evaluate(() => {
      document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
      clearUnits(); PL.ent.pos.set(0, 0, 24); PL.yaw = PL.ent.yaw = 0; PL.ks.dog = true; useDog();
      for (let i = 0; i < 45; i++) { PL.ent.health = 1e9; matchTick(1 / 30, true); }
      for (let i = 0; i < 24; i++) { PL.ent.health = 1e9; PL.ent.pos.z -= 0.15; matchTick(1 / 30, true); }
      const d = UNITS.find((u) => u.kind === 'dog'); window.__dog = d;
      MATCH.state = 'capture'; VM.root.visible = false;
      camera.position.set(d.pos.x + 2.6, 0.9, d.pos.z + 0.4); camera.lookAt(d.pos.x, 0.45, d.pos.z); camera.fov = 55; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, 'chien-profil.png'), timeout: 240000 });
    await page.evaluate(() => { const d = window.__dog; camera.position.set(d.pos.x - 1.6, 1.3, d.pos.z - 2.4); camera.lookAt(d.pos.x, 0.45, d.pos.z); for (const l of csm.lights) l.shadow.needsUpdate = true; });
    await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'chien-face.png'), timeout: 240000 });
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('chien robot : rien à signaler');
})();
