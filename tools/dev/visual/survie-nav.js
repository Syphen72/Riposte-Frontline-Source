/* Survie : navigation et fortification de la ferme (Holloway) en vraie boucle de partie (matchTick) : node survie-nav.js [dossier de captures]
   - STRUCTURE : tout le plancher de l'étage, le fenil, l'appentis, la véranda sont dans la composante principale du réseau ; chaque ouverture a
     ses ancres sur le réseau ; chaque caisse de munitions est hors des murs et des meubles, et un chemin y mène ; chaque lisière rejoint la maison ;
   - ÉTAGE : portes ouvertes, un vivant dans la chambre de l'est : les morts montent l'escalier, passent le palier et le frappent à l'étage ;
   - FENIL : un vivant sur le fenil de la grange : les morts montent l'escalier raide et le frappent ;
   - PALIER BARRÉ : une bibliothèque posée en haut de l'escalier ferme le chemin (aucun chemin ouvert, un chemin « soft » qui passe par elle) ;
     les morts montent, l'abattent (sa collision et ses nœuds se libèrent), et frappent le vivant à l'étage ;
   - CANAPÉ (portes ouvertes) : un canapé en travers du passage de la cloison, les morts font le tour par dehors (le canapé intact) ;
   - CANAPÉ (portes clouées) : le même canapé, la maison close : les morts l'enjambent ou l'abattent, et frappent le vivant dans la cuisine ;
   - FORTIFIÉE : toutes les ouvertures clouées (avec les clous), une tôle sur chacune, l'armoire derrière la porte de la cuisine : huit morts
     (une brute) finissent par entrer, au bout d'un bon moment ; plusieurs attaquent la même ouverture à la fois ; tôles et planches s'abîment à vue ;
   - COINCÉ : une bibliothèque posée dans le passage de la cloison sans prévenir le réseau (un chemin périmé) : le mort qui bute dessus s'en
     aperçoit (zStuck), s'y attaque, passe ;
   - REFUGES : de toutes les surfaces où un joueur peut se tenir (marche, saut de 1,45 m, chute, par une fenêtre accroupi), aucune hors de portée
     des morts (là où ils vont : près des nœuds du réseau, en glissant le long des meubles, en se laissant tomber, en grimpant rejoindre leur proie
     jusqu'à 2,1 m plus haut ; de là, la surface au plus 1,9 m au-dessus à 1,2 m : ils l'attrapent aux jambes) ;
   - TOUT : aucune erreur dans la page. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: 'ferme', mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1 }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m), r2 = (v) => Math.round(v * 100) / 100;
    LOCK.fallback = true; startMatch({});
    const E = PL.ent, SL = FRM_H.SL, main = NAV.mainComp;
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { E.health = 1e9; if (f && f(i / 30) === false) return i / 30; matchTick(1 / 30, true); } return -1; };
    const hold = () => { SV.phase = 'prep'; SV.t = 1e9; SV.wave = 0; SV.toSpawn = 0; };
    const clearZ = () => { for (const z of ZOMBIES) zombieStow(z); };
    const reset = () => { clearZ(); hold(); survBarrReset(); SURV_RES.planks = 99; SURV_RES.metal = 9; };
    const place = (E2, x, y, z) => { E2.pos.set(x, y, z); E2.vel.set(0, 0, 0); E2.vy = 0; };
    const nail = (f) => { for (const op of SURV.open.filter(f)) for (let k = 0; k < op.max; k++) survApply('nail', op.id, E); };
    const putProp = (p, x, y, z, ry) => { p.x = x; p.y = y; p.z = z; p.ry = ry; p.op = null; p.carried = null; survPropPlace(p); buildHash(); };
    let hits = []; const oh = zombieHit; zombieHit = (z, T) => { hits.push({ y: T.pos.y, k: z.zk, t: MATCH.time }); oh(z, T); };
    const house = (o) => o.room === 'maison';
    hold();

    // ---------- STRUCTURE ----------
    const st = { etage: 0, etageHors: 0, fenil: 0, fenilHors: 0, appentis: 0, appentisHors: 0, veranda: 0, verandaHors: 0, ancres: 0, caisses: [] };
    for (let i = 0; i < NAV.count; i++) {
      const x = NAV.nx[i], y = NAV.ny[i], z = NAV.nz[i], m = NAV.comp[i] === main;
      if (Math.abs(y - SL) < 0.06 && Math.abs(x) < 5.6 && z > -4.1 && z < 4.1) { st.etage++; if (!m) st.etageHors++; }
      if (Math.abs(y - 3.05) < 0.06 && x > -26.75 && x < -15.25 && z > -20.75 && z < -16.6) { st.fenil++; if (!m) st.fenilHors++; }
      if (y < 0.1 && x > 15.2 && x < 19.3 && z > -17.3 && z < -13.7) { st.appentis++; if (!m) st.appentisHors++; }
      if (Math.abs(y - 0.3) < 0.06 && x > -5.4 && x < 1.8 && z > 4.5 && z < 6.7) { st.veranda++; if (!m) st.verandaHors++; }
    }
    if (st.etage < 30 || st.etageHors) fail('étage : ' + st.etageHors + ' nœuds sur ' + st.etage + ' hors du réseau principal');
    if (st.fenil < 15 || st.fenilHors) fail('fenil : ' + st.fenilHors + ' nœuds sur ' + st.fenil + ' hors du réseau principal');
    if (st.appentis < 3 || st.appentisHors) fail('appentis : ' + st.appentisHors + ' nœuds hors du réseau');
    if (st.veranda < 6 || st.verandaHors) fail('véranda : ' + st.verandaHors + ' nœuds hors du réseau');
    const A = new V3();
    for (const op of SURV.open) for (const side of ['out', 'in']) {
      survOpenAnchor(op, side, A); const id = navNode(A.x, A.y, A.z);
      if (id < 0 || NAV.comp[id] !== main || hyp(NAV.nx[id] - A.x, NAV.nz[id] - A.z) > 1.2 || Math.abs(NAV.ny[id] - A.y) > 0.5) fail('ouverture ' + op.id + ' (' + op.kind + ', ' + op.room + ') : ancre ' + side + ' hors du réseau'); else st.ancres++;
    }
    const inside = new V3(-3, 0, 0);
    for (const c of SURV.caches.filter((q) => q.kind === 'ammo')) {
      const sw = Math.abs(Math.sin(c.ry)) > 0.5, hx = sw ? 0.21 : 0.31, hz = sw ? 0.31 : 0.21, own = (b) => Math.abs(b.x0 - (c.x - hx)) < 0.01 && Math.abs(b.z0 - (c.z - hz)) < 0.01 && Math.abs(b.y0 - c.y) < 0.01;
      const over = queryBoxes(c.x - hx, c.z - hz, c.x + hx, c.z + hz).filter((b) => !b.ray && !own(b) && b.y1 > c.y + 0.05 && b.y0 < c.y + 0.36 && b.x1 > c.x - hx + 0.01 && b.x0 < c.x + hx - 0.01 && b.z1 > c.z - hz + 0.01 && b.z0 < c.z + hz - 0.01);
      const id = navNode(c.x, c.y, c.z), ok = id >= 0 && NAV.comp[id] === main && hyp(NAV.nx[id] - c.x, NAV.nz[id] - c.z) < 1.3 && Math.abs(NAV.ny[id] - c.y) < 0.35;
      const p = ok && findPath(inside, new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]));
      st.caisses.push({ x: c.x, y: c.y, z: c.z, chevauche: over.length, noeud: ok ? r2(hyp(NAV.nx[id] - c.x, NAV.nz[id] - c.z)) : null, chemin: !!p });
      if (over.length) fail('caisse de munitions (' + c.x + ', ' + c.z + ') dans un mur ou un meuble'); if (!ok || !p) fail('caisse de munitions (' + c.x + ', ' + c.z + ') hors de portée du réseau');
    }
    let zs = 0; for (const s of CURMAP.def.zspawns) if (findPath(new V3(s[0], 0, s[1]), inside)) zs++;
    st.lisieres = zs + '/' + CURMAP.def.zspawns.length; if (zs !== CURMAP.def.zspawns.length) fail('une lisière ne rejoint pas la maison');
    out.structure = st;

    // ---------- ÉTAGE et FENIL : les morts montent ----------
    const chase = (name, px, py, pz, spots, kinds, sec) => {
      reset(); place(E, px, py, pz); hits = [];
      kinds.forEach((k, i) => { const z = zombieSpawn(k, spots[i % spots.length][0] + i * 0.4, spots[i % spots.length][1], 0); if (z) { z.zTgt = E; z.zRepT = 0; } });
      let maxY = 0; const t = run(sec, () => { for (const z of zombiesUp()) maxY = Math.max(maxY, z.pos.y); if (hits.some((h) => Math.abs(h.y - py) < 0.4)) return false; });
      const r = { arrivee: t < 0 ? null : r2(t), plusHaut: r2(maxY), coups: hits.length, coinces: SV.stuckN };
      out[name] = r; return r;
    };
    const up = chase('etage', 3.0, SL, 0.0, [[0, 12], [1, 12]], ['shambler', 'runner', 'shambler'], 70);
    if (up.arrivee === null) fail('étage : aucun mort ne monte frapper le vivant (au plus haut ' + up.plusHaut + ' m)');
    const loft = chase('fenil', -24.0, 3.05, -19.0, [[-21, -4], [-20, -4]], ['shambler', 'runner'], 70);
    if (loft.arrivee === null) fail('fenil : aucun mort ne monte frapper le vivant (au plus haut ' + loft.plusHaut + ' m)');

    // ---------- PALIER BARRÉ par une bibliothèque ----------
    {
      reset(); const bk = SURV.props.find((p) => p.kind === 'bookcase'); putProp(bk, -4.25, SL, -3.55, Math.PI / 2);
      const fits = survPropFits(bk); survPropNav();
      const hard = findPath(new V3(-2, 0, 1.5), new V3(3, SL, 0)), soft = findPath(new V3(-2, 0, 1.5), new V3(3, SL, 0), -1, survSoftCost), ob = NAV.softId >= 0 ? survObstacleOf(NAV.softId) : null;
      place(E, 3.0, SL, 0.0); hits = [];
      for (let i = 0; i < 3; i++) { const z = zombieSpawn('shambler', -2 + i * 0.6, 1.5, 0); if (z) { z.zTgt = E; z.zRepT = 0; } }
      let hp0 = bk.hp, broke = -1, hitBk = 0;
      const t = run(110, (s) => { if (bk.hp < hp0) { hitBk++; hp0 = bk.hp; } if (broke < 0 && bk.hp <= 0) broke = s; if (hits.some((h) => Math.abs(h.y - SL) < 0.4)) return false; });
      const freed = bk.c.x0 > 1e5 && !Array.from(NAV.pblock).includes(bk.id + 1);
      out.palier = { tient: fits, cheminOuvert: !!hard, cheminSoft: !!soft, obstacle: ob ? ob.t + (ob.p ? ':' + ob.p.kind : '') : null, coups: hitBk, eclatee: broke < 0 ? null : r2(broke), libere: freed, arrivee: t < 0 ? null : r2(t) };
      if (!fits) fail('palier : la bibliothèque ne tient pas sur le palier (placement du test)');
      if (hard) fail('palier : la bibliothèque ne ferme pas le chemin de l\'étage');
      if (!soft || !ob || ob.p !== bk) fail('palier : le chemin « soft » ne passe pas par la bibliothèque');
      if (broke < 0) fail('palier : les morts n\'abattent pas la bibliothèque'); else if (!freed) fail('palier : la bibliothèque éclatée garde sa collision ou ses nœuds');
      if (t < 0) fail('palier : les morts ne frappent pas le vivant à l\'étage');
    }

    // ---------- CANAPÉ dans le passage de la cloison ----------
    const couchCase = (name, shut) => {
      reset(); const cp = SURV.props.find((p) => p.kind === 'couch'); putProp(cp, 0.15, 0, -2.5, Math.PI / 2); survPropNav();
      if (shut) nail(house);
      place(E, 3.2, 0, -0.5); hits = [];
      const kinds = ['shambler', 'shambler', 'runner', 'shambler'];
      for (let i = 0; i < kinds.length; i++) { const z = zombieSpawn(kinds[i], -3.0 + (i % 2) * 0.7, -1.4 + Math.floor(i / 2) * 1.2, 0); if (z) { z.zTgt = E; z.zRepT = 0; z.zSeed = i * 0.22; } }
      const v0 = SV.vaults || 0, hp0 = cp.hp;
      const t = run(90, () => { if (hits.length) return false; });
      const r = { arrivee: t < 0 ? null : r2(t), enjambe: (SV.vaults || 0) - v0, canape: Math.round(cp.hp) + '/' + hp0, sorti: zombiesUp().some((z) => !survRoomAt(z.pos)) };
      out[name] = r; return r;
    };
    const c1 = couchCase('canapeOuvert', false);
    if (c1.arrivee === null) fail('canapé, portes ouvertes : les morts ne rejoignent pas le vivant');
    const c2 = couchCase('canapeClos', true);
    if (c2.arrivee === null) fail('canapé, maison close : les morts ne passent pas le canapé');
    if (c2.enjambe === 0 && /^-?\d+/.test(c2.canape) && +c2.canape.split('/')[0] > 0) fail('canapé, maison close : ni enjambé ni abattu');

    // ---------- FORTIFIÉE ----------
    {
      reset(); SURV_RES.nails = true; nail(house);
      for (const op of SURV.open.filter(house)) survApply('plate', op.id, E);
      const kd = SURV.open.find((o) => house(o) && o.kind === 'porte' && o.out < 0), wd = SURV.props.find((p) => p.kind === 'wardrobe');
      { SACT.carry = wd; wd.carried = E; const a = survOpenAnchor(kd, 'in', new V3()); place(E, a.x, 0, a.z + 0.6); E.yaw = 0; wd.x = a.x; wd.z = a.z; survPropDrop(E); }
      const behind = kd.prop === wd;
      place(E, -3.0, 0, 0.0); hits = [];
      const kinds = ['shambler', 'shambler', 'shambler', 'runner', 'shambler', 'brute', 'shambler', 'crawler'];
      kinds.forEach((k, i) => { const a = (i / kinds.length) * TAU; const z = zombieSpawn(k, Math.cos(a) * 11, Math.sin(a) * 9, 0); if (z) { z.zTgt = E; z.zRepT = 0; } });
      let first = -1, maxSame = 0, mats = new Set(), plateHit = false;
      const t = run(150, (s) => {
        const by = new Map(); for (const z of zombiesUp()) if (z.zs === 'breach' && z.zOb) { const k = z.zOb.op || z.zOb.p; by.set(k, (by.get(k) || 0) + 1); }
        for (const v of by.values()) maxSame = Math.max(maxSame, v);
        for (const op of SURV.open) { for (const sl of op.slots) if (sl.mesh && sl.hp > 0) mats.add(BARR.mats.indexOf(sl.mesh.material)); if (op.plate.max && op.plate.hp < op.plate.max) plateHit = true; }
        if (first < 0 && zombiesUp().some((z) => Math.abs(z.pos.x) < 5.5 && Math.abs(z.pos.z) < 4.0 && z.pos.y < 1)) first = s;
        if (hits.length) return false;
      });
      out.fortifiee = { armoireDerriere: behind, premiereEntree: first < 0 ? null : r2(first), coup: t < 0 ? null : r2(t), memeObstacle: maxSame, aspects: [...mats].sort(), toleTouchee: plateHit, coinces: SV.stuckN, recuperes: SV.unstuck || 0 };
      if (!behind) fail('fortifiée : l\'armoire ne se range pas derrière la porte de la cuisine');
      if (first < 0) fail('fortifiée : huit morts n\'entrent pas en 150 s (la barricade tient pour de bon)');
      else if (first < 20) fail('fortifiée : la maison barricadée tombe en ' + r2(first) + ' s (trop peu)');
      if (maxSame < 2) fail('fortifiée : jamais deux morts sur la même ouverture');
      if (mats.size < 2) fail('fortifiée : les planches ne changent pas d\'aspect en s\'abîmant');
      if (!plateHit) fail('fortifiée : aucune tôle touchée');
    }

    // ---------- COINCÉ : un chemin périmé ----------
    {
      reset(); place(E, 3.2, 0, -0.5); hits = [];
      const z = zombieSpawn('shambler', -2.5, -2.4, 0); z.zTgt = E; z.zRepT = 0; zombieTick(z, 1 / 30, MATCH.time); // (son chemin passe par la porte de la cloison)
      const bk = SURV.props.filter((p) => p.kind === 'bookcase')[1]; putProp(bk, 1.25, 0, -2.5, Math.PI / 2); // posé côté cuisine, sans prévenir le réseau
      SV.stuckN = 0; const hp0 = bk.hp;
      const t = run(60, () => { if (hits.length) return false; });
      out.coince = { detecte: SV.stuckN, bibliotheque: Math.round(bk.hp) + '/' + hp0, arrivee: t < 0 ? null : r2(t), recuperes: SV.unstuck || 0 };
      if (!SV.stuckN) fail('coincé : le mort qui bute sur un obstacle inconnu du réseau ne s\'en aperçoit pas');
      if (t < 0) fail('coincé : le mort ne passe pas (bibliothèque ' + Math.round(bk.hp) + ')');
    }

    // ---------- REFUGES hors de portée ----------
    {
      reset(); clearZ();
      const X0 = -31, X1 = 31, Z0 = -33, Z1 = 33, S = 0.5, pts = [], key = (x, z) => Math.round((x - X0) / S) + ',' + Math.round((z - Z0) / S), cellOf = new Map();
      const probe = new V3();
      for (let x = X0; x <= X1; x += S) for (let z = Z0; z <= Z1; z += S) {
        const cand = [0]; for (const c of queryBoxes(x, z, x, z)) { if (c.ray || c.inv || c.y1 > 14) continue; if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) cand.push(c.y1); }
        for (const rp of RAMPS) if (x >= rp.x0 && x <= rp.x1 && z >= rp.z0 && z <= rp.z1) cand.push(rampHeight(rp, x, z));
        cand.sort((a, b) => a - b); let prev = -9;
        for (const h of cand) {
          if (h - prev < 0.05) continue; prev = h;
          if (Math.abs(groundHeight(x, z, h + 0.05, 0.12) - h) > 0.03) continue;
          if (ceilingAbove(x, z, h + 0.3, 0.2) < h + 1.75) continue;
          probe.set(x, h, z); collideCircle(probe, 0.28, 1.7); if (hyp(probe.x - x, probe.z - z) > 0.03) continue;
          const p = { x, z, h, i: pts.length }; pts.push(p); const k = key(x, z); if (!cellOf.has(k)) cellOf.set(k, []); cellOf.get(k).push(p);
        }
      }
      // où un mort se tient : à moins d'un mètre d'un nœud du réseau principal (ouvert ou fermé : ils abattent ce qui ferme), au même niveau, qu'il
      // rejoint en ligne droite, avec la place de son corps (0,32 m) ; un refuge est hors de portée si aucun de ces points n'est à 1,2 m de lui avec
      // la surface au plus 1,9 m au-dessus (il l'attrape aux jambes)
      const zCan = new Uint8Array(pts.length);
      // un saut ou une chute de p à q : rien en travers à hauteur de corps (les barreaux comptent : boîtes noRay comprises)
      const segBlocked = (ax, az, bx, bz, y0, y1) => {
        for (const c of queryBoxes(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
          if (c.ray || c.y1 <= y0 || c.y0 >= y1) continue;
          let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
          for (const [o, d, lo, hi] of [[ax, dx, c.x0, c.x1], [az, dz, c.z0, c.z1]]) { if (Math.abs(d) < 1e-9) { if (o <= lo || o >= hi) { t0 = 2; break; } continue; } const u = (lo - o) / d, v = (hi - o) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v)); }
          if (t0 < t1) return true;
        }
        return false;
      };
      for (const p of pts) {
        probe.set(p.x, p.h, p.z); collideCircle(probe, ZOMBIE.r, 1.75); if (hyp(probe.x - p.x, probe.z - p.z) > 0.03) continue;
        let ok = false;
        for (let dz = -1; dz <= 1 && !ok; dz++) for (let dx = -1; dx <= 1 && !ok; dx++) {
          const cx = Math.floor(p.x + dx - NAV.x0), cz = Math.floor(p.z + dz - NAV.z0); if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
          for (const id of NAV.cells[cz * NAV.W + cx]) { if (NAV.comp[id] !== main || Math.abs(NAV.ny[id] - p.h) > 0.3 || hyp(NAV.nx[id] - p.x, NAV.nz[id] - p.z) > 1.0) continue; if (!segBlocked(NAV.nx[id], NAV.nz[id], p.x, p.z, Math.max(p.h, NAV.ny[id]) + 0.35, Math.max(p.h, NAV.ny[id]) + 1.6)) { ok = true; break; } }
        }
        if (ok) zCan[p.i] = 1;
      }
      // de là, il marche (hors des nœuds : il glisse le long des meubles), se laisse tomber, ou grimpe rejoindre sa proie (zombieClamber : au plus
      // 2,1 m plus haut, à 2 m, la place pour son corps là-haut)
      const zClr = new Uint8Array(pts.length);
      // (un mort se tient à 20 cm près d'un point de la grille : un passage de 80 cm entre un mur et un lit, que la grille de 50 cm manque, compte)
      for (const p of pts) { probe.set(p.x, p.h, p.z); collideCircle(probe, ZOMBIE.r, 1.75); const q = probe.clone(); collideCircle(q, ZOMBIE.r, 1.75); if (hyp(probe.x - p.x, probe.z - p.z) <= 0.2 && hyp(q.x - probe.x, q.z - probe.z) < 0.02 && Math.abs(groundHeight(probe.x, probe.z, p.h + 0.05, 0.12) - p.h) < 0.05 && ceilingAbove(probe.x, probe.z, p.h + 0.3, 0.3) >= p.h + 1.75) zClr[p.i] = 1; }
      const zSeen = new Uint8Array(pts.length), ZQ = []; for (const p of pts) if (zCan[p.i]) { zSeen[p.i] = 1; ZQ.push(p); }
      while (ZQ.length) {
        const p = ZQ.pop();
        for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const L = cellOf.get(key(p.x + dx * S, p.z + dz * S)); if (!L) continue;
          for (const q of L) {
            if (zSeen[q.i] || !zClr[q.i]) continue;
            const d = hyp(q.x - p.x, q.z - p.z), dh = q.h - p.h; let ok = false;
            if (Math.abs(dh) <= STEP && d <= 0.75) ok = !segBlocked(p.x, p.z, q.x, q.z, Math.max(p.h, q.h) + 0.35, Math.max(p.h, q.h) + 1.6);
            else if (dh < -STEP && d <= 1.2) ok = !segBlocked(p.x, p.z, q.x, q.z, p.h + 0.35, p.h + 1.6);
            else if (dh > STEP && dh <= 2.1 && d <= 2.0) ok = !segBlocked(p.x, p.z, q.x, q.z, q.h + 0.05, q.h + 1.4);
            if (ok) { zSeen[q.i] = 1; ZQ.push(q); }
          }
        }
      }
      const zReach = (p) => { if (zSeen[p.i]) return true; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const L = cellOf.get(key(p.x + dx * S, p.z + dz * S)); if (!L) continue; for (const q of L) { if (!zSeen[q.i]) continue; const dh = p.h - q.h; if (dh > -0.5 && dh < 1.9 && hyp(q.x - p.x, q.z - p.z) < 1.2) return true; } } return false; };
      const seen = new Uint8Array(pts.length), Q = [];
      for (const p of pts) { const id = navNode(p.x, p.h, p.z); if (id >= 0 && NAV.comp[id] === main && Math.abs(NAV.ny[id] - p.h) < 0.15 && hyp(NAV.nx[id] - p.x, NAV.nz[id] - p.z) < 0.6) { seen[p.i] = 1; Q.push(p); } }
      while (Q.length) {
        const p = Q.pop();
        for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const L = cellOf.get(key(p.x + dx * S, p.z + dz * S)); if (!L) continue;
          for (const q of L) {
            if (seen[q.i]) continue;
            const d = hyp(q.x - p.x, q.z - p.z), up = q.h - p.h;
            if (up > 1.45 || d > 2.2 || (up > STEP && d > 1.6)) continue;
            // debout, ou accroupi au sommet d'un saut (par une fenêtre : 1 m de corps, 0,95 m au-dessus du plus haut des deux sols)
            const top = Math.max(p.h, q.h); if (segBlocked(p.x, p.z, q.x, q.z, top + 0.35, top + 1.55) && segBlocked(p.x, p.z, q.x, q.z, top + 0.95, top + 1.95)) continue;
            seen[q.i] = 1; Q.push(q);
          }
        }
      }
      const bad = pts.filter((p) => seen[p.i] && !zReach(p));
      const groups = []; for (const p of bad) { let g = groups.find((G) => Math.abs(G.h - p.h) < 0.3 && hyp(G.x - p.x, G.z - p.z) < 2.5); if (!g) { g = { x: p.x, z: p.z, h: p.h, n: 0 }; groups.push(g); } g.n++; }
      out.refuges = { surfaces: pts.length, joueur: seen.reduce((a, v) => a + v, 0), horsDePortee: bad.length, groupes: groups.slice(0, 12).map((g) => [g.x, g.z, r2(g.h), g.n]) };
      if (bad.length) fail(bad.length + ' surfaces où un joueur se tient hors de portée des morts (refuge) : ' + JSON.stringify(out.refuges.groupes));
    }
    zombieHit = oh;
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  if (OUT && !R.fails.length) {
    const shot = async (name, f, ticks = 0) => { await page.evaluate(f); for (let i = 0; i < ticks; i++) await page.evaluate(() => matchTick(1 / 30, true)); await page.evaluate(() => { const U = FinalShader.uniforms; U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0; Settings.survNoir = false; }); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, name), timeout: 240000 }); };
    await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; VM.root.visible = false; });
    await shot('nav-escalier.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset();
      [[-0.6, 0.15], [-1.5, 1.0], [-2.4, 1.85], [-3.4, 2.75]].forEach(([x, y], i) => { const z = zombieSpawn(i === 2 ? 'runner' : 'shambler', x, -3.55, -Math.PI / 2); z.pos.y = y; z.vel.set(-1, 0, 0); z.zPh = i * 0.3; for (let j = 0; j < 6; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); });
      camera.position.set(-0.1, 1.75, 0.9); camera.lookAt(-3.0, 1.7, -3.5); camera.fov = 66; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await shot('nav-meubles.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset();
      const bk = SURV.props.find((p) => p.kind === 'bookcase'); bk.x = -4.25; bk.y = FRM_H.SL; bk.z = -3.55; bk.ry = Math.PI / 2; bk.hp = bk.max * 0.4; survPropPlace(bk);
      const cp = SURV.props.find((p) => p.kind === 'couch'); cp.hp = cp.max * 0.55; survPropPlace(cp);
      camera.position.set(-0.3, 1.8, 3.2); camera.lookAt(-3.8, 1.3, -2.4); camera.fov = 66; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
    await shot('nav-tole.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset(); SURV_RES.planks = 20; SURV_RES.metal = 2;
      const op = SURV.open.find((o) => o.room === 'maison' && o.kind === 'porte' && o.out > 0); for (let k = 0; k < op.max; k++) survApply('nail', op.id, PL.ent); survApply('plate', op.id, PL.ent); op.plate.hp = op.plate.max * 0.5; survPlateLook(op); op.slots[4].hp = op.slots[4].max * 0.3; survBoardLook(op, op.slots[4]);
      const z = zombieSpawn('brute', -2.5, op.fixed + 1.0, 0); z.vel.set(0, 0, 0); z.zAtk = 0.6; for (let j = 0; j < 4; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true);
      camera.position.set(-0.6, 1.5, 8.8); camera.lookAt(-2.5, 1.2, 4.6); camera.fov = 58; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    });
  }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('survie-nav : rien à signaler');
})();
