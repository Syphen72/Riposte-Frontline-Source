/* ==========================================================================
   HALCYON, L'AMÉNAGEMENT DES BOUTIQUES (Breachline 6.3.1, retour du propriétaire : « plus de détails dans les boutiques »)
   galShops (02yp-galerie.js) pose le sol, l'enseigne, les ouvertures, les lampes et les meubles de chaque boutique (galFit) ; ici, galShopDress
   l'habille : plinthes, panneaux à rainures ou soubassement sur les murs mitoyens, faux plafond à dalles, rails de spots, bandeau au-dessus de
   la vitrine, l'affiche de la boutique au mur du fond et en banderole, portiques antivol à l'entrée, papiers et marchandise tombés, quelques
   flaques sombres ; puis galShopProps, ce qui est propre à chaque sorte de boutique (maillots et haltères, ordonnances, portables et casques,
   ours géant, casiers à vêtements, bijoux sous verre, fauteuil de lecture, aquariums peuplés, cages, portes des vitrines réfrigérées, pince à
   peluches, air hockey, flippers, vestiaires et lit de camp du poste de sécurité, séchoirs, guitares, bacs à disques, machine à pop-corn,
   files d'attente du cinéma, vitrine à pâtisseries, rideaux des box de soins...). Les réserves de l'étage sud reçoivent leurs rayonnages.
   L'atlas d'affiches (galPosterAtlas, 2048 × 1024 : huit colonnes de deux cases de 256 px, chaque affiche sur deux cases, 256 × 512) est une
   matière éclairée du décor (galPost) : les affiches restent dans le noir quand le courant est coupé, à la différence des enseignes. Les néons
   (galNeon : bornes d'arcade, éclairage des vitrines) suivent le courant comme les enseignes (galUpdate).
   Coût : presque tout est en classe 1 ou 2 du décor (sans ombre, masqué au loin selon la qualité, updateMapDetail), avec le hasard propre à
   chaque boutique (le tirage de la carte n'en est pas décalé). Navigation : le plus souvent sans collision (contre les murs, au plafond, au sol) ;
   les pièces pleines (vestiaires, présentoirs, machines, bacs) sont posées dans des coins ou contre les murs, à l'écart des allées et des portes.
   ========================================================================== */
const GQ = {
  // affiches de l'atlas
  po: { sport: 0, filmA: 1, filmB: 2, mode: 3, arcade: 4, elec: 5, toys: 6, books: 7, pets: 8, pharma: 9, mart: 10, music: 11, missing: 12, evac: 13, menu: 14, shoes: 15 },
  // couleur de chaque sorte de boutique (soubassement, cimaise, bandeau)
  acc: { sport: [0.16, 0.3, 0.22], pharma: [0.22, 0.56, 0.36], elec: [0.1, 0.12, 0.18], toys: [0.92, 0.7, 0.16], clothes: [0.16, 0.16, 0.17], shoes: [0.66, 0.14, 0.12], jewel: [0.24, 0.14, 0.3], books: [0.16, 0.22, 0.36], pets: [0.12, 0.46, 0.44], mart: [0.9, 0.46, 0.14], arcade: [0.16, 0.08, 0.28], hobby: [0.4, 0.12, 0.12], security: [0.18, 0.22, 0.3], home: [0.44, 0.32, 0.22], salon: [0.9, 0.66, 0.72], music: [0.1, 0.1, 0.1], cinema: [0.42, 0.06, 0.08], cafe: [0.46, 0.3, 0.2], clinic: [0.56, 0.74, 0.82] },
  // l'affiche de la boutique : mur du fond, bouts de gondole, banderole
  kp: { sport: 'sport', pharma: 'pharma', elec: 'elec', toys: 'toys', clothes: 'mode', shoes: 'shoes', books: 'books', pets: 'pets', mart: 'mart', arcade: 'arcade', music: 'music', cinema: 'filmA', salon: 'mode', clinic: 'pharma' },
  slat: new Set(['sport', 'pharma', 'elec', 'toys', 'clothes', 'shoes', 'books', 'pets', 'mart', 'hobby', 'music', 'home', 'jewel']),
  eas: new Set(['sport', 'pharma', 'elec', 'toys', 'clothes', 'shoes', 'books', 'pets', 'mart', 'music', 'hobby']),
  blood: new Set(['pharma', 'mart', 'clothes', 'clinic', 'security', 'cafe']),
};
/* Coordonnées de texture d'une affiche : [u, v, du, dv] (v vers le bas, flipY coupé) */
const GQ_UV = (i) => { const c = i % 8, r = Math.floor(i / 8) * 2; return [(c * 256) / 2048, (r * 256) / 1024, 256 / 2048, 512 / 1024]; };

/* ---------- Atlas des affiches ---------- */
function galPosterAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d'), R = rngOf(6311);
  const SANS = 'Arial, Helvetica, sans-serif', SERIF = 'Georgia, "Times New Roman", serif', DISP = 'Impact, "Arial Black", sans-serif', MONO = '"Courier New", monospace', HAND = '"Comic Sans MS", "Segoe Print", cursive';
  const text = (s, cx, cy, size, col, maxW, font = SANS, weight = 'bold', style = '') => {
    g.font = `${style} ${weight} ${size}px ${font}`; const w = g.measureText(s).width, fs = w > maxW ? (size * maxW) / w : size;
    g.font = `${style} ${weight} ${fs}px ${font}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, cx, cy);
  };
  const W = 256, H = 512;
  const cell = (i, bg, draw) => { const x = (i % 8) * W, y = Math.floor(i / 8) * 2 * 256; g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip(); g.translate(x, y); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); } draw(); g.restore(); };
  const grad = (y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); return gr; };
  const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fill(); };
  const disc = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const credits = (y, col) => { g.fillStyle = col; for (let k = 0; k < 4; k++) { const w = 150 + R() * 60; g.fillRect((W - w) / 2, y + k * 9, w, 4); } };
  // un coureur (traits épais)
  const runner = (x, y, s, col) => {
    disc(x, y, 11 * s, col); g.strokeStyle = col; g.lineWidth = 9 * s; g.lineCap = 'round';
    for (const L of [[[0, 14], [-10, 46]], [[-10, 46], [10, 74]], [[-10, 46], [-34, 66]], [[-2, 20], [24, 36]], [[-2, 20], [-24, 26]]]) { g.beginPath(); g.moveTo(x + L[0][0] * s, y + L[0][1] * s); g.lineTo(x + L[1][0] * s, y + L[1][1] * s); g.stroke(); }
  };
  const P = GQ.po;
  // Ridgeback : saison des sentiers, montagnes au couchant, un coureur
  cell(P.sport, null, () => {
    g.fillStyle = grad(0, H, ['#f2b25a', '#c2552a', '#1f3b2c']); g.fillRect(0, 0, W, H);
    disc(180, 118, 36, '#f8e6b4');
    poly([[0, 330], [70, 214], [118, 276], [182, 186], [256, 292], [256, 512], [0, 512]], '#2c4a38');
    poly([[0, 384], [92, 300], [160, 352], [256, 318], [256, 512], [0, 512]], '#16261d');
    runner(96, 236, 1.5, '#16261d');
    text('TRAIL', W / 2, 404, 70, '#f8e6b4', 220, DISP); text('SEASON', W / 2, 452, 40, '#f2b25a', 220, DISP); text('RIDGEBACK', W / 2, 492, 20, '#efe6cf', 200);
  });
  // film : HOLLOW TIDE (un phare sous la lune, une mer sombre)
  cell(P.filmA, null, () => {
    g.fillStyle = grad(0, H, ['#0b1a2a', '#123447', '#04080c']); g.fillRect(0, 0, W, H);
    disc(70, 90, 30, '#e8eef2'); for (let k = 0; k < 60; k++) disc(R() * W, R() * 220, R() * 1.3, 'rgba(255,255,255,0.7)');
    g.fillStyle = 'rgba(255,236,170,0.22)'; g.beginPath(); g.moveTo(170, 196); g.lineTo(0, 150); g.lineTo(0, 240); g.closePath(); g.fill();
    poly([[160, 330], [166, 200], [176, 200], [182, 330]], '#05070a'); poly([[158, 200], [184, 200], [171, 182]], '#05070a'); disc(171, 196, 5, '#ffe9a8');
    g.strokeStyle = 'rgba(170,200,220,0.35)'; g.lineWidth = 2; for (let k = 0; k < 14; k++) { const y = 330 + k * 9; g.beginPath(); g.moveTo(R() * 60, y); g.lineTo(196 + R() * 60, y); g.stroke(); }
    text('HOLLOW', W / 2, 400, 52, '#dfe8ee', 220, SERIF, 'normal'); text('TIDE', W / 2, 444, 52, '#dfe8ee', 220, SERIF, 'normal'); credits(470, 'rgba(200,210,220,0.5)');
  });
  // film : STARGLASS (une planète et son anneau)
  cell(P.filmB, '#030306', () => {
    for (let k = 0; k < 120; k++) disc(R() * W, R() * H, R() * 1.4, 'rgba(255,255,255,0.8)');
    const gr = g.createRadialGradient(110, 300, 10, 128, 320, 120); gr.addColorStop(0, '#ffb347'); gr.addColorStop(0.6, '#b23a6e'); gr.addColorStop(1, '#2a0d3a'); disc(128, 320, 110, gr);
    g.strokeStyle = 'rgba(160,230,255,0.75)'; g.lineWidth = 6; g.beginPath(); g.ellipse(128, 320, 170, 34, -0.25, 0, TAU); g.stroke();
    text('STARGLASS', W / 2, 74, 48, '#8ff0ff', 230, DISP); text('LIGHT YEARS FROM HOME', W / 2, 112, 15, '#c9d6e0', 220); credits(470, 'rgba(200,210,220,0.5)');
  });
  // Maison Vela : une silhouette en robe, un bandeau rouge
  cell(P.mode, '#efe8dc', () => {
    g.fillStyle = '#b3261e'; g.fillRect(0, 40, W, 10);
    disc(128, 110, 24, '#141414'); poly([[118, 132], [138, 132], [150, 200], [192, 380], [64, 380], [106, 200]], '#141414'); poly([[110, 380], [122, 380], [120, 420], [112, 420]], '#141414'); poly([[134, 380], [146, 380], [144, 420], [136, 420]], '#141414');
    text('Maison Vela', W / 2, 450, 40, '#141414', 220, SERIF, 'normal', 'italic'); text(_t('Nouvelle collection').toUpperCase(), W / 2, 486, 16, '#b3261e', 220);
  });
  // Pixel Palace : grille au couchant, un envahisseur, HIGH SCORE
  cell(P.arcade, '#12062a', () => {
    const sun = g.createLinearGradient(0, 200, 0, 300); sun.addColorStop(0, '#ffd23a'); sun.addColorStop(1, '#ff3bd4'); disc(128, 300, 90, sun);
    g.fillStyle = '#12062a'; for (let k = 0; k < 6; k++) g.fillRect(0, 262 + k * 9, W, 3 + k);
    g.fillRect(0, 300, W, 212); g.strokeStyle = '#ff3bd4'; g.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const y = 300 + Math.pow(k / 7, 2) * 200; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(128 + k * 8, 300); g.lineTo(128 + k * 60, 512); g.stroke(); }
    const inv = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000']; g.fillStyle = '#5af0ff';
    inv.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') g.fillRect(84 + i * 8, 150 + j * 8, 7, 7); });
    g.shadowColor = '#3be8ff'; g.shadowBlur = 14; text('HIGH SCORE', W / 2, 80, 44, '#5af0ff', 230, MONO); g.shadowBlur = 0;
    text('INSERT COIN', W / 2, 470, 26, '#ffd23a', 220, MONO);
  });
  // Voltix : un téléviseur et son image
  cell(P.elec, '#0b0d14', () => {
    g.fillStyle = '#20232c'; g.fillRect(24, 110, 208, 140); const sc = g.createLinearGradient(30, 116, 226, 244); sc.addColorStop(0, '#1fd1a5'); sc.addColorStop(0.5, '#3b6cff'); sc.addColorStop(1, '#ff4fa8'); g.fillStyle = sc; g.fillRect(32, 118, 192, 124);
    g.fillStyle = '#20232c'; g.fillRect(116, 250, 24, 26); g.fillRect(84, 274, 88, 8);
    text('4K ULTRA', W / 2, 352, 52, '#ffffff', 220, DISP); text('Voltix', W / 2, 410, 44, '#4fc3ff', 200, DISP);
    poly([[128, 432], [112, 466], [126, 466], [118, 498], [146, 456], [132, 456]], '#ffd23a');
  });
  // Zigzag : un robot jouet
  cell(P.toys, '#ffd23a', () => {
    g.fillStyle = '#9aa3ad'; g.fillRect(124, 70, 8, 30); disc(128, 66, 10, '#e63b2e');
    g.fillStyle = '#c9ced6'; g.fillRect(78, 100, 100, 80); disc(108, 138, 14, '#2b6fd6'); disc(148, 138, 14, '#2b6fd6'); g.fillStyle = '#444'; g.fillRect(104, 162, 48, 8);
    g.fillStyle = '#e63b2e'; g.fillRect(64, 188, 128, 120); g.fillStyle = '#ffd23a'; g.fillRect(108, 216, 40, 40);
    g.fillStyle = '#9aa3ad'; g.fillRect(36, 196, 24, 90); g.fillRect(196, 196, 24, 90); g.fillRect(84, 308, 30, 60); g.fillRect(142, 308, 30, 60);
    const L = 'ROBO-REX', C = ['#e63b2e', '#2b6fd6', '#2fa84f', '#8e3bd6']; g.font = `bold 46px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < L.length; i++) { g.fillStyle = C[i % 4]; g.fillText(L[i], 30 + i * 28, 420 + (i % 2 ? -5 : 5)); }
    text('Zigzag', W / 2, 482, 24, '#5a3a00', 200, DISP);
  });
  // Inkwell : les meilleures ventes, une pile de livres
  cell(P.books, '#1b2a4a', () => {
    text(_t('Meilleures ventes'), W / 2, 70, 30, '#f0e6cc', 220, SERIF);
    const BC = ['#b3261e', '#e6b84a', '#2f6b4f', '#d9d2bf', '#4a6fa8', '#7a3b6a'];
    for (let k = 0; k < 7; k++) { const w = 150 + R() * 40, h = 24 + R() * 10, y = 360 - k * 32; g.fillStyle = BC[k % BC.length]; g.fillRect(128 - w / 2 + (R() - 0.5) * 16, y, w, h); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(128 - w / 2 + 10, y + h / 2 - 2, w * 0.5, 4); }
    for (let k = 0; k < 5; k++) { const x = 64 + k * 32; poly([[x, 120], [x + 5, 134], [x + 20, 134], [x + 8, 143], [x + 12, 158], [x, 149], [x - 12, 158], [x - 8, 143], [x - 20, 134], [x - 5, 134]], '#e6b84a'); }
    text('Inkwell', W / 2, 452, 46, '#f0e6cc', 220, SERIF); text('BOOKS · LIVRES', W / 2, 490, 16, '#c9b98f', 200);
  });
  // Paws & Co : un chien, un chat, des empreintes
  cell(P.pets, '#147a78', () => {
    disc(92, 220, 56, '#ffffff'); poly([[44, 196], [56, 140], [80, 182]], '#ffffff'); poly([[140, 196], [128, 140], [104, 182]], '#ffffff'); disc(72, 212, 7, '#147a78'); disc(112, 212, 7, '#147a78'); disc(92, 240, 9, '#0d4f4e');
    disc(176, 286, 40, '#f4d06f'); poly([[142, 270], [146, 228], [170, 256]], '#f4d06f'); poly([[210, 270], [206, 228], [182, 256]], '#f4d06f'); disc(162, 282, 5, '#5a4310'); disc(190, 282, 5, '#5a4310');
    for (const [x, y] of [[40, 360], [80, 390], [120, 360], [160, 390], [200, 360]]) { disc(x, y, 9, 'rgba(255,255,255,0.35)'); for (const [a, b] of [[-9, -10], [-3, -15], [3, -15], [9, -10]]) disc(x + a, y + b, 3.5, 'rgba(255,255,255,0.35)'); }
    text('Paws & Co', W / 2, 460, 44, '#ffffff', 220);
  });
  // Meridian : la croix verte, la grippe
  cell(P.pharma, '#f4f6f2', () => {
    g.fillStyle = '#21a35a'; g.fillRect(98, 110, 60, 170); g.fillRect(43, 165, 170, 60);
    text(_t('Vaccin contre la grippe'), W / 2, 340, 30, '#1d7a46', 220); g.fillStyle = '#1d7a46'; g.fillRect(40, 372, 176, 3);
    text('Meridian', W / 2, 430, 46, '#1d7a46', 220);
  });
  // Corner 24 : deux pour un
  cell(P.mart, '#ef6c1a', () => {
    const star = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, r = k % 2 ? 84 : 110; star.push([128 + Math.cos(a) * r, 190 + Math.sin(a) * r]); } poly(star, '#ffffff');
    text(_t('2 pour 1'), 128, 190, 52, '#d6141c', 150, DISP);
    for (let k = 0; k < 4; k++) { const x = 46 + k * 54; g.fillStyle = ['#d6141c', '#2a6fd6', '#2fa84f', '#ffd23a'][k]; g.fillRect(x - 16, 320, 32, 56); g.fillStyle = '#ffffff'; g.fillRect(x - 16, 336, 32, 10); }
    text('CORNER 24', W / 2, 452, 40, '#ffffff', 220, DISP);
  });
  // Vinyl Vault : affiche de concert (NIGHT SIGNAL)
  cell(P.music, null, () => {
    g.fillStyle = grad(0, H, ['#0c0c0c', '#2a1606', '#ff8a1f']); g.fillRect(0, 0, W, H);
    text('NIGHT', W / 2, 96, 62, '#ff8a1f', 220, DISP); text('SIGNAL', W / 2, 150, 62, '#ffd9a8', 220, DISP);
    g.strokeStyle = '#ffd9a8'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = 250 + Math.sin(x * 0.09) * 26 * Math.sin(x * 0.013 + 1); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    text('LIVE', W / 2, 352, 84, '#0c0c0c', 220, DISP); text('Vinyl Vault', W / 2, 470, 26, '#0c0c0c', 200, DISP);
  });
  // le tableau des disparus : liège, feuilles punaisées, photos
  cell(P.missing, '#a5784a', () => {
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '60,35,15' : '220,180,130'},${R() * 0.25})`; g.fillRect(R() * W, R() * H, 2, 2); }
    g.save(); g.translate(128, 52); g.rotate(-0.03); g.fillStyle = '#f7f5ee'; g.fillRect(-100, -30, 200, 60); g.restore(); text(_t('Disparus').toUpperCase(), 128, 54, 40, '#b3261e', 190, HAND);
    for (let k = 0; k < 9; k++) {
      const x = 48 + (k % 3) * 80 + (R() - 0.5) * 10, y = 150 + Math.floor(k / 3) * 120 + (R() - 0.5) * 10;
      g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.25); g.fillStyle = '#f2efe4'; g.fillRect(-34, -48, 68, 96);
      g.fillStyle = `rgb(${90 + R() * 60},${90 + R() * 50},${90 + R() * 40})`; g.fillRect(-26, -40, 52, 46); disc(0, -24, 10, 'rgba(40,30,25,0.6)'); g.fillStyle = 'rgba(40,30,25,0.6)'; g.fillRect(-16, -12, 32, 18);
      g.fillStyle = '#555'; for (let j = 0; j < 3; j++) g.fillRect(-26, 14 + j * 9, 30 + R() * 22, 3);
      g.restore(); disc(x, y - 44, 4, ['#d62a1e', '#2a6fd6', '#2fa84f'][k % 3]);
    }
  });
  // l'avis d'évacuation, scotché
  cell(P.evac, '#f6f4ee', () => {
    g.fillStyle = '#c62828'; g.fillRect(0, 0, W, 78); text(_t('Évacuation').toUpperCase(), W / 2, 40, 40, '#ffffff', 230);
    text(_t('Par ordre des autorités'), W / 2, 120, 20, '#1a1a1a', 220);
    g.fillStyle = '#9a9a9a'; for (let k = 0; k < 9; k++) g.fillRect(24, 154 + k * 15, 150 + R() * 58, 5);
    text(_t('Quittez la galerie sans attendre'), W / 2, 316, 19, '#c62828', 226); text(_t('Point de rassemblement au parking'), W / 2, 352, 16, '#1a1a1a', 226);
    g.strokeStyle = 'rgba(40,70,160,0.7)'; g.lineWidth = 4; g.beginPath(); g.arc(186, 430, 34, 0, TAU); g.stroke(); g.beginPath(); g.arc(186, 430, 24, 0, TAU); g.stroke();
    g.fillStyle = '#9a9a9a'; g.fillRect(24, 420, 90, 4); g.fillRect(24, 440, 70, 4);
    g.fillStyle = 'rgba(240,220,120,0.55)'; for (const [x, y, a] of [[10, 8, 0.6], [246, 8, -0.6], [10, 504, -0.6], [246, 504, 0.6]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-26, -9, 52, 18); g.restore(); }
  });
  // la carte du café (ardoise)
  cell(P.menu, '#5a3a22', () => {
    g.fillStyle = '#1e2a24'; g.fillRect(12, 12, W - 24, H - 24);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.05})`; g.fillRect(12 + R() * (W - 24), 12 + R() * (H - 24), 3, 2); }
    text('Daybreak', W / 2, 62, 40, '#f3ead8', 210, SERIF, 'normal', 'italic'); g.fillStyle = 'rgba(243,234,216,0.6)'; g.fillRect(60, 88, 136, 2);
    const items = [['Espresso', '2.40'], ['Cappuccino', '3.20'], ['Latte', '3.60'], ['Chai', '3.40'], ['Croissant', '2.10'], ['Muffin', '2.80'], ['Bagel', '3.10']];
    items.forEach(([a, b], i) => { const y = 128 + i * 42; g.font = `20px ${HAND}`; g.fillStyle = '#f3ead8'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(a, 30, y); g.textAlign = 'right'; g.fillStyle = '#e8902a'; g.fillText(b, W - 30, y); g.fillStyle = 'rgba(243,234,216,0.25)'; for (let x = 140; x < W - 80; x += 8) g.fillRect(x, y + 6, 3, 2); });
    g.strokeStyle = '#f3ead8'; g.lineWidth = 3; g.beginPath(); g.moveTo(98, 440); g.lineTo(106, 484); g.lineTo(150, 484); g.lineTo(158, 440); g.closePath(); g.stroke(); g.beginPath(); g.arc(166, 458, 12, -1.4, 1.4); g.stroke();
    for (const x of [112, 128, 144]) { g.beginPath(); g.moveTo(x, 430); g.quadraticCurveTo(x - 8, 418, x, 406); g.stroke(); }
  });
  // Stride : une chaussure de course
  cell(P.shoes, '#c9241d', () => {
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(18, 170 + k * 22); g.lineTo(70, 170 + k * 22); g.stroke(); }
    poly([[78, 250], [84, 176], [120, 166], [150, 196], [214, 218], [236, 246], [232, 262], [80, 262]], '#ffffff'); g.fillStyle = '#1a1a1a'; g.fillRect(78, 262, 158, 14);
    g.strokeStyle = '#c9241d'; g.lineWidth = 5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(112 + k * 16, 184 + k * 6); g.lineTo(124 + k * 16, 208 + k * 4); g.stroke(); }
    text('Stride', W / 2, 380, 70, '#ffffff', 220, SANS, 'bold', 'italic'); text('RUN LIGHT', W / 2, 440, 26, '#ffd9d4', 200);
  });
  // vieillissement : poussière, pli, coins jaunis
  for (let i = 0; i < 16; i++) cell(i, null, () => {
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '40,40,36'},${R() * 0.06})`; g.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3); }
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, H * (0.3 + R() * 0.4), W, 2);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,45,20,0.22)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}

/* ---------- Pièces ---------- */
/* Affiche i : centre (cx, cy, cz), largeur w (hauteur 2 w ; part 'top' ou 'bot' : la moitié haute ou basse, carrée), normale (nx, nz) */
function gPoster(cx, cy, cz, w, nx, nz, i, part = 'all') {
  const [u, v, du, dv] = GQ_UV(i), va = part === 'bot' ? v + dv / 2 : v, vb = part === 'top' ? v + dv / 2 : v + dv, h = part === 'all' ? w * 2 : w;
  const rx = nz, rz = -nx, x0 = cx - (rx * w) / 2, z0 = cz - (rz * w) / 2, x1 = cx + (rx * w) / 2, z1 = cz + (rz * w) / 2, M = DECOR;
  M.save().color([1, 1, 1]); M.cls = 1;
  M.quad('galPost', [x0, cy - h / 2, z0], [x1, cy - h / 2, z1], [x1, cy + h / 2, z1], [x0, cy + h / 2, z0], [nx, 0, nz], { uv: [[u, vb], [u + du, vb], [u + du, va], [u, va]] });
  M.restore();
}
/* Affiche encadrée contre un mur : (cx, cz) sur la face du mur, normale (nx, nz) ; un cadre sombre, l'affiche 1,2 cm devant */
function gPosterF(cx, cy, cz, w, nx, nz, i, part = 'all', frame = [0.1, 0.1, 0.11]) {
  const h = part === 'all' ? w * 2 : w, e = 0.035;
  if (Math.abs(nz) > 0.5) gqB('paint', cx - w / 2 - e, cx + w / 2 + e, cy - h / 2 - e, cy + h / 2 + e, cz, cz + nz * 0.01, frame);
  else gqB('paint', cx, cx + nx * 0.01, cy - h / 2 - e, cy + h / 2 + e, cz - w / 2 - e, cz + w / 2 + e, frame);
  gPoster(cx + nx * 0.012, cy, cz + nz * 0.012, w, nx, nz, i, part);
}
/* Boîte de décor sans collision, classe 1 par défaut (sans ombre, masquée au loin) */
function gqB(k, x0, x1, y0, y1, z0, z1, t, o) { box(k, x0, x1, y0, y1, z0, z1, Object.assign({ tint: t, collide: false, cls: 1 }, o || {})); }
/* Boîte pleine (arrête soldats et balles), sans ombre */
function gqS(k, x0, x1, y0, y1, z0, z1, t, m = 'metal') { box(k, x0, x1, y0, y1, z0, z1, { tint: t, m, cls: 1 }); }
/* Collision seule */
function gqCol(x0, x1, y0, y1, z0, z1, m = 'metal') { DECOR.col(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1), m); }
/* Boule (révolution : sept anneaux), posée sur y */
function gqBall(x, y, z, r, col, mat = 'rubber', seg = 10) {
  const M = DECOR, prof = []; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; prof.push([Math.max(0.004, Math.cos(a) * r), r + Math.sin(a) * r]); }
  M.save().color(col).move(x, y, z); M.cls = 1; M.lathe(mat, prof, seg); M.restore();
}
/* Cylindre debout sur y ; o.rz, o.rx : couché (l'axe part de (x, y, z)) ; o.r1 : rayon du haut */
function gqCyl(x, y, z, r, h, col, mat = 'steel', seg = 10, o = {}) {
  const M = DECOR; M.save().color(col).move(x, y, z); if (o.rx) M.rotX(o.rx); if (o.rz) M.rotZ(o.rz); M.cls = o.cls === undefined ? 1 : o.cls;
  M.cyl(mat, r, h, seg, o.r1 !== undefined ? { r1: o.r1 } : {}); M.restore();
}
/* Objet en pièces dans son repère (posé en (x, y, z), tourné de r) : [matière, cx, bas, cz, largeur, hauteur, profondeur, teinte] */
function gqParts(x, y, z, r, parts) {
  const M = DECOR; M.save().move(x, y, z).rotY(r); M.cls = 1; M.local(1);
  for (const [mat, cx, cy, cz, w, h, d, t] of parts) { M.save().color(t).move(cx, cy, cz); M.box(mat, w, h, d); M.restore(); }
  M.restore();
}
/* Tube le long de points (monde) */
function gqTube(mat, r, pts, col, seg = 5) { const M = DECOR; M.save().color(col); M.cls = 1; M.tube(mat, r, pts, seg); M.restore(); }
/* Ordinateur portable ouvert sur une table (écran vers -sg, côté vitrine) */
function gqLaptop(x, y, z, sg) {
  const M = DECOR;
  gqB('dark', x - 0.17, x + 0.17, y, y + 0.016, z - 0.115, z + 0.115, [0.22, 0.22, 0.24]);
  M.save().color([0.2, 0.2, 0.22]).move(x, y + 0.016, z + sg * 0.11).rotX(sg * 0.32); M.cls = 1; M.box('dark', 0.34, 0.23, 0.01);
  M.color([1, 1, 1]).move(0, 0.012, -sg * 0.0062); M.box('galTV', 0.31, 0.2, 0.002); M.restore();
}
/* Casque audio accroché à un mur de normale (nx, 0, 0) */
function gqPhones(x, y, z, nx, col) {
  const pts = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push([x + nx * 0.06, y + Math.sin(a) * 0.085, z + Math.cos(a) * 0.085]); }
  gqTube('plastic', 0.012, pts, col);
  for (const s of [-1, 1]) gqB('plastic', x + nx * 0.03, x + nx * 0.09, y - 0.06, y + 0.01, z + s * 0.085 - 0.03, z + s * 0.085 + 0.03, col);
  gqB('steel', x, x + nx * 0.07, y + 0.085, y + 0.1, z - 0.006, z + 0.006, [0.6, 0.6, 0.62]);
}
/* Panier de courses en plastique, posé au sol */
function gqBasket(x, y, z, r, col) {
  gqParts(x, y, z, r, [['plastic', 0, 0, 0, 0.4, 0.012, 0.3, col], ['plastic', 0, 0, -0.145, 0.4, 0.2, 0.01, col], ['plastic', 0, 0, 0.145, 0.4, 0.2, 0.01, col], ['plastic', -0.195, 0, 0, 0.01, 0.2, 0.3, col], ['plastic', 0.195, 0, 0, 0.01, 0.2, 0.3, col], ['plastic', 0, 0.2, -0.07, 0.3, 0.012, 0.014, col], ['plastic', 0, 0.2, 0.07, 0.3, 0.012, 0.014, col]]);
}
/* Sac de courses tombé (couché) */
function gqBag(x, y, z, r, col) { gqParts(x, y, z, r, [['cardboard', 0, 0, 0, 0.32, 0.12, 0.38, col], ['dark', 0, 0.12, 0.19, 0.16, 0.008, 0.07, [0.12, 0.1, 0.08]]]); }
/* Lampadaire : socle, tige, abat-jour, ampoule */
function gqFloorLamp(x, y, z, col = [0.95, 0.9, 0.78]) {
  gqCyl(x, y, z, 0.14, 0.03, [0.15, 0.15, 0.16], 'steel', 12); gqCyl(x, y + 0.03, z, 0.014, 1.36, [0.2, 0.2, 0.2], 'steel', 6);
  const M = DECOR; M.save().color(col).move(x, y + 1.3, z); M.cls = 1; M.lathe('canvas', [[0.22, 0], [0.2, 0.09], [0.14, 0.28]], 16); M.restore();
  gqB('lamp', x - 0.04, x + 0.04, y + 1.32, y + 1.35, z - 0.04, z + 0.04, null, { ao: false });
}
/* Suspension : câble depuis le plafond (yt), abat-jour conique, ampoule */
function gqShade(x, y, z, yt, col) {
  gqB('dark', x - 0.005, x + 0.005, y + 0.24, yt, z - 0.005, z + 0.005, [0.1, 0.1, 0.1]);
  const M = DECOR; M.save().color(col).move(x, y, z); M.cls = 1; M.lathe('steel', [[0.21, 0], [0.17, 0.1], [0.06, 0.22], [0.02, 0.25]], 14); M.restore();
  gqB('lamp', x - 0.045, x + 0.045, y + 0.06, y + 0.12, z - 0.045, z + 0.045, null, { ao: false });
}

/* ---------- Habillage commun ---------- */
function galShopDress(S, y0, f, sg, Z) {
  const { CL, RF } = GL, top = S.lv ? RF : CL, x0 = S.x0, x1 = S.x1, xc = (x0 + x1) / 2, k = S.kind, M = DECOR, R = rngOf(6340 + GAL_SHOPS.indexOf(S) * 31);
  const A = GQ.acc[k] || [0.4, 0.4, 0.4], xa = x0 === GL.ax ? x0 : x0 + 0.07, xb = x1 - 0.07, dB = 8.93, n = S.row === 'n', slat = GQ.slat.has(k);
  const door = S.back !== null ? S.back : S.lv && !n ? x1 - 1.5 : null; // porte du fond (couloir, ou réserve de l'étage sud)
  const span = (a0, a1, fn) => { if (door === null) { fn(a0, a1); return; } if (door - 0.65 - a0 > 0.1) fn(a0, door - 0.65); if (a1 - door - 0.65 > 0.1) fn(door + 0.65, a1); };
  // plinthes
  for (const [xw, s] of [[xa, 1], [xb, -1]]) gqB('paint', xw, xw + s * 0.015, y0, y0 + 0.1, Z(0.1), Z(dB), GPAL.trim);
  span(xa, xb, (a, b) => gqB('paint', a, b, y0, y0 + 0.1, Z(dB), Z(dB - 0.015), GPAL.trim));
  // murs mitoyens : soubassement à la couleur de la boutique, panneaux à rainures au-dessus (boutiques), une cimaise
  for (const [xw, s] of [[xa, 1], [xb, -1]]) {
    const xi = xw + s * 0.025, d1 = k === 'shoes' && s < 0 ? 6.9 : 8.5, yt = slat ? y0 + 2.6 : y0 + 1.0; // (le placard d'entretien est dans le coin des chaussures)
    gqB('paint', xw, xi, y0 + 0.1, y0 + 1.0, Z(0.5), Z(d1), A);
    if (slat) {
      gqB('paint', xw, xi, y0 + 1.0, y0 + 2.6, Z(0.5), Z(d1), [0.9, 0.9, 0.88]);
      for (let y = y0 + 1.15; y < y0 + 2.56; y += 0.15) gqB('dark', xi, xi + s * 0.004, y, y + 0.014, Z(0.5), Z(d1), [0.3, 0.3, 0.3], { cls: 2 });
    }
    gqB('paint', xw, xi + s * 0.012, yt, yt + 0.08, Z(0.5), Z(d1), A);
  }
  // faux plafond : quadrillage des dalles ; bandeau au-dessus de la vitrine ; deux rails de spots
  const yc = top - 0.012;
  for (let x = Math.ceil((x0 + 0.4) / 1.2) * 1.2; x < x1 - 0.3; x += 1.2) gqB('paint', x - 0.016, x + 0.016, yc - 0.012, yc, Z(0.07), Z(dB), [0.6, 0.6, 0.58], { cls: 2 });
  for (let d = 1.2; d < 8.9; d += 1.2) gqB('paint', xa, xb, yc - 0.012, yc, Z(d - 0.016), Z(d + 0.016), [0.6, 0.6, 0.58], { cls: 2 });
  gqB('plaster', xa, xb, top - 0.5, top, Z(0.07), Z(0.75), [0.94, 0.93, 0.9]); gqB('paint', xa, xb, top - 0.53, top - 0.5, Z(0.07), Z(0.77), A);
  for (const xr of [xc - 2.2, xc + 2.2]) {
    if (xr < x0 + 0.6 || xr > x1 - 0.6) continue;
    gqB('steel', xr - 0.02, xr + 0.02, top - 0.05, top - 0.012, Z(1.2), Z(7.8), [0.15, 0.15, 0.16]);
    for (let d = 1.6; d < 7.8; d += 1.5) { const z = Z(d); gqB('steel', xr - 0.008, xr + 0.008, top - 0.09, top - 0.05, z - 0.008, z + 0.008, [0.15, 0.15, 0.16]); gqCyl(xr, top - 0.25, z, 0.045, 0.16, [0.12, 0.12, 0.13], 'steel', 8); gqB('lamp', xr - 0.03, xr + 0.03, top - 0.255, top - 0.25, z - 0.03, z + 0.03, null, { ao: false }); }
  }
  // l'affiche de la boutique : au mur du fond (au-dessus des rayonnages, à l'écart de la porte), en banderole au milieu
  const pk = GQ.kp[k], pi = pk === undefined ? -1 : GQ.po[pk];
  if (pi >= 0 && k !== 'cinema') {
    let px = xc; if (door !== null && Math.abs(door - px) < 1.6) px = door < xc ? Math.min(xb - 0.8, door + 2.2) : Math.max(xa + 0.8, door - 2.2);
    if (k !== 'elec') gPosterF(px, y0 + 3.4, Z(dB), 0.55, 0, -sg, pi); // (le mur d'écrans de l'électronique monte jusque-là)
    const by = top - 1.3, bz = Z(4.5), w = 0.85;
    for (const s of [-1, 1]) gPoster(xc, by, bz + s * 0.004, w, 0, s, pi, 'top');
    gqB('dark', xc - w / 2, xc + w / 2, by + w / 2, by + w / 2 + 0.03, bz - 0.012, bz + 0.012, [0.15, 0.15, 0.15]);
    for (const s of [-1, 1]) gqB('dark', xc + s * w * 0.4 - 0.004, xc + s * w * 0.4 + 0.004, by + w / 2 + 0.03, top, bz - 0.004, bz + 0.004, [0.2, 0.2, 0.2]);
  }
  // portiques antivol, de part et d'autre de l'entrée
  if (GQ.eas.has(k)) for (const x of [S.f[0] + 0.3, S.f[1] - 0.3]) {
    const z = Z(0.6); gqB('dark', x - 0.05, x + 0.05, y0, y0 + 0.05, z - 0.22, z + 0.22, [0.2, 0.2, 0.22]);
    gqB('plastic', x - 0.022, x + 0.022, y0 + 0.05, y0 + 1.45, z - 0.2, z + 0.2, [0.86, 0.88, 0.9]); gqB('galNeon', x - 0.025, x + 0.025, y0 + 1.3, y0 + 1.33, z - 0.18, z + 0.18, [0.3, 0.6, 1.0]);
  }
  // au sol : papiers, marchandise tombée ; quelques flaques sombres
  const cl = [[0.95, 0.95, 0.92], A, [0.8, 0.3, 0.2], [0.3, 0.5, 0.8]];
  for (let i = 0; i < 8; i++) {
    const x = x0 + 0.8 + R() * (x1 - x0 - 1.6), z = Z(1 + R() * 7);
    if (i < 3) gqB('paint', x - 0.1, x + 0.1, y0 + 0.027, y0 + 0.03, z - 0.14, z + 0.14, [0.93, 0.92, 0.88], { rot: R() * 3, cls: 2 });
    else gqB('cardboard', x - 0.09, x + 0.09, y0 + 0.025, y0 + 0.085 + R() * 0.08, z - 0.06, z + 0.06, cl[i % cl.length], { rot: R() * 3, cls: 2 });
  }
  if (GQ.blood.has(k)) for (let i = 0; i < 2; i++) { const x = xc + (R() - 0.5) * (x1 - x0 - 2.4), z = Z(2 + R() * 5), w = 0.3 + R() * 0.35; gqB('plastic', x - w, x + w, y0 + 0.027, y0 + 0.031, z - w * 0.45, z + w * 0.45, [0.24, 0.03, 0.03], { rot: R() * 3, cls: 2 }); }
  galShopProps(S, { x0, x1, xa, xb, xc, y0, top, door, sg, Z, R, A, dB, M });
  if (S.lv && !n) gqStock(S, y0, Z, R);
}

/* Réserve d'une boutique de l'étage sud (de z = 18 au mur du dehors) : rayonnage d'acier chargé de cartons contre le mur du fond, sol de béton */
function gqStock(S, y0, Z, R) {
  const a = S.x0 + 0.4, b = S.x1 - 0.4, z0 = Z(11.42), z1 = Z(11.93), col = [0.25, 0.32, 0.55];
  gqB('concrete', S.x0 + 0.07, S.x1 - 0.07, y0 + 0.025, y0 + 0.03, Z(9.07), Z(11.93), GPAL.srv, { cls: 0 });
  gqCol(a, b, y0, y0 + 2.25, z0, z1);
  const nP = Math.max(2, Math.round((b - a) / 1.8)); for (let i = 0; i <= nP; i++) { const x = lerp(a, b, i / nP); gqB('steel', x - 0.03, x + 0.03, y0, y0 + 2.25, z0, z1, col); }
  for (const y of [0.12, 0.8, 1.48, 2.16]) {
    gqB('steel', a, b, y0 + y - 0.04, y0 + y, z0, z1, [0.62, 0.34, 0.12]);
    if (y > 2) continue;
    for (let x = a + 0.08; x < b - 0.5;) { const w = 0.35 + R() * 0.3, h = 0.25 + R() * 0.32; if (R() < 0.82) gqB('cardboard', x, x + w, y0 + y, y0 + y + h, z0 + 0.03, z1 - 0.03, [0.6 + R() * 0.15, 0.46 + R() * 0.1, 0.32], { cls: 2 }); x += w + 0.05; }
  }
  gLamp((S.x0 + S.x1) / 2, GL.RF - 0.02, Z(10.5), 1.0, 0.25, true, 0.7, 5);
}

/* ---------- Ce qui est propre à chaque sorte de boutique ---------- */
function galShopProps(S, o) {
  const { x0, x1, xa, xb, xc, y0, top, door, sg, Z, R, M } = o, k = S.kind;
  // affiche encadrée sur un mur mitoyen : 'a' (ouest, normale +x) ou 'b' (est) ; d : profondeur du centre
  const wp = (side, d, cy, w, key) => gPosterF(side === 'a' ? xa : xb, cy, Z(d), w, side === 'a' ? 1 : -1, 0, GQ.po[key]);
  // le long du mur du fond, sauf devant la porte (comme galFit)
  const along = (a0, a1, fn) => { if (S.back === null) { fn(a0, a1); return; } const p0 = S.back - 1.2, p1 = S.back + 1.2; if (p0 - a0 > 0.4) fn(a0, Math.min(a1, p0)); if (a1 - p1 > 0.4) fn(Math.max(a0, p1), a1); };
  const PC = [[0.95, 0.45, 0.6], [0.4, 0.75, 0.95], [0.95, 0.85, 0.3], [0.6, 0.9, 0.5], [0.8, 0.6, 0.95]];
  void door;
  if (k === 'sport') {
    // maillots au mur est et ballons sur la tablette au-dessus ; kayak au mur ouest ; râtelier d'haltères contre le mur du fond
    const JC = [[0.85, 0.15, 0.12], [0.12, 0.3, 0.7], [0.95, 0.95, 0.95], [0.1, 0.45, 0.25], [0.95, 0.75, 0.1]];
    for (let i = 0; i < 10; i++) {
      const z = Z(1.4 + i * 0.62), c = JC[i % 5];
      gqB('canvas', xb - 0.06, xb - 0.03, y0 + 1.25, y0 + 1.98, z - 0.22, z + 0.22, c); gqB('canvas', xb - 0.06, xb - 0.03, y0 + 1.76, y0 + 1.96, z - 0.33, z + 0.33, c);
      gqB('paint', xb - 0.064, xb - 0.06, y0 + 1.45, y0 + 1.62, z - 0.07, z + 0.07, i % 5 === 2 ? [0.1, 0.1, 0.12] : [0.96, 0.96, 0.96]);
      gqB('steel', xb - 0.1, xb - 0.03, y0 + 1.98, y0 + 2.0, z - 0.006, z + 0.006, [0.6, 0.6, 0.6]);
    }
    gqB('wood', xb - 0.32, xb, y0 + 2.3, y0 + 2.34, Z(1.0), Z(7.6), [0.5, 0.38, 0.26]);
    const BC = [[0.9, 0.42, 0.1], [0.95, 0.95, 0.95], [0.15, 0.15, 0.15], [0.95, 0.85, 0.2], [0.2, 0.4, 0.85]];
    for (let i = 0; i < 9; i++) gqBall(xb - 0.16, y0 + 2.34, Z(1.3 + i * 0.7), 0.11, BC[i % 5]);
    M.save().color([0.95, 0.45, 0.08]).move(xa + 0.24, y0 + 2.95, Z(4.6)).rotX(Math.PI / 2).scl(1, 1, 0.42); M.cls = 1;
    M.lathe('plastic', [[0.004, -1.6], [0.12, -1.3], [0.26, -0.6], [0.3, 0], [0.26, 0.6], [0.12, 1.3], [0.004, 1.6]], 12); M.restore();
    for (const d of [3.8, 5.4]) gqB('dark', xa, xa + 0.32, y0 + 2.8, y0 + 2.84, Z(d) - 0.03, Z(d) + 0.03, [0.15, 0.15, 0.15]);
    const a = x0 + 7.0, b = x0 + 8.7; gqCol(a, b, y0, y0 + 0.9, Z(8.15), Z(8.85)); // (à 0,5 m du nœud qui mène à la porte du fond)
    for (const x of [a + 0.03, b - 0.03]) gqB('steel', x - 0.03, x + 0.03, y0, y0 + 0.88, Z(8.15), Z(8.85), [0.14, 0.14, 0.15]);
    for (const [y, d0, d1] of [[0.42, 8.5, 8.85], [0.82, 8.15, 8.5]]) {
      gqB('steel', a, b, y0 + y, y0 + y + 0.04, Z(d0), Z(d1), [0.14, 0.14, 0.15]);
      for (let i = 0; i < 4; i++) { const x = a + 0.25 + i * 0.4, z = Z((d0 + d1) / 2); for (const s of [-1, 1]) gqB('rubber', x + s * 0.1 - 0.035, x + s * 0.1 + 0.035, y0 + y + 0.04, y0 + y + 0.14, z - 0.055, z + 0.055, [0.08, 0.08, 0.08]); gqB('steel', x - 0.07, x + 0.07, y0 + y + 0.075, y0 + y + 0.1, z - 0.012, z + 0.012, [0.7, 0.7, 0.72]); }
    }
    wp('a', 6.0, y0 + 1.75, 0.6, 'sport');
  } else if (k === 'pharma') {
    // ordonnances : bandeau vert, tiroirs et boîtes sur les rayonnages du fond ; borne de tension ; présentoir de lunettes ; boîtes renversées
    const MC = [[0.97, 0.97, 0.95], [0.3, 0.65, 0.4], [0.85, 0.3, 0.3], [0.35, 0.5, 0.85], [0.95, 0.8, 0.3]];
    along(x0 + 0.1, x1 - 0.1, (a, b) => {
      gqB('paint', a, b, y0 + 2.2, y0 + 2.5, Z(8.55), Z(8.85), [0.2, 0.58, 0.34]);
      for (let x = a + 0.2; x < b - 0.18; x += 0.4) for (let y = y0 + 0.25; y < y0 + 1.0; y += 0.25) { gqB('paint', x - 0.17, x + 0.17, y, y + 0.2, Z(8.55), Z(8.545), [0.97, 0.97, 0.95]); gqB('steel', x - 0.04, x + 0.04, y + 0.09, y + 0.11, Z(8.545), Z(8.535), [0.6, 0.6, 0.62]); }
      for (const y of [1.2, 1.52, 1.84]) { let x = a + 0.06; while (x < b - 0.2) { const w = 0.07 + R() * 0.08; if (R() < 0.8) gqB('cardboard', x, x + w, y0 + y, y0 + y + 0.1 + R() * 0.12, Z(8.55), Z(8.47), MC[Math.floor(R() * MC.length)], { cls: 2 }); x += w + 0.02; } }
    });
    gqS('plastic', x1 - 1.05, x1 - 0.35, y0, y0 + 0.48, Z(2.2), Z(2.95), [0.88, 0.9, 0.93]);
    gqB('plastic', x1 - 0.42, x1 - 0.32, y0 + 0.48, y0 + 1.05, Z(2.2), Z(2.95), [0.88, 0.9, 0.93]);
    gqB('plastic', x1 - 1.05, x1 - 0.35, y0 + 0.48, y0 + 0.56, Z(2.2), Z(2.95), [0.3, 0.55, 0.42]);
    gqB('plastic', x1 - 0.9, x1 - 0.55, y0 + 0.56, y0 + 1.3, Z(2.05), Z(2.2), [0.88, 0.9, 0.93]); gqB('galTV', x1 - 0.86, x1 - 0.59, y0 + 1.05, y0 + 1.25, Z(2.05), Z(2.045), [1, 1, 1]);
    { const x = x1 - 0.6, z = Z(0.8); gqCyl(x, y0, z, 0.2, 0.04, [0.2, 0.2, 0.22], 'dark', 12); gqCyl(x, y0 + 0.04, z, 0.03, 1.7, [0.75, 0.75, 0.78]);
      for (let j = 0; j < 4; j++) for (let a = 0; a < 6; a++) { const t = (a / 6) * TAU, gx = x + Math.cos(t) * 0.14, gz = z + Math.sin(t) * 0.14; gqB('dark', gx - 0.05, gx + 0.05, y0 + 0.75 + j * 0.25, y0 + 0.79 + j * 0.25, gz - 0.02, gz + 0.02, [0.05, 0.05, 0.06], { rot: -t }); } }
    for (let i = 0; i < 16; i++) { const x = (i % 2 ? x0 + 3.5 : x0 + 5.5) + (R() - 0.5) * 0.8, z = Z(2 + R() * 3.4); gqB('cardboard', x - 0.05, x + 0.05, y0 + 0.025, y0 + 0.055, z - 0.08, z + 0.08, MC[i % 4], { rot: R() * 3, cls: 2 }); }
    gqBasket(x0 + 3.6, y0 + 0.025, Z(4.2), 0.5, [0.8, 0.12, 0.1]);
    wp('a', 2.6, y0 + 1.8, 0.55, 'pharma');
  } else if (k === 'elec') {
    // portables ouverts sur les tables ; comptoir des téléphones au mur ouest ; mur des casques ; enceintes colonnes
    for (const x of [x0 + 2.5, x0 + 6.5]) for (const dx of [-0.62, 0, 0.62]) gqLaptop(x + dx, y0 + 0.8, Z(3.75), sg);
    gqS('paint', xa, xa + 0.3, y0, y0 + 0.95, Z(1.4), Z(6.4), [0.16, 0.17, 0.2]); gqB('paint', xa, xa + 0.34, y0 + 0.95, y0 + 0.99, Z(1.4), Z(6.4), [0.92, 0.92, 0.94]);
    for (let i = 0; i < 8; i++) { const z = Z(1.8 + i * 0.6); gqB('dark', xa + 0.12, xa + 0.2, y0 + 0.99, y0 + 1.02, z - 0.05, z + 0.05, [0.3, 0.3, 0.32]); gqB('dark', xa + 0.15, xa + 0.16, y0 + 1.02, y0 + 1.17, z - 0.04, z + 0.04, [0.08, 0.08, 0.09]); gqB('galTV', xa + 0.161, xa + 0.163, y0 + 1.03, y0 + 1.16, z - 0.035, z + 0.035, [1, 1, 1]); }
    gqB('dark', xb - 0.02, xb, y0 + 1.0, y0 + 2.4, Z(2.6), Z(6.2), [0.22, 0.22, 0.24]);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) gqPhones(xb - 0.02, y0 + 1.4 + j * 0.6, Z(2.95 + i * 0.6), -1, [[0.1, 0.1, 0.1], [0.9, 0.9, 0.9], [0.8, 0.15, 0.15], [0.2, 0.4, 0.8]][(i + j) % 4]);
    for (const d of [6.7, 7.5]) { const z = Z(d); gqS('paint', xb - 0.34, xb - 0.04, y0, y0 + 1.15, z - 0.16, z + 0.16, [0.06, 0.06, 0.07]); for (const [y, r] of [[0.85, 0.1], [0.45, 0.13]]) gqCyl(xb - 0.335, y0 + y, z, r, 0.012, [0.16, 0.16, 0.17], 'rubber', 12, { rz: Math.PI / 2 }); }
    wp('a', 7.3, y0 + 2.0, 0.6, 'elec'); wp('a', 3.6, y0 + 2.0, 0.5, 'elec');
  } else if (k === 'toys') {
    // ours géant assis au fond, cheval à bascule, bac à peluches, cerfs-volants au plafond, petites voitures au sol
    { const x = x1 - 0.8, z = Z(8.15), b = [0.62, 0.4, 0.22], l = [0.86, 0.7, 0.5], dk = [0.05, 0.05, 0.05], f = -sg;
      gqCol(x - 0.5, x + 0.5, y0, y0 + 0.85, z - 0.45, z + 0.45, 'dirt');
      gqBall(x, y0, z, 0.42, b, 'canvas', 12); gqBall(x, y0 + 0.74, z, 0.3, b, 'canvas', 12);
      for (const s of [-1, 1]) { gqBall(x + s * 0.2, y0 + 1.22, z, 0.09, b, 'canvas'); gqBall(x + s * 0.36, y0 + 0.3, z + f * 0.12, 0.13, b, 'canvas'); gqBall(x + s * 0.2, y0, z + f * 0.32, 0.15, b, 'canvas'); gqBall(x + s * 0.1, y0 + 1.08, z + f * 0.27, 0.03, dk); }
      gqBall(x, y0 + 0.9, z + f * 0.26, 0.1, l, 'canvas'); gqBall(x, y0 + 1.025, z + f * 0.35, 0.035, dk); gqBall(x, y0 + 0.26, z + f * 0.3, 0.2, l, 'canvas');
      gqB('canvas', x - 0.16, x + 0.16, y0 + 0.66, y0 + 0.74, z + f * 0.22, z + f * 0.36, [0.85, 0.15, 0.2]); }
    { const x = x1 - 0.75, z = Z(5.0), c = [0.85, 0.2, 0.15], yl = [0.95, 0.85, 0.3], f = -sg;
      gqParts(x, y0, z, 0, [['wood', 0, 0.42, 0, 0.22, 0.24, 0.62, c], ['wood', 0, 0.62, f * 0.3, 0.16, 0.32, 0.18, c], ['paint', 0, 0.84, f * 0.39, 0.12, 0.08, 0.2, [0.95, 0.9, 0.85]], ['canvas', 0, 0.66, -f * 0.04, 0.24, 0.02, 0.3, [0.2, 0.3, 0.8]], ['wood', 0, 0.5, -f * 0.36, 0.05, 0.2, 0.06, [0.35, 0.2, 0.1]]]
        .concat([-1, 1].flatMap((sx) => [-1, 1].map((sz) => ['wood', sx * 0.09, 0.1, sz * 0.22, 0.04, 0.34, 0.04, yl]))));
      for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 8; i++) { const t = (i / 8 - 0.5) * 1.1; pts.push([x + sx * 0.09, y0 + 0.07 + (1 - Math.cos(t)) * 0.4, z + Math.sin(t) * 0.5]); } gqTube('wood', 0.02, pts, yl); } }
    { const x = x0 + 0.85, z = Z(4.6), wire = [0.75, 0.75, 0.78]; gqCol(x - 0.45, x + 0.45, y0, y0 + 0.9, z - 0.45, z + 0.45, 'dirt');
      gqCyl(x, y0, z, 0.43, 0.55, [0.72, 0.5, 0.72], 'canvas', 16);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; gqB('steel', x + Math.cos(a) * 0.44 - 0.008, x + Math.cos(a) * 0.44 + 0.008, y0, y0 + 0.9, z + Math.sin(a) * 0.44 - 0.008, z + Math.sin(a) * 0.44 + 0.008, wire); }
      for (const y of [0.02, 0.88]) { const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; pts.push([x + Math.cos(a) * 0.44, y0 + y, z + Math.sin(a) * 0.44]); } gqTube('steel', 0.012, pts, wire, 4); }
      for (let i = 0; i < 14; i++) { const a = R() * TAU, r = R() * 0.27; gqBall(x + Math.cos(a) * r, y0 + 0.46 + R() * 0.2, z + Math.sin(a) * r, 0.1 + R() * 0.05, PC[i % 5], 'canvas', 8); } }
    for (const [dx, d, y, c] of [[-2, 3, 1.3, [0.95, 0.2, 0.2]], [1.5, 5.5, 1.05, [0.2, 0.5, 0.95]], [-0.5, 7, 1.5, [0.3, 0.8, 0.3]]]) {
      const x = xc + dx, z = Z(d), yy = top - y; M.save().color(c).move(x, yy, z).rotY(0.4).rotZ(Math.PI / 4); M.cls = 1; M.local(1); M.box('canvas', 0.42, 0.42, 0.01); M.restore();
      gqB('dark', x - 0.003, x + 0.003, yy + 0.3, top, z - 0.003, z + 0.003, [0.2, 0.2, 0.2]);
      const tail = []; for (let i = 0; i <= 6; i++) tail.push([x + Math.sin(i * 0.9) * 0.06, yy - i * 0.12, z]); gqTube('canvas', 0.006, tail, [0.95, 0.95, 0.9], 3);
    }
    for (let i = 0; i < 6; i++) { const x = x0 + 3.2 + R() * 3, z = Z(0.8 + R() * 1.2), c = PC[i % 5]; gqParts(x, y0 + 0.025, z, R() * 3, [['plastic', 0, 0.02, 0, 0.16, 0.05, 0.08, c], ['plastic', 0.01, 0.07, 0, 0.08, 0.035, 0.07, c], ['rubber', -0.05, 0, 0.042, 0.04, 0.035, 0.008, [0.05, 0.05, 0.05]], ['rubber', 0.05, 0, 0.042, 0.04, 0.035, 0.008, [0.05, 0.05, 0.05]], ['rubber', -0.05, 0, -0.042, 0.04, 0.035, 0.008, [0.05, 0.05, 0.05]], ['rubber', 0.05, 0, -0.042, 0.04, 0.035, 0.008, [0.05, 0.05, 0.05]]]); }
    wp('b', 2.6, y0 + 1.8, 0.6, 'toys');
  } else if (k === 'clothes') {
    // casiers à vêtements pliés au mur ouest, grand miroir au fond, vêtements et cintres tombés, un sac de courses
    const d0 = 2.0, d1 = 5.6, wc = [0.92, 0.9, 0.86], FC = [[0.12, 0.12, 0.14], [0.78, 0.74, 0.68], [0.45, 0.12, 0.14], [0.2, 0.28, 0.45], [0.9, 0.9, 0.88], [0.5, 0.55, 0.4]];
    gqCol(xa, xa + 0.36, y0, y0 + 2.2, Z(d0), Z(d1), 'wood');
    gqB('wood', xa, xa + 0.36, y0, y0 + 0.12, Z(d0), Z(d1), wc);
    for (const d of [d0, (d0 + d1) / 2, d1]) gqB('wood', xa, xa + 0.36, y0, y0 + 2.2, Z(d) - 0.015, Z(d) + 0.015, wc);
    for (const y of [0.45, 0.95, 1.45, 1.95]) { gqB('wood', xa, xa + 0.36, y0 + y - 0.03, y0 + y, Z(d0), Z(d1), wc); for (let dd = d0 + 0.1; dd < d1 - 0.3; dd += 0.36) { const z = Z(dd + 0.15); gqB('canvas', xa + 0.04, xa + 0.32, y0 + y, y0 + y + 0.12 + R() * 0.14, z - 0.14, z + 0.14, FC[Math.floor(R() * FC.length)], { cls: 2 }); } }
    { const x = x1 - 1.1; gqB('paint', x - 0.45, x + 0.45, y0 + 0.25, y0 + 2.25, Z(o.dB), Z(o.dB - 0.02), [0.15, 0.13, 0.12]); gqB('glass', x - 0.4, x + 0.4, y0 + 0.3, y0 + 2.2, Z(o.dB - 0.02), Z(o.dB - 0.026), [0.75, 0.8, 0.82]); }
    for (let i = 0; i < 6; i++) { const x = x0 + 1.4 + R() * 5, z = Z(1.6 + R() * 5); gqB('canvas', x - 0.25, x + 0.25, y0 + 0.025, y0 + 0.05, z - 0.18, z + 0.18, FC[i % 4], { rot: R() * 3, cls: 2 }); if (i % 2) gqB('dark', x - 0.2, x + 0.2, y0 + 0.05, y0 + 0.06, z + 0.2, z + 0.21, [0.1, 0.1, 0.1], { rot: R() * 3, cls: 2 }); }
    gqBag(x0 + 4.2, y0 + 0.025, Z(0.9), 0.5, [0.95, 0.93, 0.88]);
    wp('b', 1.8, y0 + 1.8, 0.6, 'mode');
  } else if (k === 'shoes') {
    // étagères à chaussures au mur ouest, piles de boîtes près des bancs, deux socles, un miroir de pied
    const d0 = 1.0, d1 = 6.6, wc = [0.92, 0.9, 0.86], SC = [[0.1, 0.1, 0.1], [0.95, 0.95, 0.95], [0.6, 0.2, 0.1], [0.2, 0.35, 0.7], [0.75, 0.6, 0.4]];
    gqCol(xa, xa + 0.32, y0, y0 + 2.1, Z(d0), Z(d1), 'wood'); gqB('paint', xa, xa + 0.02, y0, y0 + 2.1, Z(d0), Z(d1), wc);
    for (const y of [0.35, 0.75, 1.15, 1.55, 1.95]) { gqB('paint', xa, xa + 0.3, y0 + y - 0.025, y0 + y, Z(d0), Z(d1), wc); for (let dd = d0 + 0.2; dd < d1 - 0.2; dd += 0.38) { const z = Z(dd), c = SC[Math.floor(R() * SC.length)]; for (const s of [-1, 1]) gqB('rubber', xa + 0.06, xa + 0.28, y0 + y, y0 + y + 0.09, z + s * 0.055 - 0.045, z + s * 0.055 + 0.045, c, { cls: 2 }); } }
    for (const [dx, d, nb] of [[3.4, 3.1, 4], [1.6, 4.9, 3], [3.6, 5.1, 5]]) for (let j = 0; j < nb; j++) { const x = x0 + dx, z = Z(d), y = y0 + 0.025 + j * 0.12; gqB('cardboard', x - 0.17, x + 0.17, y, y + 0.09, z - 0.1, z + 0.1, [[0.85, 0.3, 0.2], [0.2, 0.2, 0.22], [0.9, 0.85, 0.75]][j % 3], { cls: 2 }); gqB('cardboard', x - 0.175, x + 0.175, y + 0.09, y + 0.12, z - 0.105, z + 0.105, [0.95, 0.95, 0.95], { cls: 2 }); }
    for (const [dx, d, c] of [[4.6, 6.2, [0.95, 0.95, 0.95]], [6.0, 3.4, [0.6, 0.2, 0.1]]]) { const x = x0 + dx, z = Z(d); gqCyl(x, y0, z, 0.26, 0.6, [0.9, 0.9, 0.88], 'paint', 16); gqCol(x - 0.26, x + 0.26, y0, y0 + 0.6, z - 0.26, z + 0.26, 'wood'); for (const s of [-1, 1]) gqB('rubber', x - 0.11, x + 0.11, y0 + 0.6, y0 + 0.69, z + s * 0.06 - 0.045, z + s * 0.06 + 0.045, c); }
    gqB('paint', xb - 0.03, xb, y0 + 0.05, y0 + 1.5, Z(4.25), Z(4.95), [0.2, 0.2, 0.22]); gqB('glass', xb - 0.036, xb - 0.03, y0 + 0.09, y0 + 1.46, Z(4.29), Z(4.91), [0.75, 0.8, 0.82]);
    wp('b', 2.6, y0 + 1.9, 0.55, 'shoes');
  } else if (k === 'jewel') {
    // bijoux sous les vitres des comptoirs, vitrines murales éclairées, le coffre, des éclats de verre
    const gold = [0.92, 0.74, 0.32], silver = [0.85, 0.86, 0.9], vel = [0.3, 0.08, 0.2];
    for (const d of [3, 6]) { const z = Z(d), a = x0 + 0.5; gqB('rug', a + 0.04, a + 2.96, y0 + 0.95, y0 + 0.956, z - 0.26, z + 0.26, vel);
      for (let i = 0; i < 9; i++) { const x = a + 0.25 + i * 0.31, zz = z + (i % 2 ? 0.08 : -0.08), mt = i % 3 !== 1 ? gold : silver;
        if (i % 3 === 0) { gqCyl(x, y0 + 0.956, zz, 0.03, 0.14, [0.12, 0.08, 0.12], 'dark', 8); gqCyl(x, y0 + 1.07, zz, 0.06, 0.012, mt, 'steel', 12); }
        else { gqB('dark', x - 0.035, x + 0.035, y0 + 0.956, y0 + 0.99, zz - 0.035, zz + 0.035, [0.1, 0.08, 0.12]); gqCyl(x, y0 + 0.99, zz, 0.018, 0.008, mt, 'steel', 10); } } }
    { const d0 = 1.8, d1 = 7.2; gqCol(xb - 0.43, xb, y0, y0 + 2.0, Z(d0), Z(d1));
      gqB('paint', xb - 0.42, xb, y0, y0 + 0.9, Z(d0), Z(d1), [0.15, 0.12, 0.18]); gqB('rug', xb - 0.02, xb, y0 + 0.9, y0 + 1.9, Z(d0), Z(d1), vel); gqB('rug', xb - 0.42, xb - 0.02, y0 + 0.9, y0 + 0.905, Z(d0), Z(d1), vel);
      gqB('paint', xb - 0.42, xb, y0 + 1.9, y0 + 2.0, Z(d0), Z(d1), [0.15, 0.12, 0.18]); gqB('galNeon', xb - 0.38, xb - 0.06, y0 + 1.885, y0 + 1.9, Z(d0 + 0.1), Z(d1 - 0.1), [1, 0.92, 0.75]);
      gqB('glass', xb - 0.43, xb - 0.42, y0 + 0.9, y0 + 1.9, Z(d0), Z(d1), [0.8, 0.85, 0.9]);
      for (const y of [0.905, 1.26, 1.61]) { if (y > 1) gqB('glass', xb - 0.4, xb - 0.02, y0 + y - 0.008, y0 + y, Z(d0), Z(d1), [0.85, 0.9, 0.92]); for (let i = 0; i < 10; i++) { const z = Z(d0 + 0.3 + i * 0.5); gqCyl(xb - 0.2, y0 + y, z, 0.022, 0.05 + (i % 3) * 0.04, i % 2 ? gold : silver, 'steel', 8); } } }
    { const a = x0 + 0.15, b = x0 + 1.0, zf = Z(8.05); gqS('steel', a, b, y0, y0 + 1.15, zf, Z(o.dB), [0.2, 0.21, 0.23]);
      gqCyl(a + 0.4, y0 + 0.72, zf, 0.075, 0.03, [0.7, 0.7, 0.72], 'steel', 16, { rx: -sg * Math.PI / 2 }); gqB('steel', a + 0.62, a + 0.66, y0 + 0.4, y0 + 0.9, zf, zf - sg * 0.04, [0.7, 0.7, 0.72]); }
    for (let i = 0; i < 12; i++) { const x = x0 + 1.4 + R() * 1.6, z = Z(2.4 + R() * 0.4); gqB('glass', x - 0.03 - R() * 0.04, x + 0.03, y0 + 0.025, y0 + 0.032, z - 0.02, z + 0.03, [0.85, 0.9, 0.92], { rot: R() * 3, cls: 2 }); }
  } else if (k === 'books') {
    // coin lecture (fauteuil, lampadaire), présentoir de magazines, piles de livres sur la table, livres tombés
    const BKC = [[0.6, 0.2, 0.15], [0.2, 0.3, 0.5], [0.85, 0.8, 0.65], [0.2, 0.4, 0.25], [0.5, 0.15, 0.4], [0.9, 0.7, 0.2]];
    { const x = xa + 0.47, z = Z(1.45), c = [0.2, 0.32, 0.26]; gqCol(x - 0.42, x + 0.42, y0, y0 + 0.62, z - 0.42, z + 0.42, 'dirt');
      gqParts(x, y0, z, 0, [['canvas', 0, 0, 0, 0.8, 0.4, 0.78, c], ['canvas', 0.04, 0.4, 0, 0.66, 0.1, 0.62, [0.26, 0.4, 0.32]], ['canvas', -0.32, 0.4, 0, 0.16, 0.56, 0.78, c], ['canvas', 0, 0.4, -0.34, 0.8, 0.22, 0.1, c], ['canvas', 0, 0.4, 0.34, 0.8, 0.22, 0.1, c]]);
      gqFloorLamp(xa + 0.3, y0, Z(2.3)); }
    { const z0 = Z(0.5), z1 = Z(2.0), wd = [0.4, 0.28, 0.18], MC = [[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.95, 0.85, 0.2], [0.95, 0.95, 0.95], [0.2, 0.7, 0.4]];
      gqCol(xb - 0.42, xb, y0, y0 + 1.35, z0, z1, 'wood'); gqB('wood', xb - 0.42, xb, y0, y0 + 0.08, z0, z1, wd); for (const d of [0.5, 2.0]) gqB('wood', xb - 0.42, xb, y0, y0 + 1.35, Z(d) - 0.015, Z(d) + 0.015, wd);
      for (let j = 0; j < 4; j++) { const y = y0 + 0.2 + j * 0.3; gqB('wood', xb - 0.4, xb - 0.36, y, y + 0.1, z0, z1, wd); for (let i = 0; i < 6; i++) { const z = Z(0.65 + i * 0.22); gqB('paint', xb - 0.36, xb - 0.33, y + 0.02, y + 0.3, z - 0.1, z + 0.1, MC[(i + j) % 5], { cls: 2 }); } } }
    for (let i = 0; i < 6; i++) { const x = xc - 0.65 + (i % 3) * 0.65, z = Z(2) + (i < 3 ? -0.25 : 0.25); let y = y0 + 0.8; const nb = 2 + Math.floor(R() * 5); for (let j = 0; j < nb; j++) { const h = 0.025 + R() * 0.02, w = 0.13 + R() * 0.04; gqB('paint', x - w, x + w, y, y + h, z - 0.1, z + 0.1, BKC[Math.floor(R() * BKC.length)], { rot: (R() - 0.5) * 0.3, cls: 2 }); y += h; } }
    for (let i = 0; i < 10; i++) { const x = x0 + 1.4 + R() * 3.4, z = Z(3 + R() * 3.5); gqB('paint', x - 0.12, x + 0.12, y0 + 0.025, y0 + 0.055, z - 0.09, z + 0.09, BKC[i % BKC.length], { rot: R() * 3, cls: 2 }); }
    wp('b', 2.0, y0 + 1.8, 0.55, 'books');
  } else if (k === 'pets') {
    // aquariums peuplés (gravier, plantes, poissons, couvercle éclairé), cages au mur est, sacs de croquettes, arbre à chat
    for (const x of [x0 + 0.9, x0 + 2.2, x1 - 0.9]) { const z = Z(8.6);
      gqB('paint', x - 0.56, x + 0.56, y0 + 0.9, y0 + 0.97, z - 0.26, z + 0.26, [0.72, 0.62, 0.45]);
      for (let i = 0; i < 4; i++) gqB('paint', x - 0.45 + i * 0.28, x - 0.42 + i * 0.28, y0 + 0.97, y0 + 1.3 + R() * 0.2, z - 0.05, z + 0.05, [0.2, 0.55, 0.25]);
      for (let i = 0; i < 5; i++) { const fx = x - 0.4 + R() * 0.8, fy = y0 + 1.1 + R() * 0.35, fz = z - 0.15 + R() * 0.3; gqB('paint', fx - 0.035, fx + 0.035, fy, fy + 0.025, fz - 0.008, fz + 0.008, [[0.95, 0.5, 0.1], [0.3, 0.6, 0.95], [0.95, 0.85, 0.2]][i % 3]); }
      gqB('dark', x - 0.62, x + 0.62, y0 + 1.6, y0 + 1.66, z - 0.32, z + 0.32, [0.15, 0.15, 0.16]); gqB('galNeon', x - 0.5, x + 0.5, y0 + 1.595, y0 + 1.6, z - 0.04, z + 0.04, [0.6, 0.85, 1.0]); }
    { const d0 = 2.8, d1 = 6.6, xi = xb - 0.62, st = [0.7, 0.72, 0.74]; gqCol(xi, xb, y0, y0 + 1.5, Z(d0), Z(d1));
      for (const yc of [0, 0.75]) { const yb = y0 + yc, h = 0.7; gqB('steel', xi, xb, yb, yb + 0.03, Z(d0), Z(d1), st); gqB('steel', xi, xb, yb + h, yb + h + 0.02, Z(d0), Z(d1), st);
        for (let dd = d0; dd <= d1 + 0.01; dd += 0.95) gqB('steel', xi, xb, yb, yb + h, Z(dd) - 0.015, Z(dd) + 0.015, st);
        for (let dd = d0 + 0.08; dd < d1; dd += 0.08) gqB('steel', xi - 0.004, xi + 0.004, yb + 0.03, yb + h, Z(dd) - 0.004, Z(dd) + 0.004, [0.75, 0.76, 0.78], { cls: 2 }); }
      for (const d of [3.3, 5.2]) gqB('rug', xi + 0.08, xb - 0.05, y0 + 0.03, y0 + 0.12, Z(d) - 0.3, Z(d) + 0.3, [0.55, 0.3, 0.2]); }
    { const BC = [[0.75, 0.2, 0.15], [0.2, 0.45, 0.7], [0.85, 0.7, 0.2], [0.3, 0.55, 0.3]]; gqCol(xa, xa + 0.5, y0, y0 + 0.95, Z(3), Z(6.2), 'dirt');
      let n2 = 0; for (let dd = 3.0; dd < 6.0; dd += 0.52) for (let j = 0; j < 3; j++) { const z = Z(dd + 0.26), y = y0 + j * 0.3; gqB('canvas', xa + 0.02, xa + 0.48, y, y + 0.29, z - 0.24, z + 0.24, BC[(n2++ + j) % 4], { bevel: 0.04 }); } }
    { const x = x1 - 1.6, z = Z(7.2), c = [0.82, 0.74, 0.62], p = [0.6, 0.5, 0.4]; gqCol(x - 0.3, x + 0.3, y0, y0 + 1.55, z - 0.3, z + 0.3, 'dirt');
      gqB('rug', x - 0.3, x + 0.3, y0, y0 + 0.05, z - 0.3, z + 0.3, c); for (const [dx, dz, h] of [[-0.15, -0.15, 1.5], [0.15, 0.15, 1.1]]) gqCyl(x + dx, y0, z + dz, 0.06, h, p, 'canvas', 10);
      for (const [dx, dz, y] of [[-0.12, -0.12, 1.5], [0.12, 0.12, 1.1], [0, 0, 0.6]]) gqB('rug', x + dx - 0.22, x + dx + 0.22, y0 + y, y0 + y + 0.05, z + dz - 0.22, z + dz + 0.22, c); }
    wp('a', 4.6, y0 + 1.95, 0.6, 'pets');
  } else if (k === 'mart') {
    // portes vitrées des vitrines réfrigérées et leurs bouteilles ; caisse (tapis, terminal) ; tabac ; chips ; congélateur ; distributeur ; canettes renversées
    const BT = [[0.75, 0.1, 0.1], [0.3, 0.55, 0.9], [0.45, 0.28, 0.12], [0.25, 0.6, 0.3], [0.95, 0.75, 0.2]];
    along(x0 + 0.1, x1 - 0.1, (a, b) => {
      const zf = Z(8.3), zg = Z(8.22), nd = Math.max(1, Math.round((b - a) / 0.75)), dw = (b - a) / nd;
      for (let i = 0; i <= nd; i++) gqB('dark', a + i * dw - 0.025, a + i * dw + 0.025, y0, y0 + 2.0, zg, zf, [0.2, 0.2, 0.22]);
      gqB('glass', a, b, y0 + 0.12, y0 + 1.86, zg, Z(8.226), [0.75, 0.85, 0.9]);
      for (let i = 0; i < nd; i++) gqB('steel', a + i * dw + dw - 0.09, a + i * dw + dw - 0.07, y0 + 0.8, y0 + 1.3, zg, zg - sg * 0.03, [0.8, 0.8, 0.82]);
      for (const [y, j] of [[0.2, 0], [0.62, 1], [1.04, 2], [1.46, 3]]) { gqB('steel', a, b, y0 + y - 0.012, y0 + y, Z(8.226), zf, [0.7, 0.7, 0.72], { cls: 2 }); for (let x = a + 0.06; x < b - 0.06; x += 0.095) gqB('plastic', x - 0.035, x + 0.035, y0 + y, y0 + y + (j % 2 ? 0.3 : 0.24), Z(8.25), Z(8.295), BT[(j + Math.floor((x - a) / 0.8)) % BT.length], { cls: 2 }); }
    });
    { const a = x1 - 3, b = x1 - 0.6, z = Z(1.4); gqB('rubber', a + 0.9, b - 0.15, y0 + 1.0, y0 + 1.015, z - 0.22, z + 0.22, [0.08, 0.08, 0.08]); gqB('steel', a + 0.85, a + 0.9, y0 + 1.0, y0 + 1.05, z - 0.25, z + 0.25, [0.7, 0.7, 0.72]);
      gqB('dark', b - 0.5, b - 0.38, y0 + 1.0, y0 + 1.04, z - 0.07, z + 0.07, [0.12, 0.12, 0.12]); gqB('galTV', b - 0.48, b - 0.4, y0 + 1.04, y0 + 1.041, z - 0.03, z + 0.05, [1, 1, 1]);
      for (let i = 0; i < 4; i++) { const zz = z + (i - 1.5) * 0.1; gqB('cardboard', a + 0.3, a + 0.6, y0 + 0.2, y0 + 0.9, zz - 0.04, zz + 0.04, PC[i], { cls: 2 }); } }
    { const z0 = Z(0.9), z1 = Z(2.8); gqB('paint', xb - 0.25, xb, y0 + 1.1, y0 + 2.4, z0, z1, [0.25, 0.25, 0.27]); for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) { const z = Z(1.0 + i * 0.2); gqB('cardboard', xb - 0.2, xb - 0.04, y0 + 1.15 + j * 0.25, y0 + 1.15 + j * 0.25 + 0.09, z - 0.04, z + 0.04, BT[(i + j) % BT.length], { cls: 2 }); } }
    { gqCol(xa, xa + 0.4, y0, y0 + 1.5, Z(1.4), Z(3.0), 'metal'); for (let j = 0; j < 4; j++) { const y = y0 + 0.2 + j * 0.34; gqB('steel', xa, xa + 0.4, y, y + 0.012, Z(1.4), Z(3.0), [0.7, 0.7, 0.72], { cls: 2 }); for (let i = 0; i < 7; i++) { const z = Z(1.5 + i * 0.22); gqB('plastic', xa + 0.06, xa + 0.36, y + 0.012, y + 0.27, z - 0.09, z + 0.09, [[0.95, 0.8, 0.2], [0.85, 0.2, 0.15], [0.2, 0.5, 0.85]][(i + j) % 3], { bevel: 0.03, cls: 2 }); } } gqB('steel', xa + 0.38, xa + 0.4, y0, y0 + 1.5, Z(1.4), Z(3.0), [0.7, 0.7, 0.72]); }
    { gqS('steel', xa, xa + 0.85, y0, y0 + 0.85, Z(4.0), Z(6.0), [0.92, 0.93, 0.95]); gqB('glass', xa + 0.04, xa + 0.81, y0 + 0.85, y0 + 0.87, Z(4.05), Z(5.95), [0.7, 0.8, 0.9]); for (let i = 0; i < 8; i++) gqB('cardboard', xa + 0.1 + (i % 2) * 0.35, xa + 0.4 + (i % 2) * 0.35, y0 + 0.66, y0 + 0.82, Z(4.2 + Math.floor(i / 2) * 0.42), Z(4.5 + Math.floor(i / 2) * 0.42), BT[i % BT.length], { cls: 2 }); }
    { const a = xa + 0.05, b = xa + 0.75, z0 = Z(0.25), z1 = Z(0.8); gqS('paint', a, b, y0, y0 + 1.6, z0, z1, [0.3, 0.32, 0.36]); gqB('galTV', a + 0.15, b - 0.15, y0 + 1.15, y0 + 1.4, z1, z1 + sg * 0.004, [1, 1, 1]); gqB('dark', a + 0.2, b - 0.2, y0 + 0.95, y0 + 1.0, z1, z1 + sg * 0.03, [0.1, 0.1, 0.1]); gqB('galNeon', a, b, y0 + 1.5, y0 + 1.58, z1, z1 + sg * 0.004, [0.3, 0.7, 1]); }
    for (let i = 0; i < 12; i++) gqCyl(x0 + 3.5 + (R() - 0.5) * 0.9, y0 + 0.058, Z(3 + R() * 2), 0.033, 0.12, BT[i % BT.length], 'steel', 8, { rx: Math.PI / 2, cls: 2 });
    gqBasket(x0 + 3.4, y0 + 0.025, Z(5.4), 2.1, [0.15, 0.35, 0.8]);
    wp('a', 5.0, y0 + 1.95, 0.6, 'mart');
  } else if (k === 'arcade') {
    // bornes : fronton lumineux, pupitre, manette et boutons, liserés ; pince à peluches ; air hockey ; deux flippers ; mur des lots ; néons
    for (let i = 0; i < 5; i++) for (const d of [3, 6.5]) {
      const x = x0 + 0.9 + i * 1.6, zf = Z(d) - sg * 0.4, NC = [[1, 0.25, 0.85], [0.25, 0.9, 1], [1, 0.85, 0.2], [0.4, 1, 0.4]][(i + (d > 4 ? 1 : 0)) % 4];
      gqB('galNeon', x - 0.34, x + 0.34, y0 + 1.66, y0 + 1.82, zf + sg * 0.002, zf - sg * 0.01, NC);
      gqB('paint', x - 0.34, x + 0.34, y0 + 0.92, y0 + 1.0, zf, zf - sg * 0.22, [0.08, 0.08, 0.1]);
      gqCyl(x - 0.15, y0 + 1.0, zf - sg * 0.12, 0.012, 0.08, [0.1, 0.1, 0.1]); gqBall(x - 0.15, y0 + 1.07, zf - sg * 0.12, 0.022, [0.9, 0.1, 0.1]);
      for (let b = 0; b < 4; b++) gqCyl(x + 0.02 + b * 0.07, y0 + 1.0, zf - sg * (0.1 + (b % 2) * 0.04), 0.018, 0.012, [[1, 0.2, 0.2], [0.2, 0.5, 1], [1, 0.9, 0.2], [0.3, 0.9, 0.3]][b]);
      for (const s of [-1, 1]) gqB('galNeon', x + s * 0.362 - 0.004, x + s * 0.362 + 0.004, y0 + 0.1, y0 + 1.8, zf, zf + sg * 0.04, NC, { cls: 2 }); // liseré au bord avant des flancs
    }
    { const x = x0 + 0.75, z = Z(0.95); gqCol(x - 0.5, x + 0.5, y0, y0 + 1.95, z - 0.5, z + 0.5);
      gqB('paint', x - 0.5, x + 0.5, y0, y0 + 0.9, z - 0.5, z + 0.5, [0.95, 0.35, 0.6]); gqB('galNeon', x - 0.5, x + 0.5, y0 + 1.75, y0 + 1.95, z - 0.5, z + 0.5, [1, 0.4, 0.8]);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) gqB('steel', x + sx * 0.48 - 0.02, x + sx * 0.48 + 0.02, y0 + 0.9, y0 + 1.75, z + sz * 0.48 - 0.02, z + sz * 0.48 + 0.02, [0.85, 0.85, 0.88]);
      gqB('glass', x - 0.47, x + 0.47, y0 + 0.9, y0 + 1.75, z - 0.47, z + 0.47, [0.8, 0.88, 0.95]);
      for (let i = 0; i < 10; i++) gqBall(x - 0.3 + R() * 0.6, y0 + 0.9, z - 0.3 + R() * 0.6, 0.08 + R() * 0.04, PC[i % 5], 'canvas', 8);
      gqB('steel', x - 0.005, x + 0.005, y0 + 1.4, y0 + 1.75, z - 0.005, z + 0.005, [0.7, 0.7, 0.72]);
      for (let a = 0; a < 3; a++) { const t = (a / 3) * TAU; gqB('steel', x + Math.cos(t) * 0.04 - 0.006, x + Math.cos(t) * 0.04 + 0.006, y0 + 1.3, y0 + 1.42, z + Math.sin(t) * 0.04 - 0.006, z + Math.sin(t) * 0.04 + 0.006, [0.7, 0.7, 0.72]); } }
    { const x = x1 - 0.6, z = Z(1.55), nc = [0.25, 0.9, 1]; gqS('paint', x - 0.45, x + 0.45, y0, y0 + 0.8, z - 0.9, z + 0.9, [0.1, 0.25, 0.6]); gqB('plastic', x - 0.42, x + 0.42, y0 + 0.8, y0 + 0.81, z - 0.87, z + 0.87, [0.92, 0.95, 0.98]);
      for (const s of [-1, 1]) { gqB('galNeon', x - 0.45, x + 0.45, y0 + 0.8, y0 + 0.85, z + s * 0.88 - 0.02, z + s * 0.88 + 0.02, nc); gqB('galNeon', x + s * 0.43 - 0.02, x + s * 0.43 + 0.02, y0 + 0.8, y0 + 0.85, z - 0.9, z + 0.9, nc); gqCyl(x, y0 + 0.81, z + s * 0.55, 0.05, 0.04, [0.9, 0.15, 0.15], 'plastic', 12); }
      gqB('paint', x - 0.42, x + 0.42, y0 + 0.81, y0 + 0.812, z - 0.006, z + 0.006, [0.85, 0.1, 0.1]); }
    for (const d of [4.35, 5.25]) { const z = Z(d), a = x1 - 1.42, b = x1 - 0.14, c = d < 5 ? [0.85, 0.15, 0.2] : [0.15, 0.35, 0.85];
      gqCol(a, b, y0, y0 + 1.0, z - 0.33, z + 0.33); gqCol(b - 0.2, b, y0, y0 + 1.85, z - 0.33, z + 0.33);
      gqB('paint', a, b, y0 + 0.62, y0 + 0.95, z - 0.33, z + 0.33, c); gqB('glass', a + 0.03, b - 0.22, y0 + 0.95, y0 + 0.96, z - 0.3, z + 0.3, [0.8, 0.85, 0.9]);
      for (const [lx, lz] of [[a + 0.05, -0.28], [a + 0.05, 0.28], [b - 0.05, -0.28], [b - 0.05, 0.28]]) gqB('steel', lx - 0.025, lx + 0.025, y0, y0 + 0.62, z + lz - 0.025, z + lz + 0.025, [0.7, 0.7, 0.72]);
      gqB('galNeon', a + 0.05, b - 0.25, y0 + 0.951, y0 + 0.953, z - 0.28, z + 0.28, [0.9, 0.5, 1], { cls: 2 });
      gqB('paint', b - 0.2, b, y0 + 0.95, y0 + 1.85, z - 0.33, z + 0.33, [0.06, 0.06, 0.08]); gqB('galNeon', b - 0.205, b - 0.2, y0 + 1.3, y0 + 1.8, z - 0.29, z + 0.29, c.map((v) => Math.min(1, v + 0.3))); }
    { const a = S.back + 1.3, b = xb, BC = [[0.95, 0.45, 0.6], [0.4, 0.75, 0.95], [0.95, 0.85, 0.3]]; for (const y of [1.2, 1.65, 2.1]) { gqB('wood', a, b, y0 + y - 0.03, y0 + y, Z(8.73), Z(o.dB), [0.5, 0.36, 0.24]); for (let x = a + 0.15; x < b - 0.1; x += 0.3) gqBall(x, y0 + y, Z(8.83), 0.1, BC[Math.floor(R() * 3)], 'canvas', 8); } }
    for (const [xw, c] of [[xa, [1, 0.3, 0.85]], [xb, [0.3, 0.9, 1]]]) gqB('galNeon', xw, xw + (xw === xa ? 0.03 : -0.03), top - 0.4, top - 0.36, Z(0.8), Z(8.6), c);
    wp('a', 4.75, y0 + 2.1, 0.6, 'arcade');
  } else if (k === 'hobby') {
    // tranches des boîtes de jeux sur les rayonnages du fond ; décor de figurines, plateau et dés sur les tables ; vitrine de figurines peintes
    const GBC = [[0.7, 0.15, 0.15], [0.15, 0.3, 0.6], [0.85, 0.7, 0.2], [0.2, 0.5, 0.3], [0.1, 0.1, 0.1], [0.85, 0.85, 0.8], [0.5, 0.2, 0.5]];
    along(x0 + 0.1, x1 - 0.1, (a, b) => { const zf = Z(8.57); for (const y of [0.3, 0.72, 1.14, 1.56]) { let x = a + 0.06; while (x < b - 0.2) { const w = 0.05 + R() * 0.1; gqB('paint', x, x + w, y0 + y, y0 + y + 0.2 + R() * 0.16, zf, zf - sg * 0.012, GBC[Math.floor(R() * GBC.length)], { cls: 2 }); x += w + 0.008; } } });
    { const x = x0 + 2.5, z = Z(3); gqB('rug', x - 0.7, x + 0.7, y0 + 0.8, y0 + 0.81, z - 0.42, z + 0.42, [0.3, 0.45, 0.25]);
      for (let i = 0; i < 6; i++) { const bx = x - 0.55 + R() * 1.1, bz = z - 0.3 + R() * 0.6; gqB('concrete', bx - 0.06, bx + 0.06, y0 + 0.81, y0 + 0.86 + R() * 0.12, bz - 0.04, bz + 0.04, [0.6, 0.6, 0.58], { rot: R() * 3 }); }
      for (let i = 0; i < 14; i++) gqCyl(x - 0.6 + R() * 1.2, y0 + 0.81, z - 0.35 + R() * 0.7, 0.012, 0.035, i % 2 ? [0.7, 0.15, 0.15] : [0.2, 0.3, 0.7], 'paint', 6, { cls: 2 }); }
    { const x = x0 + 6.5, z = Z(6.4); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) gqB('paint', x - 0.24 + i * 0.06, x - 0.18 + i * 0.06, y0 + 0.8, y0 + 0.805, z - 0.24 + j * 0.06, z - 0.18 + j * 0.06, (i + j) % 2 ? [0.9, 0.85, 0.7] : [0.3, 0.2, 0.12], { cls: 2 });
      for (let i = 0; i < 3; i++) gqB('plastic', x + 0.35 + i * 0.05, x + 0.37 + i * 0.05, y0 + 0.8, y0 + 0.82, z - 0.1 + i * 0.07, z - 0.08 + i * 0.07, [0.95, 0.95, 0.95], { rot: R() }); }
    { const d0 = 1.2, d1 = 3.4; gqCol(xb - 0.45, xb, y0, y0 + 1.9, Z(d0), Z(d1));
      gqB('wood', xb - 0.45, xb, y0, y0 + 0.85, Z(d0), Z(d1), [0.35, 0.24, 0.15]); gqB('wood', xb - 0.45, xb, y0 + 1.8, y0 + 1.9, Z(d0), Z(d1), [0.35, 0.24, 0.15]); gqB('glass', xb - 0.45, xb - 0.44, y0 + 0.85, y0 + 1.8, Z(d0), Z(d1), [0.8, 0.85, 0.9]);
      for (const y of [0.85, 1.15, 1.45]) { gqB('glass', xb - 0.44, xb - 0.02, y0 + y, y0 + y + 0.008, Z(d0), Z(d1), [0.85, 0.9, 0.92]); for (let i = 0; i < 9; i++) gqCyl(xb - 0.3 + R() * 0.2, y0 + y + 0.008, Z(d0 + 0.15 + i * 0.22), 0.015, 0.04, [[0.7, 0.2, 0.2], [0.75, 0.7, 0.3], [0.3, 0.5, 0.3]][i % 3], 'paint', 6); }
      gqB('galNeon', xb - 0.4, xb - 0.05, y0 + 1.78, y0 + 1.79, Z(d0 + 0.05), Z(d1 - 0.05), [1, 0.95, 0.85]); }
  } else if (k === 'security') {
    // vestiaires, lit de camp (on a dormi ici), table des radios et du café, claviers et tasses sur la console ; les disparus et l'avis d'évacuation au mur ouest
    { const d0 = 0.5, d1 = 2.5, lc = [0.42, 0.46, 0.52]; gqS('steel', xb - 0.46, xb, y0, y0 + 1.9, Z(d0), Z(d1), lc);
      for (let i = 0; i < 4; i++) { const zc = Z(d0 + 0.25 + i * 0.5); gqB('dark', xb - 0.465, xb - 0.46, y0 + 0.05, y0 + 1.85, zc + 0.24, zc + 0.25, [0.15, 0.15, 0.16]);
        for (let j = 0; j < 4; j++) gqB('dark', xb - 0.465, xb - 0.46, y0 + 1.5 + j * 0.06, y0 + 1.52 + j * 0.06, zc - 0.12, zc + 0.12, [0.15, 0.15, 0.16]); gqB('steel', xb - 0.49, xb - 0.46, y0 + 0.95, y0 + 1.1, zc + 0.15, zc + 0.18, [0.75, 0.75, 0.78]); } }
    { const a = xa + 0.25, b = xa + 2.15, z = Z(0.95); gqCol(a, b, y0, y0 + 0.42, z - 0.36, z + 0.36, 'dirt'); gqB('canvas', a, b, y0 + 0.34, y0 + 0.42, z - 0.36, z + 0.36, [0.36, 0.4, 0.26]);
      for (const x of [a + 0.05, b - 0.05]) for (const s of [-1, 1]) gqB('steel', x - 0.015, x + 0.015, y0, y0 + 0.36, z + s * 0.32 - 0.015, z + s * 0.32 + 0.015, [0.3, 0.3, 0.3]);
      gqB('canvas', a + 0.05, a + 0.5, y0 + 0.42, y0 + 0.52, z - 0.25, z + 0.25, [0.9, 0.9, 0.86]); gqB('canvas', a + 0.6, b - 0.1, y0 + 0.42, y0 + 0.47, z - 0.34, z + 0.3, [0.5, 0.18, 0.14], { rot: 0.05 }); }
    { const z0 = Z(4.8), z1 = Z(6.0); gqS('wood', xa, xa + 0.55, y0, y0 + 0.8, z0, z1, [0.45, 0.32, 0.2], 'wood');
      gqB('dark', xa + 0.1, xa + 0.35, y0 + 0.8, y0 + 1.15, Z(5.0), Z(5.3), [0.12, 0.12, 0.13]); gqCyl(xa + 0.22, y0 + 0.82, Z(5.15) - sg * 0.12, 0.06, 0.14, [0.6, 0.65, 0.7], 'glass', 10);
      for (let i = 0; i < 3; i++) { const z = Z(5.5 + i * 0.15); gqB('dark', xa + 0.2, xa + 0.3, y0 + 0.8, y0 + 0.86, z - 0.05, z + 0.05, [0.2, 0.2, 0.2]); gqB('dark', xa + 0.22, xa + 0.28, y0 + 0.86, y0 + 1.04, z - 0.025, z + 0.025, [0.08, 0.08, 0.08]); gqB('dark', xa + 0.265, xa + 0.275, y0 + 1.04, y0 + 1.16, z - 0.005, z + 0.005, [0.08, 0.08, 0.08]); gqB('galNeon', xa + 0.21, xa + 0.23, y0 + 0.845, y0 + 0.855, z - 0.01, z + 0.01, [0.3, 1, 0.4]); } }
    along(x0 + 1, x1 - 1, (a, b) => { for (let i = 0; i < 6; i++) { const x = x0 + 1.4 + i * 1.1; if (x - 0.3 < a || x + 0.3 > b) continue; const z = Z(7.65); gqB('dark', x - 0.22, x + 0.22, y0 + 0.9, y0 + 0.92, z - 0.07, z + 0.07, [0.1, 0.1, 0.11]); if (i % 2) gqCyl(x + 0.36, y0 + 0.9, z, 0.04, 0.1, [0.85, 0.85, 0.82], 'plastic', 10); } });
    wp('a', 3.0, y0 + 2.0, 0.85, 'missing'); wp('a', 6.9, y0 + 1.7, 0.45, 'evac');
  } else if (k === 'home') {
    // tapis sous les canapés, lampadaires, panneau à outils au-dessus du comptoir, pots de peinture, suspensions en vente, meubles en kit
    for (const dx of [2.5, 6.5]) { const x = x0 + dx, z = Z(2.8); gqB('rug', x - 1.2, x + 1.2, y0 + 0.025, y0 + 0.032, z - 0.85, z + 0.85, [0.55, 0.22, 0.16], { cls: 2 }); gqB('rug', x - 1.0, x + 1.0, y0 + 0.032, y0 + 0.034, z - 0.65, z + 0.65, [0.85, 0.75, 0.55], { cls: 2 }); }
    gqFloorLamp(x0 + 0.9, y0, Z(2.2)); gqFloorLamp(x1 - 0.9, y0, Z(2.2), [0.85, 0.92, 0.95]);
    { const a = S.back + 1.3, b = x1 - 1.7, z = Z(o.dB); gqB('wood', a, b, y0 + 1.15, y0 + 2.4, z, z - sg * 0.015, [0.72, 0.58, 0.4]); const zt = z - sg * 0.03;
      for (let x = a + 0.15, i = 0; x < b - 0.15; x += 0.28, i++) { if (i % 3 === 0) { gqB('wood', x - 0.015, x + 0.015, y0 + 1.5, y0 + 1.82, zt - 0.015, zt + 0.015, [0.55, 0.36, 0.2]); gqB('steel', x - 0.06, x + 0.06, y0 + 1.82, y0 + 1.86, zt - 0.02, zt + 0.02, [0.3, 0.3, 0.32]); } else if (i % 3 === 1) gqB('steel', x - 0.1, x + 0.1, y0 + 1.95, y0 + 2.2, zt - 0.004, zt + 0.004, [0.75, 0.76, 0.78]); else gqB('steel', x - 0.015, x + 0.015, y0 + 1.35, y0 + 1.6, zt - 0.006, zt + 0.006, [0.6, 0.62, 0.65]); } }
    { const a = x0 + 2.1, b = S.back - 1.3; for (let x = a + 0.12; x < b - 0.1; x += 0.24) gqCyl(x, y0 + 1.0, Z(8.4), 0.09, 0.2, PC[Math.floor(R() * 5)], 'steel', 12); }
    for (let i = 0; i < 4; i++) gqShade(x0 + 2.5 + i * 1.4, top - 1.5 - (i % 2) * 0.3, Z(6.9), top, [[0.2, 0.3, 0.25], [0.85, 0.85, 0.82], [0.7, 0.3, 0.15], [0.15, 0.15, 0.16]][i]);
    { gqCol(x1 - 1.45, xb, y0, y0 + 0.38, Z(0.35), Z(1.4), 'wood'); for (let j = 0; j < 3; j++) gqB('cardboard', x1 - 1.45 + j * 0.03, xb - j * 0.02, y0 + j * 0.125, y0 + (j + 1) * 0.125, Z(0.35 + j * 0.04), Z(1.4 - j * 0.03), [0.62, 0.48, 0.32], { cls: 0 }); }
  } else if (k === 'salon') {
    // séchoirs à casque au mur ouest, bacs à shampoing au mur est, flacons et sèche-cheveux sur les postes, ampoules autour des miroirs, produits
    for (const d of [3.2, 5.0]) { const z = Z(d), x = xa + 0.45, c = [0.85, 0.3, 0.45]; gqCol(x - 0.36, x + 0.35, y0, y0 + 0.5, z - 0.3, z + 0.3, 'dirt');
      gqB('canvas', x - 0.3, x + 0.3, y0 + 0.38, y0 + 0.5, z - 0.28, z + 0.28, c); gqB('canvas', x - 0.36, x - 0.24, y0 + 0.5, y0 + 1.05, z - 0.28, z + 0.28, c);
      gqCyl(x, y0, z, 0.2, 0.04, [0.6, 0.6, 0.62]); gqCyl(x, y0 + 0.04, z, 0.04, 0.34, [0.6, 0.6, 0.62]); gqB('steel', x - 0.38, x - 0.32, y0 + 1.05, y0 + 1.45, z - 0.03, z + 0.03, [0.6, 0.6, 0.62]);
      M.save().color([0.92, 0.9, 0.95]).move(x - 0.1, y0 + 1.2, z); M.cls = 1; M.lathe('plastic', [[0.26, 0], [0.27, 0.12], [0.22, 0.26], [0.1, 0.34], [0.004, 0.36]], 14); M.restore(); }
    for (const d of [3.6, 5.4]) { const z = Z(d); gqS('paint', xb - 0.55, xb, y0, y0 + 0.85, z - 0.35, z + 0.35, [0.15, 0.15, 0.16]); gqCyl(xb - 0.3, y0 + 0.85, z, 0.2, 0.06, [0.95, 0.95, 0.95], 'plastic', 14);
      gqB('steel', xb - 0.08, xb - 0.03, y0 + 0.85, y0 + 1.15, z - 0.02, z + 0.02, [0.8, 0.8, 0.82]); gqB('steel', xb - 0.25, xb - 0.03, y0 + 1.12, y0 + 1.15, z - 0.015, z + 0.015, [0.8, 0.8, 0.82]); }
    for (const y of [1.45, 1.85]) { gqB('wood', xb - 0.2, xb, y0 + y - 0.025, y0 + y, Z(3.0), Z(6.0), [0.95, 0.95, 0.95]); for (let i = 0; i < 12; i++) gqCyl(xb - 0.1, y0 + y, Z(3.15 + i * 0.24), 0.03, 0.1 + (i % 3) * 0.04, PC[i % 5], 'plastic', 8); }
    for (let i = 0; i < 3; i++) { const x = x0 + 1.5 + i * 2.2, z = Z(8.6), zf = z - sg * 0.28;
      for (const s of [-1, 1]) for (let j = 0; j < 4; j++) gqB('lamp', x + s * 0.53 - 0.025, x + s * 0.53 + 0.025, y0 + 1.25 + j * 0.27, y0 + 1.3 + j * 0.27, zf - 0.02, zf + 0.02, null, { ao: false });
      for (let j = 0; j < 3; j++) gqCyl(x - 0.4 + j * 0.09, y0 + 0.85, z, 0.028, 0.14 + j * 0.03, PC[(i + j) % 5], 'plastic', 8);
      gqB('dark', x + 0.15, x + 0.33, y0 + 0.85, y0 + 0.93, z - 0.05, z + 0.05, [0.12, 0.12, 0.13]); gqCyl(x + 0.3, y0 + 0.89, z, 0.035, 0.12, [0.12, 0.12, 0.13], 'plastic', 8, { rz: -Math.PI / 2 }); }
    wp('a', 6.9, y0 + 1.8, 0.55, 'mode');
  } else if (k === 'music') {
    // bacs à disques sur les tables, guitares au mur est, platine sur le comptoir, borne d'écoute, mur de pochettes au fond
    const SC = [[0.85, 0.2, 0.15], [0.1, 0.1, 0.1], [0.95, 0.85, 0.3], [0.2, 0.4, 0.8], [0.9, 0.9, 0.88], [0.6, 0.2, 0.6], [0.2, 0.6, 0.4]], wd = [0.5, 0.36, 0.22];
    for (const x of [x0 + 3.5, x0 + 5.5]) for (const [dx, dd] of [[-0.28, 3.5], [0.28, 3.5], [-0.28, 4.5], [0.28, 4.5]]) {
      const cx = x + dx, cz = Z(dd), yb = y0 + 0.8;
      gqB('wood', cx - 0.25, cx + 0.25, yb, yb + 0.02, cz - 0.5, cz + 0.5, wd); for (const s of [-1, 1]) { gqB('wood', cx + s * 0.24 - 0.01, cx + s * 0.24 + 0.01, yb, yb + 0.32, cz - 0.5, cz + 0.5, wd); gqB('wood', cx - 0.25, cx + 0.25, yb, yb + 0.32, cz + s * 0.49 - 0.01, cz + s * 0.49 + 0.01, wd); }
      for (let i = 0; i < 36; i++) { const z = cz - 0.44 + i * 0.025; gqB('paint', cx - 0.155, cx + 0.155, yb + 0.02, yb + 0.33, z - 0.003, z + 0.003, SC[Math.floor(R() * SC.length)], { cls: 2 }); }
    }
    for (let i = 0; i < 4; i++) { const z = Z(4.4 + i * 1.0), y = y0 + 1.35, c = [[0.75, 0.35, 0.1], [0.08, 0.08, 0.08], [0.75, 0.1, 0.1], [0.92, 0.9, 0.85]][i];
      gqCyl(xb - 0.04, y, z, 0.17, 0.06, c, 'wood', 14, { rz: Math.PI / 2 }); gqCyl(xb - 0.04, y + 0.26, z, 0.13, 0.06, c, 'wood', 14, { rz: Math.PI / 2 });
      gqB('wood', xb - 0.11, xb - 0.08, y + 0.3, y + 0.95, z - 0.025, z + 0.025, [0.35, 0.22, 0.12]); gqB('wood', xb - 0.11, xb - 0.08, y + 0.95, y + 1.1, z - 0.04, z + 0.04, [0.15, 0.1, 0.06]);
      gqB('steel', xb - 0.08, xb, y + 0.98, y + 1.0, z - 0.01, z + 0.01, [0.6, 0.6, 0.6]); gqB('dark', xb - 0.105, xb - 0.1, y - 0.05, y + 0.05, z - 0.04, z + 0.04, [0.1, 0.1, 0.1]); }
    { const x = x1 - 1.2, z = Z(1.6); gqB('paint', x - 0.23, x + 0.23, y0 + 1.0, y0 + 1.08, z - 0.18, z + 0.18, [0.12, 0.12, 0.13]); gqCyl(x - 0.04, y0 + 1.08, z, 0.15, 0.015, [0.2, 0.2, 0.2], 'steel', 20); gqCyl(x - 0.04, y0 + 1.095, z, 0.148, 0.004, [0.04, 0.04, 0.04], 'rubber', 20); gqCyl(x - 0.04, y0 + 1.099, z, 0.04, 0.002, [0.95, 0.5, 0.1], 'paint', 12); gqB('steel', x + 0.06, x + 0.18, y0 + 1.1, y0 + 1.115, z + 0.08, z + 0.095, [0.75, 0.75, 0.78], { rot: 0.5 }); }
    { gqS('paint', xa, xa + 0.4, y0, y0 + 1.3, Z(6.6), Z(7.4), [0.1, 0.1, 0.11]); gqB('galTV', xa + 0.4, xa + 0.404, y0 + 1.0, y0 + 1.2, Z(6.85), Z(7.15), [1, 1, 1]); gqPhones(xa + 0.4, y0 + 0.82, Z(7.0), 1, [0.08, 0.08, 0.08]); }
    { const a = xa + 0.1, b = x1 - 2.3, z = Z(o.dB) - sg * 0.004; for (let x = a; x < b - 0.32; x += 0.34) for (const y of [1.5, 1.88, 2.26]) { const c = SC[Math.floor(R() * SC.length)]; gqB('paint', x, x + 0.31, y0 + y, y0 + y + 0.31, z, z - sg * 0.006, c, { cls: 2 }); gqB('paint', x + 0.08, x + 0.23, y0 + y + 0.08, y0 + y + 0.23, z - sg * 0.006, z - sg * 0.008, SC[(SC.indexOf(c) + 3) % SC.length], { cls: 2 }); } }
    wp('a', 1.5, y0 + 1.9, 0.6, 'music');
  } else if (k === 'cinema') {
    // les affiches des films dans leurs cadres, machine à pop-corn et fontaine sur la confiserie, files d'attente devant les caisses, un présentoir en carton
    for (let i = 0; i < 4; i++) { const x = x0 + 1.2 + i * 2.6, z = Z(8.83); gPoster(x, y0 + 2.05, z - sg * 0.004, 0.8, 0, -sg, GQ.po[i % 2 ? 'filmB' : 'filmA']); gqB('lamp', x - 0.5, x + 0.5, y0 + 2.93, y0 + 2.96, z - sg * 0.07, z, null, { ao: false }); }
    { const x = x0 + 2.2, z = Z(6.5), red = [0.75, 0.08, 0.08]; gqB('paint', x - 0.32, x + 0.32, y0 + 1.0, y0 + 1.15, z - 0.25, z + 0.25, red); gqB('paint', x - 0.3, x + 0.3, y0 + 1.15, y0 + 1.42, z - 0.23, z + 0.23, [1, 0.85, 0.35]);
      gqB('glass', x - 0.32, x + 0.32, y0 + 1.15, y0 + 1.8, z - 0.25, z + 0.25, [0.9, 0.92, 0.95]); gqB('paint', x - 0.34, x + 0.34, y0 + 1.8, y0 + 1.92, z - 0.27, z + 0.27, red); gqB('galNeon', x - 0.3, x + 0.3, y0 + 1.83, y0 + 1.9, z - sg * 0.275, z - sg * 0.27, [1, 0.9, 0.4]); gqCyl(x, y0 + 1.6, z, 0.1, 0.12, [0.7, 0.7, 0.72], 'steel', 10); }
    { const x = x0 + 4.4, z = Z(6.5); gqB('steel', x - 0.3, x + 0.3, y0 + 1.0, y0 + 1.65, z - 0.2, z + 0.25, [0.75, 0.75, 0.78]); gqB('galNeon', x - 0.28, x + 0.28, y0 + 1.45, y0 + 1.6, z - sg * 0.21, z - sg * 0.2, [0.3, 0.7, 1]);
      for (let i = 0; i < 4; i++) gqB('dark', x - 0.22 + i * 0.13, x - 0.18 + i * 0.13, y0 + 1.25, y0 + 1.3, z - sg * 0.21, z - sg * 0.28, [0.1, 0.1, 0.1]);
      for (let i = 0; i < 3; i++) gqCyl(x + 0.45 + i * 0.12, y0 + 1.0, z, 0.045, 0.3, [0.95, 0.95, 0.95], 'plastic', 10, { r1: 0.055 }); }
    { const gold = [0.85, 0.68, 0.3], red = [0.55, 0.05, 0.08]; for (const d of [1.3, 2.4]) { const xs = [x0 + 7.7, x0 + 8.95, x0 + 10.2, x0 + 11.45], z = Z(d);
      for (const x of xs) { gqCyl(x, y0, z, 0.12, 0.03, gold, 'steel', 12); gqCyl(x, y0 + 0.03, z, 0.022, 0.92, gold, 'steel', 8); gqBall(x, y0 + 0.95, z, 0.035, gold, 'steel', 8); }
      for (let i = 0; i < xs.length - 1; i++) { const pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8; pts.push([lerp(xs[i], xs[i + 1], t), y0 + 0.88 - Math.sin(t * Math.PI) * 0.14, z]); } gqTube('canvas', 0.018, pts, red); } } }
    { const x = x0 + 1.0, z = Z(1.4); gPoster(x, y0 + 0.85, z, 0.75, 0, -sg, GQ.po.filmB); gqB('cardboard', x - 0.375, x + 0.375, y0 + 0.1, y0 + 1.6, z + sg * 0.002, z + sg * 0.008, [0.6, 0.55, 0.5]); gqB('cardboard', x - 0.02, x + 0.02, y0, y0 + 1.0, z + sg * 0.008, z + sg * 0.45, [0.6, 0.55, 0.5]); }
    wp('a', 3.0, y0 + 2.0, 0.6, 'filmB'); wp('b', 6.0, y0 + 2.0, 0.6, 'filmA');
  } else if (k === 'cafe') {
    // vitrine à pâtisseries sur le comptoir, l'ardoise au mur, comptoir et tabourets au mur est, sacs de café, suspensions au-dessus du comptoir
    { const x = x0 + 4.4, z = Z(7.2); gqB('glass', x - 1.0, x + 1.0, y0 + 1.0, y0 + 1.42, z - 0.3, z + 0.3, [0.88, 0.92, 0.95]); gqB('galNeon', x - 0.95, x + 0.95, y0 + 1.4, y0 + 1.41, z - 0.25, z + 0.25, [1, 0.92, 0.8]); gqB('steel', x - 0.98, x + 0.98, y0 + 1.2, y0 + 1.21, z - 0.28, z + 0.28, [0.85, 0.85, 0.85]);
      for (let i = 0; i < 14; i++) gqBall(x - 0.85 + (i % 7) * 0.28, y0 + (i < 7 ? 1.0 : 1.21), z + (R() - 0.5) * 0.3, 0.05 + R() * 0.02, [[0.85, 0.6, 0.3], [0.6, 0.35, 0.18], [0.95, 0.85, 0.6]][i % 3], 'canvas', 8); }
    gPosterF(x0 + 3.5, y0 + 2.9, Z(o.dB), 1.0, 0, -sg, GQ.po.menu, 'all', [0.3, 0.2, 0.12]);
    { gqB('wood', xb - 0.38, xb, y0 + 1.02, y0 + 1.07, Z(1.5), Z(6.5), [0.5, 0.36, 0.24]); for (const d of [2.0, 4.0, 6.0]) gqB('steel', xb - 0.3, xb, y0 + 0.9, y0 + 1.02, Z(d) - 0.02, Z(d) + 0.02, [0.3, 0.3, 0.3]);
      for (const d of [2.0, 3.2, 4.4, 5.6]) { const x = xb - 0.7, z = Z(d); gqCol(x - 0.17, x + 0.17, y0, y0 + 0.77, z - 0.17, z + 0.17); gqCyl(x, y0, z, 0.18, 0.03, [0.3, 0.3, 0.32]); gqCyl(x, y0 + 0.03, z, 0.025, 0.69, [0.3, 0.3, 0.32]); gqCyl(x, y0 + 0.72, z, 0.17, 0.05, [0.45, 0.3, 0.2], 'rug', 12); } }
    for (let i = 0; i < 3; i++) gqB('canvas', x0 + 0.2 + (i % 2) * 0.3, x0 + 0.75 + (i % 2) * 0.3, y0 + Math.floor(i / 2) * 0.3, y0 + Math.floor(i / 2) * 0.3 + 0.3, Z(7.9 + (i % 2) * 0.2), Z(8.7), [0.62, 0.5, 0.34], { bevel: 0.06, cls: 0 });
    for (let i = 0; i < 3; i++) gqShade(x0 + 2 + i * 1.6, y0 + 3.0, Z(7.2), top, [0.18, 0.32, 0.26]);
  } else if (k === 'clinic') {
    // rideaux entre les lits (rails au plafond), pieds à perfusion, chaises d'attente, fauteuil roulant, chariot d'instruments, compresses au sol
    for (const [bx, s] of [[x0 + 2.5, 1], [x0 + 6, -1]]) { const xr = bx + s * 0.85, cur = [0.62, 0.8, 0.78];
      gqB('steel', xr - 0.012, xr + 0.012, top - 0.05, top - 0.02, Z(4.4), Z(7.6), [0.7, 0.7, 0.72]); gqB('canvas', xr - 0.01, xr + 0.01, y0 + 0.35, y0 + 2.3, Z(4.6), Z(7.4), cur);
      for (let dd = 4.6; dd < 7.4; dd += 0.3) gqB('canvas', xr - 0.035, xr + 0.035, y0 + 0.35, y0 + 2.3, Z(dd) - 0.006, Z(dd) + 0.006, [0.56, 0.74, 0.72], { cls: 2 });
      for (let dd = 4.7; dd < 7.4; dd += 0.6) gqB('steel', xr - 0.003, xr + 0.003, y0 + 2.3, top - 0.05, Z(dd) - 0.003, Z(dd) + 0.003, [0.7, 0.7, 0.72], { cls: 2 });
      const xi = bx - s * 0.65, zi = Z(5.3); gqCyl(xi, y0, zi, 0.2, 0.03, [0.7, 0.7, 0.72]); gqCyl(xi, y0 + 0.03, zi, 0.014, 1.92, [0.8, 0.8, 0.82], 'steel', 6); gqB('steel', xi - 0.12, xi + 0.12, y0 + 1.9, y0 + 1.92, zi - 0.006, zi + 0.006, [0.8, 0.8, 0.82]);
      gqB('plastic', xi + 0.06, xi + 0.14, y0 + 1.6, y0 + 1.86, zi - 0.03, zi + 0.03, [0.85, 0.9, 0.95]); gqB('plastic', xi + 0.098, xi + 0.102, y0 + 0.9, y0 + 1.6, zi - 0.002, zi + 0.002, [0.9, 0.9, 0.92]); }
    { const a = xa, b = xa + 0.52, c = [0.3, 0.55, 0.6]; gqCol(a, b, y0, y0 + 0.45, Z(2.4), Z(4.2), 'dirt');
      for (let i = 0; i < 3; i++) { const z0 = Z(2.45 + i * 0.6), z1 = Z(2.95 + i * 0.6); gqB('plastic', a + 0.04, b, y0 + 0.4, y0 + 0.46, z0, z1, c); gqB('plastic', a, a + 0.06, y0 + 0.46, y0 + 0.95, z0, z1, c); for (const zz of [z0, z1]) gqB('steel', b - 0.04, b - 0.02, y0, y0 + 0.4, zz - 0.01, zz + 0.01, [0.6, 0.6, 0.62]); } }
    { const x = x1 - 1.1, z = Z(0.85); gqParts(x, y0, z, 0, [['canvas', 0, 0.45, 0, 0.42, 0.06, 0.42, [0.15, 0.2, 0.3]], ['canvas', 0, 0.5, sg * 0.2, 0.42, 0.45, 0.04, [0.15, 0.2, 0.3]], ['steel', 0, 0.1, -sg * 0.25, 0.3, 0.02, 0.12, [0.6, 0.6, 0.62]]]);
      for (const s of [-1, 1]) { gqCyl(x + s * 0.24, y0 + 0.3, z + sg * 0.05, 0.3, 0.025, [0.12, 0.12, 0.12], 'rubber', 16, { rz: s * Math.PI / 2 }); gqCyl(x + s * 0.18, y0 + 0.07, z - sg * 0.22, 0.07, 0.02, [0.12, 0.12, 0.12], 'rubber', 10, { rz: s * Math.PI / 2 }); } }
    { const x = x1 - 1.6, z = Z(6.6); gqB('steel', x - 0.3, x + 0.3, y0 + 0.85, y0 + 0.87, z - 0.2, z + 0.2, [0.8, 0.8, 0.82]); gqB('steel', x - 0.3, x + 0.3, y0 + 0.3, y0 + 0.32, z - 0.2, z + 0.2, [0.8, 0.8, 0.82]); for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) gqB('steel', x + sx * 0.28 - 0.01, x + sx * 0.28 + 0.01, y0, y0 + 0.87, z + sz * 0.18 - 0.01, z + sz * 0.18 + 0.01, [0.8, 0.8, 0.82]);
      for (let i = 0; i < 4; i++) gqB('steel', x - 0.2 + i * 0.1, x - 0.16 + i * 0.1, y0 + 0.87, y0 + 0.88, z - 0.1, z + 0.08, [0.85, 0.86, 0.9]); }
    for (let i = 0; i < 6; i++) { const x = x0 + 2.5 + (R() - 0.5) * 1.6, z = Z(4.4 + R() * 0.8); gqB('canvas', x - 0.06, x + 0.06, y0 + 0.025, y0 + 0.03, z - 0.06, z + 0.06, i % 3 ? [0.95, 0.95, 0.93] : [0.6, 0.1, 0.1], { rot: R() * 3, cls: 2 }); }
    gqB('paint', x1 - 0.62, x1 - 0.6, y0 + 1.3, y0 + 1.5, Z(8.2) - 0.1, Z(8.2) + 0.1, [0.85, 0.12, 0.1]);
    wp('b', 4.0, y0 + 1.8, 0.55, 'pharma');
  }
}
