/* Banc du grappin (src/08k-grappin.js) : node grappin.js [dossier de captures]   (MAP=sable ; PAGE=autre version)
   Dans la vraie boucle de partie (matchTick) : depuis la rue, le joueur vise le haut de la façade d'un bloc à toit plat, lance le grappin,
   et doit finir debout sur le toit, sans traverser l'acrotère. Vérifie aussi qu'un toit en pente, le ciel et le sol refusent le crochet,
   qu'une charge part à chaque lancer et revient, et que le saut lâche le câble. Avec un dossier : une capture pendant la traction. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: 640, h: 360, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    for (const e of entities) if (!e.isPlayer) { e.alive = false; e.respawnT = 1e9; } // personne pour gêner
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { PL.ent.health = 1e9; if (f) f(i); matchTick(1 / 30, true); } };
    const look = (yaw, pitch) => { PL.yaw = yaw; PL.pitch = pitch; PL.ent.yaw = yaw; PL.ent.pitch = pitch; };
    // un bloc à toit plat (bâtiment plein), et un endroit de la rue face à l'une de ses façades, dégagé, dans la carte
    const blocks = COL.filter((c) => !c.prop && !c.veh && !c.ray && !c.noRay && !c.noTop && c.y0 <= 0.01 && c.y1 > 5 && c.y1 < 12 && (c.x1 - c.x0) * (c.z1 - c.z0) > 30);
    let spot = null;
    for (const c of blocks) {
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = nx > 0 ? c.x1 : nx < 0 ? c.x0 : (c.x0 + c.x1) / 2, fz = nz > 0 ? c.z1 : nz < 0 ? c.z0 : (c.z0 + c.z1) / 2;
        const px = fx + nx * 7, pz = fz + nz * 7;
        if (px < MAP.x0 + 1 || px > MAP.x1 - 1 || pz < MAP.z0 + 1 || pz > MAP.z1 - 1) continue;
        if (Math.abs(groundHeight(px, pz, 2, 0.35)) > 0.05) continue;
        const eye = new V3(px, 1.62, pz), tgt = new V3(fx, c.y1 - 1.2, fz), d = tgt.clone().sub(eye).normalize();
        const a = grappleAim(eye, d, 0); if (!a || Math.abs(a.top - c.y1) > 0.05) continue; // le toit du bloc lui-même, pas un objet devant
        spot = { c, px, pz, yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y), top: a.top, land: a.land.clone() }; break;
      }
      if (spot) break;
    }
    if (!spot) { fail('aucune façade de bloc à toit plat où accrocher le grappin depuis la rue'); return out; }
    out.bloc = { haut: +spot.top.toFixed(2), x: +spot.px.toFixed(1), z: +spot.pz.toFixed(1) };
    PL.ent.pos.set(spot.px, 0, spot.pz); PL.ent.vel.set(0, 0, 0); PL.ent.vy = 0; look(spot.yaw, spot.pitch); run(0.2);
    const c0 = GR.charges; grappleTry();
    out.lance = { etat: GR.st, charges: GR.charges };
    if (GR.st !== 'fly') fail('le grappin ne part pas (' + GR.st + ')');
    if (GR.charges !== c0 - 1) fail('la charge n’est pas consommée');
    let maxY = 0; run(3.5, () => { maxY = Math.max(maxY, PL.ent.pos.y); look(spot.yaw, Math.min(spot.pitch, 0.2)); });
    const p = PL.ent.pos, c = spot.c;
    out.arrivee = { y: +p.y.toFixed(2), sol: PL.ent.onGround, surLeToit: p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1, maxY: +maxY.toFixed(2), ecart: +Math.hypot(p.x - spot.land.x, p.z - spot.land.z).toFixed(2) };
    if (!(Math.abs(p.y - spot.top) < 0.25 && PL.ent.onGround)) fail(`le joueur ne finit pas debout sur le toit (y ${p.y.toFixed(2)}, toit ${spot.top.toFixed(2)}, au sol ${PL.ent.onGround})`);
    if (GR.st) fail('le câble tient encore à l’arrivée');
    // refus : un toit en pente, le ciel, le sol
    const pitched = COL.find((x) => x.noTop);
    if (pitched) { const eye = new V3((pitched.x0 + pitched.x1) / 2, pitched.y1 + 6, pitched.z1 + 6), tgt = new V3((pitched.x0 + pitched.x1) / 2, pitched.y1 - 0.3, pitched.z1); if (grappleAim(eye, tgt.sub(eye).normalize(), pitched.y1 - 2)) fail('le grappin accroche un toit en pente'); }
    if (grappleAim(new V3(0, 1.6, 20), new V3(0, 1, 0), 0)) fail('le grappin accroche le ciel');
    if (grappleAim(new V3(0, 1.6, 20), new V3(0, -1, 0.2).normalize(), 0)) fail('le grappin accroche le sol');
    // recharge : la charge revient en 9 s
    run(9.5); out.charges = GR.charges;
    if (GR.charges !== GRAP.charges) fail('charges non rechargées après 9,5 s (' + GR.charges + ')');
    // saut pendant la traction : le câble lâche, l'élan reste
    PL.ent.pos.set(spot.px, 0, spot.pz); PL.ent.vel.set(0, 0, 0); PL.ent.vy = 0; look(spot.yaw, spot.pitch); run(0.3);
    grappleTry(); run(0.45, () => look(spot.yaw, spot.pitch)); const was = GR.st;
    run(0.1, () => { KEYS.Space = true; }); KEYS.Space = false; run(0.05);
    out.saut = { avant: was, apres: GR.st, vy: +PL.ent.vy.toFixed(1) };
    if (was !== 'pull' || GR.st) fail('le saut ne lâche pas le câble (' + was + ' -> ' + GR.st + ')');
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT && !R.fails.length) {
    await page.evaluate(() => {
      document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
      grappleReset(); const r = PL.ent.pos; void r;
    });
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('grappin : rien à signaler');
})();
