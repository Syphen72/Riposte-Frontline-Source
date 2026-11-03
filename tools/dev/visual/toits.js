/* Toits et combles : ce que l'on voit au-dessus d'un dessus où l'on peut se tenir. node toits.js [--json]   (MAP=meltem ; PAGE=autre version ; TOP=25)
   Retour du propriétaire (novembre 2026) : au grappin, on se retrouvait sous un toit en pente, dans des combles qu'on ne devait pas
   atteindre, d'où l'on voyait et tirait dehors à travers les tuiles sans être vu. Ce contrôle relève le rendu avant son envoi au GPU
   (finalizeWorld enveloppé, comme fentes.js), le décor fusionné seulement (matières de construction : ni feuillage, ni toile, ni vitre), puis
   descend des rayons verticaux tous les 50 cm sur toute la carte. En chaque point :
   - H : la plus haute surface rendue ; S : le plus haut dessus de collision sous H (une boîte, une rampe ou le sol) ;
   - libre : la hauteur sans boîte au-dessus de S, jusqu'à H ou jusqu'au dessous de la boîte suivante.
   COMBLE : libre d'au moins 1,15 m (un soldat accroupi, 1,2 m, y tient), S à plus de 0,5 m au-dessus du sol, aucun nœud du réseau principal des
   bots sur la zone (une pièce, un porche, une terrasse couverte où l'on marche en ont), et fermé (à 1 m au-dessus de S, le rendu arrête
   la vue à moins de 5 m dans les 8 directions) : un volume clos par le rendu, que la collision laisse vide, où un soldat arrivé par en haut
   se tiendrait caché. Les points voisins (même S à 0,5 m près) forment une zone ; une zone de
   moins de 1 m2 ne compte pas.
   ENFONCÉ : sur un dessus que le grappin peut prendre (boîte sans noTop), le rendu passe de 12 cm à 1 m au-dessus : on s'y tient les
   jambes dans le toit.
   Sortie : les zones, de la plus grande à la plus petite ; code d'erreur s'il reste un comble. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'sable', TOP = +(process.env.TOP || 25);
  const { browser, page, logs } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (TOP) => {
    const bufs = [], fin = finalizeWorld;
    window.finalizeWorld = function () { for (const b of WORLD.bufs.values()) if (b.g.ni && (b.cls === 0 || b.cls === 2)) bufs.push({ mat: b.mat, P: b.g.P.slice(0, b.g.nv * 3), I: b.g.I.slice(0, b.g.ni) }); return fin.apply(this, arguments); };
    await mapEnsure(Settings.map); LOCK.fallback = true; startMatch({});
    const SKIP = /leaf|foliage|folb|cyfol|bark|trunk|tronc|grass|gazon|herb|flower|fleur|plant|vine|ivy|lierre|palm|canvas|toile|cloth|fabric|burlap|tarp|bache|awning|store|glass|vitre|window|water|eau|sea|mer|sky|ciel|cloud|nuage|smoke|fume|lamp|neon|wire|cable|rope|corde|flag|drapeau|linge|net|filet/i;
    const used = bufs.filter((b) => !SKIP.test(b.mat));
    // triangles par case de 1 m (les très grands triangles, sol et ciel, sont écartés)
    const key = (i, j) => (i + 5000) * 100003 + j + 5000, TB = new Map();
    for (let bi = 0; bi < used.length; bi++) {
      const { P, I } = used[bi];
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        if (Math.max(P[a + 1], P[b + 1], P[c + 1]) < 0.6) continue;
        const x0 = Math.floor(Math.min(P[a], P[b], P[c])), x1 = Math.floor(Math.max(P[a], P[b], P[c])), z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2])), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 900) continue;
        for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); let l = TB.get(k); if (!l) TB.set(k, l = []); l.push(bi, t); }
      }
    }
    // plus haute surface rendue au-dessus de (x, z) : test du point dans le triangle vu de dessus, hauteur par interpolation
    const top = (x, z) => {
      const l = TB.get(key(Math.floor(x), Math.floor(z))); if (!l) return null;
      let best = -1e9, bm = null;
      for (let n = 0; n < l.length; n += 2) {
        const B = used[l[n]], P = B.P, I = B.I, t = l[n + 1], a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ax = P[a], az = P[a + 2], bx = P[b], bz = P[b + 2], cx = P[c], cz = P[c + 2];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
        const y = u * P[a + 1] + v * P[b + 1] + w * P[c + 1];
        if (y > best) { best = y; bm = B.mat; }
      }
      return bm ? { y: best, m: bm } : null;
    };
    const main = (id) => NAV.comp[id] === NAV.mainComp;
    const navNear = (x, z, y) => {
      for (let i = Math.floor(x - 0.8); i <= Math.floor(x + 0.8); i++) for (let j = Math.floor(z - 0.8); j <= Math.floor(z + 0.8); j++) {
        const cell = NAV.cells[(j - NAV.z0) * NAV.W + i - NAV.x0]; if (!cell) continue;
        for (const id of cell) if (main(id) && Math.abs(NAV.ny[id] - y) < 0.5 && Math.hypot(NAV.nx[id] - x, NAV.nz[id] - z) < 1.1) return true;
      }
      return false;
    };
    const boxAt = (x, z, y) => { let best = null; for (const c of queryBoxes(x - 0.01, z - 0.01, x + 0.01, z + 0.01)) if (!c.ray && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && Math.abs(c.y1 - y) < 0.02) best = c; return best; };
    // premier triangle touché par un rayon horizontal (cases traversées tous les 25 cm)
    const castH = (ox, oy, oz, dx, dz, L) => {
      const ks = new Set(); for (let s = 0; s <= L; s += 0.25) ks.add(key(Math.floor(ox + dx * s), Math.floor(oz + dz * s)));
      let best = -1;
      for (const k of ks) {
        const l = TB.get(k); if (!l) continue;
        for (let n = 0; n < l.length; n += 2) {
          const B = used[l[n]], P = B.P, I = B.I, t = l[n + 1], a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
          const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
          const px = -e2y * dz, py = dz * e2x - dx * e2z, pz = dx * e2y, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-9) continue;
          const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (dx * qx + dz * qz) * inv; if (w < 0 || u + w > 1) continue;
          const s = (e2x * qx + e2y * qy + e2z * qz) * inv; if (s >= 0 && s <= L && (best < 0 || s < best)) best = s;
        }
      }
      return best;
    };
    // fermé : dans les 8 directions, à hauteur d'œil accroupi, le rendu arrête la vue à moins de 5 m (combles, volume sous un toit, dans un
    // édicule) ; un recoin ouvert d'un côté (sous le débord d'un toit voisin, sur une marquise) se voit du dehors : ce n'est pas une cachette
    const shut = (x, y, z) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (castH(x, y, z, Math.cos(a), Math.sin(a), 5) < 0) return false; } return true; };
    const S = 0.5, pts = new Map();
    for (let x = MAP.x0 + S / 2; x < MAP.x1; x += S) for (let z = MAP.z0 + S / 2; z < MAP.z1; z += S) {
      const h = top(x, z); if (!h) continue;
      // dessus : le plus haut dessus de collision qui n'est pas au-dessus du rendu (le haut d'une boîte qui affleure le rendu compte : c'est plein)
      const g0 = gy0(x, z), s = groundHeight(x, z, h.y + 0.12 - STEP, 0.01);
      if (h.y - s <= 0.12) continue;
      const ceil = ceilingAbove(x, z, s + 0.03, 0.01), free = Math.min(ceil, h.y) - s;
      const b = boxAt(x, z, s), i = Math.round((x - MAP.x0) / S), j = Math.round((z - MAP.z0) / S);
      if (free >= 1.15 && s > g0 + 0.5) pts.set(i * 10000 + j, { k: 'comble', x, z, s, h: h.y, free, m: h.m, b, i, j });
      else if (b && !b.noTop && h.y - s < 1 && ceil >= h.y - 0.02) pts.set(i * 10000 + j, { k: 'enfonce', x, z, s, h: h.y, free, m: h.m, b, i, j });
    }
    // zones : points voisins de même sorte et de même S
    const seen = new Set(), zones = [];
    for (const p of pts.values()) {
      if (seen.has(p)) continue;
      const Z = [p], q = [p]; seen.add(p);
      while (q.length) {
        const a = q.pop();
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = pts.get((a.i + di) * 10000 + a.j + dj); if (n && !seen.has(n) && n.k === p.k && Math.abs(n.s - a.s) < 0.5) { seen.add(n); Z.push(n); q.push(n); } }
      }
      const area = Z.length * S * S; if (area < 1) continue;
      const nav = Z.filter((a) => navNear(a.x, a.z, a.s)).length;
      if (p.k === 'comble' && nav > 0) continue; // une pièce, un porche, une terrasse couverte où l'on marche
      if (p.k === 'comble') { const c = Z.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const probe = [c[0], c[Math.floor(c.length / 2)], c[c.length - 1]]; if (!probe.some((a) => shut(a.x, a.s + 1.0, a.z))) continue; }
      const mats = new Map(); for (const a of Z) mats.set(a.m, (mats.get(a.m) || 0) + 1);
      const fl = new Set(); for (const a of Z) if (a.b) { if (a.b.noTop) fl.add('noTop'); if (a.b.veh) fl.add('veh'); if (a.b.prop) fl.add('prop'); if (a.b.roof) fl.add('roof:' + a.b.roof); }
      const xs = Z.map((a) => a.x), zs = Z.map((a) => a.z);
      zones.push({ k: p.k, aire: +area.toFixed(1), x: [+Math.min(...xs).toFixed(1), +Math.max(...xs).toFixed(1)], z: [+Math.min(...zs).toFixed(1), +Math.max(...zs).toFixed(1)], S: +p.s.toFixed(2), H: +Math.max(...Z.map((a) => a.h)).toFixed(2), libre: +Math.max(...Z.map((a) => a.free)).toFixed(2), zone: zoneName(p.x, p.z), rendu: [...mats].sort((a, b) => b[1] - a[1]).slice(0, 3).map((m) => m[0]).join(','), boite: [...fl].join(',') });
    }
    // exceptions, une par cas vu sur place : le relevé ne voit pas les tissus (toile d'une tente, store), qu'il laisse de côté parce qu'ils bougent
    const EXEMPT = { givre: [[-7.6, -0.4, 43.2, 47.8, 'tente de la base : son toit est un tissu, à 2,4 m au bord, au-dessus de la boîte de 2,1 m (noTop)']] };
    for (const z of zones) for (const [x0, x1, z0, z1, why] of EXEMPT[CURMAP.id] || []) { // (et son reflet en z : les cartes sont symétriques)
      const a0 = Math.min(Math.abs(z.z[0]), Math.abs(z.z[1])), a1 = Math.max(Math.abs(z.z[0]), Math.abs(z.z[1]));
      if (z.k === 'comble' && Math.sign(z.z[0]) === Math.sign(z.z[1]) && z.x[0] >= x0 && z.x[1] <= x1 && a0 >= z0 && a1 <= z1) { z.k = 'exempt'; z.pourquoi = why; }
    }
    zones.sort((a, b) => b.aire - a.aire);
    return { carte: CURMAP.info.name, points: pts.size, combles: zones.filter((z) => z.k === 'comble'), exempts: zones.filter((z) => z.k === 'exempt'), enfonces: zones.filter((z) => z.k === 'enfonce'), top: TOP };
  }, TOP);
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.carte} : ${R.combles.length} comble(s), ${R.enfonces.length} dessus enfoncé(s)`);
    for (const z of R.combles.slice(0, TOP)) console.log(`  COMBLE ${z.aire} m2  x ${z.x.join('..')}  z ${z.z.join('..')}  dessus ${z.S}  rendu ${z.H}  libre ${z.libre}  ${z.zone}  [${z.rendu}] ${z.boite}`);
    for (const z of R.exempts) console.log(`  (exception) ${z.aire} m2  x ${z.x.join('..')}  z ${z.z.join('..')} : ${z.pourquoi}`);
    for (const z of R.enfonces.slice(0, TOP)) console.log(`  ENFONCÉ ${z.aire} m2  x ${z.x.join('..')}  z ${z.z.join('..')}  dessus ${z.S}  rendu ${z.H}  ${z.zone}  [${z.rendu}] ${z.boite}`);
  }
  const errs = logs.filter((l) => l.includes('pageerror'));
  if (errs.length) console.log(errs.slice(0, 5).join('\n'));
  await browser.close();
  if (R.combles.length || errs.length) { if (!json) console.log('ÉCHECS :\n  ' + R.combles.length + ' comble(s) où se tenir sous le rendu'); process.exit(1); }
  console.log('toits : rien à signaler');
})();
