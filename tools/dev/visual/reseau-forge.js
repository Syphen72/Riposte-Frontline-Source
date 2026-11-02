/* États de joueur distant forgés (client modifié) : le jeu les reçoit sans se figer. Un salon entier tenait à un seul message : une arme
   « constructor » (clé héritée de tout objet), une position infinie (« 1e999 » en JSON) ou des centaines de grenades dans un même état
   faisaient lever une erreur à chaque image chez l'hôte (netUpdate, avant le rendu). Pour chaque cas : l'état appliqué (netApply), puis
   120 pas de jeu ; ni erreur ni scène qui enfle.
   node tools/dev/visual/reseau-forge.js ; PAGE=autre/version.html */
const { openGame } = require('./common');
const P0 = { n: 'Forge', t: 1, w: 'm4', g: 'm4', s: [3, 0.2, 3, 0, 0, 0, 0, 0, 0, 1, 0, 100], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [] };
const CASES = [
  ['tenue « constructor » à la création', (P) => netApply('gA', { ...P, sk: 'constructor' })],
  ['tenue valide puis « __proto__ »', (P) => { netApply('gB', P); netApply('gB', { ...P, sk: '__proto__' }); }],
  ['arme w « constructor » sans clé, à la création', (P) => netApply('gC', { ...P, w: 'constructor', g: '' })],
  ['arme valide puis w « toString »', (P) => { netApply('gD', P); netApply('gD', { ...P, w: 'toString', g: '' }); }],
  ['clé d\'arme « __proto__ » et camouflage « constructor »', (P) => { netApply('gE', { ...P, g: '__proto__' }); netApply('gE', { ...P, g: 'm4~~constructor' }); }],
  ['position et vitesse infinies (1e999)', (P) => netApply('gF', JSON.parse(JSON.stringify(P).replace('"s":[3,0.2,3,0,0,0,0', '"s":[1e999,-1e999,1e999,1e999,0,1e999,-1e999')))],
  ['800 grenades dans un seul état', (P) => { const p = PL.ent.pos, ev = []; for (let i = 1; i <= 800; i++) ev.push({ k: 'nade', i, px: p.x, py: p.y + 0.3, pz: p.z, vx: 0, vy: 0, vz: 0, fu: 0.1 }); netApply('gG', { ...P, ev }); }],
  ['événements mal formés (null, nombres, texte)', (P) => netApply('gH', { ...P, ev: [null, 3, 'x', { k: 'hit', i: 1, to: 'personne', d: 'abc' }, { k: 'air', i: 2, x: 1e999, z: 'z', y: {} }] })],
  // Breachline : unités posées, câble de grappin, roquettes, mines, décor
  ['unités « constructor », position infinie, 500 unités', (P) => { const u = [[1, 'constructor', 0, 0, 0, 0], [2, '__proto__', 0, 0, 0, 0]]; for (let i = 0; i < 500; i++) u.push([10 + i, 'turret', 1e999, -1e999, 'x', null, 'a', {}, 1]); netApply('gI', { ...P, u }); }],
  ['câble de grappin infini ou mal formé', (P) => { netApply('gJ', { ...P, gr: [1e999, 'a', null] }); netApply('gJ', { ...P, gr: { x: 1 } }); }],
  ['100 roquettes et explosions forgées', (P) => { const ev = []; for (let i = 1; i <= 100; i++) ev.push({ k: 'rk', i, px: i % 2 ? 1e999 : 0, py: 1, pz: 0, vx: 1, vy: 0, vz: 'z' }); ev.push({ k: 'rkx', i: 101, r: 'x', x: 1e999, a: 1 }, { k: 'mt', i: 102, u: 'a', x: 'b', f: 1e999, c: 1 }); netApply('gK', { ...P, ev }); }],
  ['décor forgé (vitres, brèches, véhicules, barils, unités, hélicoptère)', (P) => netApply('gL', { ...P, ev: [{ k: 'gb', i: 1, n: new Array(5000).fill(0) }, { k: 'gb', i: 2, n: 'x' }, { k: 'wb', i: 3, n: 1e9 }, { k: 'wh', i: 4, n: -1, d: 1e999 }, { k: 'vb', i: 5, n: -1, by: {} }, { k: 'vh', i: 6, n: 'constructor', d: 'x' }, { k: 'bx', i: 7, n: '__proto__' }, { k: 'uh', i: 8, to: 'moi', u: 'x', d: 1e999 }, { k: 'ux', i: 9, u: null }, { k: 'hs', i: 10, s: 'z' }] })],
];
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, noHdri: true, settings: { quality: 'low', map: 'sable', lang: 'fr' } });
  await page.evaluate(() => { LOCK.fallback = true; startMatch({}); NET.on = true; NET.role = 'client'; NET.me = 'moi'; NET.joined = true; NET.t0 = performance.now(); NET.hostConn = { open: true, send() {} }; PL.ent.protT = 1e9; });
  let bad = 0;
  for (const [name, fn] of CASES) {
    const r = await page.evaluate(([src, P]) => {
      const before = scene.children.length, errs = new Map();
      const step = (n, f) => { try { f(); } catch (e) { const k = n + ' : ' + String(e.message).slice(0, 80); errs.set(k, (errs.get(k) || 0) + 1); } };
      step('netApply', () => (0, eval)('(' + src + ')')(P)); // (évaluation : l'outil lève la CSP de la page, voir common.js)
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) {
        MATCH.time += 1 / 60; NET.hostSeen = performance.now() + 1e9; PL.ent.protT = 1e9; PL.ent.health = 100;
        step('updateNades', () => updateNades(1 / 60)); step('netUpdate', () => netUpdate(1 / 60));
        step('updateUnits', () => updateUnits(1 / 60)); step('updateRockets', () => updateRockets(1 / 60)); step('dmgTick', () => dmgTick(1 / 60)); step('grappleDraw', () => grappleDraw());
      }
      step('rendu', () => renderer.render(scene, camera));
      return { errs: [...errs.entries()], grew: scene.children.length - before, nades: NADES.length, ms: Math.round(performance.now() - t0) };
    }, [fn.toString(), P0]);
    const ok = !r.errs.length && r.grew < 40 && r.nades <= 8;
    if (!ok) bad++;
    console.log((ok ? 'ok     : ' : 'ÉCHEC  : ') + name + (ok ? '' : ' ' + JSON.stringify(r)));
    await page.evaluate(() => { for (const n of [...NADES]) n.fuse = 0; for (let i = 0; i < 10; i++) updateNades(1 / 30); }); // les grenades du cas éclatent avant le suivant
  }
  const pe = logs.filter((l) => l.startsWith('[pageerror]'));
  if (pe.length) { bad++; console.log('ÉCHEC  : erreurs de page : ' + pe.slice(0, 3).join(' | ')); }
  console.log(bad ? `\n${bad} échec(s)` : '\ntout est bon');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
