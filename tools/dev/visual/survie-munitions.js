/* Survie : les munitions (src/08n-ravitaillement.js) en vraie boucle de partie sur la ferme : node survie-munitions.js
   - FIN DE VAGUE : à sec, la fin d'une vague (par le directeur) remet chaque arme à sa part de réserve pleine ; toutes les cinq vagues, le plein ;
   - CAISSES : quatre caisses, chacune donne à chaque arme sa part (au moins un chargeur) ; deux prises, puis vide ; l'invite disparaît à munitions
     pleines ; une prise revient au bout de son temps ; toutes reviennent à la fin de la vague ;
   - CARTOUCHIÈRES : l'équipe à court, des morts en laissent ; chacune sur un nœud libre du réseau (ni dans un mur ni sous un meuble) ; on la
     ramasse en marchant dessus ; elle disparaît au bout de 35 s ;
   - SECOURS : à sec depuis 5 s, un chargeur et demi d'arme de poing ; pas deux fois en 40 s ;
   - LARGAGE : à la vague 4, une fois le tiers de la vague sorti, une caisse tombe dehors, à 15-26 m, qu'un chemin rejoint ; le plein et une
     grenade, des planches et une tôle pour l'équipe ; une seule prise par survivant ;
   - CAISSE DE LA SALLE : le plein contre 250 points ; pleine, rien n'est payé ; OBJECTIF : le plein ;
   - LONGUE PARTIE : douze vagues en solo, un tireur immobile dans la salle (portes ouvertes) qui vise, tire, recharge, change d'arme et finit
     au couteau, va aux caisses entre deux vagues (et en pleine vague quand il est presque à sec) et au largage, ramasse les cartouchières proches : il n'est presque jamais à sec (moins de 8 %
     du temps de combat), et la réserve baisse pourtant (on n'a pas tout, tout le temps) ;
   - TOUT : aucune erreur dans la page. */
const { openGame } = require('./common');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: 'ferme', mode: 'zombie', limitZombie: 0, survMates: 0, difficulty: 1 }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m), r2 = (v) => Math.round(v * 100) / 100;
    LOCK.fallback = true; startMatch({});
    const E = PL.ent, A = E.arms;
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { E.health = 1e9; if (f && f(i / 30) === false) return i / 30; matchTick(1 / 30, true); } return -1; };
    const hold = () => { SV.phase = 'prep'; SV.t = 1e9; SV.wave = 0; SV.toSpawn = 0; SV.horde = null; };
    const W = () => A.slots.filter(ammoUsable), drain = () => { for (const w of W()) { w.mag = 0; w.reserve = 0; } }, fill = () => { for (const w of W()) { w.mag = w.def.mag; w.reserve = ammoMaxOf(w); } };
    const snap = () => W().map((w) => ({ id: w.def.id, cat: w.def.cat, mag: w.mag, res: w.reserve, max: ammoMaxOf(w) }));
    const place = (x, y, z) => { E.pos.set(x, y, z); E.vel.set(0, 0, 0); E.vy = 0; };
    hold(); out.armes = snap();
    if (W().length < 2) fail('le joueur n\'a pas deux armes à munitions (' + W().length + ')');

    // ---------- FIN DE VAGUE ----------
    drain(); SV.phase = 'wave'; SV.wave = 2; SV.toSpawn = 0; for (const z of ZOMBIES) zombieStow(z);
    run(0.2);
    const w2 = snap(); out.finDeVague = { phase: SV.phase, armes: w2.map((w) => w.res + '/' + w.max) };
    if (SV.phase !== 'prep') fail('la vague 2 vide ne se termine pas');
    for (const w of w2) if (w.res < Math.ceil(w.max * 0.55)) fail('fin de vague : ' + w.id + ' remis à ' + w.res + ' sur ' + w.max + ' (attendu au moins 55 %)');
    hold(); drain(); SV.wave = 5; survResupplyMe(); for (const w of snap()) if (w.res !== w.max) fail('vague 5 : ' + w.id + ' pas au plein (' + w.res + '/' + w.max + ')');

    // ---------- CAISSES ----------
    hold(); const boxes = SURV.caches.filter((c) => c.kind === 'ammo'); out.caisses = { n: boxes.length };
    if (boxes.length < 4) fail('moins de quatre caisses de munitions (' + boxes.length + ')');
    const b = boxes[0]; drain(); place(b.x + 0.6, b.y, b.z);
    const act = survActionAt(E), b0 = snap();
    out.caisses.invite = act ? act.label : null;
    if (!act || act.k !== 'take') fail('caisse : pas d\'invite pour prendre des munitions');
    survApply('take', b.id, E); const b1 = snap();
    out.caisses.prise = b1.map((w, i) => w.id + ' +' + (w.res - b0[i].res));
    for (let i = 0; i < b1.length; i++) { const w = b1[i], need = Math.min(w.max, w.cat === 'launcher' ? 1 : Math.min(w.max, Math.max(1, Math.round(w.max * 0.3)))); if (w.res - b0[i].res < need) fail('caisse : ' + w.id + ' ne reçoit que ' + (w.res - b0[i].res) + ' (au moins ' + need + ' attendu)'); }
    survApply('take', b.id, E); const left2 = b.left; survApply('take', b.id, E); const b3 = snap();
    out.caisses.charges = [b.max, left2, b.left];
    if (left2 !== 0 || b3.some((w, i) => w.res > Math.min(w.max, b1[i].res * 3))) fail('caisse : plus de deux prises d\'affilée');
    fill(); const act2 = survActionAt(E); out.caisses.inviteAuPlein = act2 ? act2.k + ':' + act2.label : null;
    if (act2 && act2.k === 'take' && /munitions/i.test(act2.label)) fail('caisse : l\'invite reste à munitions pleines');
    const tRe = run(90, () => { if (b.left > 0) return false; }); out.caisses.recharge = r2(tRe);
    if (tRe < 0) fail('caisse : aucune prise ne revient en 90 s'); else if (tRe < 40) fail('caisse : une prise revient en ' + r2(tRe) + ' s (trop vite)');
    for (const c of boxes) c.left = 0; SV.phase = 'wave'; SV.wave = 1; survWaveClear(); hold();
    if (boxes.some((c) => c.left !== c.max)) fail('caisses : pas toutes refaites à la fin de la vague');

    // ---------- CARTOUCHIÈRES ----------
    hold(); drain(); SV.wave = 6; run(0.1);
    for (const l of SAMMO.loot.slice()) survLootRemove(l);
    let kills = 0; const dropped = [];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * TAU, r = rand(7, 14), z = zombieSpawn(i % 9 ? 'shambler' : 'brute', Math.cos(a) * r, Math.sin(a) * r, 0); if (!z) continue;
      const n0 = SAMMO.loot.length; applyDamage(z, 9999, E, 'M4A1', false, new V3(0, 0, -1), E.pos.clone()); kills++; if (SAMMO.loot.length > n0) dropped.push(SAMMO.loot[SAMMO.loot.length - 1]); zombieStow(z);
    }
    let badSpot = 0;
    for (const l of dropped) {
      const id = navNode(l.x, l.y, l.z), onNode = id >= 0 && NAV.comp[id] === NAV.mainComp && hyp(NAV.nx[id] - l.x, NAV.nz[id] - l.z) < 0.35 && Math.abs(NAV.ny[id] - l.y) < 0.2;
      const inBox = queryBoxes(l.x - 0.1, l.z - 0.1, l.x + 0.1, l.z + 0.1).some((c) => !c.ray && c.y0 < l.y + 0.25 && c.y1 > l.y + 0.05 && l.x > c.x0 && l.x < c.x1 && l.z > c.z0 && l.z < c.z1);
      if (!onNode || inBox) badSpot++;
    }
    out.cartouchieres = { tues: kills, laissees: dropped.length, auSol: SAMMO.loot.length, malPlacees: badSpot };
    if (dropped.length < 4) fail('cartouchières : ' + dropped.length + ' pour ' + kills + ' morts, l\'équipe à sec');
    if (badSpot) fail('cartouchières : ' + badSpot + ' hors d\'un nœud libre du réseau ou dans le décor');
    if (SAMMO.loot.length) {
      const l = SAMMO.loot[0], n0 = SAMMO.loot.length, s0 = snap(); place(l.x, l.y, l.z); run(0.2); const s1 = snap();
      out.cartouchieres.ramassee = SAMMO.loot.length < n0; out.cartouchieres.gain = s1.map((w, i) => w.res - s0[i].res);
      if (SAMMO.loot.length >= n0 || (l.k === 'ammo' && !s1.some((w, i) => w.res > s0[i].res))) fail('cartouchière : marcher dessus ne la ramasse pas');
      place(-3, 0, 0); run(36); out.cartouchieres.apres36s = SAMMO.loot.length;
      if (SAMMO.loot.length) fail('cartouchières : encore là au bout de 36 s');
    }

    // ---------- SECOURS ----------
    hold(); place(-3, 0, 0); drain(); SAMMO.emCd = 0; SAMMO.emT = 0; run(6);
    const side = W().find((w) => w.def.cat === 'pistol') || W().slice(-1)[0];
    out.secours = { arme: side.def.id, apres6s: side.reserve, chargeur: side.def.mag };
    if (side.reserve < side.def.mag) fail('secours : rien au bout de 6 s à sec');
    drain(); run(6); out.secours.encore = side.reserve; if (side.reserve > 0) fail('secours : deux fois en 12 s');
    run(40); out.secours.apres46s = side.reserve; if (side.reserve <= 0) fail('secours : ne revient pas au bout de 40 s');

    // ---------- LARGAGE ----------
    hold(); fill(); for (const z of ZOMBIES) zombieStow(z);
    SV.phase = 'wave'; SV.wave = 4; SV.comp = survWaveComp(4); const tot = SV.comp.n + SV.comp.brutes; SV.toSpawn = Math.floor(tot * 0.6); SV.spawnT = 1e9; SV.airDone = false; SV.drop = null;
    run(0.3);
    const dc = SURV.caches.find((c) => c.kind === 'drop');
    out.largage = { tombe: !!SV.drop, ou: SV.drop, distance: SV.drop ? r2(hyp(SV.drop[0], SV.drop[1])) : null, dehors: SV.drop ? !survRoomAt(new V3(SV.drop[0], 0, SV.drop[1])) : null };
    if (!SV.drop) fail('largage : rien à la vague 4');
    else {
      const p = findPath(new V3(-3, 0, 0), new V3(dc.x, dc.y, dc.z)); out.largage.chemin = !!p;
      if (!p) fail('largage : aucun chemin de la maison au largage'); if (out.largage.distance < 15 || out.largage.distance > 26.5) fail('largage : à ' + out.largage.distance + ' m de la maison');
      if (!out.largage.dehors) fail('largage : tombé dans un bâtiment');
      drain(); const nd = PL.nades || 0, pl = SURV_RES.planks, mt = SURV_RES.metal; place(dc.x + 0.9, dc.y, dc.z);
      const a = survActionAt(E); out.largage.invite = a ? a.label : null;
      survApply('take', dc.id, E); const s = snap();
      out.largage.apres = { armes: s.map((w) => w.res + '/' + w.max), grenades: (PL.nades || 0) - nd, planches: SURV_RES.planks - pl, toles: SURV_RES.metal - mt, encore: !!SV.drop };
      if (s.some((w) => w.res !== w.max)) fail('largage : pas le plein'); if (SURV_RES.planks - pl !== 3 || SURV_RES.metal - mt !== 1) fail('largage : planches ou tôle de l\'équipe manquantes');
      drain(); survApply('take', dc.id, E); if (snap().some((w) => w.res > 0)) fail('largage : pris deux fois par le même survivant');
    }
    hold();

    // ---------- CAISSE DE LA SALLE, OBJECTIF ----------
    drain(); SVSTAT.points = 400; place(SURV_AMMO.x + 0.8, 0, SURV_AMMO.z); survBuyAmmo(); const pts1 = SVSTAT.points, full1 = snap().every((w) => w.res === w.max); survBuyAmmo();
    out.salle = { points: [400, pts1, SVSTAT.points], plein: full1 };
    if (!full1 || pts1 !== 150) fail('caisse de la salle : pas le plein contre 250 points'); if (SVSTAT.points !== 150) fail('caisse de la salle : payée à munitions pleines');
    drain(); const oi = SURV.objs.findIndex((o) => o.kind === 'power'); SURV.objs[oi].done = false; survObjDone(oi, E); out.objectif = snap().every((w) => w.res === w.max);
    if (!out.objectif) fail('objectif rempli : pas le plein');

    // ---------- LONGUE PARTIE ----------
    {
      for (const z of ZOMBIES) zombieStow(z); for (const l of SAMMO.loot.slice()) survLootRemove(l);
      survStart(); fill(); PL.nades = 1; place(-3, 0, 0.6); SVSTAT.points = 0; for (const k in SAMMO.stats) SAMMO.stats[k] = 0;
      SV.t = 4;
      const waves = [], eye = new V3(), aim = new V3(); let cur = null, shootT = 0, reloadT = 0, dry = 0, combat = 0, knife = 0, t = 0, lastLoot = 0, stall = null;
      const pickTarget = () => { let best = null, bd = 22; eye.set(E.pos.x, E.pos.y + 1.55, E.pos.z); for (const z of zombiesUp()) { const d = z.pos.distanceTo(E.pos); if (d < bd && lineClear(eye, aim.set(z.pos.x, z.pos.y + 1.2, z.pos.z))) { bd = d; best = z; } } return best; };
      const visitBoxes = (lim = 0.6) => { for (const c of SURV.caches) if (c.kind === 'ammo' && c.left > 0 && ammoFracOf(E) < lim) { const o = E.pos.clone(); place(c.x + 0.5, c.y, c.z); survApply('take', c.id, E); place(o.x, o.y, o.z); } };
      const grabDrop = () => { const c = SURV.caches.find((q) => q.kind === 'drop'); if (SV.drop && c && c.left > 0 && survCacheUseful(c)) { const o = E.pos.clone(); place(c.x + 0.8, c.y, c.z); survApply('take', c.id, E); place(o.x, o.y, o.z); } };
      while (t < 2400 && SV.wave <= 12) {
        E.health = 1e9; const dt = 1 / 30; t += dt;
        if (SV.phase === 'prep') { SV.t = Math.min(SV.t, 4); if (cur) { cur.end = r2(ammoFracOf(E)); cur = null; } visitBoxes(); grabDrop(); }
        else if (SV.phase === 'wave') {
          if (!cur || cur.w !== SV.wave) { cur = { w: SV.wave, n: SV.comp.n + SV.comp.brutes, min: 1, dry: 0, t0: t }; waves.push(cur); }
          combat += dt; cur.min = Math.min(cur.min, ammoFracOf(E));
          if (ammoFracOf(E) < 0.35) grabDrop();
          if (ammoFracOf(E) < 0.15) visitBoxes(0.3); // (presque à sec : une course jusqu'à une caisse, comme le ferait un joueur)
          // les cartouchières à moins de 12 m : un saut pour les prendre (toutes les 5 s)
          if (t - lastLoot > 5 && ammoFracOf(E) < 0.9) { const l = SAMMO.loot.find((q) => hyp(q.x - E.pos.x, q.z - E.pos.z) < 12); if (l) { lastLoot = t; const o = E.pos.clone(); place(l.x, l.y, l.z); matchTick(dt, true); place(o.x, o.y, o.z); } }
          const tg = pickTarget(); shootT -= dt; reloadT -= dt;
          const w = A.slots[A.cur];
          if (tg && reloadT <= 0 && shootT <= 0) {
            let ws = ammoUsable(w) && w.mag + w.reserve > 0 ? w : W().find((q) => q.mag + q.reserve > 0);
            if (ws && ws !== w) { A.cur = A.slots.indexOf(ws); reloadT = 0.6; }
            else if (ws) {
              if (ws.mag <= 0) { const n = Math.min(ws.def.mag, ws.reserve); ws.reserve -= n; ws.mag += n; reloadT = 2.2; }
              else {
                ws.mag--; shootT = ws.def.bolt ? 1.3 : ws.def.auto ? 0.16 : 0.35;
                soundEvents.push({ pos: E.pos.clone(), team: E.team, who: E, t: MATCH.time, loud: !!ws.def.loud, quiet: !!ws.def.silent }); if (soundEvents.length > 60) soundEvents.shift(); // (le bruit du tir, comme ctlFire)
                if (Math.random() < 0.55) { const head = Math.random() < 0.15, d = ws.def.dmg[0] * (ws.def.pellets ? ws.def.pellets * 0.6 : 1) * (head ? ws.def.head || 1.5 : 1); applyDamage(tg, d, E, ws.def.name, head, aim.copy(tg.pos).sub(E.pos).normalize(), E.pos.clone()); }
              }
            } else if (tg.pos.distanceTo(E.pos) < 1.7) { knife++; shootT = 0.6; applyDamage(tg, 55, E, 'Couteau', false, aim.copy(tg.pos).sub(E.pos).normalize(), E.pos.clone()); }
          }
          if (ammoEmpty(E)) { dry += dt; cur.dry += dt; }
          if (t - cur.t0 > 420 && !stall) stall = { vague: SV.wave, reste: SV.toSpawn, debout: zombiesUp().map((z) => ({ p: [r2(z.pos.x), r2(z.pos.y), r2(z.pos.z)], v: [r2(z.vel.x), r2(z.vel.z)], zs: z.zs, st: z.zStuck, tgt: z.zTgt === E, ob: z.zOb ? z.zOb.t + (z.zOb.op ? z.zOb.op.id : z.zOb.p.id) : null, path: z.zPath ? z.zPath.slice(Math.max(0, z.zPathI - 1), z.zPathI + 3).map((q) => [q.x, r2(q.y), q.z]) : null, pi: z.zPathI, rep: r2(z.zRepT), climb: r2(z.zClimb) })) };
          if (t - cur.t0 > 420) break;
          cur.dur = r2(t - cur.t0);
        }
        matchTick(dt, true);
      }
      out.longue = { vagues: waves.map((w) => [w.w, w.n, r2(w.min), w.end, r2(w.dry), w.dur]), atteinte: SV.wave, combat: r2(combat), sec: r2(dry), partSec: r2(dry / Math.max(1, combat)), couteau: knife, sources: { ...SAMMO.stats }, coinces: SV.stuckN, recuperes: SV.unstuck || 0, enjambes: SV.vaults || 0, grimpes: SV.clambers || 0, bloque: stall };
      if (stall) fail('longue partie : la vague ' + stall.vague + ' ne finit pas en 7 min (' + JSON.stringify(stall).slice(0, 300) + ')');
      if (SV.wave < 12) fail('longue partie : seulement ' + SV.wave + ' vagues en 40 min de jeu');
      if (dry / Math.max(1, combat) > 0.08) fail('longue partie : à sec ' + Math.round((100 * dry) / combat) + ' % du temps de combat');
      const mins = waves.filter((w) => w.w >= 3).map((w) => w.min); if (mins.length && Math.min(...mins) > 0.7) fail('longue partie : la réserve ne descend jamais sous 70 % (aucune pénurie)');
    }
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('survie-munitions : rien à signaler');
})();
