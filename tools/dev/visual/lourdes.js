/* Armes lourdes en partie (src/08d-heli.js, src/08f-mecha.js, traçantes lourdes de src/04-fx.js, src/04c-degats.js) : un hélicoptère et un mecha
   ennemis appelés près du joueur (invulnérable), puis la vraie boucle de partie (matchTick) pendant 30 s.
   node lourdes.js   (MAP=sable ; PAGE=autre version). Sort en erreur si une exception tombe, si l'hélicoptère ou le mecha ne tirent pas,
   si leurs tirs ne laissent aucune traçante lourde. */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [], errors: [] };
    try {
      LOCK.fallback = true; startMatch({});
      const foe = entities.find((e) => !e.isPlayer && !allied(e, PL.ent));
      const at = new V3(0, 0, 20); PL.ent.pos.copy(at); PL.ent.alive = true;
      callHeli(foe);
      // le mecha à 10-16 m du joueur, sur un sol dégagé qui le voit (avant novembre 2026 : posé dans un bloc, il voyait à travers, le rayon
      // ignorant la boîte de départ)
      let drop = null;
      for (let k = 0; k < 48 && !drop; k++) { const a = k * 2.39996, r = 10 + (k % 4) * 2, p = new V3(at.x + Math.sin(a) * r, 0, at.z + Math.cos(a) * r); p.y = groundHeight(p.x, p.z, 1, 0.5); const eye = new V3(p.x, p.y + 2, p.z); if (Math.abs(p.y) < 0.3 && !COL.some((c) => !c.ray && !c.noRay && eye.x > c.x0 - 1.2 && eye.x < c.x1 + 1.2 && eye.z > c.z0 - 1.2 && eye.z < c.z1 + 1.2 && c.y1 > 0.5 && c.y0 < 4) && lineClear(eye, new V3(at.x, 1.3, at.z))) drop = p; }
      if (!drop) { out.fails.push('aucun sol dégagé où poser le mecha'); return out; }
      mechaCall(foe, drop, 0);
      let heavy = 0, heliShots = 0, mechaShots = 0;
      const t0 = MATCH.time;
      for (let i = 0; i < 30 * 30; i++) {
        PL.ent.health = 1e9; PL.ent.alive = true; PL.ent.protT = 0;
        matchTick(1 / 30, true); updateFx(1 / 30);
        heavy = Math.max(heavy, FX.heavy.list.length);
        for (const h of KS.helis) if (h.burst) heliShots++;
        for (const m of MECHAS) if (m.shotAt > t0) mechaShots++;
      }
      out.heli = KS.helis.map((h) => h.state); out.mecha = MECHAS.map((m) => m.state);
      out.traçantesLourdes = heavy; out.salvesHeli = heliShots; out.tirsMecha = mechaShots;
      if (!heavy) out.fails.push('aucune traçante lourde');
      if (!heliShots) out.fails.push('l’hélicoptère n’a pas tiré');
      if (!mechaShots) out.fails.push('le mecha n’a pas tiré');
    } catch (e) { out.fails.push('exception : ' + e.message); out.errors.push(String(e.stack).slice(0, 600)); }
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror') || (l.includes('[error]') && !l.includes('ERR_FILE_NOT_FOUND')));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('armes lourdes : rien à signaler');
})();
