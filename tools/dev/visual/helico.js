/* Dégâts et écrasement des engins (src/08d-heli.js, src/08f-mecha.js) : node helico.js   (MAP=sable ; PAGE=autre version)
   Hélicoptère ennemi : une explosion sous lui le blesse (étape de dégâts) ; abattu, il vrille, s'écrase, explose pour le compte de celui
   qui l'a abattu, puis son épave brûle et disparaît ; lâché au-dessus d'un toit, il s'écrase sur le toit. Mecha : sa destruction va jusqu'au
   bout (explosions secondaires, épave) sans erreur. */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    const foe = entities.find((e) => !e.isPlayer && !allied(e, PL.ent));
    const booms = []; const ex0 = window.explode; window.explode = function (p, owner, w, r, d, l, k) { booms.push({ w, owner: owner === PL.ent ? 'joueur' : owner && owner.name, y: +p.y.toFixed(1) }); return ex0.apply(this, arguments); };
    const step = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { MATCH.time += 1 / 30; updateHelis(1 / 30); updateFx(1 / 30); } };
    callHeli(foe); step(9);
    const h = KS.helis[0]; if (!h) { fail('pas d’hélicoptère'); return out; }
    const hp0 = h.hp; explode(h.pos.clone().add(new V3(0, -2.6, 0)), PL.ent, 'Grenade', 7.5, 150);
    out.souffle = { avant: hp0, apres: Math.round(h.hp), etape: h.stage || 0 };
    if (!(h.hp < hp0)) fail('une explosion sous l’hélicoptère ne le blesse pas');
    heliDamage(h, 999, PL.ent); booms.length = 0;
    if (h.state !== 'crash') fail('abattu, l’hélicoptère ne s’écrase pas');
    let t = 0; while (h.wreckT === undefined && t < 12) { step(0.1); t += 0.1; }
    out.ecrasement = { duree: +t.toFixed(1), epave: h.wreckT !== undefined, explosions: booms.slice() };
    if (h.wreckT === undefined) fail('l’hélicoptère ne touche jamais le sol');
    if (!booms.some((b) => b.w === NET_WSPECIAL.heli && b.owner === 'joueur')) fail('l’écrasement n’explose pas pour le compte de celui qui l’a abattu');
    step(15); out.fin = KS.helis.includes(h) ? 'encore là' : 'partie';
    if (KS.helis.includes(h)) fail('l’épave ne disparaît pas');
    // au-dessus d'un toit : il s'écrase sur le toit
    const roof = COL.find((c) => !c.prop && !c.veh && !c.noTop && c.y0 <= 0.01 && c.y1 > 6 && c.y1 < 12 && (c.x1 - c.x0) > 6 && (c.z1 - c.z0) > 6);
    callHeli(foe); step(9); const h2 = KS.helis.find((x) => x.state === 'fly');
    if (roof && h2) {
      h2.pos.set((roof.x0 + roof.x1) / 2, roof.y1 + 6, (roof.z0 + roof.z1) / 2); h2.state = 'crash'; h2.vy = 0; h2.spin = 0; h2.lastAtt = PL.ent;
      let u = 0; while (h2.wreckT === undefined && u < 6) { step(0.05); u += 0.05; }
      out.toit = { toit: +roof.y1.toFixed(2), epave: +h2.pos.y.toFixed(2) };
      if (h2.wreckT === undefined || h2.pos.y < roof.y1 - 0.3) fail('lâché au-dessus d’un toit, l’hélicoptère ne s’y écrase pas (' + h2.pos.y.toFixed(2) + ' contre ' + roof.y1.toFixed(2) + ')');
    }
    // mecha : destruction complète
    const me = mechaCall(foe, new V3(0, 0, 20), 0);
    for (let i = 0; i < 200 && me.state !== 'fight'; i++) { MATCH.time += 1 / 30; updateMechas(1 / 30); }
    mechaOverheat(me);
    for (let i = 0; i < 300 && !me.gone; i++) { MATCH.time += 1 / 30; updateMechas(1 / 30); updateFx(1 / 30); }
    out.mecha = { etat: me.state, parti: !!me.gone };
    if (!me.gone) fail('l’épave du mecha ne disparaît pas');
    window.explode = ex0;
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('engins : rien à signaler');
})();
