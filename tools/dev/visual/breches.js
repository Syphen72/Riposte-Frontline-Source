/* Banc des brèches (src/04d-breches.js) : node breches.js [dossier de captures]   (MAP=sable ; PAGE=autre version)
   Pour chaque pan : nœuds de navigation fermés tant qu'il tient, aucun chemin des bots à travers lui ; une grenade ne l'ouvre pas, une
   roquette si ; ouvert : collision partie (une balle passe), chemin des bots plus court qui passe par l'ouverture ; nouvelle partie : refermé.
   Avec un dossier : le premier pan photographié fermé, puis juste après sa brèche. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [], pans: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    for (const e of entities) if (!e.isPlayer) { e.alive = false; e.respawnT = 1e9; }
    const fly = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { MATCH.time += 1 / 60; updateRockets(1 / 60); dmgTick(1 / 60); } };
    out.n = BRCH.list.length;
    if (!BRCH.list.length) { fail('aucun pan à brèche sur la carte'); return out; }
    const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += p[i].distanceTo(p[i - 1]); return s; };
    const inPan = (b, v) => v.x > b.x0 - 0.05 && v.x < b.x1 + 0.05 && v.z > b.z0 - 0.05 && v.z < b.z1 + 0.05;
    for (const b of BRCH.list) {
      for (const q of BRCH.list) if (!q.open) q.hp = BREACH.hp; // (les explosions d'un pan voisin ne comptent pas)
      const r = { id: b.id, x: +b.c.x.toFixed(1), z: +b.c.z.toFixed(1) }, nx = b.ax ? 0 : 1, nz = b.ax ? 1 : 0;
      const A = new V3(b.c.x - nx * 2, b.y0, b.c.z - nz * 2), B = new V3(b.c.x + nx * 2, b.y0, b.c.z + nz * 2);
      let gated = 0; for (let i = 0; i < NAV.gate.length; i++) if (NAV.gate[i] === b.id + 1) gated++;
      r.noeuds = gated; if (!gated) fail('pan ' + b.id + ' : aucun nœud de navigation sous l’ouverture');
      const p0 = findPath(A, B); r.avant = p0 ? Math.round(plen(p0)) : null;
      if (p0 && p0.some((v, i) => i > 0 && (inPan(b, v) || inPan(b, v.clone().lerp(p0[i - 1], 0.5))))) fail('pan ' + b.id + ' fermé : un chemin de bot le traverse');
      // une grenade au pied : il tient
      explode(new V3(b.c.x - nx * 1, b.y0 + 0.3, b.c.z - nz * 1), PL.ent, 'Grenade', 7.5, 150);
      r.grenade = Math.round(b.hp); if (b.open) fail('pan ' + b.id + ' : ouvert par une seule grenade');
      // une roquette : il s'ouvre
      // d'un côté dégagé, à 8 m (la roquette s'arme après 6 m)
      let o = null; for (const sd of [-1, 1]) { const q = new V3(b.c.x + sd * nx * 8, b.y0 + 1.2, b.c.z + sd * nz * 8), to = new V3(b.c.x + sd * nx * (b.t / 2 + 0.05), b.y0 + 1.2, b.c.z + sd * nz * (b.t / 2 + 0.05)); if (lineClear(q, to)) { o = q; break; } }
      if (!o) { r.tir = 'aucun côté dégagé à 8 m'; o = new V3(b.c.x - nx * 8, b.y0 + 1.2, b.c.z - nz * 8); }
      rocketFire(PL.ent, o, b.c.clone().sub(o).normalize(), WEAPONS.rpg7); fly(0.6);
      if (!b.open && r.tir) { breachDamage(b, BREACH.rocket + 140, PL.ent); r.tir += ', ouvert à la main'; } // pas de ligne de tir dégagée à 8 m : on vérifie le reste
      r.ouvert = b.open; if (!b.open && !r.tir) { fail('pan ' + b.id + ' : la roquette ne l’ouvre pas (' + Math.round(b.hp) + ' pv)'); out.pans.push(r); continue; }
      const h = rayWorld(A.x, b.y0 + 1.2, A.z, nx, 0, nz, 4, 2); if (h && h.t < 2.2) fail('pan ' + b.id + ' ouvert : une balle bute encore dans l’ouverture (' + h.t.toFixed(2) + ' m, ' + h.m + (h.box ? ' ' + [h.box.x0, h.box.x1, h.box.z0, h.box.z1].map((v) => v.toFixed(2)).join(',') : '') + ')');
      const p1 = findPath(A, B); r.apres = p1 ? Math.round(plen(p1)) : null;
      if (!p1) fail('pan ' + b.id + ' ouvert : aucun chemin à travers');
      else if (p0 && plen(p1) > plen(p0) - 1) fail('pan ' + b.id + ' ouvert : le chemin ne raccourcit pas (' + Math.round(plen(p0)) + ' -> ' + Math.round(plen(p1)) + ' m)');
      out.pans.push(r);
    }
    dmgReset();
    if (BRCH.list.some((b) => b.open || b.col.y1 < b.y0)) fail('dmgReset ne referme pas les pans');
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT && !R.fails.length) {
    const cam = await page.evaluate(() => {
      document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
      MATCH.state = 'capture'; VM.root.visible = false;
      const b = BRCH.list[BRCH.list.length - 1], nx = b.ax ? 0 : 1, nz = b.ax ? 1 : 0, e = new V3(b.c.x - nx * 4.5 + nz * 1.2, 1.7, b.c.z - nz * 4.5 + nx * 1.2);
      camera.position.copy(e); camera.lookAt(b.c.x, 1.3, b.c.z); camera.fov = 65; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
      return b.id;
    });
    await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, 'breche-avant.png'), timeout: 240000 });
    await page.evaluate((id) => { const b = BRCH.list[id]; breachSet(b, true, true); for (let i = 0; i < 20; i++) updateFx(1 / 30); }, cam);
    await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, 'breche-pendant.png'), timeout: 240000 });
    await page.evaluate(() => { for (let i = 0; i < 150; i++) updateFx(1 / 30); });
    await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, 'breche-apres.png'), timeout: 240000 });
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('brèches : rien à signaler');
})();
