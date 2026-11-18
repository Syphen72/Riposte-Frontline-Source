/* Survie : la tourelle et le chien robot au milieu des morts (Breachline 6.3.1) : node survie-unites.js   (MAP=ferme ; la galerie par défaut)
   Jusqu'en 6.3.1, unitsBotsTick (08h-unites.js) prenait les morts pour des bots armés : dès qu'un mort voyait la tourelle ou le chien, armsW
   levait une erreur à chaque image, le reste de l'image sautait (en solo : écran figé, plus d'image rendue) jusqu'à la fin de l'unité, et
   la horde tuait le joueur. Ici, en vraie boucle de partie (matchTick, comme une image du jeu) :
   - TOURELLE : posée face à cinq morts qui avancent vers le joueur : aucune erreur, elle tire, des morts tombent ;
   - CHIEN : même chose avec le chien robot ;
   - IMAGES : la tourelle en plein tir, la boucle d'images du navigateur tourne trois secondes sans erreur. */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'galerie';
(async () => {
  const { browser, page } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: MAP, mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1 }, noHdri: true, page: process.env.PAGE });
  const perr = []; page.on('pageerror', (e) => perr.push(String(e))); // (la liste de openGame est une copie prise au chargement)
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    const E = PL.ent, hold = () => { SV.phase = 'prep'; SV.t = 1e9; SV.wave = 0; SV.toSpawn = 0; SV.horde = null; };
    hold();
    // un endroit dégagé : la tourelle se pose, cinq morts à 8-10 m devant la voient (galerie : le mail, face à l'atrium)
    const pick = () => {
      // (les départs de la ferme sont dans la maison : on cherche aussi dans la cour, sur des anneaux autour du centre)
      const ring = []; for (const r of [10, 14, 18]) for (let a = 0; a < 8; a++) { const x = Math.cos((a / 8) * TAU) * r, z = Math.sin((a / 8) * TAU) * r, id = navNode(x, 0, z); if (id >= 0 && NAV.ny[id] < 0.3) ring.push([NAV.nx[id], NAV.ny[id], NAV.nz[id]]); }
      const starts = (CURMAP.id === 'galerie' ? [[0, 0, 2]] : []).concat(CURMAP.def.spawns.map((s) => [s[0], 0, s[1]]), ring);
      for (const st of starts) for (let a = 0; a < 16; a++) {
        const yaw = (a / 16) * TAU; E.pos.set(st[0], st[1], st[2]); E.vel.set(0, 0, 0); E.yaw = yaw; E.pitch = 0;
        const p = sentryPlaceAt(E, new V3()); if (!p) continue;
        const eye = new V3(p.x, p.y + SENTRY.eye, p.z), fx = -Math.sin(yaw), fz = -Math.cos(yaw), zs = [];
        for (let i = 0; i < 5; i++) { const s = (i - 2) * 1.2, d = 8 + (i % 2) * 1.5, x = p.x + fx * d - fz * s, z = p.z + fz * d + fx * s, id = navNode(x, p.y, z); if (id < 0 || Math.abs(NAV.ny[id] - p.y) > 0.4 || !lineClear(eye, new V3(x, p.y + 1.2, z))) break; zs.push([x, z]); }
        if (zs.length === 5) return { st, yaw, zs };
      }
      return null;
    };
    const run = (sec, check) => { const errs = []; for (let i = 0; i < Math.round(sec * 30); i++) { E.health = 1e9; E.alive = true; try { matchTick(1 / 30, false); } catch (e) { errs.push(String(e && e.message || e)); if (errs.length > 2) break; } if (check && check() === false) break; } return errs; };
    const deploy = (kind) => {
      for (const z of ZOMBIES) zombieStow(z); hold();
      const s = pick(); if (!s) { fail(kind + ' : aucun endroit dégagé pour la poser'); return null; }
      E.pos.set(s.st[0], s.st[1], s.st[2]); E.vel.set(0, 0, 0); E.yaw = s.yaw;
      if (kind === 'turret') { PL.ks.sentry = true; useSentry(); } else { PL.ks.dog = true; useDog(); }
      const u = UNITS.find((q) => q.kind === kind && !q.dead); if (!u) { fail(kind + ' : non posée'); return null; }
      const zs = s.zs.map(([x, z]) => { const q = zombieSpawn('shambler', x, z, s.yaw); if (q) { q.zTgt = E; q.zRepT = 0; } return q; }).filter(Boolean);
      return { u, zs };
    };
    for (const kind of ['turret', 'dog']) {
      const D = deploy(kind); if (!D) continue;
      const a0 = D.u.ammo, errs = run(kind === 'turret' ? 14 : 18, () => D.zs.some((z) => z.alive));
      const dead = D.zs.filter((z) => !z.alive).length;
      out[kind] = { erreurs: errs.slice(0, 2), morts: dead + '/' + D.zs.length, coups: a0 !== undefined ? a0 - D.u.ammo : undefined, etat: D.u.state };
      if (errs.length) fail(kind + ' : erreur dans la boucle de partie (' + errs[0] + ')');
      if (kind === 'turret' && !(a0 - D.u.ammo > 0)) fail('la tourelle ne tire pas sur les morts');
      if (dead < 3) fail(kind + ' : ' + dead + ' morts sur ' + D.zs.length + ' tombés');
      for (const u of UNITS) if (!u.dead) unitKill(u);
      run(3);
    }
    // une tourelle en plein tir pour la boucle d'images du navigateur
    const D = deploy('turret'); if (D) { run(3); out.pret = { etat: D.u.state, cible: !!D.u.tgt }; }
    return out;
  });
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => { const u = UNITS.find((q) => q.kind === 'turret'); return u ? { etat: u.state, munitions: u.ammo } : null; });
  R.images = st;
  if (perr.length) { R.fails.push('erreurs dans la page'); console.log(perr.slice(0, 5).join('\n')); }
  console.log(JSON.stringify(R, null, 1));
  console.log(R.fails.length ? 'ÉCHEC' : 'OK');
  await browser.close();
  process.exit(R.fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
