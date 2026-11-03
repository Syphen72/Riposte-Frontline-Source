/* Survie en coopération (src/09ia-survie.js, 07g-zombies.js, 08m-barricades.js) : node survie.js [dossier de captures]   (PAGE=autre version)
   Dans la vraie boucle de partie (matchTick), sur la ferme (Holloway), en solo sans compagnon :
   - DÉPART : mode survie, réserve de morts prête, joueur dans la maison, ouvertures enregistrées, grappin refusé ;
   - BARRICADES : clouer les planches de toutes les portes de la maison ferme leurs nœuds du réseau des bots (pas de chemin du dehors vers
     le dedans par une porte), les planches sont de vraies boîtes (on ne passe pas, les balles passent entre elles) ;
   - VAGUE : toutes les ouvertures de la maison clouées, la vague 1 sort du bois, les morts marchent vers la maison, aucun n'entre tant
     que tout est cloué, l'un d'eux attaque une ouverture (une planche perd des points de vie), puis on les abat (points, ragdoll, retour à la réserve) jusqu'à la fin de la vague (préparation suivante, ravitaillement) ;
   - À TERRE : un coup mortel met le joueur à terre (pas mort), l'adrénaline le relève une fois ; seul et sans adrénaline, à terre, personne
     ne le relèvera : fin de la survie, défaite, une vague tenue ;
   - TOUT : aucune erreur dans la page. Avec un dossier : la ferme de nuit, les morts devant la maison, une fenêtre clouée vue du dedans. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: 'ferme', mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1 }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m);
    LOCK.fallback = true; startMatch({});
    const E = PL.ent, run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { if (f && f(i) === false) break; matchTick(1 / 30, true); } };
    out.depart = { mode: MATCH.mode, survie: SV.on, reserve: ZOMBIES.length, ouvertures: SURV.open.length, joueur: [+E.pos.x.toFixed(1), +E.pos.y.toFixed(1), +E.pos.z.toFixed(1)], phase: SV.phase };
    if (MATCH.mode !== 'zombie' || !SV.on) fail('la partie ne démarre pas en survie (' + MATCH.mode + ')');
    if (ZOMBIES.length < ZOMBIE.pool) fail('réserve de morts incomplète (' + ZOMBIES.length + ')');
    if (SURV.open.length < 7) fail('ouvertures de la ferme non enregistrées (' + SURV.open.length + ')');
    if (Math.abs(E.pos.x) > 7 || Math.abs(E.pos.z) > 8) fail('le joueur n’apparaît pas à la maison');
    grappleTry(); if (GR.st) fail('le grappin part en survie');
    // barricades : toutes les portes de la maison clouées (planches gratuites pour l'essai)
    SURV_RES.planks = 40; const doors = SURV.open.filter((o) => o.room === 'maison' && o.kind === 'porte');
    for (const op of doors) for (let k = 0; k < op.max; k++) survApply('nail', op.id, E);
    const boarded = doors.every((op) => op.slots.every((s) => s.hp > 0));
    const p = findPath(new V3(0, 0, 12), new V3(-3, 0, 0)), q = findPath(new V3(0, 0, 12), new V3(-3, 0, 9));
    out.barricades = { portes: doors.length, clouees: boarded, cheminVersDedans: !!p, cheminDehors: !!q, planches: SURV_RES.planks };
    if (!boarded) fail('les portes de la maison ne se clouent pas');
    if (p) fail('portes clouées : le réseau des bots passe encore par une porte');
    if (!q) fail('le réseau des bots du dehors est cassé');
    const s0 = doors[0].slots[2].c; let blocked = COL.includes(s0) && s0.x0 < 1e5;
    if (!blocked) fail('une planche clouée n’a pas de collision');
    // la vague 1
    E.pos.set(-3, 0, 0); E.vel.set(0, 0, 0); // dans la salle : les morts doivent passer par une ouverture
    SV.t = 0.05; run(0.2); out.vague = { phase: SV.phase, numero: SV.wave, aSortir: SV.toSpawn };
    if (SV.phase !== 'wave' || SV.wave !== 1) fail('la vague 1 ne commence pas (' + SV.phase + ')');
    // toutes les ouvertures de la maison clouées : pour entrer, il faut arracher des planches
    for (const op of SURV.open.filter((o) => o.room === 'maison')) for (let k = 0; k < op.max; k++) survApply('nail', op.id, E);
    const house = SURV.open.filter((o) => o.room === 'maison'), inHouse = (z) => Math.abs(z.pos.x) < 5.6 && Math.abs(z.pos.z) < 4.1;
    E.health = 1e9; let d0 = null, minD = 1e9, hpMin = 1e9, intrus = 0;
    run(40, () => { E.health = 1e9; E.pos.set(-3, 0, 0); const up = zombiesUp(); if (up.length && d0 === null) d0 = up.reduce((a, z) => a + hyp(z.pos.x, z.pos.z), 0) / up.length; for (const z of up) minD = Math.min(minD, hyp(z.pos.x, z.pos.z)); for (const op of SURV.open) for (const s of op.slots) if (s.max) hpMin = Math.min(hpMin, s.hp / s.max); if (house.every((o) => survOpenShut(o)) && up.some(inHouse)) intrus++; });
    const up = zombiesUp();
    out.marche = { intrusAvecToutFerme: intrus, debout: up.length, distanceDepart: d0 && +d0.toFixed(1), plusPres: +minD.toFixed(1), planchePlusAbimee: hpMin === 1e9 ? null : +hpMin.toFixed(2), sortes: [...new Set(up.map((z) => z.zk))] };
    if (!up.length && SV.toSpawn > 0) fail('aucun mort debout pendant la vague 1');
    if (!(minD < 9)) fail('les morts n’approchent pas de la maison (au plus près ' + minD.toFixed(1) + ' m)');
    if (intrus) fail('un mort est dans la maison alors que toutes ses ouvertures sont clouées');
    if (!(hpMin < 1)) fail('aucun mort ne s’attaque aux planches');
    // on les abat : points, ragdoll, réserve
    const pts0 = SVSTAT.points; let killed = 0;
    run(30, () => { E.health = 1e9; for (const z of zombiesUp()) { applyDamage(z, 500, E, 'M4A1', true, new V3(0, 0, -1), E.pos.clone()); killed++; } if (SV.phase === 'prep') return false; });
    run(6);
    out.abattus = { morts: killed, points: SVSTAT.points - pts0, tetes: SVSTAT.heads, phase: SV.phase, enReserve: ZOMBIES.filter((z) => z.off).length };
    if (!killed) fail('aucun mort abattu'); if (SVSTAT.points <= pts0) fail('aucun point pour les morts abattus');
    if (SV.phase !== 'prep') fail('la vague 1 ne finit pas quand ses morts sont tous tombés (' + SV.phase + ', reste ' + SV.toSpawn + ')');
    // à terre, adrénaline, puis mort
    E.health = 20; applyDamage(E, 50, ZOMBIES[0], 'Zombie', false, new V3(0, 0, 1), E.pos.clone());
    out.aTerre = { vivant: E.alive, aTerre: !!E.downed };
    if (!E.alive || !E.downed) fail('un coup mortel ne met pas le joueur à terre');
    run(6); out.aTerre.adrenaline = !E.downed && E.alive;
    if (E.downed || !E.alive) fail('l’adrénaline ne relève pas le joueur');
    // seul, sans adrénaline : à terre, personne pour le relever, la survie finit
    E.health = 10; applyDamage(E, 50, ZOMBIES[0], 'Zombie', false, new V3(0, 0, 1), E.pos.clone()); run(1);
    out.aTerre.fin = { aTerre: !!E.downed, phase: SV.phase, resultat: SV.result, vaguesTenues: SVSTAT.bestWave };
    if (!E.downed) fail('le second coup mortel ne met pas le joueur à terre');
    if (SV.phase !== 'over' || SV.result !== 'loss') fail('seul à terre sans adrénaline : la survie ne finit pas (' + SV.phase + ')');
    if (SVSTAT.bestWave !== 1) fail('vagues tenues mal comptées (' + SVSTAT.bestWave + ')');
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  if (OUT && !R.fails.length) {
    const shot = async (name, f) => { await page.evaluate(f); await page.evaluate(() => { const U = FinalShader.uniforms; U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0; Settings.survNoir = false; }); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, name), timeout: 240000 }); };
    await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); });
    await shot('survie-ferme.png', () => { MATCH.state = 'capture'; VM.root.visible = false; camera.position.set(14, 3.0, 20); camera.lookAt(-2, 2.2, 0); camera.fov = 58; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; });
    await shot('survie-horde.png', () => {
      for (const z of ZOMBIES) zombieStow(z);
      const kinds = ['shambler', 'shambler', 'runner', 'crawler', 'brute', 'shambler', 'screamer', 'shambler'];
      kinds.forEach((k, i) => { const z = zombieSpawn(k, -4.5 + i * 1.2, 10.5 + (i % 3) * 1.5, Math.PI * 0.02); z.vel.set(0, 0, -1); z.zPh = i * 0.13; for (let j = 0; j < 6; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); });
      camera.position.set(0.2, 1.65, 7.6); camera.lookAt(-0.3, 1.15, 12); camera.fov = 60; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await shot('survie-fenetre.png', () => {
      const op = SURV.open.find((o) => o.kind === 'fenetre' && o.axis === 'x' && o.out > 0); SURV_RES.planks = 10; for (let k = 0; k < op.max; k++) survApply('nail', op.id, PL.ent);
      op.slots[1].hp = op.slots[1].max * 0.5; survBoardLook(op, op.slots[1]); op.slots[3].hp = op.slots[3].max * 0.2; survBoardLook(op, op.slots[3]);
      const m = (op.a0 + op.a1) / 2; camera.position.set(m + 0.6, 1.55, op.fixed - 2.6); camera.lookAt(m, 1.5, op.fixed); camera.fov = 60; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('survie : rien à signaler');
})();
