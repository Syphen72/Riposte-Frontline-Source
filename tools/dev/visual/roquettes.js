/* Banc du lance-roquettes (src/06ob-lanceurs.js, src/07f-roquettes.js) : node roquettes.js   (MAP=sable ; PAGE=autre version)
   - tir réel par la classe Démolition (ctlWeapon) : une roquette part, le tube se vide, le rechargement remet une roquette
   - roquette armée sur un bot à 25 m : il meurt ; à 4 m (pas encore armée) : un choc qui blesse sans tuer, pas d'explosion
   - coup direct sur un véhicule : il s'embrase ; sur un hélicoptère ennemi : il perd ses points de vie */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    const fly = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { MATCH.time += 1 / 60; updateRockets(1 / 60); dmgTick(1 / 60); } };
    LOCK.fallback = true; Settings.loadout = 4; startMatch({});
    const foes = entities.filter((e) => !e.isPlayer && !allied(e, PL.ent));
    // 1. vrai tir par la classe Démolition
    const A = PL.ent.arms; A.cur = 1; const w = armsW(PL.ent);
    out.secondaire = w.def.id;
    if (w.def.id !== 'rpg7') fail('la classe Démolition ne porte pas le RPG-7 (' + w.def.id + ')');
    else {
      A.switching = 0; A.fireCd = 0; PL.ent.sprinting = false; A.sprintW = 0; PL.ent.busy = false;
      PL.ent.input.firePressed = true; ctlWeapon(PL.ent, 1 / 60, MATCH.time);
      out.tir = { roquettes: ROCKETS.length, chargeur: w.mag, reserve: w.reserve };
      if (ROCKETS.length !== 1 || w.mag !== 0) fail('tir du RPG-7 : ' + ROCKETS.length + ' roquette(s), chargeur ' + w.mag);
      for (let i = 0; i < 4 * 60; i++) { MATCH.time += 1 / 60; ctlWeapon(PL.ent, 1 / 60, MATCH.time); updateRockets(1 / 60); }
      out.recharge = { chargeur: w.mag, reserve: w.reserve };
      if (w.mag !== 1 || w.reserve !== 2) fail('rechargement du RPG-7 : chargeur ' + w.mag + ', réserve ' + w.reserve);
    }
    clearRockets();
    // un bot ennemi seul au milieu d'une rue dégagée, le joueur à distance d
    const shootAt = (e, d) => {
      e.alive = true; e.health = 100; e.protT = 0; e.pos.set(0, 0, 20); e.vel.set(0, 0, 0);
      if (e.model) { e.model.root.visible = true; for (let k = 0; k < 4; k++) poseSoldier(e, 1 / 30); e.model.root.updateMatrixWorld(true); } // squelette remis à la nouvelle place (sphères de touche)
      PL.ent.pos.set(0, 0, 20 + d); PL.ent.alive = true; PL.ent.health = 1e9;
      const o = new V3(0, 1.4, 20 + d - 0.6), t = entChest(e, new V3()), dir = t.sub(o).normalize();
      rocketFire(PL.ent, o, dir, WEAPONS.rpg7); fly(1.5);
      return e;
    };
    const b = shootAt(foes[0], 25);
    out.loin = { vivant: b.alive, pv: Math.round(b.health) };
    if (b.alive) fail('roquette armée sur un bot à 25 m : il survit (' + Math.round(b.health) + ' pv)');
    const c = shootAt(foes[1] || foes[0], 4);
    out.pres = { vivant: c.alive, pv: Math.round(c.health) };
    if (!c.alive || c.health > 60) fail('roquette non armée à 4 m : ' + (c.alive ? Math.round(c.health) + ' pv' : 'le bot meurt'));
    // coup direct sur un véhicule
    const rec = DMG.veh[0];
    if (rec) {
      const o = rec.c.clone().add(new V3(rec.r + 12, 0.4, 0)), dir = rec.c.clone().sub(o).normalize();
      rocketFire(PL.ent, o, dir, WEAPONS.rpg7); fly(1);
      out.vehicule = rec.state;
      if (rec.state < 1) fail('coup direct sur un véhicule : il ne s’embrase pas (' + Math.round(rec.hp) + ' pv)');
    }
    // hélicoptère ennemi
    callHeli(foes[0]);
    for (let i = 0; i < 9 * 30; i++) { MATCH.time += 1 / 30; updateHelis(1 / 30); }
    const h = KS.helis[0];
    if (h) {
      const hp0 = h.hp, o = h.pos.clone().add(new V3(0, -8, 30)), dir = h.pos.clone().sub(o).normalize();
      rocketFire(PL.ent, o, dir, WEAPONS.rpg7);
      for (let i = 0; i < 90; i++) { MATCH.time += 1 / 60; updateRockets(1 / 60); }
      out.heli = { avant: hp0, apres: h.hp, etat: h.state };
      if (!(h.hp < hp0) && h.state !== 'crash') fail('roquette sur l’hélicoptère : aucun dégât');
    }
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('lance-roquettes : rien à signaler');
})();
