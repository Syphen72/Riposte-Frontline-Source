/* ==========================================================================
   LANCE-ROQUETTES (Breachline) : RPG-7, sa roquette, son rechargement
   Le tube est décalé à droite de la ligne de mire (x = 0) comme sur le vrai : en visée, l'œil passe à gauche du tube, sur la hausse et le
   guidon montés sur le flanc gauche. Tenue de fusil (famille rifle) : main droite à la poignée-pistolet, main gauche sous l'avant du tube.
   La roquette est le « chargeur » (info.mag) : posée à la bouche, elle disparaît au tir (VM.rocketOut, vmAttachMags) et revient par le
   rechargement (RELOAD.launcher) : la main gauche va la chercher à la ceinture et l'enfonce par l'avant.
   ========================================================================== */
const RPG_X = 0.09, RPG_SY = 0.072; // axe du tube, à droite de la ligne de mire ; hauteur de la ligne de mire au-dessus de l'axe
/* Roquette (repère du chargeur : origine au bord du tube, la roquette dépasse vers -z ; queue dans le tube vers +z) */
function rocketParts(t, M, fins) {
  cz(t, M.dark, 0, 0, 0.03, 0.019, 0.12);                 // tige du propulseur, dans le tube
  cz(t, M.olive, 0, 0, -0.085, 0.041, 0.11);              // corps de la charge
  cone(t, M.olive, 0, 0, -0.2, 0.011, 0.041, 0.12);       // ogive
  cz(t, M.metal, 0, 0, -0.267, 0.007, 0.024);             // fusée de nez
  cz(t, M.tan, 0, 0, -0.035, 0.0415, 0.012);              // bague de la charge
  if (fins) { // ailettes et tuyère du propulseur (la roquette en vol)
    cz(t, M.dark, 0, 0, 0.12, 0.024, 0.08);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; bx(t, M.dark, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.15, k % 2 ? 0.05 : 0.004, k % 2 ? 0.004 : 0.05, 0.07); }
  }
}
defineGun('rpg7', 'rifle', (c) => {
  const { g, M, info } = c, X = RPG_X, W = M.wood, D = M.dark, Mt = M.metal;
  // ----- tube : bouche, garde en bois au milieu, évasement de la tuyère à l'arrière -----
  cz(g, Mt, X, 0, -0.04, 0.0235, 0.95);
  cz(g, D, X, 0, -0.52, 0.029, 0.03);
  cz(g, W, X, 0, 0.03, 0.036, 0.3); for (const z of [-0.12, 0.18]) cz(g, D, X, 0, z, 0.038, 0.012);
  cone(g, D, X, 0, 0.5, 0.025, 0.052, 0.17); cz(g, D, X, 0, 0.59, 0.053, 0.012);
  // ----- poignée-pistolet et détente, sous le tube ; garde de main avant (bois) -----
  rb(g, D, X, -0.016, -0.03, 0.03, 0.026, 0.07, 0.004);
  rb(g, M.poly, X, -0.072, -0.01, 0.026, 0.1, 0.038, 0.007, -0.26);
  rb(g, D, X, -0.076, -0.05, 0.006, 0.004, 0.044, 0.0015); rb(g, D, X, -0.058, -0.074, 0.006, 0.034, 0.004, 0.0015); // pontet
  rb(g, D, X, -0.045, -0.066, 0.006, 0.018, 0.005, 0.0015, -0.2);
  rb(g, W, X, -0.03, -0.32, 0.032, 0.03, 0.12, 0.008);
  // ----- organes de visée sur le flanc gauche : platine, guidon (avant), hausse (arrière) -----
  // (platines obliques : du flanc du tube jusqu'à la ligne de mire, plus haute et à gauche)
  for (const [z, d] of [[-0.07, 0.05], [-0.41, 0.03]]) { rb(g, D, X * 0.5, RPG_SY * 0.45, z, X * 0.95, 0.012, d, 0.002, 0, 0, -0.62); rb(g, D, 0.004, RPG_SY - 0.026, z, 0.018, 0.014, d * 0.8, 0.002); }
  rb(g, D, 0, RPG_SY - 0.014, -0.07, 0.016, 0.024, 0.012, 0.0015); rb(g, M.sight, 0, RPG_SY - 0.002, -0.07, 0.012, 0.006, 0.004, 0.001);
  rb(g, D, 0, RPG_SY - 0.012, -0.41, 0.006, 0.026, 0.006, 0.0015);
  // ----- roquette (chargeur) -----
  info.magHome.set(X, 0, -0.535);
  info.buildMag = (parent) => rocketParts(parent, M, false);
  info.magAxis = new V3(0, 0, 1); info.magGrip = new V3(0, -0.04, -0.09);
  info.rocket = true;
  // ----- mains, visée, montages, bouche (l'avant de la roquette), éjection (le souffle, derrière) -----
  info.gripR.set(X, -0.072, -0.01); info.gripL.set(X, -0.03, -0.32);
  info.sightY = RPG_SY; info.adsZ = 0.36;
  info.mount.optic = { y: RPG_SY - 0.01, z: -0.24, len: 0.1, D: 0.3 }; info.mount.muzzle = { x: X, y: 0, z: -0.54, r: 0.029 };
  info.mount.under = { y: -0.045, z: -0.32 }; info.mount.side = { x: X - 0.03, y: 0, z: -0.3 };
  info.muzzle.position.set(X, 0, -0.82); info.eject.position.set(X, 0, 0.62);
  info.gripDef = {
    R: [{ c: [X, -0.072, -0.01], h: [0.013, 0.05, 0.019], r: 0.006, rx: -0.26 }, { c: [X, -0.016, -0.03], h: [0.015, 0.013, 0.035], r: 0.004 }],
    L: [{ c: [X, -0.03, -0.32], h: [0.016, 0.015, 0.06], r: 0.008 }, { c: [X, 0, -0.32], h: [0.0235, 0.0235, 0.08], r: 0.022 }],
  };
  info.trigDef = { at: [X + 0.004, -0.045, -0.062], xTip: -0.004, guard: [{ c: [X, -0.074, -0.05], h: [0.004, 0.0025, 0.03], r: 0.002 }] };
});
/* La roquette en vol (avec ses ailettes) : un groupe construit une fois et copié pour chaque tir */
let ROCKET_MESH = null;
function rocketMesh() {
  if (!ROCKET_MESH) { ROCKET_MESH = new THREE.Group(); rocketParts(ROCKET_MESH, gunMaterials(), true); ROCKET_MESH.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  return ROCKET_MESH.clone();
}

/* ---------- Rechargement : une roquette prise à la ceinture, enfoncée par l'avant ----------
   L'arme bascule bouche en l'air vers la gauche ; la main gauche quitte l'avant du tube, descend à la ceinture (repère du corps), y prend
   la roquette (porte 2), la présente devant la bouche (repère de la prise du chargeur : 18 cm devant sa place), l'enfonce (insert), donne
   une petite claque, puis revient sous le tube. Une seule table : le tube est toujours vide quand on recharge. */
const RELOAD_LAUNCHER = {
  dur: 2.4,
  gun: [
    [0, 0, 0, 0, 0, 0, 0],
    [0.2, -0.07, -0.02, 0.04, 0.3, 0.18, -0.28],
    [0.55, -0.12, -0.055, 0.06, 0.62, 0.32, -0.45],
    [1.0, -0.125, -0.06, 0.06, 0.64, 0.33, -0.46],
    [1.38, -0.12, -0.075, 0.065, 0.6, 0.31, -0.45],
    [1.46, -0.12, -0.05, 0.07, 0.55, 0.3, -0.43],
    [1.9, -0.04, -0.02, 0.02, 0.2, 0.1, -0.15],
    [2.2, 0.005, -0.005, 0, -0.03, 0, 0.04],
    [2.4, 0, 0, 0, 0, 0, 0],
  ],
  lh: [
    [0, 0, 0, 0, 3, 0, 0, 0],
    [0.25, -0.04, 0.04, 0.05, 3, 0.3, 3, 0],
    [0.62, -0.22, -0.42, 0.04, 2, 0.8, 3, 0],
    [0.78, -0.24, -0.44, 0.02, 2, 1, 1, 2],
    [1.15, 0, 0, -0.18, 1, 1, 1, 2],
    [1.4, 0, 0, 0, 1, 1, 1, 2],
    [1.5, 0, 0.02, -0.03, 1, 1, 4, 0],
    [1.85, 0, 0.02, 0.05, 3, 0.4, 3, 0],
    [2.2, 0, 0, 0, 3, 0, 0, 0],
    [2.4, 0, 0, 0, 3, 0, 0, 0],
  ],
  ev: [[0.02, 'leve'], [0.74, 'spare'], [1.4, 'insert'], [2.05, 'pret']],
  allure: [[0, 1.1], [0.3, 1.2], [0.62, 0.9], [0.8, 1.0], [1.1, 0.9], [1.3, 1.6], [1.42, 2.2], [1.55, 1.2], [2.0, 0.9], [2.4, 0.7]],
};
RELOAD.launcher = { norm: RELOAD_LAUNCHER, empty: RELOAD_LAUNCHER };
