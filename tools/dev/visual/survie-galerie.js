/* Survie : la galerie marchande (Halcyon, src/02yp-galerie.js) en vraie boucle de partie (matchTick) : node survie-galerie.js [dossier de captures]
   - STRUCTURE : chaque boutique, l'étage, les couloirs, le quai et sa mezzanine sont dans la composante principale du réseau ; chaque ouverture a
     ses ancres sur le réseau ; chaque caisse est hors des murs et des meubles, et un chemin y mène ; chaque point d'apparition rejoint une entrée ;
   - VANTAUX : un rideau baissé, une porte fermée ferment le chemin (et le rouvrent levés) ; une porte vitrée éclate sous les coups et les balles ;
   - PAR L'ARRIÈRE : le quai ouvert, un vivant dans la boutique d'électronique au rideau baissé : les morts de la cour passent le couloir de
     service, forcent la porte du fond et le frappent ;
   - DÉBORDEMENT : la galerie close sauf le quai, la porte du quai sur le mail clouée, les rideaux des boutiques levés : les morts arrivent sur le
     mail par une boutique, après en avoir forcé la porte du fond ;
   - ÉTAGE : par l'escalier de service et le couloir de l'étage (une boutique de l'étage nord, son rideau baissé) ; par les escaliers de l'atrium ;
   - CONFINEMENT : avec le courant, le poste de sécurité ferme l'aile ouest (rideaux et portes coupe-feu) ; des morts dans l'aile mettent du temps
     à rejoindre un vivant au centre, et forcent quelque chose pour y arriver ; l'aile se rouvre ;
   - SIÈGE : des morts qui ne sentent personne marchent sur plusieurs entrées et les forcent ;
   - CAGE, FUITE : la cage s'ouvre avec les outils (planches, tôles, clous, caisses pleines) ; la fuite lève les rideaux du quai, cinq secondes
     près du camion et c'est gagné ;
   - MUR QUI CÈDE : un pan du couloir de service tombe, l'ouverture se barricade et le réseau passe ;
   - REFUGES : de toutes les surfaces où un joueur peut se tenir, aucune hors de portée des morts ;
   - COÛT : une vague de 24 morts dans la galerie, le temps d'une image de la simulation ;
   - LONGUE PARTIE : dix vagues en solo, un tireur sur le mail : chaque vague finit, peu de morts coincés pour de bon ;
   - TOUT : aucune erreur dans la page. Avec un dossier : quelques captures. */
const path = require('path');
const { openGame } = require('./common');
const OUT = process.argv[2] || '';
(async () => {
  const { browser, page, logs } = await openGame({ w: OUT ? 960 : 480, h: OUT ? 540 : 270, settings: { quality: 'low', map: 'galerie', mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1 }, noHdri: !OUT, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const out = { fails: [] }, fail = (m) => out.fails.push(m), r2 = (v) => Math.round(v * 100) / 100;
    LOCK.fallback = true; startMatch({});
    const E = PL.ent, SL = GL.SL, main = NAV.mainComp, A = E.arms;
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { E.health = 1e9; if (f && f(i / 30) === false) return i / 30; matchTick(1 / 30, true); } return -1; };
    const hold = () => { SV.phase = 'prep'; SV.t = 1e9; SV.wave = 0; SV.toSpawn = 0; SV.horde = null; };
    const clearZ = () => { for (const z of ZOMBIES) zombieStow(z); };
    const reset = () => { clearZ(); hold(); survBarrReset(); SURV_RES.planks = 99; SURV_RES.metal = 9; SV.power = false; SV.stuckN = 0; SV.unstuck = 0; };
    const place = (P, x, y, z) => { P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.vy = 0; };
    const grille = (id) => SURV.open.find((o) => o.room === id && o.gate && o.gate.type === 'grille');
    const backOf = (id) => SURV.open.find((o) => o.room === id && o.kind === 'porte' && !o.ext && o.gate && !o.wing);
    const dockW = () => SURV.open.find((o) => o.dock && o.a0 < 0);
    const nail = (op, n = op.max) => { for (let k = 0; k < n; k++) survApply('nail', op.id, E); };
    let hits = []; const oh = zombieHit; zombieHit = (z, T) => { hits.push({ y: T.pos.y, k: z.zk, t: MATCH.time, room: survRoomAt(z.pos) }); oh(z, T); };
    let broken = []; const ogh = survGateHit; survGateHit = (op, dmg) => { const was = op.gate && op.gate.hp > 0; ogh(op, dmg); if (was && op.gate.hp <= 0) broken.push({ id: op.id, room: op.room, kind: op.kind, type: op.gate.type, t: r2(MATCH.time) }); };
    const spawnAt = (kinds, pts, tgt) => kinds.map((k, i) => { const p = pts[i % pts.length], z = zombieSpawn(k, p[0] + (i % 3) * 0.5, p[1] + Math.floor(i / 3) * 0.5, 0); if (z && tgt) { z.zTgt = tgt; z.zRepT = 0; } return z; });
    hold();

    // ---------- STRUCTURE ----------
    {
      const st = { noeuds: NAV.count, principal: 0, etage: 0, etageHors: 0, boutiques: [], ancres: 0, caisses: [], entrees: '' };
      for (let i = 0; i < NAV.count; i++) { if (NAV.comp[i] === main) st.principal++; const y = NAV.ny[i], x = NAV.nx[i], z = NAV.nz[i]; if (Math.abs(y - SL) < 0.06 && Math.abs(x) < 23.5 && Math.abs(z) < 20.5 && !(x > -6 && x < 6 && z < -9 && z > -18)) { st.etage++; if (NAV.comp[i] !== main) st.etageHors++; } }
      if (st.etageHors > 40) fail('étage : ' + st.etageHors + ' nœuds sur ' + st.etage + ' hors du réseau principal');
      for (const S of GAL_SHOPS) { const n = S.row === 'n', zc = (n ? GL.nf : GL.sf) + (n ? -4.5 : 4.5), y = S.lv ? SL : 0, id = navNode((S.x0 + S.x1) / 2, y, zc); if (!(id >= 0 && NAV.comp[id] === main && Math.abs(NAV.ny[id] - y) < 0.5)) st.boutiques.push(S.id); }
      if (st.boutiques.length) fail('boutiques hors du réseau : ' + st.boutiques.join(', '));
      const P = new V3();
      for (const op of SURV.open) for (const side of ['out', 'in']) {
        if (survOpenWalled(op) && side === 'out') { /* (le pan à brèche tient : l'ancre du dehors est contre le mur, mais un nœud la rejoint quand même) */ }
        survOpenAnchor(op, side, P); const id = navNode(P.x, P.y, P.z);
        if (id < 0 || NAV.comp[id] !== main || hyp(NAV.nx[id] - P.x, NAV.nz[id] - P.z) > 1.2 || Math.abs(NAV.ny[id] - P.y) > 0.5) fail('ouverture ' + op.id + ' (' + op.kind + ', ' + op.room + ') : ancre ' + side + ' hors du réseau (' + r2(P.x) + ', ' + r2(P.y) + ', ' + r2(P.z) + ')'); else st.ancres++;
      }
      const atr = new V3(0, 0, 0);
      for (const c of SURV.caches.filter((q) => q.kind === 'ammo')) {
        const sw = Math.abs(Math.sin(c.ry)) > 0.5, hx = sw ? 0.21 : 0.31, hz = sw ? 0.31 : 0.21, own = (b) => Math.abs(b.x0 - (c.x - hx)) < 0.01 && Math.abs(b.z0 - (c.z - hz)) < 0.01 && Math.abs(b.y0 - c.y) < 0.01;
        const over = queryBoxes(c.x - hx, c.z - hz, c.x + hx, c.z + hz).filter((b) => !b.ray && !own(b) && b.y1 > c.y + 0.05 && b.y0 < c.y + 0.36 && b.x1 > c.x - hx + 0.01 && b.x0 < c.x + hx - 0.01 && b.z1 > c.z - hz + 0.01 && b.z0 < c.z + hz - 0.01);
        const id = navNode(c.x, c.y, c.z), ok = id >= 0 && NAV.comp[id] === main && hyp(NAV.nx[id] - c.x, NAV.nz[id] - c.z) < 1.3 && Math.abs(NAV.ny[id] - c.y) < 0.35;
        // (le chemin, portes ouvertes : on ouvre tout le temps du calcul)
        for (const op of SURV.open) if (op.gate && op.gate.down) survGateSet(op, false);
        const p = ok && findPath(atr, new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id])); survBarrReset();
        st.caisses.push([c.x, c.y, c.z, over.length, !!p]);
        if (over.length) fail('caisse (' + c.x + ', ' + c.z + ') dans un mur ou un meuble'); if (!ok || !p) fail('caisse (' + c.x + ', ' + c.z + ') hors de portée du réseau');
      }
      let zs = 0; for (const s of CURMAP.def.zspawns) { const ext = SURV.open.filter((o) => o.ext && !survOpenWalled(o)); if (ext.some((op) => findPath(new V3(s[0], 0, s[1]), survOpenAnchor(op, 'out', P).clone()))) zs++; }
      st.entrees = zs + '/' + CURMAP.def.zspawns.length; if (zs !== CURMAP.def.zspawns.length) fail('un point d\'apparition ne rejoint aucune entrée');
      st.ouvertures = SURV.open.length; st.vantaux = SURV.open.filter((o) => o.gate).length; st.meubles = SURV.props.length; st.objectifs = SURV.objs.map((o) => o.kind).join(',');
      out.structure = st;
    }

    // ---------- VANTAUX : un rideau, une porte ferment le chemin ; le verre éclate ----------
    {
      reset();
      const g = grille('elec'), b = backOf('elec'), inS = new V3(10.5, 0, -13), mall = new V3(10.5, 0, -4), srv = new V3(10.5, 0, -19.5);
      for (const op of SURV.open) if (op.gate && op.gate.down && op !== b) survGateSet(op, false); // (tout ouvert, sauf le fond de la boutique)
      const p0 = !!findPath(mall, inS); survGateSet(g, true); const p1 = !!findPath(mall, inS); survGateSet(b, false); const p2 = !!findPath(srv, inS); survGateSet(b, true); const p3 = !!findPath(srv, inS);
      out.vantaux = { rideauLeve: p0, rideauBaisse: p1, porteOuverte: p2, porteFermee: p3 };
      if (!p0 || p1) fail('rideau de la boutique : le chemin ne suit pas (levé ' + p0 + ', baissé ' + p1 + ')');
      if (!p2 || p3) fail('porte du fond : le chemin ne suit pas (ouverte ' + p2 + ', fermée ' + p3 + ')');
      // une porte vitrée : des balles la brisent (la collision s'en va, le chemin passe)
      reset(); const gl = SURV.open.find((o) => o.gate && o.gate.type === 'glass' && o.room === 'galerie' && o.axis === 'x');
      const end = survOpenFace(gl, new V3()), dir = new V3(0, 0, -1); let n = 0;
      while (gl.gate.hp > 0 && n < 20) { dmgWorldShot(gl.gate.c, end, dir, 32, E); n++; }
      out.vantaux.verreBalles = { tirs: n, pv: gl.gate.hp, collision: gl.gate.c.x0 < 1e5, chemin: !!findPath(new V3(0, 0, 26), new V3(0, 0, 15)) };
      if (gl.gate.hp > 0 || gl.gate.c.x0 < 1e5) fail('porte vitrée : les balles ne la brisent pas (' + n + ' tirs)');
      // et sous les coups d'un mort, de l'autre côté
      reset(); place(E, 0, 0, 14); hits = []; broken = [];
      spawnAt(['shambler'], [[0, 26]], E);
      const t = run(40, () => { if (hits.length) return false; });
      out.vantaux.verreCoups = { brisee: broken.some((x) => x.type === 'glass'), coup: t < 0 ? null : r2(t) };
      if (!out.vantaux.verreCoups.brisee || t < 0) fail('porte vitrée : un mort ne la brise pas pour entrer (' + JSON.stringify(out.vantaux.verreCoups) + ')');
    }

    // ---------- PAR L'ARRIÈRE : le couloir de service, la porte du fond ----------
    {
      reset(); const d = dockW(); d.gate.hp = 0; survGateSet(d, false);
      survGateSet(grille('elec'), true); place(E, 10.5, 0, -13); hits = []; broken = [];
      spawnAt(['shambler', 'shambler', 'runner', 'shambler'], [[-3.5, -24.5], [-2.5, -24.5]], E);
      const t = run(150, () => { if (hits.length) return false; });
      const back = backOf('elec');
      out.arriere = { coup: t < 0 ? null : r2(t), porteDuFond: back.gate.hp <= 0, cedes: broken.map((x) => x.room + ':' + x.type), dansLaBoutique: hits.length ? hits[0].room : null, coinces: SV.stuckN, recuperes: SV.unstuck };
      if (t < 0) fail('par l\'arrière : les morts du quai ne rejoignent pas le vivant dans la boutique');
      else if (back.gate.hp > 0 && grille('elec').gate.hp > 0) fail('par l\'arrière : arrivés sans forcer ni la porte du fond ni le rideau (' + JSON.stringify(out.arriere) + ')');
    }

    // ---------- DÉBORDEMENT : les morts gagnent le mail par une boutique ----------
    {
      reset(); const d = dockW(); d.gate.hp = 0; survGateSet(d, false);
      const staff = SURV.open.find((o) => o.room === 'quai' && o.kind === 'porte' && o.fl === 0 && !o.ext); SURV_RES.nails = true; nail(staff); staff.gate.hp = staff.gate.max;
      place(E, 10, 0, 4); hits = []; broken = [];
      spawnAt(['shambler', 'shambler', 'runner', 'shambler', 'shambler'], [[-3.5, -24.5], [-2.5, -24.5]], E);
      let firstMall = -1, via = null;
      const t = run(170, (s) => { if (firstMall < 0) { const z = zombiesUp().find((q) => survRoomAt(q.pos) === 'galerie' && q.pos.y < 1); if (z) { firstMall = s; via = broken.slice(); } } if (hits.length) return false; });
      out.debordement = { mail: firstMall < 0 ? null : r2(firstMall), coup: t < 0 ? null : r2(t), cedes: (via || broken).map((x) => x.room + ':' + x.kind), porteDuQuai: Math.round(survOpenHp(staff)) };
      if (t < 0) fail('débordement : les morts du quai ne gagnent pas le mail');
      else if (!(via || []).some((x) => x.kind === 'porte' && GAL_SHOPS.some((S) => S.id === x.room))) fail('débordement : les morts ne passent pas par l\'arrière d\'une boutique (' + JSON.stringify(out.debordement) + ')');
    }

    // ---------- ÉTAGE : par l'escalier de service ; par l'atrium ----------
    {
      reset(); const d = dockW(); d.gate.hp = 0; survGateSet(d, false);
      survGateSet(grille('jeux'), true); place(E, -10.5, SL, -13.5); hits = []; broken = [];
      spawnAt(['shambler', 'runner', 'shambler'], [[-3.5, -24.5], [-2.5, -24.5]], E);
      let maxY = 0; const t = run(170, () => { for (const z of zombiesUp()) maxY = Math.max(maxY, z.pos.y); if (hits.some((h) => Math.abs(h.y - SL) < 0.4)) return false; });
      out.etageService = { coup: t < 0 ? null : r2(t), plusHaut: r2(maxY), cedes: broken.map((x) => x.room + ':' + x.kind) };
      if (t < 0) fail('étage (service) : les morts ne montent pas frapper le vivant de la boutique de l\'étage (au plus haut ' + r2(maxY) + ' m)');
      reset(); place(E, 0, SL, 6.5); hits = [];
      spawnAt(['shambler', 'runner', 'shambler', 'crawler'], [[-8, 6], [8, -6]], E);
      const t2 = run(80, () => { if (hits.some((h) => Math.abs(h.y - SL) < 0.4)) return false; });
      out.etageAtrium = { coup: t2 < 0 ? null : r2(t2) };
      if (t2 < 0) fail('étage (atrium) : les morts ne prennent pas les escaliers mécaniques');
    }

    // ---------- CONFINEMENT de l'aile ouest ----------
    {
      reset(); SV.power = true; survLights(true);
      const oi = SURV.objs.findIndex((o) => o.kind === 'lock' && o.w === 'w'); survObjDone(oi, E);
      const wing = SURV.open.filter((o) => o.wing === 'w'), down = wing.filter((o) => o.gate.down).length;
      const fireOk = wing.filter((o) => o.gate.type === 'fire').every((o) => o.gate.down);
      const pathClosed = !findPath(new V3(-20, 0, 0), new V3(0, 0, 0)) && !survOpenReach(new V3(-31, 0, 0), new V3(0, 0, 0));
      place(E, 0, 0, 0); hits = []; broken = [];
      spawnAt(['shambler', 'shambler', 'runner', 'shambler', 'shambler', 'brute'], [[-31, -3], [-20, 3], [-20, -3]], E);
      const t = run(170, () => { if (hits.length) return false; });
      out.confinement = { baisses: down + '/' + wing.length, coupeFeu: fireOk, ferme: pathClosed, coup: t < 0 ? null : r2(t), cedes: broken.map((x) => x.room + ':' + x.type) };
      if (!fireOk) fail('confinement : les rideaux coupe-feu de l\'aile ouest ne tombent pas');
      if (!pathClosed) fail('confinement : l\'aile ouest fermée, un chemin ouvert la relie encore au centre');
      if (t >= 0 && t < 15) fail('confinement : les morts de l\'aile frappent au centre en ' + r2(t) + ' s (trop vite)');
      if (t >= 0 && !broken.length) fail('confinement : les morts de l\'aile arrivent sans rien forcer');
      survObjDone(oi, E); const up = wing.filter((o) => o.gate.hp > 0 && o.gate.type === 'fire').every((o) => !o.gate.down);
      out.confinement.rouverte = up; if (!up) fail('confinement : l\'aile ne se rouvre pas');
      SV.power = false; const lockOff = survObjAction(Object.assign(Object.create(E), { pos: new V3(SURV.objs[oi].x, SL, SURV.objs[oi].z) }));
      out.confinement.sansCourant = lockOff ? lockOff.label : null;
    }

    // ---------- SIÈGE : des morts qui ne sentent personne forcent plusieurs entrées ----------
    {
      reset(); place(E, 10.5, SL, -13); survGateSet(grille('securite'), true);
      const pts = CURMAP.def.zspawns; spawnAt(new Array(14).fill('shambler'), pts, null);
      const att = new Set(); let broke = 0;
      run(75, () => { for (const z of zombiesUp()) if (z.zs === 'breach' && z.zOb && z.zOb.op && z.zOb.op.ext) att.add(z.zOb.op.id); });
      broke = broken.filter((x) => SURV.open[x.id].ext).length;
      out.siege = { entreesAttaquees: att.size, cedees: broke, coinces: SV.stuckN };
      if (att.size < 3) fail('siège : les morts ne s\'en prennent qu\'à ' + att.size + ' entrée(s)');
    }

    // ---------- CAGE, MUR QUI CÈDE, FUITE ----------
    {
      reset(); const ci = SURV.objs.findIndex((o) => o.kind === 'cage'), pl = SURV_RES.planks, mt = SURV_RES.metal;
      for (const c of SURV.caches) if (c.kind === 'ammo') c.left = 0;
      const locked = survObjAction(Object.assign(Object.create(E), { pos: new V3(SURV.objs[ci].x, 0, SURV.objs[ci].z) }));
      survObjDone(ci, E); const shut = !SURV.objs[ci].done; SURV_RES.tools = true; survObjDone(ci, E);
      out.cage = { sansOutils: locked ? locked.label : null, resteFermee: shut, ouverte: SURV.objs[ci].done, planches: SURV_RES.planks - pl, toles: SURV_RES.metal - mt, clous: SURV_RES.nails, caisses: SURV.caches.filter((c) => c.kind === 'ammo').every((c) => c.left === c.max) };
      if (!shut || !SURV.objs[ci].done || SURV_RES.planks - pl !== 6 || SURV_RES.metal - mt !== 2 || !SURV_RES.nails || !out.cage.caisses) fail('cage : ' + JSON.stringify(out.cage));
      // le mur qui cède
      reset(); const w = CURMAP.def.surv.breaks()[0], b = BRCH.list[w.id], op = SURV.open.find((o) => o.brk === w.id);
      const before = !!findPath(new V3(-11.5, 0, -24.5), new V3(-11.5, 0, -19.5)), act0 = survActionAt(Object.assign(Object.create(E), { pos: new V3(-11.5, 0, -20.2), yaw: Math.PI, alive: true }));
      breachSet(b, true, false); const after = !!findPath(new V3(-11.5, 0, -24.5), new V3(-11.5, 0, -19.5));
      place(E, -11.5, 0, -20.2); E.yaw = Math.PI; const act1 = survActionAt(E); nail(op); const boarded = !findPath(new V3(-11.5, 0, -24.5), new V3(-11.5, 0, -19.5));
      out.mur = { avant: before, invite: act0 ? act0.k + (act0.op ? ':' + act0.op.id : '') : null, apres: after, inviteOuvert: act1 ? act1.k + (act1.op ? ':' + act1.op.id : '') : null, cloue: boarded, ouverture: op.id };
      if (before || !after) fail('mur qui cède : le réseau ne suit pas le pan (' + before + ', ' + after + ')');
      if (act0 && act0.op === op) fail('mur qui cède : on cloue sur le mur encore debout');
      if (!act1 || act1.op !== op) fail('mur qui cède : le pan tombé, rien à clouer dans l’ouverture');
      if (!boarded) fail('mur qui cède : l\'ouverture clouée laisse passer');
      breachReset();
    }

    // ---------- REFUGES hors de portée ----------
    {
      survStart(); reset(); clearZ();
      const X0 = -54, X1 = 54, Z0 = -44, Z1 = 48, S = 0.5, pts = [], key = (x, z) => Math.round((x - X0) / S) + ',' + Math.round((z - Z0) / S), cellOf = new Map();
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
      const zCan = new Uint8Array(pts.length);
      const segBlocked = (ax, az, bx, bz, y0, y1) => {
        for (const c of queryBoxes(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
          if (c.ray || c.y1 <= y0 || c.y0 >= y1) continue;
          let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
          // (boîtes grossies de 6 cm : deux boîtes qui se touchent ne laissent pas de fente, un segment le long de leur jointure passait)
          for (const [o, d, lo, hi] of [[ax, dx, c.x0 - 0.06, c.x1 + 0.06], [az, dz, c.z0 - 0.06, c.z1 + 0.06]]) { if (Math.abs(d) < 1e-9) { if (o <= lo || o >= hi) { t0 = 2; break; } continue; } const u = (lo - o) / d, v = (hi - o) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v)); }
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
      const zClr = new Uint8Array(pts.length);
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
            const top = Math.max(p.h, q.h); if (segBlocked(p.x, p.z, q.x, q.z, top + 0.35, top + 1.55) && segBlocked(p.x, p.z, q.x, q.z, top + 0.95, top + 1.95)) continue;
            seen[q.i] = 1; Q.push(q);
          }
        }
      }
      const bad = pts.filter((p) => seen[p.i] && !zReach(p));
      const groups = []; for (const p of bad) { let g = groups.find((G) => Math.abs(G.h - p.h) < 0.3 && hyp(G.x - p.x, G.z - p.z) < 2.5); if (!g) { g = { x: p.x, z: p.z, h: p.h, n: 0 }; groups.push(g); } g.n++; }
      out.refuges = { surfaces: pts.length, joueur: seen.reduce((a, v) => a + v, 0), horsDePortee: bad.length, groupes: groups.slice(0, 14).map((g) => [g.x, g.z, r2(g.h), g.n]), toit: pts.filter((p) => seen[p.i] && p.h > GL.RF).length };
      if (bad.length) fail(bad.length + ' surfaces où un joueur se tient hors de portée des morts (refuge) : ' + JSON.stringify(out.refuges.groupes));
      if (out.refuges.toit) fail('un joueur atteint le toit (' + out.refuges.toit + ' surfaces)');
    }

    // ---------- COÛT : 24 morts dans la galerie ----------
    {
      reset(); place(E, 0, SL, 6.5);
      const P = [[-20, 0], [20, 0], [-31, 4], [31, -4], [0, -14], [-10, 14], [10, 14], [-4, -20.5], [4, 19.5]];
      for (let i = 0; i < 24; i++) { const p = P[i % P.length], z = zombieSpawn(i % 5 === 0 ? 'runner' : 'shambler', p[0] + (i % 3) * 0.6, p[1] + Math.floor(i / 9) * 0.6, 0); if (z) { z.zTgt = E; z.zRepT = Math.random(); } }
      const ms = []; for (let i = 0; i < 30 * 20; i++) { E.health = 1e9; const t0 = performance.now(); matchTick(1 / 30, true); ms.push(performance.now() - t0); }
      ms.sort((a, b) => a - b); const avg = ms.reduce((a, v) => a + v, 0) / ms.length;
      out.cout = { morts: zombiesUp().length, moyenne: r2(avg), mediane: r2(ms[ms.length >> 1]), p95: r2(ms[Math.floor(ms.length * 0.95)]), max: r2(ms[ms.length - 1]) };
    }

    // ---------- LONGUE PARTIE : dix vagues, un tireur sur la passerelle de l'atrium ----------
    {
      clearZ(); survStart(); const W = () => A.slots.filter(ammoUsable), fill = () => { for (const w of W()) { w.mag = w.def.mag; w.reserve = ammoMaxOf(w); } };
      fill(); PL.nades = 1; place(E, 0, SL, 0); SV.t = 4; SV.limit = 0; SV.stuckN = 0; SV.unstuck = 0;
      const waves = [], eye = new V3(), aim = new V3(); let cur = null, shootT = 0, reloadT = 0, t = 0, stall = null;
      const pickTarget = () => { let best = null, bd = 30; eye.set(E.pos.x, E.pos.y + 1.55, E.pos.z); for (const z of zombiesUp()) { const d = z.pos.distanceTo(E.pos); if (d < bd && lineClear(eye, aim.set(z.pos.x, z.pos.y + 1.2, z.pos.z))) { bd = d; best = z; } } return best; };
      while (t < 3600 && SV.wave <= 10 && SV.phase !== 'over') {
        E.health = 1e9; const dt = 1 / 30; t += dt; place(E, 0, SL, 0);
        if (SV.phase === 'prep') { SV.t = Math.min(SV.t, 4); cur = null; fill(); }
        else if (SV.phase === 'wave') {
          if (!cur || cur.w !== SV.wave) { cur = { w: SV.wave, n: SV.comp.n + SV.comp.brutes, t0: t, entrees: new Set() }; waves.push(cur); }
          for (const z of zombiesUp()) if (z.zs === 'breach' && z.zOb && z.zOb.op && z.zOb.op.ext) cur.entrees.add(z.zOb.op.id);
          const tg = pickTarget(); shootT -= dt; reloadT -= dt; const w = A.slots[A.cur];
          if (tg && reloadT <= 0 && shootT <= 0 && w && ammoUsable(w)) {
            if (w.mag <= 0) { const n = Math.min(w.def.mag, w.reserve); w.reserve -= n; w.mag += n; reloadT = 2.2; if (w.reserve <= 0) fill(); }
            else { w.mag--; shootT = w.def.auto ? 0.16 : 0.35; soundEvents.push({ pos: E.pos.clone(), team: E.team, who: E, t: MATCH.time, loud: !!w.def.loud, quiet: !!w.def.silent }); if (soundEvents.length > 60) soundEvents.shift(); if (Math.random() < 0.6) applyDamage(tg, w.def.dmg[0] * 1.2, E, w.def.name, Math.random() < 0.15, aim.copy(tg.pos).sub(E.pos).normalize(), E.pos.clone()); }
          }
          // (au contact : le couteau, sans quoi un mort collé au tireur le bloquerait)
          for (const z of zombiesUp()) if (z.pos.distanceTo(E.pos) < 1.6) applyDamage(z, 999, E, 'Couteau', false, aim.copy(z.pos).sub(E.pos).normalize(), E.pos.clone());
          if (t - cur.t0 > 480 && !stall) stall = { vague: SV.wave, reste: SV.toSpawn, debout: zombiesUp().slice(0, 8).map((z) => {
            const h = survHomeOf(z).clone(), hop = SURV.open[z.zHomeOp], n = navNode(z.pos.x, z.pos.y, z.pos.z), hn = navNode(h.x, h.y, h.z);
            return { p: [r2(z.pos.x), r2(z.pos.y), r2(z.pos.z)], zs: z.zs, st: z.zStuck, room: survRoomAt(z.pos), ob: z.zOb ? z.zOb.t + (z.zOb.op ? z.zOb.op.id + ':' + Math.round(survOpenHp(z.zOb.op)) : z.zOb.p.id) : null,
              home: [r2(h.x), r2(h.y), r2(h.z)], homeOp: hop ? hop.id + ':' + hop.room + ':' + (hop.gate ? hop.gate.hp + '/' + hop.gate.down : '-') + ':' + survOpenShut(hop) : null, noeud: n, noeudMaison: hn, ouvert: survOpenReach(z.pos, h), dur: !!findPath(z.pos, h), soft: !!findPath(z.pos, h, -1, survSoftCost), softId: NAV.softId, chemin: z.zPath ? z.zPath.length : null, rep: r2(z.zRepT), heard: !!z.zHeard, tgt: !!z.zTgt };
          }) };
          if (t - cur.t0 > 480) break;
          cur.dur = r2(t - cur.t0);
        }
        matchTick(dt, true);
      }
      out.longue = { vagues: waves.map((w) => [w.w, w.n, w.dur, w.entrees.size]), atteinte: SV.wave, coinces: SV.stuckN, recuperes: SV.unstuck, rentres: 0, bloque: stall };
      if (stall) fail('longue partie : la vague ' + stall.vague + ' ne finit pas en 8 min (' + JSON.stringify(stall).slice(0, 400) + ')');
      if (SV.wave < 10) fail('longue partie : seulement ' + SV.wave + ' vagues');
    }
    // ---------- FUITE (en dernier : la partie se termine) ----------
    {
      reset(); SV.power = true; SV.truck = true; SV.limit = 10; SV.wave = 10; SV.phase = 'wave'; SV.toSpawn = 0; clearZ(); run(0.3);
      const docks = SURV.open.filter((o) => o.dock), T = SURV.objs.find((o) => o.kind === 'truck');
      out.fuite = { phase: SV.phase, quaiOuvert: docks.every((o) => !o.gate.down) };
      place(E, T.x + 1.2, 0, T.z); for (let i = 0; i < 30 * 7 && SV.phase !== 'over'; i++) { E.health = 1e9; place(E, T.x + 1.2, 0, T.z); clearZ(); matchTick(1 / 30, true); }
      out.fuite.fin = SV.phase + ':' + SV.result;
      if (out.fuite.phase !== 'extract' || !out.fuite.quaiOuvert) fail('fuite : ' + JSON.stringify(out.fuite));
      if (SV.result !== 'win') fail('fuite : cinq secondes près du camion ne suffisent pas (' + out.fuite.fin + ')');
    }
    zombieHit = oh; survGateHit = ogh;
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 10).join('\n')); R.fails.push('erreurs dans la page'); }
  if (OUT && !R.fails.length) {
    const shot = async (name, f) => { await page.evaluate(f); await page.evaluate(() => { const U = FinalShader.uniforms; U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0; Settings.survNoir = false; for (const L of csm.lights) L.shadow.needsUpdate = true; }); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, name), timeout: 240000 }); };
    await page.evaluate(() => { startMatch({}); for (let i = 0; i < 10; i++) matchTick(1 / 30, true); document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; VM.root.visible = false; }); // (la fuite a terminé la partie)
    await shot('galerie-rideau.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset(); const g = SURV.open.find((o) => o.room === 'elec' && o.gate && o.gate.type === 'grille'); survGateSet(g, true); g.gate.k = 1; survGateLook(g); g.gate.hp = g.gate.max * 0.45; survGateLook(g);
      for (let i = 0; i < 4; i++) { const z = zombieSpawn(i === 1 ? 'runner' : 'shambler', 8.4 + i * 1.3, -10.2 - (i % 2) * 0.8, 0); z.zAtk = 0.5 + i * 0.1; z.vel.set(0, 0, 0); for (let j = 0; j < 4; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); }
      camera.position.set(12.5, 1.6, -3.5); camera.lookAt(10.5, 1.5, -9.5); camera.fov = 66; camera.updateProjectionMatrix();
    });
    await shot('galerie-couloir.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset(); const b = SURV.open.find((o) => o.room === 'elec' && o.kind === 'porte'); b.gate.hp = b.gate.max * 0.3; survGateLook(b);
      for (let i = 0; i < 3; i++) { const z = zombieSpawn('shambler', 9.8 + i * 0.7, -19.0 - (i % 2) * 0.9, Math.PI); z.zAtk = 0.6; for (let j = 0; j < 4; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); }
      camera.position.set(2.5, 1.7, -19.6); camera.lookAt(12, 1.3, -19.2); camera.fov = 66; camera.updateProjectionMatrix();
    });
    await shot('galerie-atrium.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset(); SV.power = true; survLights(true);
      for (let i = 0; i < 8; i++) { const z = zombieSpawn(i % 3 ? 'shambler' : 'runner', -6 + i * 1.6, (i % 2 ? 2 : -2.5), Math.PI / 2); z.vel.set(1, 0, 0); for (let j = 0; j < 4; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); }
      camera.position.set(14, 6.7, 7.5); camera.lookAt(-4, 1.5, -1); camera.fov = 66; camera.updateProjectionMatrix();
    });
    await shot('galerie-entree.png', () => {
      for (const z of ZOMBIES) zombieStow(z); survBarrReset(); SV.power = false; survLights(false);
      const g = SURV.open.find((o) => o.gate && o.gate.type === 'glass' && o.axis === 'x'); for (let k = 0; k < 5; k++) survApply('nail', g.id, PL.ent);
      for (let i = 0; i < 9; i++) { const z = zombieSpawn(i % 4 ? 'shambler' : 'brute', -3 + (i % 5) * 1.5, 22.6 + Math.floor(i / 5) * 1.2, Math.PI); z.zAtk = 0.4 + (i % 3) * 0.2; for (let j = 0; j < 4; j++) zombiePose(z, 1 / 30); layoutSoldier(z.model, true); }
      camera.position.set(6, 2.2, 31); camera.lookAt(0, 2, 21.5); camera.fov = 62; camera.updateProjectionMatrix();
    });
  }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('survie-galerie : rien à signaler');
})();
