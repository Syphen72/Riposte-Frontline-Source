/* Grappin et collisions des bâtiments, sur toute une carte : node grappin-toits.js [--json]   (MAP=sable ; PAGE=autre version ; N=60 essais)
   Retour du propriétaire (novembre 2026) : au grappin, on traversait un toit, on finissait dans des combles d'où l'on tirait dehors sans
   être vu. Le grappin n'est stable que s'il tient sur beaucoup de bâtiments de styles différents, pas sur un seul. Dans la vraie boucle de
   partie (matchTick), sans bots :
   - ESSAIS : depuis des nœuds du réseau principal au sol, le joueur vise des façades tirées au hasard (graine fixe), à toutes les hauteurs,
     au milieu ou à 20 cm d'un angle, puis lance le grappin si la visée est acceptée. À la fin : jamais logé dans une boîte pleine, l'œil
     jamais dans une boîte, la tête sous aucune dalle ; posé en hauteur, jamais sur un toit en pente ni un dessus refusé loin du point validé
     (à 70 cm près : le premier gradin d'un toit à côté d'un escalier se rejoint à pied) ; une visée acceptée
     doit le poser sur le dessus visé (au moins 70 % des essais acceptés, sinon le grappin promet ce qu'il ne tient pas) ;
   - REFUS : visé depuis la rue, aucun toit en pente (boîtes roof) ne prend le crochet ;
   - VITESSE : lancé à 45 m/s contre des murs fins (au plus 35 cm) ou à 30 m/s sous des dalles, à 15 images par seconde, le contrôleur
     (ctlMove) ne les traverse jamais ;
   - SYMÉTRIE : 600 paires de points tirés au hasard (et 60 points au fond d'une boîte pleine) : un rayon de A vers B est arrêté si et
     seulement si le rayon de B vers A l'est (rayWorld) ; un point dans une boîte pleine ne voit rien et n'est vu de nulle part : le tir à
     sens unique ne revient pas ;
   - MODE : dans un mode qui retire le grappin (ban), la visée, le lancer, le HUD et le câble des autres joueurs sont coupés. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'low', map: process.env.MAP || 'sable', mode: 'tdm' }, noHdri: true, page: process.env.PAGE });
  const R = await page.evaluate((N) => {
    const out = { carte: CURMAP.info.name, fails: [] }, fail = (m) => { if (out.fails.length < 25) out.fails.push(m); };
    LOCK.fallback = true; startMatch({});
    for (const e of entities) if (!e.isPlayer) { e.alive = false; e.respawnT = 1e9; }
    const E = PL.ent, rnd = rngOf(4242);
    const run = (sec, f) => { for (let i = 0; i < Math.round(sec * 30); i++) { E.health = 1e9; if (f && f(i) === false) break; matchTick(1 / 30, true); } };
    const look = (yaw, pitch) => { PL.yaw = yaw; PL.pitch = pitch; E.yaw = yaw; E.pitch = pitch; };
    const solid = (c) => !c.ray && !c.noRay && !c.inv;
    const lodged = (p, h) => { const r = 0.3; for (const c of queryBoxes(p.x - r, p.z - r, p.x + r, p.z + r)) { if (c.ray || c.y1 <= p.y + STEP + 0.02 || c.y0 >= p.y + h - 0.05) continue; const dx = p.x - clamp(p.x, c.x0, c.x1), dz = p.z - clamp(p.z, c.z0, c.z1); if (dx * dx + dz * dz < r * r) return c; } return null; };
    const inBox = (x, y, z, m = 0.02) => { for (const c of queryBoxes(x - 0.01, z - 0.01, x + 0.01, z + 0.01)) if (solid(c) && x > c.x0 + m && x < c.x1 - m && z > c.z0 + m && z < c.z1 - m && y > c.y0 + m && y < c.y1 - m) return c; return null; };
    const fmt = (c) => c && c.x0 !== undefined ? [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((v) => +v.toFixed(2)).join(' ') : '';
    const main = (id) => NAV.comp[id] === NAV.mainComp && !navGated(id);
    const nodes = []; for (let i = 0; i < NAV.count; i++) if (main(i) && NAV.ny[i] < gy0(NAV.nx[i], NAV.nz[i]) + 0.4) nodes.push(i);
    const reset = (x, y, z) => { grappleReset(); E.pos.set(x, y, z); E.vel.set(0, 0, 0); E.vy = 0; E.onGround = true; E.crouch = false; E.safeP = null; };
    /* ---- Essais ---- */
    const walls = COL.filter((c) => solid(c) && !c.prop && !c.veh && !c.roof && !c.noTop && c.y1 - c.y0 >= 2.5 && c.y1 >= 3 && c.y1 <= GRAP.maxH && Math.max(c.x1 - c.x0, c.z1 - c.z0) >= 1.5);
    const T = { essais: 0, poses: 0, ailleurs: 0, refuses: 0, logé: 0 };
    for (let k = 0; k < N * 6 && T.essais < N && walls.length && nodes.length; k++) {
      const c = walls[Math.floor(rnd() * walls.length)], f = Math.floor(rnd() * 4), ax = f < 2, sg = f % 2 ? 1 : -1;
      const u0 = ax ? c.z0 : c.x0, u1 = ax ? c.z1 : c.x1, edge = rnd() < 0.2;
      const u = edge ? (rnd() < 0.5 ? u0 + 0.2 : u1 - 0.2) : lerp(u0 + 0.3, u1 - 0.3, rnd());
      const fx = ax ? (sg > 0 ? c.x1 : c.x0) + sg * 0.02 : u, fz = ax ? u : (sg > 0 ? c.z1 : c.z0) + sg * 0.02, fy = c.y1 - lerp(0.25, 2.5, rnd());
      if (fy < 1) continue;
      // un nœud devant la face, de 4 à 16 m, qui la voit
      let best = null;
      for (let t = 0; t < 40; t++) {
        const id = nodes[Math.floor(rnd() * nodes.length)], nx = NAV.nx[id], nz = NAV.nz[id], ny = NAV.ny[id];
        const dx = nx - fx, dz = nz - fz, d = Math.hypot(dx, dz); if (d < 4 || d > 16) continue;
        if ((ax ? dx * sg : dz * sg) < d * 0.5) continue; // devant la face
        const eye = new V3(nx, ny + 1.62, nz); if (!lineClear(eye, new V3(fx, fy, fz))) continue;
        best = { nx, ny, nz, eye }; break;
      }
      if (!best) continue;
      const dir = new V3(fx - best.eye.x, fy - best.eye.y, fz - best.eye.z).normalize();
      const aim = grappleAim(best.eye, dir, best.ny);
      if (!aim) { T.refuses++; continue; }
      T.essais++;
      reset(best.nx, best.ny, best.nz); look(Math.atan2(-dir.x, -dir.z), Math.asin(dir.y)); run(0.1);
      grappleTry(); if (!GR.st) { T.essais--; T.refuses++; continue; } // visée de la caméra un peu différente de celle de l'essai, au bord d'un dessus
      const top = aim.top; let maxY = E.pos.y, why = '', was = GR.st;
      const rel0 = window.grappleRelease; window.grappleRelease = function (j) { if (!why) why = (GR.t > GRAP.maxT ? 'durée' : 'lâché') + ' en ' + GR.st + ' à ' + E.pos.y.toFixed(2); return rel0.apply(this, arguments); };
      let t = 0; run(4, () => { t += 1 / 30; maxY = Math.max(maxY, E.pos.y); if (GR.st) was = GR.st; look(Math.atan2(-dir.x, -dir.z), Math.min(Math.asin(dir.y), 0.2)); if (t > 0.6 && !GR.st && E.onGround) return false; });
      window.grappleRelease = rel0;
      run(0.2);
      const p = E.pos, h = E.crouch ? 1.2 : 1.75, L = lodged(p, h), eyeB = inBox(p.x, p.y + E.eyeH, p.z), head = ceilingAbove(p.x, p.z, p.y + 0.3, 0.3);
      const where = `${p.x.toFixed(1)} ${p.y.toFixed(2)} ${p.z.toFixed(1)} (${zoneName(p.x, p.z)})`;
      if (L) { T.logé++; fail(`logé dans une boîte pleine en ${where} : ${fmt(L)}`); }
      if (eyeB) fail(`l'œil dans une boîte en ${where} : ${fmt(eyeB)}`);
      if (head < p.y + h - 0.1) fail(`la tête sous une dalle en ${where} (dalle à ${head.toFixed(2)})`);
      const under = grappleUnder(p.x, p.z, p.y);
      if (p.y > best.ny + 2 && under && (under.roof || under.noTop) && Math.hypot(p.x - aim.land.x, p.z - aim.land.z) > 0.7) fail(`posé sur un dessus refusé (${under.roof || 'noTop'}) en ${where}, visé ${aim.land.x.toFixed(1)} ${top.toFixed(2)} ${aim.land.z.toFixed(1)} sur ${fmt(grappleUnder(aim.land.x, aim.land.z, top))}, bord ${aim.clear.toFixed(2)}`);
      if (E.onGround && Math.abs(p.y - top) < 0.3) T.poses++; else { T.ailleurs++; if ((out.ailleurs = out.ailleurs || []).length < 8) out.ailleurs.push(`visé ${aim.land.x.toFixed(1)} ${top.toFixed(2)} ${aim.land.z.toFixed(1)} depuis ${best.nx.toFixed(1)} ${best.nz.toFixed(1)} : fini en ${where}, monté à ${maxY.toFixed(2)}, ${why || 'arrivé'}`); }
    }
    out.essais = T;
    if (T.essais >= 5 && T.poses < T.essais * 0.7) fail(`le grappin pose le joueur sur le dessus visé ${T.poses} fois sur ${T.essais} visées acceptées`);
    /* ---- Refus des toits en pente ---- */
    const roofs = COL.filter((c) => c.roof); let refusOk = 0, accroche = 0;
    for (let k = 0; k < 80 && roofs.length; k++) {
      const c = roofs[Math.floor(rnd() * roofs.length)], x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2;
      for (const [ox, oz] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) {
        const eye = new V3(x + ox, gy0(x + ox, z + oz) + 1.62, z + oz), d = new V3(x - eye.x, c.y1 - 0.05 - eye.y, z - eye.z).normalize();
        const h = rayWorld(eye.x, eye.y, eye.z, d.x, d.y, d.z, 40, 2); if (!h || h.box !== c) continue;
        if (grappleAim(eye, d, eye.y - 1.62)) { accroche++; fail(`le crochet prend un toit (${c.roof}) en ${x.toFixed(1)} ${c.y1.toFixed(2)} ${z.toFixed(1)}`); } else refusOk++;
        break;
      }
    }
    out.toitsRefuses = { refus: refusOk, accroche };
    /* ---- Vitesse : murs fins et dalles ---- */
    const V = { murs: 0, traverses: 0, dalles: 0, passees: 0 };
    const thin = COL.filter((c) => solid(c) && !c.prop && !c.veh && c.y0 <= 0.05 + gy0((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2) && c.y1 - c.y0 >= 2.2 && Math.min(c.x1 - c.x0, c.z1 - c.z0) <= 0.35 && Math.max(c.x1 - c.x0, c.z1 - c.z0) >= 2);
    for (let k = 0; k < 30 && thin.length; k++) {
      const c = thin[Math.floor(rnd() * thin.length)], alongX = c.x1 - c.x0 > c.z1 - c.z0, mid = alongX ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2;
      for (const sg of [1, -1]) {
        const x = alongX ? mid : (sg > 0 ? c.x0 - 1.2 : c.x1 + 1.2), z = alongX ? (sg > 0 ? c.z0 - 1.2 : c.z1 + 1.2) : mid, g = groundHeight(x, z, c.y0 + 1, 0.3);
        if (lodged(new V3(x, g, z), 1.75) || Math.abs(g - c.y0) > 0.3) continue;
        V.murs++; reset(x, g + 0.6, z); E.onGround = false;
        for (let i = 0; i < 8; i++) { if (alongX) { E.vel.set(0, 0, 45 * sg); } else E.vel.set(45 * sg, 0, 0); E.vy = 0.5; ctlMove(E, 1 / 15); }
        const past = alongX ? (sg > 0 ? E.pos.z > c.z1 : E.pos.z < c.z0) : (sg > 0 ? E.pos.x > c.x1 : E.pos.x < c.x0);
        if (past && E.pos.y < c.y1 - 0.5) { V.traverses++; fail(`à 45 m/s, un mur fin traversé en ${x.toFixed(1)} ${z.toFixed(1)} (${fmt(c)})`); }
        break;
      }
    }
    const slabs = COL.filter((c) => solid(c) && !c.prop && !c.veh && c.y1 - c.y0 <= 0.45 && c.y0 >= 2.4 && (c.x1 - c.x0) >= 2 && (c.z1 - c.z0) >= 2);
    for (let k = 0; k < 30 && slabs.length; k++) {
      const c = slabs[Math.floor(rnd() * slabs.length)], x = lerp(c.x0 + 0.6, c.x1 - 0.6, rnd()), z = lerp(c.z0 + 0.6, c.z1 - 0.6, rnd());
      const g = groundHeight(x, z, c.y0 - 0.1, 0.3); if (c.y0 - g < 2.1 || lodged(new V3(x, g, z), 1.75)) continue;
      V.dalles++; reset(x, g, z); E.onGround = false;
      for (let i = 0; i < 6; i++) { E.vy = 30; E.vel.set(0, 0, 0); ctlMove(E, 1 / 15); }
      if (E.pos.y + 1.0 > c.y1) { V.passees++; fail(`à 30 m/s, une dalle traversée par le haut en ${x.toFixed(1)} ${z.toFixed(1)} (${fmt(c)} ; pieds à ${E.pos.y.toFixed(2)})`); }
    }
    out.vitesse = V;
    reset(NAV.nx[nodes[0]], NAV.ny[nodes[0]], NAV.nz[nodes[0]]);
    /* ---- Symétrie des rayons ---- */
    const blocked = (a, b) => { const d = a.distanceTo(b); if (d < 0.05) return false; const v = b.clone().sub(a).divideScalar(d); const h = rayWorld(a.x, a.y, a.z, v.x, v.y, v.z, d, 0); return !!h && h.t < d - 0.05; };
    const margin = (p) => { for (const c of queryBoxes(p.x - 0.2, p.z - 0.2, p.x + 0.2, p.z + 0.2)) { if (c.noRay) continue; const dx = Math.max(c.x0 - p.x, p.x - c.x1, 0), dy = Math.max(c.y0 - p.y, p.y - c.y1, 0), dz = Math.max(c.z0 - p.z, p.z - c.z1, 0); const out_ = Math.hypot(dx, dy, dz); const inn = Math.min(p.x - c.x0, c.x1 - p.x, p.y - c.y0, c.y1 - p.y, p.z - c.z0, c.z1 - p.z); if ((out_ > 0 && out_ < 0.15) || (out_ === 0 && inn < 0.2)) return true; } return false; };
    const pt = () => { const x = lerp(MAP.x0 + 1, MAP.x1 - 1, rnd()), z = lerp(MAP.z0 + 1, MAP.z1 - 1, rnd()); return new V3(x, gy0(x, z) + lerp(0.3, 14, rnd()), z); };
    const S = { paires: 0, asym: 0, dedans: 0, dedansVu: 0 };
    for (let k = 0; k < 2000 && S.paires < 600; k++) {
      const a = pt(), b = pt(); if (margin(a) || margin(b) || a.distanceTo(b) > 60) continue;
      S.paires++; const ab = blocked(a, b), ba = blocked(b, a);
      if (ab !== ba) { S.asym++; fail(`rayon à sens unique entre ${a.toArray().map((v) => v.toFixed(1)).join(' ')} et ${b.toArray().map((v) => v.toFixed(1)).join(' ')} (${ab ? 'arrêté' : 'libre'} à l'aller, ${ba ? 'arrêté' : 'libre'} au retour)`); }
    }
    const big = COL.filter((c) => solid(c) && c.x1 - c.x0 > 1 && c.y1 - c.y0 > 1 && c.z1 - c.z0 > 1);
    for (let k = 0; k < 60 && big.length; k++) {
      const c = big[Math.floor(rnd() * big.length)], a = new V3(lerp(c.x0 + 0.35, c.x1 - 0.35, rnd()), lerp(c.y0 + 0.35, c.y1 - 0.35, rnd()), lerp(c.z0 + 0.35, c.z1 - 0.35, rnd()));
      const b = a.clone().add(new V3(rnd() * 30 - 15, rnd() * 6, rnd() * 30 - 15)); if (margin(b)) continue;
      S.dedans++; if (!blocked(a, b) || !blocked(b, a)) { S.dedansVu++; fail(`un point au fond d'une boîte voit ou est vu : ${a.toArray().map((v) => v.toFixed(1)).join(' ')} dans ${fmt(c)}`); }
    }
    out.symetrie = S;
    /* ---- Mode sans grappin ---- */
    const m0 = MATCH.mode; MODES.__essai = { ...MODES.tdm, ban: ['grapple'] }; MATCH.mode = '__essai';
    const eye = new V3(0, 1.62, 0), anyAim = walls.length ? grappleAim(eye, new V3(0, 1, 0), 0) : null;
    grappleReset(); grappleTry(); const st = GR.st, hud = grappleHud(); const rem = entities.find((e) => !e.isPlayer); if (rem) { rem.net = rem.net || {}; grappleNet(rem, [1, 2, 3]); }
    out.mode = { lance: st, hud, cableDistant: rem ? !!GR.remote.has(rem) : false };
    if (st || hud || (rem && GR.remote.has(rem)) || anyAim) fail('un mode qui retire le grappin le laisse partir, l’afficher ou dessiner le câble d’un autre joueur');
    MATCH.mode = m0; delete MODES.__essai;
    return out;
  }, +(process.env.N || 60));
  if (json) console.log(JSON.stringify(R)); else console.log(JSON.stringify(R, null, 1));
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) { console.log(errs.slice(0, 8).join('\n')); R.fails.push('erreurs dans la page'); }
  await browser.close();
  if (R.fails.length) { console.log('ÉCHECS :\n  ' + R.fails.join('\n  ')); process.exit(1); }
  console.log('grappin et toits : rien à signaler');
})();
