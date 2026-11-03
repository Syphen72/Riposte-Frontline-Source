/* ==========================================================================
   CARTE « HOLLOWAY » (Breachline, survie : MODES.zombie, 09ia-survie.js) : une ferme isolée, la nuit.
   Au centre, la maison de pierre à étage (salle et cuisine au rez-de-chaussée, deux chambres à l'étage, un escalier contre le mur nord de la
   salle, des combles pleins sous le toit de tuiles : on ne s'y tient pas) ; une véranda couverte au sud. Au nord-ouest, la grange rouge, ouverte
   jusqu'au toit, avec son fenil (on y monte par un escalier raide) ; au nord-est, l'appentis à outils. Autour : la cour gravillonnée, le puits,
   le pick-up, des clôtures basses, les champs labourés à l'est et à l'ouest, le chemin de terre qui part au sud, et la lisière des bois tout
   autour, d'où viennent les morts.
   Ce que l'on peut tenir : la maison (six ouvertures du rez-de-chaussée à barricader, deux portes et quatre fenêtres : survOpening, 08m-barricades.js),
   la grange (son grand portail et sa porte de côté), l'appentis. Rien n'est praticable au-dessus des toits : tuiles et combles sont pleins
   (Maker.capEnd), le grappin est retiré de la survie, et les morts n'ont aucun chemin vers un toit (règles du propriétaire, novembre 2026).
   Lumière : une nuit de lune, brume basse ; la lampe de la véranda, la cuisine et la grange éclairées ; les fenêtres de la maison allumées.
   Matières et sol : le nécessaire de French Dream (lotissement, 02ym-pavillons-kit.js : pelouse, terre, gravillons, arbres, herbe), la pierre
   et les tuiles de Khamsin.
   ========================================================================== */
const FRM = { R: null, splat: null };
/* Maison : bornes, épaisseur des murs, hauteur du plancher de l'étage (SL), hauteur des murs de l'étage */
const FRM_H = { x0: -6, x1: 6, z0: -4.5, z1: 4.5, t: 0.4, SL: 3.25, H2: 2.6 };
function fermeLevel() {
  FRM.R = rngOf(6203);
  fermeHouse(); fermeBarn(); fermeShed(); fermeYard(); fermeFields(); fermeWoods(); fermeGround();
}

/* ---------- La maison ---------- */
function fermeHouse() {
  const { x0, x1, z0, z1, t, SL, H2 } = FRM_H, M = DECOR, stone = [0.86, 0.82, 0.76], wall = { tint: stone, m: 'concrete' };
  const top = SL + H2, zn = z0 + t / 2, zs = z1 - t / 2, xw = x0 + t / 2, xe = x1 - t / 2;
  // rez-de-chaussée : porte d'entrée et deux fenêtres au sud, porte de la cuisine et une fenêtre au nord, une fenêtre à l'est et à l'ouest
  const door = (a0, a1) => ({ a0, a1, b0: 0, b1: 2.25 }), win = (a0, a1) => ({ a0, a1, b0: 0.95, b1: 2.2 });
  // (portes de 1,2 m centrées sur un centre de case de 1 m : le réseau des bots les traverse, navigation.js)
  wallOpen('stone', 'x', zs, t, x0, x1, 0, SL, [win(-5.3, -4.3), door(-3.1, -1.9), win(2.4, 3.6)], wall);
  wallOpen('stone', 'x', zn, t, x0, x1, 0, SL, [win(-1.6, -0.4), door(2.9, 4.1)], wall);
  wallOpen('stone', 'z', xe, t, z0 + t, z1 - t, 0, SL, [win(-0.6, 0.6)], wall);
  wallOpen('stone', 'z', xw, t, z0 + t, z1 - t, 0, SL, [win(-1.6, -0.4)], wall);
  for (const [k, axis, fixed, a0, a1, b0, b1, out] of [
    ['porte', 'x', zs, -3.1, -1.9, 0, 2.25, 1], ['fenetre', 'x', zs, -5.3, -4.3, 0.95, 2.2, 1], ['fenetre', 'x', zs, 2.4, 3.6, 0.95, 2.2, 1],
    ['porte', 'x', zn, 2.9, 4.1, 0, 2.25, -1], ['fenetre', 'x', zn, -1.6, -0.4, 0.95, 2.2, -1],
    ['fenetre', 'z', xe, -0.6, 0.6, 0.95, 2.2, 1], ['fenetre', 'z', xw, -1.6, -0.4, 0.95, 2.2, -1],
  ]) survOpening({ kind: k, axis, fixed, t, a0, a1, b0, b1, out, room: 'maison' });
  // cloison de la salle et de la cuisine, sa porte
  wallOpen('plaster', 'z', 0.8, 0.2, z0 + t, z1 - t, 0, SL, [{ a0: -3.1, a1: -1.9, b0: 0, b1: 2.2 }], { tint: [0.92, 0.88, 0.8], frames: false });
  // escalier contre le mur nord de la salle, de la cloison vers le mur ouest ; dessous maçonné (pas de recoin sous les marches)
  ramp(-5.55, -2.0, z0 + t, z0 + t + 1.1, 'x', SL, 0, 'wood', [0.66, 0.52, 0.38], { mat: 'wood' });
  // plancher de l'étage, trémie au-dessus de l'escalier, garde-corps
  M.save().color([0.62, 0.48, 0.34]).world(1);
  box('wood', x0 + t, x1 - t, SL - 0.25, SL, z0 + t + 1.1, z1 - t, { tint: [0.62, 0.48, 0.34], m: 'wood' });
  box('wood', -2.0, x1 - t, SL - 0.25, SL, z0 + t, z0 + t + 1.1, { tint: [0.62, 0.48, 0.34], m: 'wood' });
  M.restore();
  ceilingJoists(x0 + t, x1 - t, z0 + t + 1.1, z1 - t, SL - 0.25);
  railing(z0 + t + 1.12, 0, SL, -5.55, -2.0, 'x', null, [0.3, 0.24, 0.18]); DECOR.col(-5.55, -2.0, SL, SL + 1.0, z0 + t + 1.08, z0 + t + 1.16, 'wood');
  // étage : deux chambres, fenêtres sur chaque face, plafond, puis le toit de tuiles (combles pleins, Maker.capEnd)
  const up = { tint: [0.9, 0.86, 0.8], m: 'concrete', floorY: SL }, uwin = (a0, a1) => ({ a0, a1, b0: 0.9, b1: 2.0 });
  wallOpen('stone', 'x', zs, t, x0, x1, SL, H2, [uwin(-4.4, -3.4), uwin(2.6, 3.6)], up);
  wallOpen('stone', 'x', zn, t, x0, x1, SL, H2, [uwin(-1.5, -0.5), uwin(3.0, 4.0)], up);
  wallOpen('stone', 'z', xe, t, z0 + t, z1 - t, SL, H2, [uwin(-0.5, 0.5)], up);
  wallOpen('stone', 'z', xw, t, z0 + t, z1 - t, SL, H2, [uwin(0.4, 1.4)], up);
  wallOpen('plaster', 'z', 0.8, 0.2, z0 + t, z1 - t, SL, H2, [{ a0: 0.9, a1: 2.1, b0: 0, b1: 2.1 }], { tint: [0.92, 0.88, 0.8], frames: false, floorY: SL });
  box('plaster', x0, x1, top, top + 0.15, z0, z1, { tint: [0.9, 0.87, 0.82] });
  pitchedRoof(x0, x1, z0, z1, top + 0.15, [0.82, 0.78, 0.72], rngOf(611));
  // véranda : plancher, marches, poteaux, petit toit de tuiles plat (sa collision suit son dessus)
  box('wood', -5.4, 1.8, 0, 0.3, z1, z1 + 2.2, { tint: [0.6, 0.46, 0.32], m: 'wood' });
  ramp(-3.6, -2.2, z1 + 2.2, z1 + 2.8, 'z', 0.3, 0, 'wood', [0.6, 0.46, 0.32], { mat: 'wood' });
  for (const x of [-5.25, -1.0, 1.65]) box('wood', x - 0.07, x + 0.07, 0.3, 2.7, z1 + 2.0, z1 + 2.14, { tint: [0.55, 0.42, 0.3], m: 'wood' });
  box('rooftiles', -5.5, 1.9, 2.7, 2.85, z1, z1 + 2.4, { tint: [0.74, 0.5, 0.4] });
  DECOR.place(PF.lantern(), -2.9, 2.65, z1 + 1.6, 0, { nocol: true });
  // dedans : table et chaises, tapis, buffet et étagères (des meubles à pousser), cuisinière, évier ; à l'étage, les lits
  tableSet(DECOR, -2.8, 0.8, 0.1, [[-0.4, 0.72], [0.45, -0.72]], [0.52, 0.38, 0.26]);
  DECOR.place(PF.rugFloor(), -2.8, 0.035, 0.8, 0.1);
  box('wood', 1.2, 2.0, 0, 0.92, z1 - t - 0.6, z1 - t, { tint: [0.5, 0.38, 0.28], m: 'wood' }); // buffet sous la fenêtre de la cuisine
  box('steel', 4.4, 5.4, 0, 0.9, z0 + t, z0 + t + 0.65, { tint: [0.3, 0.3, 0.32], m: 'metal' }); // cuisinière
  box('plaster', 1.2, 3.0, 0, 0.9, z0 + t, z0 + t + 0.6, { tint: [0.86, 0.84, 0.8] }); // évier et plan de travail
  DECOR.place(PF.hangLamp(false, 0.5), 3.2, SL - 0.25, 0, 0, { nocol: true });
  DECOR.place(PF.hangLamp(false, 0.5), -2.8, SL - 0.25, 0.8, 0, { nocol: true });
  for (const [bx, bz] of [[-3.8, 2.6], [3.6, 2.6]]) { box('wood', bx - 1.0, bx + 1.0, SL, SL + 0.5, bz - 0.7, bz + 0.7, { tint: [0.56, 0.42, 0.3], m: 'wood' }); box('canvas', bx - 0.95, bx + 0.95, SL + 0.5, SL + 0.62, bz - 0.65, bz + 0.65, { tint: [0.82, 0.8, 0.74], collide: false }); }
  box('crate', -1.45, -0.55, 0, 0.62, 3.25, 3.95, { tint: [0.55, 0.6, 0.42], m: 'wood' }); box('steel', -1.4, -0.6, 0.62, 0.66, 3.3, 3.9, { tint: [0.25, 0.27, 0.22], collide: false }); // la caisse de munitions (SURV_AMMO)
  survProp('bookcase', -5.25, 0, 2.4, Math.PI / 2); survProp('bookcase', 5.25, 0, 2.6, -Math.PI / 2); survProp('table', -2.8, 0, 0.8, 0.1, true);
}

/* ---------- La grange : ouverte jusqu'au toit, fenil au fond, escalier raide ---------- */
function fermeBarn() {
  const X0 = -27, X1 = -15, Z0 = -21, Z1 = -9, t = 0.25, H = 5.0, red = { tint: [0.56, 0.2, 0.15], m: 'wood' };
  wallOpen('paintwood', 'x', Z1 - t / 2, t, X0, X1, 0, H, [{ a0: -23.2, a1: -18.8, b0: 0, b1: 3.8 }], red);
  wallOpen('paintwood', 'x', Z0 + t / 2, t, X0, X1, 0, H, [{ a0: -22, a1: -20, b0: 3.2, b1: 4.0 }], red);
  wallOpen('paintwood', 'z', X1 - t / 2, t, Z0 + t, Z1 - t, 0, H, [{ a0: -13.1, a1: -11.9, b0: 0, b1: 2.25 }], red);
  wallOpen('paintwood', 'z', X0 + t / 2, t, Z0 + t, Z1 - t, 0, H, [{ a0: -16, a1: -14, b0: 2.4, b1: 3.2 }], red);
  survOpening({ kind: 'portail', axis: 'x', fixed: Z1 - t / 2, t, a0: -23.2, a1: -18.8, b0: 0, b1: 3.8, out: 1, room: 'grange' });
  survOpening({ kind: 'porte', axis: 'z', fixed: X1 - t / 2, t, a0: -13.1, a1: -11.9, b0: 0, b1: 2.25, out: 1, room: 'grange' });
  // fenil : plancher sur le tiers du fond, garde-corps, escalier raide
  box('wood', X0 + t, X1 - t, 2.85, 3.05, Z0 + t, -16.5, { tint: [0.56, 0.44, 0.32], m: 'wood' });
  DECOR.col(X0 + t, -18.2, 3.05, 4.0, -16.55, -16.45, 'wood'); box('wood', X0 + t, -18.2, 3.9, 4.0, -16.55, -16.45, { tint: [0.5, 0.38, 0.28], collide: false });
  ramp(-18.0, -16.2, -16.5, -11.8, 'z', 3.05, 0, 'wood', [0.56, 0.44, 0.32], { mat: 'wood' });
  pitchedRoof(X0, X1, Z0, Z1, H, [0.5, 0.18, 0.14], rngOf(733));
  DECOR.place(PF.hangLamp(false, 0.8), -21, H - 0.1, -12.5, 0, { nocol: true });
  // foin, planches (matériaux), le groupe électrogène (objectif : rendre le courant), fûts
  for (const [x, z, y, r] of [[-25.6, -19.6, 3.05, 0], [-24.6, -19.6, 3.05, 0], [-25.6, -18.8, 3.05, 0.1], [-25.8, -11.2, 0, 0.3], [-25.8, -10.4, 0, 0.2], [-25.8, -10.8, 0.45, 0.25]]) DECOR.place(PF.hayBale(), x, y, z, r);
  survCache('planks', -16.4, 0, -19.6, Math.PI / 2); survCache('planks', -24.8, 0, -15.2, 0);
  DECOR.place(PF.generator(), -16.6, 0, -17.2, -Math.PI / 2); survObjective('power', -16.6, -17.2);
  for (const [x, z] of [[-26.2, -13.6], [-26.2, -14.4]]) DECOR.dyn('barrel', x, 0, z, 0, { tint: [0.35, 0.42, 0.3] });
}

/* ---------- L'appentis à outils ---------- */
function fermeShed() {
  const X0 = 15, X1 = 19.5, Z0 = -17.5, Z1 = -13.5, t = 0.2, H = 2.6, w = { tint: [0.52, 0.42, 0.32], m: 'wood' };
  wallOpen('paintwood', 'z', X0 + t / 2, t, Z0, Z1, 0, H, [{ a0: -16.1, a1: -14.9, b0: 0, b1: 2.2 }], w);
  wallOpen('paintwood', 'z', X1 - t / 2, t, Z0, Z1, 0, H, [], w);
  wallOpen('paintwood', 'x', Z0 + t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: 16.6, a1: 17.6, b0: 1.1, b1: 1.8 }], w);
  wallOpen('paintwood', 'x', Z1 - t / 2, t, X0 + t, X1 - t, 0, H, [], w);
  survOpening({ kind: 'porte', axis: 'z', fixed: X0 + t / 2, t, a0: -16.1, a1: -14.9, b0: 0, b1: 2.2, out: -1, room: 'appentis' });
  pitchedRoof(X0, X1, Z0, Z1, H, [0.48, 0.42, 0.36], rngOf(811));
  box('wood', X1 - t - 0.6, X1 - t, 0, 0.95, Z0 + 0.4, Z1 - 0.4, { tint: [0.5, 0.4, 0.3], m: 'wood' }); // établi
  survCache('tools', X1 - t - 0.3, 0.95, -15.5, 0); survCache('nails', X1 - t - 0.3, 0.95, -14.4, 0); survCache('planks', 15.9, 0, -16.6, 0);
}

/* ---------- La cour : puits, pick-up, bois, clôtures, chemin ---------- */
function fermeYard() {
  const M = DECOR, R = FRM.R;
  // puits de pierre
  M.save().color([0.72, 0.7, 0.66]).move(9, 0, 9); M.cyl('stone', 0.85, 0.85, 16, {}); M.restore();
  M.save().color([0.12, 0.12, 0.12]).move(9, 0.86, 9); M.cyl('dark', 0.62, 0.01, 16, {}); M.restore();
  for (const sx of [-1, 1]) box('wood', 9 + sx * 0.75 - 0.05, 9 + sx * 0.75 + 0.05, 0.85, 2.2, 8.95, 9.05, { tint: [0.45, 0.35, 0.26], collide: false });
  box('rooftiles', 8.0, 10.0, 2.2, 2.3, 8.4, 9.6, { tint: [0.7, 0.48, 0.38], collide: false });
  DECOR.col(8.2, 9.8, 0, 0.85, 8.2, 9.8, 'concrete');
  // le pick-up, garé devant la maison ; la remorque à foin ; le bois coupé contre la grange
  vehicle(PF.car('offroad', {}), 8.5, 0, 1.2, 0.35, { tint: [0.36, 0.4, 0.42] });
  survObjective('truck', 8.5, 1.2);
  for (let i = 0; i < 3; i++) DECOR.place(PF.hayBale(), 3.6 + i * 0.95, 0, -8.6, 0.05 * i);
  DECOR.place(PF.plankStack(2.6, 1.0, 0.7), -12.2, 0, -10.6, Math.PI / 2);
  // clôtures basses de la cour (1,15 m : les morts ne les enjambent pas, elles canalisent ; on les franchit d'un saut)
  const fence = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3.6)), a = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; M.place(PF.fence(L / n), lerp(x0, x1, u), 0, lerp(z0, z1, u), a); }
    const p = 0.1; DECOR.col(Math.min(x0, x1) - p, Math.max(x0, x1) + p, 0, 1.15, Math.min(z0, z1) - p, Math.max(z0, z1) + p, 'wood');
  };
  fence(-12, 14, -2.5, 14); fence(2.5, 14, 14, 14); fence(14, 14, 14, 3); fence(14, -3, 14, -8); fence(-12, 14, -12, 6); fence(-12, -2, -12, -8);
  // lampadaire de cour près de la grange, éteint (le courant revient avec le groupe électrogène)
  DECOR.place(PF.lampPost(), -10.5, 0, -6.5, Math.PI * 0.75);
  void R;
}

/* ---------- Les champs : sillons, épis de maïs secs ---------- */
function fermeFields() {
  const M = DECOR, R = rngOf(7311);
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -31 : 16, xb = s < 0 ? -16 : 31;
    for (let z = -4; z < 30; z += 1.6) for (let x = xa; x < xb; x += 2.2 + R() * 1.4) {
      if (R() < 0.35) continue;
      M.place(PF.bush(0.55 + R() * 0.35), x + R() * 0.6, 0, z + R() * 0.4, R() * TAU, { nocol: true });
    }
  }
}

/* ---------- Lisière des bois et arrière-plan ---------- */
function fermeWoods() {
  const M = DECOR, R = rngOf(9001), kinds = ['oak', 'linden', 'maple', 'oak'];
  const tree = (x, z, far) => M.place(PF.tree(kinds[Math.floor(R() * kinds.length)], R.range(8, 12), R.range(2.8, 4), 1 + Math.floor(R() * 5), far ? { lod: 1 } : {}), x, 0, z, R() * TAU, far ? { nocol: true } : undefined);
  for (let a = 0; a < TAU; a += 0.09) { const rx = 30 + R() * 2, rz = 32 + R() * 2; tree(Math.cos(a) * rx * 1.02, Math.sin(a) * rz * 1.02, false); }
  for (let a = 0; a < TAU; a += 0.05) { const r = 44 + R() * 30; tree(Math.cos(a) * r, Math.sin(a) * r, true); }
}

/* ---------- Sol ---------- */
function fermeGround() {
  const sp = new Splat();
  sp.rect(0, -1.5, 1.5, 6.5, 40, 0.5, 1, 0.8); // le chemin de terre qui part au sud
  sp.rect(0, -16, -1, -9, -6, 0.6, 1, 0.8); // vers la grange
  sp.rect(1, -11, 13, -7.5, 13, 1.2, 0.9, 1.2); // la cour gravillonnée
  sp.rect(2, -5.6, 2.0, 4.5, 7.2, 0.1, 1, 0.1); // dalles sous la véranda
  for (const s of [-1, 1]) sp.rect(3, s < 0 ? -32 : 15, s < 0 ? -15 : 32, -5, 31, 0.8, 0.85, 1.4); // terre labourée
  sp.rect(3, -27, -15, -21, -9, 0.2, 1, 0.2); // sol de la grange
  FRM.splat = sp;
  MAT.ground = groundMat(sp.finish(0.12), [SPLAT.x0, SPLAT.z0, SPLAT.w, SPLAT.d], GROUND_FERME);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.5, 0.5, 0.5]).local(1); M.aoFn = null; M.plane('ground', 660, 660, 1, 1); M.restore();
  WORLD.force = null;
}
const GROUND_FERME = { base: 'lawn', l1: 'dirt', l2: 'pathgravel', l3: 'pavers', pom: [0, 0.02, 0.02, 0], dirt: [0.3, 0.24, 0.18], mul: 0, env: 0.3 };
function fermeSurface(p) {
  const S = FRM.splat; if (!S) return 'grass';
  if (p.y > 0.2 && Math.abs(p.x) < 6 && Math.abs(p.z) < 7) return 'wood';
  if (S.at(0, p.x, p.z) > 0.5 || S.at(3, p.x, p.z) > 0.5) return 'dirt';
  if (S.at(1, p.x, p.z) > 0.5) return 'gravel';
  return 'grass';
}

/* ---------- Ambiance : nuit de lune, brume basse, couleurs éteintes ---------- */
const ATMO_FERME = Object.assign({}, ATMO_DEFAULT, {
  sun: [0.35, 0.58, -0.45], sunColor: 0x9fb4dc, sunI: 0.75, vmSun: 0x8fa4cc,
  fog: [0.055, 0.07, 0.095], fogD: 0.03, fogH: [10, 0], fogSun: 0.15,
  hemi: [0x2c3a56, 0x16140f, 0.42], vmHemi: [0x31405e, 0x16140f],
  sky: {
    zen: [0.006, 0.01, 0.024], mid: [0.02, 0.028, 0.05], hor: [0.06, 0.07, 0.095], gnd: [0.02, 0.02, 0.02],
    glow: [0.22, 0.27, 0.4], halo: [0.45, 0.5, 0.65], disk: [3.2, 3.4, 3.8], cloudLo: [0.04, 0.045, 0.06], cloudHi: [0.14, 0.15, 0.2], cloud: [0.6, 0.9, 0.55],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x0c0d10, hdri: 'park',
  bounce: [0.5, 0.55, 0.7], dust: [0.3, 0.32, 0.38], motes: [0.45, 0.48, 0.6],
  grade: { lo: [0.86, 0.95, 1.16], hi: [1.02, 0.98, 0.9], exp: 1.35, sat: 0.72, con: 1.08 }, rays: [0.3, 0.34, 0.45],
  impact: [0.35, 0.33, 0.3], wind: [420, 0.06], winLit: 0.7,
  bloom: [0.6, 0.6, 0.7], aoFloor: 0.22, raysThr: 9, raysCap: 1, satExp: 1.6, interior: [2.2, 0.35, 0.45],
});

/* ---------- Définition de la carte (voir MAP_DEFS dans 02-map.js et 02z-load.js) ---------- */
MAP_DEFS.ferme = {
  type: 'close', zombie: true, only: ['zombie'], night: true,
  bounds: { x0: -32, x1: 32, z0: -34, z1: 34 },
  textures: ['plaster', 'slate', 'asphalt', 'sand', 'stone', 'rooftiles', 'concrete', 'pavers', 'lawn', 'pathgravel', 'wood', 'paintwood', 'steel', 'timber', 'bark', 'dirt', 'canvas', 'crate', 'burlap', 'cardboard', 'ashlar', 'rollshutter'],
  surfaces: ['hedge', 'ripple', 'parpaing'],
  sound: { pack: 'amb_floreal', bed: 0.12, spots: [] },
  kit: () => fdKit(),
  materials: (M) => makeFdMaterials(M),
  art: { cam: [16, 3.2, 26], look: [-2, 2.4, 0], fov: 55 },
  grass: {
    dens: 55,
    density: (x, z) => { const S = FRM.splat; if (!S) return 0; const k = Math.max(S.at(0, x, z), S.at(1, x, z), S.at(2, x, z), S.at(3, x, z) * 1.2); return clamp((0.75 - k) * 2, 0, 1); },
    height: (x, z, r) => 0.16 + 0.22 * r,
    colors: [[0.05, 0.08, 0.03], [0.14, 0.2, 0.08], [0.24, 0.26, 0.14]],
    wind: [0.9, 0.8, 0.3], width: 0.012, amb: 0.3, seed: 4141,
  },
  landmarks: [[-21, 8.4, -15, 'grange'], [0, 8.6, 0, 'maison']],
  splat: { x0: -64, z0: -64, w: 128, d: 128, ppm: 4 },
  far: 220,
  build() { fermeLevel(); },
  update(t, dt) { floraUpdate(t, dt); },
  unload() { FRM.splat = null; FRM.R = null; },
  // apparitions des survivants : dans la maison et sur la véranda (miroir inutile : un seul camp)
  spawns: [[-3.5, 2.5], [-1.5, 2.5], [2.5, 2.0], [3.5, -1.5], [-3.5, -1.0], [-1.5, 5.6], [0.5, 5.6], [-4.4, 5.6]],
  // où naissent les morts : sous les arbres de la lisière, tout autour
  zspawns: [[-29, 30], [-10, 32], [10, 32], [29, 30], [30, 12], [30, -8], [29, -30], [8, -32], [-8, -32], [-29, -30], [-30, -6], [-30, 14], [-29, -24], [24, -31]],
  poi: [[0, 0, 0, 'M'], [-3, 0, 6, 'M'], [-21, 0, -12, 'L'], [17, 0, -15, 'E'], [9, 0, 6, 'E'], [-8, 0, 10, 'L']],
  lane: (x) => (x < -8 ? 'L' : x > 8 ? 'E' : 'M'),
  sniper: [-3.5, FRM_H.SL, 2.5], coverZ: 30, heli: [26, 28], cam: 34,
  surface: (p) => fermeSurface(p),
  zones: [
    [_t('Maison'), -6, 6, -4.5, 4.5], [_t('Véranda'), -5.5, 2, 4.5, 7.2], [_t('Grange'), -27, -15, -21, -9], [_t('Appentis'), 15, 19.5, -17.5, -13.5],
    [_t('Cour'), -12, 14, -8, 14], [_t('Champs'), -32, -12, -6, 32], [_t('Champs'), 14, 32, -6, 32], [_t('Chemin'), -3, 3, 14, 34], [_t('Lisière'), -32, 32, -34, 34],
  ],
  atmo: ATMO_FERME,
};
