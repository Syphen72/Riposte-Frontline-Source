/* Banc des dégâts du décor (src/04c-degats.js) : vitres, véhicules, barils et bouteilles explosifs, caisses qui volent en éclats.
   node degats.js [dossier de captures]   (MAP=sable par défaut ; PAGE=autre version ; CAPTURE=0 sans images)
   Sort en erreur au premier défaut : vitre qui ne se brise pas sous une balle ou un souffle, vitre que la remise à zéro ne répare pas,
   véhicule qui ne s'embrase pas ou n'explose pas, collisions de l'épave mal posées, baril percé qui n'explose pas, explosion qui
   n'en allume pas une voisine, caisse qui ne casse pas. Avec un dossier : captures d'une façade aux vitres brisées et d'une épave en feu. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const MAP = process.env.MAP || 'sable', OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  await page.evaluate(() => { MATCH.state = 'capture'; MATCH.time = 1; });
  const R = await page.evaluate(() => {
    const out = { fails: [], vitres: {}, vehicules: {}, barils: {}, caisses: {} }, fail = (m) => out.fails.push(m);
    const tick = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { MATCH.time += 1 / 30; dmgTick(1 / 30); updateProps(1 / 30); } };
    // vitres : combien, et combien rattachées à leurs sommets
    const P = DMG.panes, mapped = P.filter((p) => p.mesh && p.vi.length >= 4);
    out.vitres = { n: P.length, rattachees: mapped.length, maillages: WORLD.win.length };
    if (!P.length && WORLD.win.length) fail('aucune vitre enregistrée'); // (une carte sans fenêtres de façade, Simoun : rien à vérifier)
    if (P.length && mapped.length < P.length * 0.8) fail(`vitres sans sommets : ${P.length - mapped.length} sur ${P.length}`);
    // une balle tirée de la rue dans une vitre la brise ; dmgReset la répare
    let shotOk = 0, shotTry = 0;
    for (const p of mapped.slice(0, 40)) {
      const o = p.c.clone().addScaledVector(p.n, 6).addScaledVector(p.u, 0.05), d = p.c.clone().sub(o).normalize();
      if (rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 5.2, 2)) continue; // quelque chose devant la façade (auvent, balcon)
      shotTry++;
      fireRay(PL.ent, o, d, WEAPONS.m4, null, false);
      if (p.broken) { shotOk++; const A = p.mesh.geometry.attributes.color.array; if (A[p.vi[0] * 3 + 1] < 1.5) fail('vitre brisée sans marque dans ses sommets (id ' + p.id + ')'); }
    }
    out.vitres.balles = `${shotOk}/${shotTry}`;
    if (shotTry && shotOk < shotTry * 0.9) fail(`balles dans des vitres : ${shotOk} brisées sur ${shotTry}`);
    dmgReset();
    if (P.some((p) => p.broken)) fail('dmgReset laisse des vitres brisées');
    if (mapped.some((p) => p.mesh.geometry.attributes.color.array[p.vi[0] * 3 + 1] > 1.5)) fail('dmgReset : sommets encore marqués');
    // un souffle devant une façade brise ses vitres
    if (mapped.length) {
      const p = mapped[Math.floor(mapped.length / 2)], at = p.c.clone().addScaledVector(p.n, 3); at.y = 0.4;
      explode(at, PL.ent, 'Grenade', 7.5, 150);
      out.vitres.souffle = P.filter((x) => x.broken).length;
      if (!p.broken) fail("souffle à 3 m d'une vitre : elle tient");
      dmgReset();
    }
    // véhicules : des balles, puis un souffle ; il s'embrase, explose, devient une épave aux collisions basses ; remise à neuf
    out.vehicules.n = DMG.veh.length;
    for (const rec of DMG.veh.slice(0, 3)) {
      const name = rec.kind + rec.id, r = { hp0: rec.hp };
      // d'un côté dégagé (le premier rayon qui touche bien le véhicule)
      let o = null, d = null;
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) { const q = rec.c.clone().add(new V3(sx * (rec.r + 5), 0.3, sz * (rec.r + 5))), dd = rec.c.clone().sub(q).normalize(), w = rayWorld(q.x, q.y, q.z, dd.x, dd.y, dd.z, rec.r + 6, 1); if (w && w.box && w.box.veh === rec) { o = q; d = dd; break; } }
      if (!o) { r.tir = 'aucun côté dégagé'; out.vehicules[name] = r; continue; }
      for (let i = 0; i < 12; i++) fireRay(PL.ent, o, d, WEAPONS.m4, null, false);
      r.balles = Math.round(rec.hp);
      if (!(rec.hp < rec.hpMax)) fail(name + " : les balles ne l'abîment pas");
      explode(rec.c.clone().add(new V3(0, 0.2, rec.r + 1)), PL.ent, 'Grenade', 7.5, 150);
      let guard = 0; while (rec.state === 0 && guard++ < 6) explode(rec.c.clone().add(new V3(0, 0.2, rec.r + 1)), PL.ent, 'Grenade', 7.5, 150);
      r.etat = rec.state;
      if (rec.state !== 1) fail(name + " : ne s'embrase pas (état " + rec.state + ', ' + Math.round(rec.hp) + ' pv)');
      tick(DMG_VEH.burn + 0.5);
      if (rec.state !== 2) fail(name + " : n'explose pas après l'embrasement");
      if (rec.g.visible || !rec.w.visible) fail(name + " : l'épave ne remplace pas le véhicule");
      const top = Math.max(...rec.cols.map((c) => c.y1)), wtop = Math.max(...rec.wcols.map((c) => c.y1));
      if (top > -1e5) fail(name + ' : collisions du véhicule intact encore là');
      if (!(wtop > 0.3)) fail(name + " : collisions de l'épave absentes");
      r.epave = +wtop.toFixed(2);
      tick(1);
      vehReset(rec);
      if (rec.state !== 0 || !rec.g.visible || rec.w.visible || Math.max(...rec.wcols.map((c) => c.y1)) > -1e5) fail(name + ' : vehReset incomplet');
      out.vehicules[name] = r;
    }
    dmgReset(); propsReset();
    // barils : percé, il flambe puis explose ; un voisin proche part à son tour
    const booms = PHYS.bodies.filter((b) => b.boom && !b.pooled);
    out.barils.n = booms.length; out.barils.types = [...new Set(booms.map((b) => b.d.type))];
    const nb = (b) => booms.filter((o) => o !== b && o.p.distanceTo(b.p) < b.boom.r * 0.6).length;
    const b0 = booms.slice().sort((a, b) => nb(b) - nb(a))[0]; // celui qui a le plus de voisins : l'explosion en chaîne est vérifiée
    if (b0) {
      const dir = new V3(1, 0, 0.2).normalize();
      for (let i = 0; i < 12 && !b0.lit; i++) propShot(b0, b0.p.clone().addScaledVector(dir, -0.1), dir, 32, PL.ent);
      if (!b0.lit) fail(b0.d.type + " : percé, il ne s'allume pas (" + Math.round(b0.hp) + ' pv)');
      const near = booms.filter((b) => b !== b0 && b.p.distanceTo(b0.p) < b0.boom.r * 0.6);
      tick(b0.boom.fire + 0.3);
      if (b0.state !== 0) fail(b0.d.type + " : allumé, il n'explose pas");
      out.barils.voisins = near.length;
      if (near.length) { tick(3); out.barils.chaine = near.filter((b) => b.lit).length; if (!near.some((b) => b.lit)) fail("explosion d'un baril : aucun voisin ne s'allume"); }
      propsReset(); dmgReset();
      if (b0.lit || b0.state === 0 || b0.hp !== b0.boom.hp) fail('propsReset ne remet pas le baril à neuf');
    }
    // caisses mobiles : elles cassent
    const cr = PHYS.bodies.find((b) => b.d.brk === 'wood' && !b.pooled);
    out.caisses.n = PHYS.bodies.filter((b) => b.d.brk === 'wood' && !b.pooled).length;
    if (cr) {
      const dir = new V3(0, 0, 1);
      for (let i = 0; i < 20 && cr.state !== 0; i++) propShot(cr, cr.p.clone().addScaledVector(dir, -0.1), dir, 32, PL.ent);
      if (cr.state !== 0) fail('caisse : 20 balles sans la casser');
      propsReset();
    }
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT && process.env.CAPTURE !== '0') {
    fs.mkdirSync(OUT, { recursive: true });
    await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); });
    // une façade : la moitié de ses vitres brisées (une sur deux), vue de la rue
    const cam = await page.evaluate(() => {
      const m = DMG.panes.filter((p) => p.mesh && p.c.y < 6 && Math.abs(p.n.y) < 0.1);
      const p = m[Math.floor(m.length * 0.4)];
      if (!p) return null;
      for (const q of DMG.panes) if (q.c.distanceTo(p.c) < 9 && (q.id & 1)) glassSet(q, true);
      const eye = p.c.clone().addScaledVector(p.n, 5).addScaledVector(p.t, 1.5); eye.y = 1.7;
      return [[eye.x, eye.y, eye.z], [p.c.x, p.c.y, p.c.z]];
    });
    if (cam) {
      await page.evaluate(([e, t]) => { camera.position.set(...e); camera.lookAt(...t); camera.fov = 60; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, cam);
      await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, 'degats-vitres.png'), timeout: 240000 });
    }
    // un véhicule en feu puis son épave
    const vc = await page.evaluate(() => {
      const rec = DMG.veh[0]; if (!rec) return null;
      vehIgnite(rec, PL.ent);
      const eye = rec.c.clone().add(new V3(6, 1.6, 4));
      return [[eye.x, eye.y, eye.z], [rec.c.x, rec.c.y, rec.c.z]];
    });
    if (vc) {
      await page.evaluate(([e, t]) => { camera.position.set(...e); camera.lookAt(...t); camera.fov = 60; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; MATCH.state = 'capture'; }, vc);
      await page.evaluate(() => { for (let i = 0; i < 45; i++) { MATCH.time += 1 / 30; dmgTick(1 / 30); updateFx(1 / 30); } });
      await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, 'degats-feu.png'), timeout: 240000 });
      await page.evaluate(() => { for (let i = 0; i < 120; i++) { MATCH.time += 1 / 30; dmgTick(1 / 30); updateFx(1 / 30); } });
      await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, 'degats-epave.png'), timeout: 240000 });
    }
  }
  const errs = logs.filter((l) => !l.includes('GPU stall') && !l.includes('ERR_FILE_NOT_FOUND'));
  if (errs.length) console.log(errs.slice(0, 20).join('\n'));
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('dégâts du décor : rien à signaler');
})();
