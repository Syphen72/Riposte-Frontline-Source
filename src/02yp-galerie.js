/* ==========================================================================
   CARTE « HALCYON » (Breachline 6.3, survie : MODES.zombie, 09ia-survie.js) : une galerie marchande de deux étages, la nuit, que les morts
   assiègent. Une carte originale : ni enseigne réelle, ni plan d'un lieu existant.
   Le plan (x d'ouest en est, z du nord au sud ; le parking est au sud) :
   - au centre, la galerie : un mail de 18 m de large sur deux niveaux, l'atrium ouvert sur toute sa hauteur au milieu (deux puits de lumière,
     une passerelle entre les deux), deux escaliers mécaniques à l'arrêt, des coursives de 5 m à l'étage, garde-corps de verre ;
   - de chaque côté du mail, une rangée de boutiques sur chaque niveau (dix-neuf en tout), chacune sa vitrine sur le mail (un rideau ajouré
     qu'on baisse ou qu'on lève, des planches par-dessus) et, au rez-de-chaussée et à l'étage nord, sa porte du fond sur le couloir de service ;
   - derrière les boutiques, les couloirs de service : au nord sur les deux niveaux, au sud au rez-de-chaussée (en deux moitiés, de part et
     d'autre du hall d'entrée), reliés par le quai de réception (double hauteur, deux rideaux de quai, un escalier de service, une mezzanine)
     et par des portes coupe-feu à la limite de chaque aile ; issues de secours, entrée du personnel, un placard d'entretien ;
   - à l'ouest, le grand magasin (Whitcombe, deux niveaux, sa réserve et sa cage cadenassée) ; à l'est, la restauration (double hauteur,
     quatre comptoirs et leurs cuisines) ; au nord, la cour de livraison et le camion du quai ; au sud, le parking.
   Défense en couches : les entrées du dehors (portes vitrées fragiles, portes d'acier, rideaux de quai), puis les couloirs de service, puis
   les boutiques (porte du fond, rideau de la vitrine), puis le mail ; le poste de sécurité (étage nord) baisse les rideaux coupe-feu d'une
   aile, avec le courant (le groupe électrogène du quai). Les murs des couloirs de service cèdent en milieu de partie (pans à brèche).
   Les morts (07g-zombies.js) font le siège : ceux qui ne sentent personne marchent sur une entrée et la forcent ; une fois dedans, ils
   cherchent les vivants par le chemin le moins coûteux, et passent par les couloirs de service quand le mail est fermé.
   Grille de navigation (1 m, centres des cases en x,5) : les murs minces (14 cm) sont posés sur des entiers, les portes centrées sur des
   centres de case, les meubles d'une boutique sur des centres de case aussi (une allée de 2,4 m garde deux rangées de nœuds).
   ========================================================================== */
const GAL = { R: null, splat: null, breaks: [], t: 0 };
/* Le bâtiment : murs extérieurs (faces intérieures), limites des rangées, de l'aile du grand magasin et de la restauration ; hauteur de l'étage
   (SL), du plafond du rez-de-chaussée (CL), du toit (TOP) ; épaisseur des cloisons (TW) */
const GL = { X0: -38, X1: 38, Z0: -21, Z1: 21, SL: 5.0, CL: 4.6, RF: 9.6, TW: 0.14, nb: -18, nf: -9, sf: 9, sb: 18, ax: -24, fx: 24 };
const GPAL = { wall: [0.86, 0.84, 0.8], wall2: [0.78, 0.8, 0.82], srv: [0.7, 0.7, 0.68], floor: [0.8, 0.78, 0.74], slab: [0.9, 0.89, 0.86], ext: [0.62, 0.6, 0.57], trim: [0.2, 0.21, 0.23], steel: [0.55, 0.57, 0.6] };
/* Enseignes : atlas de 4 × 8 cases de 512 × 128 */
const GSN = { sport: 0, pharma: 1, elec: 2, jouets: 3, mode: 4, chaussures: 5, bijoux: 6, livres: 7, animaux: 8, superette: 9, arcade: 10, jeux: 11, securite: 12, maison: 13, salon: 14, disques: 15, cinema: 16, cafe: 17, soins: 18, whitcombe: 19, napoli: 20, smokehouse: 21, wok: 22, brew: 23, halcyon: 24, sortie: 25, restau: 26, prive: 27, plan: 28, soldes: 29, parking: 30, livraison: 31 };
const GSN_CELL = (i) => [(i % 4) * 512, Math.floor(i / 4) * 128, 512, 128];
/* Noms des enseignes (propres, les mêmes dans les deux langues) */
const GNAME = { sport: 'Ridgeback', pharma: 'Meridian', elec: 'Voltix', jouets: 'Zigzag', mode: 'Maison Vela', chaussures: 'Stride', bijoux: 'Lumière', livres: 'Inkwell', animaux: 'Paws & Co', superette: 'Corner 24', arcade: 'Pixel Palace', jeux: 'Tabletop', securite: '', maison: 'Hearth & Home', salon: 'Gloss', disques: 'Vinyl Vault', cinema: 'Ciné Halcyon', cafe: 'Daybreak', soins: 'Halcyon Care', whitcombe: 'Whitcombe', napoli: 'Napoli', smokehouse: 'Smokehouse', wok: 'Golden Wok', brew: 'Brew & Bean' };

/* ---------- Enseignes, écrans, vitres : matières propres à la carte ---------- */
function galSignAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d'), R = rngOf(6301);
  const SANS = 'Arial, Helvetica, sans-serif', SERIF = 'Georgia, "Times New Roman", serif', DISP = 'Impact, "Arial Black", sans-serif';
  const text = (s, cx, cy, size, col, maxW, font = SANS, weight = 'bold', style = '') => {
    g.font = `${style} ${weight} ${size}px ${font}`; const w = g.measureText(s).width, fs = w > maxW ? (size * maxW) / w : size;
    g.font = `${style} ${weight} ${fs}px ${font}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, cx, cy);
  };
  const cell = (i, bg, draw) => { const [x, y, w, h] = GSN_CELL(i); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = bg; g.fillRect(x, y, w, h); draw(x, y, w, h); g.restore(); };
  const cross = (cx, cy, s, col) => { g.fillStyle = col; g.fillRect(cx - s * 0.18, cy - s / 2, s * 0.36, s); g.fillRect(cx - s / 2, cy - s * 0.18, s, s * 0.36); };
  const logo = (i, bg, fg, name, font, o = {}) => cell(i, bg, (x, y, w, h) => {
    if (o.band) { g.fillStyle = o.band; g.fillRect(x, y + h - 18, w, 18); }
    if (o.icon) o.icon(x, y, w, h);
    text(o.caps === false ? name : name.toUpperCase(), x + w / 2 + (o.dx || 0), y + h / 2 + (o.dy || 0), o.size || 74, fg, w - (o.pad || 70), font, o.weight || 'bold', o.style || '');
    if (o.sub) text(o.sub, x + w / 2 + (o.dx || 0), y + h - 22, 20, o.subCol || fg, w - 80, SANS, 'bold');
  });
  logo(GSN.sport, '#1f3b2c', '#efe6cf', 'Ridgeback', DISP, { dx: 30, icon: (x, y) => { g.fillStyle = '#d98b2b'; g.beginPath(); g.moveTo(x + 30, y + 98); g.lineTo(x + 70, y + 34); g.lineTo(x + 92, y + 66); g.lineTo(x + 108, y + 46); g.lineTo(x + 138, y + 98); g.closePath(); g.fill(); }, sub: 'OUTDOOR · SPORT' });
  logo(GSN.pharma, '#f4f6f2', '#1d7a46', 'Meridian', SANS, { dx: 40, icon: (x, y) => cross(x + 70, y + 64, 74, '#21a35a') });
  logo(GSN.elec, '#0b0d14', '#4fc3ff', 'Voltix', DISP, { size: 88, icon: (x, y) => { g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(x + 70, y + 20); g.lineTo(x + 46, y + 70); g.lineTo(x + 66, y + 70); g.lineTo(x + 54, y + 112); g.lineTo(x + 92, y + 54); g.lineTo(x + 72, y + 54); g.closePath(); g.fill(); } });
  cell(GSN.jouets, '#ffd23a', (x, y, w, h) => { const L = 'ZIGZAG', C = ['#e63b2e', '#2b6fd6', '#2fa84f', '#8e3bd6', '#ff7a1a', '#e63b2e']; g.font = `bold 84px ${DISP}`; g.textBaseline = 'middle'; let px = x + 92; for (let i = 0; i < L.length; i++) { g.save(); g.translate(px, y + h / 2 + (i % 2 ? -6 : 6)); g.rotate((i % 2 ? -1 : 1) * 0.08); g.fillStyle = C[i]; g.textAlign = 'center'; g.fillText(L[i], 0, 0); g.restore(); px += 66; } });
  logo(GSN.mode, '#111111', '#f2efe8', 'Maison Vela', SERIF, { weight: 'normal', size: 66, caps: false, style: 'italic' });
  logo(GSN.chaussures, '#c9241d', '#ffffff', 'Stride', SANS, { style: 'italic', size: 90 });
  logo(GSN.bijoux, '#2a1638', '#e6c46a', 'Lumière', SERIF, { weight: 'normal', size: 80, caps: false });
  logo(GSN.livres, '#1b2a4a', '#f0e6cc', 'Inkwell', SERIF, { size: 78, sub: 'BOOKS · LIVRES', subCol: '#c9b98f' });
  logo(GSN.animaux, '#147a78', '#ffffff', 'Paws & Co', SANS, { dx: 34, icon: (x, y) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 72, y + 76, 20, 0, TAU); g.fill(); for (const [a, b] of [[-26, -22], [-9, -34], [9, -34], [26, -22]]) { g.beginPath(); g.arc(x + 72 + a, y + 76 + b, 9, 0, TAU); g.fill(); } } });
  cell(GSN.superette, '#ffffff', (x, y, w, h) => { g.fillStyle = '#ef6c1a'; g.fillRect(x, y, 150, h); text('24', x + 75, y + h / 2, 90, '#ffffff', 130, DISP); text('CORNER', x + 330, y + h / 2, 80, '#2a2a2a', 320, DISP); });
  cell(GSN.arcade, '#08060f', (x, y, w, h) => { g.shadowColor = '#ff3bd4'; g.shadowBlur = 18; text('PIXEL', x + 150, y + h / 2, 70, '#ff5ad9', 230, '"Courier New", monospace'); g.shadowColor = '#3be8ff'; text('PALACE', x + 370, y + h / 2, 70, '#5af0ff', 230, '"Courier New", monospace'); });
  logo(GSN.jeux, '#5a1414', '#e8c873', 'Tabletop', SERIF, { size: 74, icon: (x, y) => { g.fillStyle = '#e8c873'; g.save(); g.translate(x + 58, y + 64); g.rotate(0.3); g.fillRect(-26, -26, 52, 52); g.fillStyle = '#5a1414'; for (const [a, b] of [[-12, -12], [12, 12], [0, 0]]) { g.beginPath(); g.arc(a, b, 6, 0, TAU); g.fill(); } g.restore(); }, dx: 30 });
  cell(GSN.securite, '#16233d', (x, y, w, h) => { g.fillStyle = '#d9b44a'; g.beginPath(); g.moveTo(x + w / 2, y + 14); g.lineTo(x + w / 2 + 46, y + 30); g.quadraticCurveTo(x + w / 2 + 44, y + 92, x + w / 2, y + 116); g.quadraticCurveTo(x + w / 2 - 44, y + 92, x + w / 2 - 46, y + 30); g.closePath(); g.fill(); g.fillStyle = '#16233d'; g.beginPath(); g.arc(x + w / 2, y + 62, 16, 0, TAU); g.fill(); g.fillStyle = '#9fb2d6'; g.fillRect(x + 30, y + 58, 150, 8); g.fillRect(x + w - 180, y + 58, 150, 8); });
  logo(GSN.maison, '#5b3a22', '#f3e7cf', 'Hearth & Home', SERIF, { size: 62, caps: false });
  logo(GSN.salon, '#f2b8c6', '#1a1a1a', 'Gloss', SERIF, { size: 92, style: 'italic', weight: 'normal', caps: false });
  logo(GSN.disques, '#0c0c0c', '#ff8a1f', 'Vinyl Vault', DISP, { dx: 40, icon: (x, y) => { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x + 70, y + 64, 46, 0, TAU); g.fill(); g.strokeStyle = '#444'; g.lineWidth = 2; for (const r of [20, 30, 40]) { g.beginPath(); g.arc(x + 70, y + 64, r, 0, TAU); g.stroke(); } g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(x + 70, y + 64, 12, 0, TAU); g.fill(); } });
  cell(GSN.cinema, '#7a0f12', (x, y, w, h) => { g.fillStyle = '#f5d36b'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(x + 20 + i * 27.5, y + 10, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 20 + i * 27.5, y + h - 10, 5, 0, TAU); g.fill(); } text('CINÉ HALCYON', x + w / 2, y + h / 2, 70, '#fff2cf', w - 60, DISP); });
  logo(GSN.cafe, '#f3ead8', '#5b3620', 'Daybreak', SERIF, { dx: 36, size: 72, caps: false, icon: (x, y) => { g.fillStyle = '#e8902a'; g.beginPath(); g.arc(x + 72, y + 80, 30, Math.PI, TAU); g.fill(); g.strokeStyle = '#e8902a'; g.lineWidth = 5; for (let k = 0; k < 5; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 5; g.beginPath(); g.moveTo(x + 72 + Math.cos(a) * 38, y + 80 + Math.sin(a) * 38); g.lineTo(x + 72 + Math.cos(a) * 52, y + 80 + Math.sin(a) * 52); g.stroke(); } } });
  logo(GSN.soins, '#ffffff', '#b3261e', 'Halcyon Care', SANS, { dx: 44, size: 60, caps: false, icon: (x, y) => cross(x + 66, y + 64, 70, '#d62a1e') });
  logo(GSN.whitcombe, '#123326', '#e3c77a', 'Whitcombe', SERIF, { size: 84, weight: 'normal', sub: 'DEPUIS 1962 · SINCE 1962', subCol: '#bfa45f' });
  cell(GSN.napoli, '#ffffff', (x, y, w, h) => { g.fillStyle = '#1f8a3c'; g.fillRect(x, y, 40, h); g.fillStyle = '#d32f2f'; g.fillRect(x + w - 40, y, 40, h); text('NAPOLI', x + w / 2, y + h / 2 - 6, 80, '#c62828', w - 140, SERIF); text('PIZZA', x + w / 2, y + h - 20, 22, '#1f8a3c', 200); });
  cell(GSN.smokehouse, '#141110', (x, y, w, h) => { const gr = g.createLinearGradient(0, y + h, 0, y); gr.addColorStop(0, '#ff6a00'); gr.addColorStop(1, '#ffd34d'); text('SMOKEHOUSE', x + w / 2, y + h / 2, 70, gr, w - 60, DISP); });
  logo(GSN.wok, '#b71c1c', '#ffd54f', 'Golden Wok', SERIF, { size: 70 });
  logo(GSN.brew, '#3b2416', '#f1e3c8', 'Brew & Bean', SERIF, { size: 64, caps: false, style: 'italic' });
  cell(GSN.halcyon, '#0d1b2e', (x, y, w, h) => { g.shadowColor = '#8fd6ff'; g.shadowBlur = 20; text('HALCYON', x + w / 2, y + h / 2, 92, '#e9f6ff', w - 40, SERIF, 'normal'); });
  cell(GSN.sortie, '#15a04a', (x, y, w, h) => { // issue de secours : silhouette qui court vers une porte, flèche
    g.fillStyle = '#ffffff'; g.fillRect(x + 300, y + 22, 64, 86); g.fillStyle = '#15a04a'; g.fillRect(x + 310, y + 32, 44, 76);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 240, y + 30, 12, 0, TAU); g.fill(); g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    for (const L of [[[236, 44], [222, 76]], [[222, 76], [246, 104]], [[222, 76], [196, 98]], [[234, 50], [262, 66]], [[234, 50], [208, 58]]]) { g.beginPath(); g.moveTo(x + L[0][0], y + L[0][1]); g.lineTo(x + L[1][0], y + L[1][1]); g.stroke(); }
    g.beginPath(); g.moveTo(x + 60, y + 64); g.lineTo(x + 150, y + 64); g.stroke(); g.beginPath(); g.moveTo(x + 125, y + 40); g.lineTo(x + 152, y + 64); g.lineTo(x + 125, y + 88); g.stroke();
  });
  cell(GSN.restau, '#24323f', (x, y, w, h) => { g.strokeStyle = '#f2e7c9'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w / 2 - 40, y + 22); g.lineTo(x + w / 2 - 40, y + 106); g.stroke(); for (const d of [-14, 0, 14]) { g.beginPath(); g.moveTo(x + w / 2 - 40 + d, y + 22); g.lineTo(x + w / 2 - 40 + d, y + 50); g.stroke(); } g.beginPath(); g.ellipse(x + w / 2 + 40, y + 46, 12, 26, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + w / 2 + 40, y + 72); g.lineTo(x + w / 2 + 40, y + 106); g.stroke(); });
  cell(GSN.prive, '#f2f2f2', (x, y, w, h) => { g.fillStyle = '#c62828'; g.beginPath(); g.arc(x + w / 2, y + h / 2, 52, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 34, y + h / 2 - 9, 68, 18); });
  cell(GSN.plan, '#e9e5db', (x, y, w, h) => { g.strokeStyle = '#3a3a3a'; g.lineWidth = 3; g.strokeRect(x + 20, y + 14, w - 40, h - 28); const C = ['#d98b2b', '#21a35a', '#4fc3ff', '#ffd23a', '#c9241d', '#8e3bd6', '#147a78', '#ef6c1a']; for (let i = 0; i < 8; i++) { g.fillStyle = C[i]; g.fillRect(x + 70 + i * 48, y + 22, 42, 26); g.fillRect(x + 70 + ((i + 3) % 8) * 48, y + h - 48, 42, 26); } g.fillStyle = '#c62828'; g.beginPath(); g.arc(x + w / 2, y + h / 2 + 4, 9, 0, TAU); g.fill(); g.fillStyle = '#123326'; g.fillRect(x + 22, y + 16, 40, h - 32); g.fillStyle = '#24323f'; g.fillRect(x + w - 62, y + 16, 40, h - 32); });
  logo(GSN.soldes, '#d6141c', '#ffffff', 'Soldes −50 %', DISP, { size: 76 });
  cell(GSN.parking, '#1d4f9c', (x, y, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 54, y + 10, 108, 108); g.fillStyle = '#1d4f9c'; g.fillRect(x + w / 2 - 46, y + 18, 92, 92); text('P', x + w / 2, y + h / 2 + 4, 96, '#ffffff', 90, SANS); });
  cell(GSN.livraison, '#f6d64a', (x, y, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(x + 150, y + 40, 130, 56); g.fillRect(x + 280, y + 56, 60, 40); for (const cx of [180, 250, 316]) { g.beginPath(); g.arc(x + cx, y + 100, 14, 0, TAU); g.fill(); } g.fillStyle = '#f6d64a'; g.fillRect(x + 292, y + 62, 30, 16); });
  // salissures : poussière, coulures, patine vers le bas
  for (let i = 0; i < 32; i++) {
    const [x, y, w, h] = GSN_CELL(i);
    for (let k = 0; k < 220; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '40,40,36'},${R() * 0.07})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 4, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(30,32,36,0.18)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Neige d'un écran sans signal (écrans de la boutique d'électronique, bornes de l'arcade) : elle défile (galUpdate) */
function galTvTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), R = rngOf(77);
  const im = g.createImageData(128, 128); for (let i = 0; i < 128 * 128; i++) { const v = 40 + R() * 180; im.data[i * 4] = v * 0.85; im.data[i * 4 + 1] = v * 0.95; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
}
function galKit() { fdKit(); TEX.galSigns = galSignAtlas(); TEX.galPost = galPosterAtlas(); } // (affiches des boutiques : 02yq-galerie-boutiques.js)
function galMaterials(M) {
  makeFdMaterials(M);
  // enseignes lumineuses (allumées avec le courant ; galSignF vacille), écrans, verre des vitrines et du garde-corps, néons de service
  const basic = (o) => { const m = new THREE.MeshBasicMaterial(o); m.userData.noShadow = true; return m; };
  MAT.galSign = basic({ map: TEX.galSigns.map, color: new THREE.Color(1, 1, 1) });
  MAT.galSignF = basic({ map: TEX.galSigns.map, color: new THREE.Color(1, 1, 1) });
  MAT.galSignE = basic({ map: TEX.galSigns.map, color: new THREE.Color(1.3, 1.3, 1.3) }); // issues de secours : sur batterie, toujours allumées
  const tv = galTvTex(); MAT.galTV = basic({ map: tv, color: new THREE.Color(0.7, 0.75, 0.8) }); MAT.galTV.userData.own = [tv];
  MAT.galExit = basic({ color: new THREE.Color(0.25, 1.6, 0.6) });
  MAT.galNeon = basic({ vertexColors: true, color: new THREE.Color(1.4, 1.4, 1.4) }); // néons des boutiques (teinte de la boîte), avec le courant
  M('galPost', { tex: 'galPost', rough: 0.55, env: 0.25, macro: 0.04, scale: 1, noNormal: true }); MAT.galPost.userData.noShadow = true; // affiches, éclairées comme le décor
  const gl = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.18, depthWrite: false, roughness: 0.05, metalness: 0.1, envMapIntensity: 0.55, side: THREE.DoubleSide });
  gl.userData.noShadow = true; gl.userData.noAO = true; gl.userData.noReceive = true; MAT.galGlass = gl;
  M('galFloor', { tex: 'concrete', scale: 5, macro: 0.18, env: 1.0, rough: 0.26, dust: 0.1 }); // sol du mail : béton poli, qui luit sous les lampes
}

/* ---------- Construction ---------- */
function galeriesLevel() {
  GAL.R = rngOf(6302); GAL.breaks = [];
  galShell(); galFloors(); galInner(); galAtrium(); galShops(); galAnchor(); galFood(); galService(); galOutside(); galGround();
  survAmmoSpots(MAP_DEFS.galerie.ammo);
}
/* Mur mince de la galerie (porte à l'entier, épaisseur TW) ; ops relatives à y0 */
function gWall(axis, fixed, a0, a1, y0, h, ops, o = {}) {
  wallOpen(o.key || 'peinture', axis, fixed, o.t || GL.TW, a0, a1, y0, h, ops, Object.assign({ tint: o.tint || GPAL.wall, frames: false, floorY: y0 }, o));
}
const gDoor = (c, w = 1.2, h = 2.2) => ({ a0: c - w / 2, a1: c + w / 2, b0: 0, b1: h });
/* Une ouverture de la survie : axis, fixed, a0, a1 le long du mur, fl hauteur du plancher, h hauteur de l'ouverture ; o : le reste */
function gOpen(kind, axis, fixed, a0, a1, fl, h, out, room, o = {}) {
  return survOpening(Object.assign({ kind, axis, fixed, t: o.t || GL.TW, a0, a1, b0: fl, b1: fl + h, fl, out, room, bld: 'galerie', ext: false }, o));
}
/* Panneau lumineux de l'atlas : centre (cx, cy, cz), largeur, hauteur, normale (nx, nz) ; mat : galSign ou galSignF */
function gSign(cx, cy, cz, w, h, nx, nz, idx, mat = 'galSign') {
  const [px, py, pw, ph] = GSN_CELL(idx), u0 = px / 2048, u1 = (px + pw) / 2048, v0 = py / 1024, v1 = (py + ph) / 1024;
  const rx = nz, rz = -nx, x0 = cx - rx * w / 2, z0 = cz - rz * w / 2, x1 = cx + rx * w / 2, z1 = cz + rz * w / 2, M = DECOR;
  M.save(); M.cls = 1;
  M.quad(mat, [x0, cy - h / 2, z0], [x1, cy - h / 2, z1], [x1, cy + h / 2, z1], [x0, cy + h / 2, z0], [nx, 0, nz], { uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]] });
  M.restore();
}
/* Vitre transparente (verre des vitrines, des garde-corps) et sa collision ; see : les balles passent (garde-corps) */
function gGlass(x0, x1, y0, y1, z0, z1, see) {
  const M = DECOR; M.save().color([0.85, 0.95, 0.95]); M.cls = 1;
  if (x1 - x0 < z1 - z0) { const x = (x0 + x1) / 2; M.quad('galGlass', [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [1, 0, 0]); }
  else { const z = (z0 + z1) / 2; M.quad('galGlass', [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1]); }
  M.restore();
  COL.push({ x0, x1, y0, y1, z0, z1, m: 'glass', ray: false, noRay: !!see, noTop: true });
}
/* Lampe de plafond : dalle lumineuse (la lumière est cuite, 02e-light.js) ; cool : néon froid */
function gLamp(x, y, z, w = 1.2, d = 0.3, cool = false, p = 1.4, r = 8) {
  box(cool ? 'lampCool' : 'lamp', x - w / 2, x + w / 2, y - 0.04, y, z - d / 2, z + d / 2, { collide: false, ao: false });
  DECOR.lamp(x, y - 0.25, z, cool ? [0.8, 0.9, 1.0] : [1.0, 0.86, 0.66], p, r, 0.6);
}

/* L'enveloppe : murs extérieurs (portes vitrées, issues de secours, rideaux de quai, pans à brèche), toit et puits de lumière */
function galShell() {
  const { X0, X1, Z0, Z1, RF } = GL, H = RF + 1.1, ext = { tint: GPAL.ext, m: 'concrete', frames: false, floorY: 0 }, ET = 0.5;
  const zs = Z1 + ET / 2, zn = Z0 - ET / 2, xe = X1 + ET / 2, xw = X0 - ET / 2;
  // brèches : un pan de 2 m du couloir de service nord (ouest), un du couloir sud (est) ; les ouvertures qu'elles laissent se barricadent
  const bS = BRCH.list.length, bN = bS + 1; // (le mur sud est posé le premier)
  // sud : l'entrée principale (porte vitrée de 5 m sous une verrière), l'issue de secours sud-ouest, l'entrée du personnel, le pan à brèche sud
  // (une ouverture par travée : wallOpen ne superpose pas deux ouvertures ; la traverse et la verrière au-dessus de la porte sont posées à part)
  wallOpen('concrete', 'x', zs, ET, X0 - ET, X1 + ET, 0, H, [{ a0: -2.5, a1: 2.5, b0: 0, b1: 8.6 }, gDoor(-22.5), gDoor(12.5, 1.2, 2.25)], Object.assign({ breach: [{ a0: 18.5, a1: 20.5, b1: 2.6 }] }, ext));
  // nord : les deux rideaux du quai, l'issue nord-ouest, la porte de la réserve du grand magasin, le pan à brèche nord
  wallOpen('concrete', 'x', zn, ET, X0 - ET, X1 + ET, 0, H, [{ a0: -5.3, a1: -1.7, b0: 0, b1: 4.2 }, { a0: 1.7, a1: 5.3, b0: 0, b1: 4.2 }, gDoor(-22.5), gDoor(-34.5, 1.2, 2.25)], Object.assign({ breach: [{ a0: -12.5, a1: -10.5, b1: 2.6 }] }, ext));
  // est : l'entrée de la restauration (vitrée, 5 m), les issues nord-est et sud-est ; ouest : l'entrée du grand magasin (vitrée, 5 m)
  wallOpen('concrete', 'z', xe, ET, Z0, Z1, 0, H, [gDoor(-19.5, 1.2, 2.25), { a0: -2.5, a1: 2.5, b0: 0, b1: 8.6 }, gDoor(19.5, 1.2, 2.25)], ext);
  wallOpen('concrete', 'z', xw, ET, Z0, Z1, 0, H, [{ a0: -2.5, a1: 2.5, b0: 0, b1: 8.6 }], ext);
  // au-dessus des trois entrées vitrées : la traverse (3,2 à 3,6 m) et la verrière, ses montants
  for (const [ax, f] of [['x', zs], ['z', xe], ['z', xw]]) {
    if (ax === 'x') { box('steel', -2.5, 2.5, 3.2, 3.6, f - 0.2, f + 0.2, { tint: GPAL.trim }); gGlass(-2.5, 2.5, 3.6, 8.6, f - 0.02, f + 0.02); for (const a of [-2.5, -1.25, 0, 1.25, 2.5]) box('steel', a - 0.04, a + 0.04, 3.6, 8.6, f - 0.06, f + 0.06, { tint: GPAL.trim, collide: false }); for (const y of [6.1, 8.6]) box('steel', -2.5, 2.5, y - 0.04, y + 0.04, f - 0.06, f + 0.06, { tint: GPAL.trim, collide: false }); }
    else { box('steel', f - 0.2, f + 0.2, 3.2, 3.6, -2.5, 2.5, { tint: GPAL.trim }); gGlass(f - 0.02, f + 0.02, 3.6, 8.6, -2.5, 2.5); for (const a of [-2.5, -1.25, 0, 1.25, 2.5]) box('steel', f - 0.06, f + 0.06, 3.6, 8.6, a - 0.04, a + 0.04, { tint: GPAL.trim, collide: false }); for (const y of [6.1, 8.6]) box('steel', f - 0.06, f + 0.06, y - 0.04, y + 0.04, -2.5, 2.5, { tint: GPAL.trim, collide: false }); }
  }
  // les ouvertures du dehors (ext : les morts du siège marchent sur elles)
  const E = (o) => Object.assign({ ext: true, t: ET }, o);
  gOpen('portail', 'x', zs, -2.5, 2.5, 0, 3.2, 1, 'galerie', E({ gate: 'glass', closed: true, name: _t('L\u0027entrée principale') }));
  gOpen('porte', 'x', zs, -23.1, -21.9, 0, 2.2, 1, 'srvS', E({ gate: 'door', closed: true, name: _t('Une issue de secours') }));
  gOpen('porte', 'x', zs, 11.9, 13.1, 0, 2.25, 1, 'srvS', E({ gate: 'door', closed: true, name: _t('L\u0027entrée du personnel') }));
  gOpen('portail', 'x', zn, -5.3, -1.7, 0, 4.2, -1, 'quai', E({ gate: 'rollup', closed: true, dock: true, name: _t('Un rideau du quai') }));
  gOpen('portail', 'x', zn, 1.7, 5.3, 0, 4.2, -1, 'quai', E({ gate: 'rollup', closed: true, dock: true, name: _t('Un rideau du quai') }));
  gOpen('porte', 'x', zn, -23.1, -21.9, 0, 2.2, -1, 'srvN', E({ gate: 'door', closed: true, name: _t('Une issue de secours') }));
  gOpen('porte', 'x', zn, -35.1, -33.9, 0, 2.25, -1, 'whitcombe', E({ gate: 'door', closed: true, name: _t('La porte de la réserve') }));
  gOpen('portail', 'z', xe, -2.5, 2.5, 0, 3.2, 1, 'galerie', E({ gate: 'glass', closed: true, name: _t('L\u0027entrée de la restauration') }));
  gOpen('porte', 'z', xe, -20.1, -18.9, 0, 2.25, 1, 'srvN', E({ gate: 'door', closed: true, name: _t('Une issue de secours') }));
  gOpen('porte', 'z', xe, 18.9, 20.1, 0, 2.25, 1, 'srvS', E({ gate: 'door', closed: true, name: _t('Une issue de secours') }));
  gOpen('portail', 'z', xw, -2.5, 2.5, 0, 3.2, -1, 'whitcombe', E({ gate: 'glass', closed: true, name: _t('L\u0027entrée du grand magasin') }));
  // les pans à brèche : une ouverture que le mur ferme tant qu'il tient (survOpenWalled), à barricader une fois tombé
  gOpen('portail', 'x', zn, -12.5, -10.5, 0, 2.6, -1, 'srvN', E({ brk: bN }));
  gOpen('portail', 'x', zs, 18.5, 20.5, 0, 2.6, 1, 'srvS', E({ brk: bS }));
  GAL.breaks.push({ id: bN, n: _t('Le mur du couloir de service nord'), x: -11.5, z: -30 }, { id: bS, n: _t('Le mur du couloir de service sud'), x: 19.5, z: 30 });
  // fissures du mur à brèche, vues du dedans (le mur cède à cet endroit), et du dehors
  for (const [x, z, s] of [[-11.5, Z0, 1], [19.5, Z1, -1]]) for (let k = 0; k < 5; k++) box('dark', x - 0.9 + k * 0.42, x - 0.86 + k * 0.42, 0.4 + (k % 3) * 0.5, 1.6 + (k % 2) * 0.7, z + s * 0.002, z + s * 0.01, { collide: false, rot: 0 });
  // toit : dalle pleine, sauf les puits de lumière (atrium, restauration) ; parapet ; combles inaccessibles
  const RT = { tint: [0.4, 0.4, 0.4], m: 'concrete' };
  box('concrete', X0 - ET, X1 + ET, RF, RF + 0.7, Z0 - ET, -4, RT); box('concrete', X0 - ET, X1 + ET, RF, RF + 0.7, 4, Z1 + ET, RT);
  for (const [a, b] of [[X0 - ET, -13], [-2, 2], [13, 27], [35, X1 + ET]]) box('concrete', a, b, RF, RF + 0.7, -4, 4, RT);
  for (const [a, b] of [[-13, -2], [2, 13], [27, 35]]) {
    const M = DECOR; M.save().color([0.85, 0.95, 0.95]); M.cls = 1; M.quad('galGlass', [a, RF + 0.6, -4], [b, RF + 0.6, -4], [b, RF + 0.6, 4], [a, RF + 0.6, 4], [0, -1, 0]); M.restore();
    DECOR.col(a, b, RF + 0.58, RF + 0.62, -4, 4, 'glass', false, false);
    for (let x = a; x <= b + 0.01; x += (b - a) / 4) box('steel', x - 0.05, x + 0.05, RF + 0.1, RF + 0.66, -4, 4, { tint: GPAL.trim, collide: false });
    for (const z of [-4, -2, 0, 2, 4]) box('steel', a, b, RF + 0.1, RF + 0.66, z - 0.05, z + 0.05, { tint: GPAL.trim, collide: false });
  }
  // plafond du dernier niveau (sous le toit) : enduit clair
  box('plaster', X0, X1, RF - 0.02, RF, Z0, -4, { tint: GPAL.slab, collide: false }); box('plaster', X0, X1, RF - 0.02, RF, 4, Z1, { tint: GPAL.slab, collide: false });
}

/* Planchers : les dalles des deux niveaux (sous-face enduite, dessus fini), les sols du rez-de-chaussée */
function galFloors() {
  const { SL, CL, X0, X1, Z0, Z1 } = GL;
  const slab = (x0, x1, z0, z1, top = 'galFloor', tint = GPAL.floor) => { box('plaster', x0, x1, CL, SL - 0.03, z0, z1, { tint: GPAL.slab, m: 'concrete' }); box(top, x0, x1, SL - 0.03, SL, z0, z1, { tint, collide: false }); };
  // étage nord (boutiques, couloir de service), mezzanine du quai, étage sud ; coursives, bouts du mail, passerelle ; plafonds de la restauration
  slab(-24, -6, Z0, -9); slab(6, 24, Z0, -9); slab(-6, 6, Z0, -18, 'concrete', GPAL.srv); slab(3, 6, -18, -9, 'concrete', GPAL.srv);
  slab(-24, 24, 9, Z1); slab(-24, 24, -9, -4); slab(-24, 24, 4, 9); slab(-24, -13, -4, 4); slab(13, 24, -4, 4); slab(-2, 2, -4, 4);
  slab(24, X1, Z0, -9, 'concrete', GPAL.srv); slab(24, X1, 9, Z1, 'concrete', GPAL.srv);
  // le grand magasin : son étage, la trémie de son escalier
  slab(X0, -24, Z0, 5); slab(X0, -24, 12.5, Z1); slab(X0, -36, 5, 12.5); slab(-33, -24, 5, 12.5);
  // sols du rez-de-chaussée : dalles du mail et de la restauration, béton des couloirs et du quai (les boutiques ont le leur, galShops)
  box('galFloor', -24, X1, 0, 0.02, -9, 9, { tint: GPAL.floor, collide: false }); box('galFloor', -3, 3, 0, 0.02, 9, Z1, { tint: GPAL.floor, collide: false });
  for (const [x0, x1, z0, z1] of [[-24, X1, Z0, -18], [-24, X1, 18, Z1], [-6, 6, -18, -9]]) box('concrete', x0, x1, 0, 0.02, z0, z1, { tint: GPAL.srv, collide: false });
  box('galFloor', X0, -24, 0, 0.02, Z0, Z1, { tint: [0.86, 0.84, 0.8], collide: false });
}

/* Les cloisons : façades des boutiques sur le mail, murs du fond, murs mitoyens, quai, hall d'entrée, mur du grand magasin, restauration */
function galInner() {
  const { SL, CL, RF, TW } = GL, hG = CL, hU = RF - SL;
  // façades sur le mail (z = -9 et z = 9), aux deux niveaux : vitrine, ouverture, vitrine ; la restauration monte jusqu'au toit
  for (const row of ['n', 's']) for (const lv of [0, 1]) {
    const f = row === 'n' ? GL.nf : GL.sf, y0 = lv ? SL : 0, ops = [], L = GAL_SHOPS.filter((s) => s.row === row && s.lv === lv);
    for (const s of L) {
      ops.push({ a0: s.f[0], a1: s.f[1], b0: 0, b1: 3.4 });
      for (const [a, b] of [[s.x0 + 0.45, s.f[0] - 0.45], [s.f[1] + 0.45, s.x1 - 0.45]]) if (b - a > 0.9) { ops.push({ a0: a, a1: b, b0: 0.55, b1: 3.1 }); gGlass(a, b, y0 + 0.55, y0 + 3.1, f - 0.02, f + 0.02); }
    }
    // le quai : porte du personnel sur le mail (rez-de-chaussée, sous la mezzanine ; à l'étage, depuis la mezzanine) ; le hall d'entrée, au sud
    if (row === 'n') ops.push(gDoor(4.5, 1.2, 2.25));
    if (row === 's' && !lv) ops.push({ a0: -3, a1: 3, b0: 0, b1: 3.6 });
    gWall('x', f, -24, 24, y0, lv ? hU : hG, ops.sort((p, q) => p.a0 - q.a0), { tint: GPAL.wall });
  }
  // la restauration : façade des comptoirs, jusqu'au toit
  for (const f of [GL.nf, GL.sf]) gWall('x', f, 24, GL.X1, 0, RF, [{ a0: 24.5, a1: 30.5, b0: 0, b1: 3.2 }, { a0: 31.5, a1: 37.5, b0: 0, b1: 3.2 }], { tint: [0.74, 0.7, 0.62] });
  // murs du fond (couloirs de service), rez-de-chaussée et étage nord : une porte par boutique
  const backs = (row, lv) => GAL_SHOPS.filter((s) => s.row === row && s.lv === lv && s.back !== null).map((s) => gDoor(s.back));
  gWall('x', GL.nb, -24, -6, 0, hG, backs('n', 0).filter((d) => d.a0 < -6), { tint: GPAL.srv });
  gWall('x', GL.nb, 6, GL.X1, 0, hG, backs('n', 0).filter((d) => d.a0 > 6).concat([gDoor(27.5), gDoor(34.5)]), { tint: GPAL.srv });
  gWall('x', GL.nb, -24, -6, SL, hU, backs('n', 1).filter((d) => d.a0 < -6), { tint: GPAL.srv });
  gWall('x', GL.nb, 6, 24, SL, hU, backs('n', 1).filter((d) => d.a0 > 6), { tint: GPAL.srv });
  gWall('x', GL.sb, -24, -3, 0, hG, backs('s', 0).filter((d) => d.a0 < -3).concat([gDoor(-9.5)]), { tint: GPAL.srv });
  gWall('x', GL.sb, 3, GL.X1, 0, hG, backs('s', 0).filter((d) => d.a0 > 3).concat([gDoor(27.5), gDoor(34.5)]), { tint: GPAL.srv });
  // murs mitoyens et portes coupe-feu des couloirs (aux limites des ailes, x = ±15) ; nord de z = -21 à -9, sud de 9 à 21
  const fireN = { a0: -20.6, a1: -18.4, b0: 0, b1: 2.4 }, fireS = { a0: 18.4, a1: 20.6, b0: 0, b1: 2.4 };
  for (const x of [-15, 15]) {
    gWall('z', x, GL.Z0, GL.nf, 0, hG, [fireN], { tint: GPAL.wall2 }); gWall('z', x, GL.Z0, GL.nf, SL, hU, [fireN], { tint: GPAL.wall2 });
    gWall('z', x, GL.sf, GL.Z1, 0, hG, [fireS], { tint: GPAL.wall2 });
  }
  for (const x of [24, 31]) { gWall('z', x, GL.nb, GL.nf, 0, hG, [], { tint: GPAL.wall2 }); gWall('z', x, GL.sf, GL.sb, 0, hG, [], { tint: GPAL.wall2 }); }
  for (const x of [-8, 9]) gWall('z', x, GL.sf, GL.sb, 0, hG, [], { tint: GPAL.wall2 });
  for (const x of [-15, -6, 6, 15]) gWall('z', x, GL.sf, GL.Z1, SL, hU, [], { tint: GPAL.wall2 });
  // l'étage, au bout du mail : les deux boutiques d'angle ferment contre la restauration (x = 24), de z = -21 à -9 et de 9 à 21
  gWall('z', 24, GL.Z0, GL.nf, SL, hU, [], { tint: GPAL.wall2 }); gWall('z', 24, GL.sf, GL.Z1, SL, hU, [], { tint: GPAL.wall2 });
  // le quai (x = ±6, du toit au sol) : passages vers le couloir nord aux deux niveaux
  // (un mur par niveau : wallOpen ne superpose pas deux ouvertures dans la même travée)
  const pass = { a0: -20.6, a1: -18.4, b0: 0, b1: 2.6 };
  for (const x of [-6, 6]) { gWall('z', x, GL.Z0, GL.nf, 0, SL, [pass], { tint: GPAL.srv, key: 'concrete' }); gWall('z', x, GL.Z0, GL.nf, SL, hU, [{ ...pass, b1: 2.4 }], { tint: GPAL.srv, key: 'concrete' }); }
  // le hall d'entrée (x = ±3, du mail au dehors) : une porte de service de chaque côté
  for (const x of [-3, 3]) gWall('z', x, GL.sf, GL.Z1, 0, hG, [gDoor(19.5)], { tint: GPAL.wall });
  // le grand magasin (x = -24, mur porteur de 30 cm) : entrée sur le mail aux deux niveaux, portes des couloirs de service
  wallOpen('plaster', 'z', -24.15, 0.3, GL.Z0, GL.Z1, 0, SL, [gDoor(-19.5), { a0: -4, a1: 4, b0: 0, b1: 3.8 }, gDoor(19.5)], { tint: [0.82, 0.8, 0.74], frames: false, floorY: 0 });
  wallOpen('plaster', 'z', -24.15, 0.3, GL.Z0, GL.Z1, SL, hU, [gDoor(-19.5), { a0: -3, a1: 3, b0: 0, b1: 3.4 }], { tint: [0.82, 0.8, 0.74], frames: false, floorY: SL });
  void TW;
}

/* ---------- Les boutiques ---------- */
/* id, enseigne, rangée (n : au nord du mail, s : au sud), niveau, x0, x1, ouverture de la vitrine [a0, a1], centre de la porte du fond (null :
   aucune), sorte (galFit), sol, fermée au départ */
const GAL_SHOPS = [
  { id: 'sport', row: 'n', lv: 0, x0: -24, x1: -15, f: [-22.5, -16.5], back: -19.5, kind: 'sport', floor: ['wood', [0.62, 0.5, 0.38]] },
  { id: 'pharma', row: 'n', lv: 0, x0: -15, x1: -6, f: [-13.5, -8.5], back: -10.5, kind: 'pharma', floor: ['galFloor', [0.92, 0.92, 0.9]] },
  { id: 'elec', row: 'n', lv: 0, x0: 6, x1: 15, f: [7.5, 13.5], back: 10.5, kind: 'elec', floor: ['galFloor', [0.34, 0.35, 0.38]] },
  { id: 'jouets', row: 'n', lv: 0, x0: 15, x1: 24, f: [16.5, 22.5], back: 19.5, kind: 'toys', floor: ['rug', [0.42, 0.56, 0.78]] },
  { id: 'mode', row: 's', lv: 0, x0: -24, x1: -15, f: [-22.5, -16.5], back: -19.5, kind: 'clothes', floor: ['wood', [0.5, 0.38, 0.28]] },
  { id: 'chaussures', row: 's', lv: 0, x0: -15, x1: -8, f: [-13.5, -9.5], back: -12.5, kind: 'shoes', floor: ['rug', [0.46, 0.18, 0.16]] },
  { id: 'bijoux', row: 's', lv: 0, x0: -8, x1: -3, f: [-7, -4], back: -5.5, kind: 'jewel', floor: ['galFloor', [0.22, 0.2, 0.24]], shut: true },
  { id: 'livres', row: 's', lv: 0, x0: 3, x1: 9, f: [4, 8], back: 5.5, kind: 'books', floor: ['wood', [0.42, 0.3, 0.2]] },
  { id: 'animaux', row: 's', lv: 0, x0: 9, x1: 15, f: [10, 14], back: 12.5, kind: 'pets', floor: ['galFloor', [0.76, 0.86, 0.8]] },
  { id: 'superette', row: 's', lv: 0, x0: 15, x1: 24, f: [16.5, 22.5], back: 19.5, kind: 'mart', floor: ['galFloor', [0.9, 0.9, 0.86]] },
  { id: 'arcade', row: 'n', lv: 1, x0: -24, x1: -15, f: [-22.5, -16.5], back: -19.5, kind: 'arcade', floor: ['rug', [0.14, 0.1, 0.24]] },
  { id: 'jeux', row: 'n', lv: 1, x0: -15, x1: -6, f: [-13.5, -8.5], back: -10.5, kind: 'hobby', floor: ['wood', [0.5, 0.36, 0.24]] },
  { id: 'securite', row: 'n', lv: 1, x0: 6, x1: 15, f: [9.5, 12.5], back: 10.5, kind: 'security', floor: ['rug', [0.3, 0.32, 0.36]] },
  { id: 'maison', row: 'n', lv: 1, x0: 15, x1: 24, f: [16.5, 22.5], back: 19.5, kind: 'home', floor: ['wood', [0.66, 0.54, 0.4]] },
  { id: 'salon', row: 's', lv: 1, x0: -24, x1: -15, f: [-22.5, -17.5], back: null, kind: 'salon', floor: ['galFloor', [0.95, 0.9, 0.92]] },
  { id: 'disques', row: 's', lv: 1, x0: -15, x1: -6, f: [-13.5, -8.5], back: null, kind: 'music', floor: ['wood', [0.3, 0.24, 0.2]] },
  { id: 'cinema', row: 's', lv: 1, x0: -6, x1: 6, f: [-4.5, 4.5], back: null, kind: 'cinema', floor: ['rug', [0.42, 0.08, 0.1]] },
  { id: 'cafe', row: 's', lv: 1, x0: 6, x1: 15, f: [7.5, 13.5], back: null, kind: 'cafe', floor: ['wood', [0.58, 0.44, 0.3]] },
  { id: 'soins', row: 's', lv: 1, x0: 15, x1: 24, f: [17.5, 21.5], back: null, kind: 'clinic', floor: ['galFloor', [0.86, 0.9, 0.92]] },
];
function galShops() {
  const { SL, CL, RF } = GL;
  for (const S of GAL_SHOPS) {
    const n = S.row === 'n', y0 = S.lv ? SL : 0, f = n ? GL.nf : GL.sf, sg = n ? -1 : 1, deep = n ? 9 : S.lv ? 12 : 9, b = f + sg * deep, top = S.lv ? RF : CL;
    const z0 = Math.min(f, b), z1 = Math.max(f, b), name = GNAME[S.id] || '';
    // sol
    box(S.floor[0], S.x0 + 0.07, S.x1 - 0.07, y0, y0 + 0.025, z0 + 0.07, z1 - 0.07, { tint: S.floor[1], collide: false });
    // enseigne : bandeau sombre au-dessus de la vitrine, panneau lumineux devant (sur le mail)
    const fz = f - sg * 0.07, sw = Math.min(4.2, S.x1 - S.x0 - 1.2), sx = (S.f[0] + S.f[1]) / 2;
    box('paint', S.x0 + 0.15, S.x1 - 0.15, y0 + 3.55, y0 + 4.4, n ? fz : fz - 0.1, n ? fz + 0.1 : fz, { tint: [0.12, 0.12, 0.13], collide: false });
    gSign(sx, y0 + 3.98, fz - sg * 0.11, sw, sw / 4 > 0.78 ? 0.78 : sw / 4, 0, -sg, GSN[S.id], S.id === 'cinema' || S.id === 'arcade' ? 'galSignF' : 'galSign');
    // l'ouverture sur le mail : le rideau de la boutique ; la porte du fond sur le couloir de service
    gOpen('portail', 'x', f, S.f[0], S.f[1], y0, 3.4, -sg, S.id, { gate: 'grille', closed: !!S.shut, name: name ? _t('Le rideau de {0}', name) : _t('Le rideau du poste de sécurité') });
    if (S.back !== null) gOpen('porte', 'x', b, S.back - 0.6, S.back + 0.6, y0, 2.2, sg, S.id, { gate: 'door', closed: true, name: name ? _t('L\u0027arrière de {0}', name) : _t('L\u0027arrière du poste de sécurité') });
    // éclairage : deux dalles lumineuses
    const zc = (z0 + z1) / 2, xc = (S.x0 + S.x1) / 2;
    gLamp(xc - (S.x1 - S.x0) * 0.22, top - 0.02, zc, 1.2, 0.3, true, 1.1, 7); gLamp(xc + (S.x1 - S.x0) * 0.22, top - 0.02, zc, 1.2, 0.3, true, 1.1, 7);
    // les étagères, comptoirs, meubles de chaque sorte de boutique ; d : profondeur depuis la vitrine
    galFit(S, y0, f, sg, (d) => f + sg * d);
    galShopDress(S, y0, f, sg, (d) => f + sg * d); // l'habillage (02yq-galerie-boutiques.js)
    // à l'étage sud : la réserve du fond (z de 18 à 21), sa porte
    if (S.lv && !n) gWall('x', GL.sb, S.x0, S.x1, SL, RF - SL, [gDoor(S.x1 - 1.5)], { tint: GPAL.wall2 });
  }
}
/* Mobilier d'une boutique (axes du monde ; Z(d) : z à d m de la vitrine, vers le fond) */
function galFit(S, y0, f, sg, Z) {
  const M = DECOR, R = GAL.R, x0 = S.x0, x1 = S.x1, xc = (x0 + x1) / 2;
  // gondole : étagère double face, centrée sur un centre de case (x,5), le long de z ; cols : teintes des produits
  const gondola = (x, d0, d1, h, cols, frame = [0.86, 0.86, 0.84]) => {
    const za = Math.min(Z(d0), Z(d1)), zb = Math.max(Z(d0), Z(d1));
    box('paint', x - 0.04, x + 0.04, y0, y0 + h, za, zb, { tint: frame, collide: false }); box('paint', x - 0.3, x + 0.3, y0, y0 + 0.14, za, zb, { tint: frame, collide: false });
    M.col(x - 0.3, x + 0.3, y0, y0 + h, za, zb, 'metal');
    // (6.3.1) bouts de gondole : panneau plein, l'affiche de la boutique côté allée
    for (const [z, s] of [[za, -1], [zb, 1]]) { box('paint', x - 0.3, x + 0.3, y0, y0 + h, z, z + s * 0.02, { tint: frame, collide: false, cls: 1 }); const pk = GQ.kp[S.kind]; if (pk !== undefined && h > 1.4) gPoster(x, y0 + h * 0.56, z + s * 0.024, 0.46, 0, s, GQ.po[pk]); }
    for (let k = 1; k <= 4; k++) {
      const y = y0 + (k * h) / 5 - 0.18; box('paint', x - 0.3, x + 0.3, y - 0.02, y, za, zb, { tint: frame, collide: false });
      // (6.3.1) bandeau des prix au bord de la tablette, une étiquette jaune de loin en loin
      for (const s of [-1, 1]) { box('paint', x + s * 0.3 - 0.004, x + s * 0.3 + 0.004, y - 0.05, y, za, zb, { tint: [0.96, 0.96, 0.94], collide: false, cls: 2 }); for (let q = za + 0.2, j = 0; q < zb - 0.1; q += 0.45, j++) if ((j + k) % 3 === 0) box('paint', x + s * 0.305 - 0.003, x + s * 0.305 + 0.003, y - 0.045, y - 0.01, q, q + 0.06, { tint: [1, 0.85, 0.1], collide: false, cls: 2 }); }
      for (const s of [-1, 1]) for (let i = 0; i < Math.floor((zb - za) / 0.3); i++) if (R() < 0.85) { const c = cols[Math.floor(R() * cols.length)], zz = za + 0.04 + i * 0.3, hh = 0.12 + R() * 0.2; box('cardboard', x + s * 0.06, x + s * 0.27, y, y + hh, zz, zz + 0.24, { tint: c, collide: false }); }
    }
  };
  // le long du mur du fond : de a0 à a1 sauf devant la porte du fond (2,4 m dégagés)
  const along = (a0, a1, fn) => { if (S.back === null) { fn(a0, a1); return; } const p0 = S.back - 1.2, p1 = S.back + 1.2; if (p0 - a0 > 0.4) fn(a0, Math.min(a1, p0)); if (a1 - p1 > 0.4) fn(Math.max(a0, p1), a1); };
  // comptoir avec caisse ; le long de x
  const counter = (a0, a1, d, tint = [0.3, 0.3, 0.32]) => { const z = Z(d); box('paint', a0, a1, y0, y0 + 1.0, z - 0.35, z + 0.35, { tint, m: 'wood' }); box('plastic', a0 + 0.3, a0 + 0.75, y0 + 1.0, y0 + 1.25, z - 0.2, z + 0.15, { tint: [0.12, 0.12, 0.12], collide: false }); };
  // présentoir bas (table) au centre
  const table = (x, d, w, dd, cols) => { const z = Z(d); box('wood', x - w / 2, x + w / 2, y0, y0 + 0.8, z - dd / 2, z + dd / 2, { tint: [0.55, 0.42, 0.3] }); for (let i = 0; i < 6; i++) { const px = x - w / 2 + 0.15 + R() * (w - 0.4), pz = z - dd / 2 + 0.1 + R() * (dd - 0.3); box('cardboard', px, px + 0.25, y0 + 0.8, y0 + 0.86 + R() * 0.1, pz, pz + 0.2, { tint: cols[i % cols.length], collide: false }); } };
  // portant de vêtements : barre, vêtements pendus
  const rack = (x, d, len, cols) => { const z = Z(d); box('steel', x - len / 2, x + len / 2, y0 + 1.5, y0 + 1.53, z - 0.02, z + 0.02, { tint: GPAL.steel, collide: false }); for (const s of [-1, 1]) box('steel', x + s * len / 2 - 0.02, x + s * len / 2 + 0.02, y0, y0 + 1.53, z - 0.25, z + 0.25, { tint: GPAL.steel, collide: false }); for (let i = 0; i < Math.round(len / 0.12); i++) { const px = x - len / 2 + 0.06 + i * 0.12; box('canvas', px - 0.025, px + 0.025, y0 + 0.55 + R() * 0.2, y0 + 1.48, z - 0.24, z + 0.24, { tint: cols[Math.floor(R() * cols.length)], collide: false }); } M.col(x - len / 2, x + len / 2, y0, y0 + 1.5, z - 0.26, z + 0.26, 'dirt'); };
  // cartons de la réserve, que les balles et les morts dérangent (props physiques)
  const boxes = (x, d, n) => { for (let i = 0; i < n; i++) M.dyn('cardboard', x + (R() - 0.5) * 1.2, y0 + (i > 2 ? 0.4 : 0), Z(d) + (R() - 0.5) * 1.0, R() * 0.6, { a: [0.5 + R() * 0.2, 0.4, 0.4] }); };
  const k = S.kind;
  if (k === 'sport') {
    // armurerie de chasse et de tir : le comptoir où l'on achète des munitions (surv.buy), râtelier ; vélos, ballons, tentes, rayons
    counter(x0 + 0.6, x0 + 4.2, 6.8, [0.2, 0.24, 0.2]); box('wood', x0 + 0.1, x0 + 4.2, y0 + 0.4, y0 + 2.4, Z(8.6) - 0.15, Z(8.6) + 0.15, { tint: [0.4, 0.3, 0.2] });
    for (let i = 0; i < 6; i++) box('steel', x0 + 0.4 + i * 0.6, x0 + 0.46 + i * 0.6, y0 + 0.9, y0 + 2.1, Z(8.5) - sg * 0.1, Z(8.5) - sg * 0.16, { tint: [0.1, 0.1, 0.1], collide: false });
    gondola(x0 + 5.5, 2.2, 7.4, 1.8, [[0.85, 0.4, 0.15], [0.2, 0.45, 0.25], [0.2, 0.3, 0.6]]); gondola(x0 + 7.5, 2.2, 7.4, 1.8, [[0.9, 0.85, 0.2], [0.6, 0.1, 0.1], [0.2, 0.2, 0.22]]);
    for (const dx of [1.5, 3]) DECOR.dyn('bicycle', x0 + dx, y0, Z(1.5), Math.PI / 2, { tint: [0.7, 0.15, 0.1] });
    table(x0 + 2.5, 3.6, 2.2, 1.0, [[0.9, 0.5, 0.1], [0.95, 0.95, 0.95], [0.2, 0.5, 0.9]]);
  } else if (k === 'pharma') {
    counter(x0 + 1, xc - 0.5, 6.8, [0.9, 0.9, 0.88]); along(x0 + 0.1, x1 - 0.1, (a, b) => box('paint', a, b, y0, y0 + 2.2, Z(8.7) - 0.15, Z(8.7) + 0.15, { tint: [0.9, 0.92, 0.9] }));
    for (const x of [x0 + 2.5, x0 + 4.5, x0 + 6.5]) gondola(x, 1.8, 5.6, 1.6, [[0.95, 0.95, 0.95], [0.3, 0.7, 0.4], [0.9, 0.4, 0.4], [0.4, 0.6, 0.9]], [0.95, 0.95, 0.94]);
    survCache('med', xc - 1.6, y0 + 1.0, Z(6.8), 0); // la seringue d'adrénaline, sur le comptoir
    survProp('bookcase', x0 + 0.35, y0, Z(4.5), Math.PI / 2);
  } else if (k === 'elec') {
    // le mur d'écrans (neige qui défile), présentoirs, comptoir
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = x0 + 0.95 + i * (i > 1 ? 1.9 : 1.6) + (i > 1 ? 1.3 : 0), y = y0 + 0.9 + j * 0.95, z = Z(8.82); box('dark', x - 0.7, x + 0.7, y, y + 0.85, z - 0.04, z + 0.04, { collide: false }); box('galTV', x - 0.65, x + 0.65, y + 0.05, y + 0.8, z - sg * 0.05, z - sg * 0.04, { collide: false }); }
    along(x0 + 0.2, x1 - 0.2, (a, b) => M.col(a, b, y0, y0 + 3.8, Z(8.9) - 0.1, Z(8.9) + 0.1, 'concrete'));
    for (const x of [x0 + 2.5, x0 + 6.5]) table(x, 4, 2.0, 1.1, [[0.1, 0.1, 0.1], [0.75, 0.75, 0.78], [0.2, 0.2, 0.3]]);
    counter(x1 - 3.8, x1 - 0.6, 1.8, [0.1, 0.1, 0.12]); boxes(x0 + 2, 7.4, 4);
  } else if (k === 'toys') {
    for (const x of [x0 + 2.5, x0 + 4.5, x0 + 6.5]) gondola(x, 2, 7.2, 1.9, [[0.95, 0.2, 0.2], [0.2, 0.5, 0.95], [1, 0.8, 0.1], [0.3, 0.8, 0.3], [0.8, 0.3, 0.9]], [0.98, 0.9, 0.4]);
    counter(x1 - 3.4, x1 - 0.6, 1.4, [0.95, 0.55, 0.1]); boxes(x0 + 1.5, 8, 3);
    for (let i = 0; i < 4; i++) DECOR.dyn('fdBallon', x0 + 1 + R() * 2, y0, Z(1.2 + R() * 1.5), 0, {});
  } else if (k === 'clothes') {
    for (const [dx, d] of [[2, 2.4], [5, 2.4], [2, 5.2], [5, 5.2]]) rack(x0 + dx + 0.5, d, 2.2, [[0.1, 0.1, 0.12], [0.75, 0.72, 0.68], [0.45, 0.12, 0.14], [0.2, 0.28, 0.45]]);
    counter(x1 - 2.8, x1 - 0.6, 7.6, [0.12, 0.12, 0.12]); survProp('wardrobe', x0 + 0.4, y0, Z(7.6), Math.PI / 2);
    for (let i = 0; i < 3; i++) box('canvas', x0 + 7.4, x0 + 8.8, y0, y0 + 2.2, Z(4 + i * 1.3) - 0.04, Z(4 + i * 1.3) + 0.04, { tint: [0.55, 0.12, 0.12], collide: i === 0 }); // cabines d'essayage
    for (const [dx, d, r] of [[0.9, 1.0, 0.3], [3.2, 0.9, -0.2], [6.1, 1.1, 2.8]]) DECOR.place(PF.galMannequin(), x0 + dx, y0, Z(d), r);
  } else if (k === 'shoes') {
    // (le mur à chaussures s'arrête au placard d'entretien, pris dans le coin de la boutique)
    along(x0 + 0.1, x1 - 3.15, (a, b) => { box('paint', a, b, y0, y0 + 2.4, Z(8.7) - 0.2, Z(8.7) + 0.2, { tint: [0.92, 0.9, 0.86] }); for (let x = a + 0.1; x < b - 0.3; x += 0.42) for (const yy of [0.9, 1.5]) box('rubber', x, x + 0.28, y0 + yy, y0 + yy + 0.12, Z(8.5) - sg * 0.1 - 0.12, Z(8.5) - sg * 0.1 + 0.12, { tint: [[0.1, 0.1, 0.1], [0.9, 0.9, 0.9], [0.6, 0.2, 0.1]][Math.floor(x * 7) % 3], collide: false }); });
    for (const x of [x0 + 2.5, x0 + 4.5]) box('rug', x - 0.6, x + 0.6, y0, y0 + 0.45, Z(4) - 0.3, Z(4) + 0.3, { tint: [0.3, 0.12, 0.1] }); // bancs d'essayage
    counter(x1 - 2.6, x1 - 0.5, 1.4, [0.86, 0.84, 0.8]);
  } else if (k === 'jewel') {
    for (const [a, d] of [[x0 + 0.5, 3], [x0 + 0.5, 6]]) { const z = Z(d); box('paint', a, a + 3.0, y0, y0 + 0.95, z - 0.3, z + 0.3, { tint: [0.15, 0.12, 0.18] }); gGlass(a, a + 3.0, y0 + 0.95, y0 + 1.25, z - 0.29, z + 0.29); }
    box('paint', x0 + 0.2, x1 - 0.2, y0 + 2.6, y0 + 2.62, Z(4.5) - 2, Z(4.5) + 2, { tint: [0.8, 0.65, 0.3], collide: false });
  } else if (k === 'books') {
    for (const [x, d, r] of [[x0 + 0.3, 3, Math.PI / 2], [x0 + 0.3, 5, Math.PI / 2], [x1 - 0.3, 4, -Math.PI / 2]]) survProp('bookcase', x, y0, Z(d), r);
    for (const x of [x0 + 2.5, x0 + 4.5]) gondola(x, 6, 8, 1.7, [[0.6, 0.2, 0.15], [0.2, 0.3, 0.5], [0.85, 0.8, 0.65], [0.2, 0.4, 0.25]], [0.4, 0.28, 0.18]);
    table(xc, 2, 1.8, 1.0, [[0.9, 0.85, 0.7], [0.5, 0.15, 0.1], [0.15, 0.2, 0.35]]);
  } else if (k === 'pets') {
    for (const x of [x0 + 0.9, x0 + 2.2, x1 - 0.9]) { const z = Z(8.6); box('glass', x - 0.6, x + 0.6, y0 + 0.9, y0 + 1.6, z - 0.3, z + 0.3, { tint: [0.4, 0.7, 0.75] }); box('paint', x - 0.62, x + 0.62, y0, y0 + 0.9, z - 0.32, z + 0.32, { tint: [0.2, 0.22, 0.24] }); } // aquariums
    gondola(x0 + 2.5, 2, 6.5, 1.5, [[0.8, 0.6, 0.3], [0.3, 0.6, 0.8], [0.6, 0.4, 0.2]]); counter(x1 - 2.6, x1 - 0.5, 1.4, [0.2, 0.5, 0.48]);
  } else if (k === 'mart') {
    for (const x of [x0 + 2.5, x0 + 4.5, x0 + 6.5]) gondola(x, 2.2, 6.2, 1.7, [[0.9, 0.2, 0.15], [0.95, 0.8, 0.2], [0.2, 0.55, 0.25], [0.85, 0.85, 0.85], [0.3, 0.35, 0.75]]);
    along(x0 + 0.1, x1 - 0.1, (a, b) => { box('steel', a, b, y0, y0 + 2.0, Z(8.6) - 0.3, Z(8.6) + 0.3, { tint: [0.85, 0.88, 0.9] }); box('lampCool', a + 0.1, b - 0.1, y0 + 1.86, y0 + 1.9, Z(8.6) - sg * 0.31 - 0.01, Z(8.6) - sg * 0.31 + 0.01, { collide: false }); }); // vitrines réfrigérées
    counter(x1 - 3, x1 - 0.6, 1.4, [0.95, 0.5, 0.15]); boxes(x0 + 1.5, 7.4, 3);
    for (let i = 0; i < 3; i++) DECOR.dyn('galCart', x0 + 1.2 + i * 0.7, y0, Z(1.0), Math.PI / 2 + (R() - 0.5) * 0.2, {});
  } else if (k === 'arcade') {
    for (let i = 0; i < 5; i++) for (const d of [3, 6.5]) { const x = x0 + 0.9 + i * 1.6, z = Z(d); box('paint', x - 0.36, x + 0.36, y0, y0 + 1.85, z - 0.4, z + 0.4, { tint: [[0.6, 0.1, 0.5], [0.1, 0.3, 0.7], [0.1, 0.1, 0.1]][i % 3] }); box('galTV', x - 0.27, x + 0.27, y0 + 1.15, y0 + 1.6, z - sg * 0.41 - 0.005, z - sg * 0.41 + 0.005, { collide: false }); }
    counter(x1 - 2.6, x1 - 0.5, 8.4, [0.1, 0.1, 0.1]);
  } else if (k === 'hobby') {
    for (const [x, d] of [[x0 + 2.5, 3], [x0 + 6.5, 3], [x0 + 2.5, 6.4], [x0 + 6.5, 6.4]]) { table(x, d, 1.6, 1.0, [[0.3, 0.5, 0.3], [0.7, 0.2, 0.2], [0.85, 0.8, 0.5]]); for (const s of [-1, 1]) DECOR.dyn('chair', x + s * 1.1, y0, Z(d), -s * Math.PI / 2, {}); }
    along(x0 + 0.1, x1 - 0.1, (a, b) => box('wood', a, b, y0, y0 + 2.2, Z(8.75) - 0.18, Z(8.75) + 0.18, { tint: [0.4, 0.28, 0.18] }));
  } else if (k === 'security') {
    // le poste de sécurité : moniteurs de vidéosurveillance, la console des rideaux coupe-feu (objectif : survObjective lock), une caisse
    for (let i = 0; i < 6; i++) { const x = x0 + 1.4 + i * 1.1, z = Z(8.82); box('dark', x - 0.5, x + 0.5, y0 + 1.2, y0 + 1.95, z - 0.05, z + 0.05, { collide: false }); box('galTV', x - 0.45, x + 0.45, y0 + 1.25, y0 + 1.9, z - sg * 0.06, z - sg * 0.055, { collide: false }); }
    along(x0 + 1, x1 - 1, (a, b) => box('paint', a, b, y0, y0 + 0.9, Z(7.9) - 0.4, Z(7.9) + 0.4, { tint: [0.25, 0.27, 0.3], m: 'metal' })); // la console, en deux pupitres
    for (let i = 0; i < 2; i++) { const x = i ? x1 - 2.2 : x0 + 2.2, z = Z(7.9); box('dark', x - 0.4, x + 0.4, y0 + 0.9, y0 + 0.93, z - 0.3, z + 0.1, { collide: false }); box(i ? 'lampCool' : 'lamp', x - 0.08, x + 0.08, y0 + 0.93, y0 + 0.96, z - 0.05, z + 0.05, { collide: false }); }
    survObjective('lock', x0 + 2.2, Z(7.1), { y: y0, w: 'w', close: _t('Fermer l\u0027aile ouest (rideaux coupe-feu)'), open: _t('Rouvrir l\u0027aile ouest'), sealed: _t('Aile ouest fermée, les rideaux coupe-feu tombent'), opened: _t('Aile ouest rouverte') });
    survObjective('lock', x1 - 2.2, Z(7.1), { y: y0, w: 'e', close: _t('Fermer l\u0027aile est (rideaux coupe-feu)'), open: _t('Rouvrir l\u0027aile est'), sealed: _t('Aile est fermée, les rideaux coupe-feu tombent'), opened: _t('Aile est rouverte') });
    survProp('bookcase', x1 - 0.35, y0, Z(4), -Math.PI / 2); survProp('dresser', x0 + 0.4, y0, Z(3), Math.PI / 2);
    for (const dx of [2.5, 6.5]) DECOR.dyn('chair', x0 + dx, y0, Z(6.6), 0, {});
  } else if (k === 'home') {
    // de quoi barricader : meubles à pousser, planches, clous (le rayon bricolage)
    survProp('couch', x0 + 2.5, y0, Z(2.8), 0); survProp('couch', x0 + 6.5, y0, Z(2.8), 0); survProp('dresser', x0 + 2.5, y0, Z(5.2), 0); survProp('wardrobe', x1 - 0.4, y0, Z(6.2), -Math.PI / 2);
    survProp('dresser', x0 + 6.5, y0, Z(5.2), Math.PI); survProp('wardrobe', x0 + 0.4, y0, Z(7.4), Math.PI / 2);
    along(x0 + 2, x1 - 1.6, (a, b) => box('wood', a, b, y0, y0 + 1.0, Z(8.4) - 0.3, Z(8.4) + 0.3, { tint: [0.5, 0.38, 0.26] }));
    survCache('planks', x0 + 2.0, y0, Z(6.6), Math.PI / 2); survCache('nails', x0 + 2.6, y0 + 1.0, Z(8.4), 0);
  } else if (k === 'salon') {
    for (let i = 0; i < 3; i++) { const x = x0 + 1.5 + i * 2.2, z = Z(8.6); box('paint', x - 0.6, x + 0.6, y0, y0 + 0.85, z - 0.25, z + 0.25, { tint: [0.95, 0.95, 0.95] }); box('glass', x - 0.5, x + 0.5, y0 + 1.1, y0 + 2.2, z - sg * 0.27 - 0.01, z - sg * 0.27 + 0.01, { tint: [0.8, 0.85, 0.9], collide: false }); DECOR.dyn('chair', x, y0, Z(7.6), 0, {}); }
    counter(x1 - 3, x1 - 0.6, 1.6, [0.95, 0.75, 0.82]);
  } else if (k === 'music') {
    survProp('bookcase', x0 + 0.3, y0, Z(3), Math.PI / 2); survProp('bookcase', x0 + 0.3, y0, Z(5), Math.PI / 2);
    for (const x of [x0 + 3.5, x0 + 5.5]) table(x, 4, 1.2, 2.4, [[0.1, 0.1, 0.1], [0.8, 0.4, 0.1], [0.6, 0.6, 0.6]]);
    counter(x1 - 3, x1 - 0.6, 1.6, [0.1, 0.1, 0.1]);
  } else if (k === 'cinema') {
    // le hall du cinéma : caisses, comptoir à confiserie, affiches (les salles sont fermées : la porte du fond est murée)
    counter(x0 + 1.5, x0 + 6.5, 6.5, [0.5, 0.08, 0.1]); box('paint', x0 + 7.5, x1 - 0.6, y0, y0 + 1.1, Z(3.8) - 0.4, Z(3.8) + 0.4, { tint: [0.4, 0.06, 0.08] });
    for (let i = 0; i < 4; i++) { const x = x0 + 1.2 + i * 2.6; box('paint', x - 0.6, x + 0.6, y0 + 1.2, y0 + 2.9, Z(8.85) - 0.02, Z(8.85) + 0.02, { tint: [[0.8, 0.6, 0.2], [0.2, 0.3, 0.6], [0.6, 0.15, 0.15], [0.15, 0.5, 0.4]][i], collide: false }); }
  } else if (k === 'cafe') {
    counter(x0 + 1, x0 + 6, 7.2, [0.4, 0.26, 0.16]); box('steel', x0 + 1.4, x0 + 2.4, y0 + 1.0, y0 + 1.5, Z(7.3) - 0.2, Z(7.3) + 0.2, { tint: [0.7, 0.7, 0.72], collide: false });
    for (const [dx, d] of [[2.5, 2.5], [5.5, 2.5], [2.5, 5]]) { DECOR.dyn('cafeTable', x0 + dx, y0, Z(d), 0, {}); for (const s of [-1, 1]) DECOR.dyn('chair', x0 + dx + s * 0.8, y0, Z(d), -s * Math.PI / 2, {}); }
  } else if (k === 'clinic') {
    for (let i = 0; i < 2; i++) { const x = x0 + 2.5 + i * 3.5, z = Z(6); box('canvas', x - 0.45, x + 0.45, y0, y0 + 0.75, z - 1, z + 1, { tint: [0.88, 0.9, 0.92] }); box('steel', x - 0.47, x + 0.47, y0, y0 + 0.62, z - 1.02, z + 1.02, { tint: GPAL.steel, collide: false }); }
    counter(x0 + 1, x0 + 4.5, 1.6, [0.85, 0.88, 0.9]); survCache('med', x0 + 3.6, y0 + 1.0, Z(1.6), 0);
    box('paint', x1 - 0.6, x1 - 0.1, y0, y0 + 1.9, Z(8.2) - 0.6, Z(8.2) + 0.6, { tint: [0.92, 0.94, 0.94], m: 'metal' });
  }
}

/* Habillage d'un escalier mécanique (pied en za, haut en zb, au rez-de-chaussée et à l'étage) : nez de marche et bords jaunes, paliers d'acier
   strié aux deux bouts avec leur peigne, main courante de caoutchouc noir qui déborde en palier et s'enroule dans un pied d'acier (le pied
   arrête les soldats ; les centres de case, à 0,44 m, restent libres) */
function galEscalatorTrim(x0, x1, za, zb) {
  const { SL } = GL, M = DECOR, dir = Math.sign(zb - za), n = Math.round(SL / 0.2), Y = [0.95, 0.78, 0.12], len = Math.abs(zb - za);
  for (let i = 0; i < n; i++) {
    const s0 = i / n, s1 = (i + 1) / n, ze = za + dir * len * s0, y = s1 * SL, zf = za + dir * len * s1;
    box('paint', x0 + 0.05, x1 - 0.05, y - 0.012, y + 0.004, Math.min(ze, ze + dir * 0.05), Math.max(ze, ze + dir * 0.05), { tint: Y, collide: false });
    for (const x of [x0 + 0.06, x1 - 0.1]) box('paint', x, x + 0.04, y - 0.012, y + 0.004, Math.min(ze, zf), Math.max(ze, zf), { tint: Y, collide: false });
  }
  for (const [z, y, s] of [[za, 0, -dir], [zb, SL, dir]]) {
    // palier : plaque d'acier strié, peigne jaune contre la première marche
    const zo = z + s * 1.1;
    box('steel', x0, x1, y, y + 0.02, Math.min(z, zo), Math.max(z, zo), { tint: [0.6, 0.62, 0.64], collide: false });
    for (let k = 1; k < 7; k++) { const zz = z + s * k * 0.15; box('dark', x0 + 0.08, x1 - 0.08, y + 0.02, y + 0.026, zz - 0.01, zz + 0.01, { collide: false }); }
    box('paint', x0 + 0.04, x1 - 0.04, y + 0.02, y + 0.035, Math.min(z, z + s * 0.08), Math.max(z, z + s * 0.08), { tint: Y, collide: false });
  }
  for (const x of [x0, x1]) {
    const xo = x === x0 ? x0 + 0.02 : x1 - 0.02, zf = za - dir * 0.95, zt = zb + dir * 0.95;
    // pieds d'acier aux deux bouts (le flanc qui enferme la main courante), sur 10 cm de large : à 0,43 m au moins des centres de case.
    // Ils mordent de 5 cm sur le garde-corps invisible : bout à bout sur une ligne de centres de case (z = 3,5), le lien de marche passait
    // entre les deux boîtes (navLinkClear suit une ligne sans épaisseur) et un mort s'y coinçait au pied de l'escalier
    const za2 = za + dir * 0.05, zb2 = zb - dir * 0.05;
    box('steel', xo - 0.05, xo + 0.05, 0, 0.98, Math.min(za2, zf), Math.max(za2, zf), { tint: [0.7, 0.72, 0.74], m: 'metal' });
    box('steel', xo - 0.05, xo + 0.05, SL, SL + 0.98, Math.min(zb2, zt), Math.max(zb2, zt), { tint: [0.7, 0.72, 0.74], m: 'metal' });
    // main courante : du pied, le long de la pente, jusqu'au haut, enroulée aux deux bouts
    const pts = [[xo, 0.62, zf - dir * 0.02], [xo, 0.86, zf - dir * 0.08], [xo, 1.0, zf + dir * 0.06], [xo, 1.02, za], [xo, SL + 1.02, zb], [xo, SL + 1.0, zt - dir * 0.06], [xo, SL + 0.86, zt + dir * 0.08], [xo, SL + 0.62, zt + dir * 0.02]];
    M.save().color([0.05, 0.05, 0.05]); M.cls = 1; M.tube('rubber', 0.034, pts, 6); M.restore();
  }
  // sous l'escalier : le caisson d'acier brossé (le dessous de la rampe), une plinthe sombre
  for (const x of [x0, x1]) box('dark', x + (x === x0 ? -0.04 : 0), x + (x === x0 ? 0 : 0.04), 0, 0.12, Math.min(za, zb), Math.max(za, zb), { collide: false });
}

/* ---------- L'atrium : escaliers mécaniques à l'arrêt, garde-corps de verre, fontaine, kiosques, bancs, suspensions ---------- */
function galAtrium() {
  const { SL, RF } = GL, M = DECOR;
  // garde-corps de verre autour des deux puits (coursives à 5 m) et au bout des coursives sur la restauration ; une main courante d'acier
  const rail = (axis, f, a0, a1) => {
    if (a1 - a0 < 0.05) return;
    if (axis === 'x') { gGlass(a0, a1, SL, SL + 1.1, f - 0.03, f + 0.03, true); box('steel', a0, a1, SL + 1.1, SL + 1.16, f - 0.05, f + 0.05, { tint: GPAL.steel, collide: false }); COL.push({ x0: a0, x1: a1, y0: SL + 1.1, y1: SL + 1.95, z0: f - 0.03, z1: f + 0.03, m: 'glass', ray: false, noRay: true, inv: true, noTop: true }); }
    else { gGlass(f - 0.03, f + 0.03, SL, SL + 1.1, a0, a1, true); box('steel', f - 0.05, f + 0.05, SL + 1.1, SL + 1.16, a0, a1, { tint: GPAL.steel, collide: false }); COL.push({ x0: f - 0.03, x1: f + 0.03, y0: SL + 1.1, y1: SL + 1.95, z0: a0, z1: a1, m: 'glass', ray: false, noRay: true, inv: true, noTop: true }); }
  };
  rail('x', -4, -13, -10); rail('x', -4, -7, -2); rail('x', 4, -13, -2); rail('z', -13, -4, 4); rail('z', -2, -4, 4);
  rail('x', -4, 2, 13); rail('x', 4, 2, 7); rail('x', 4, 10, 13); rail('z', 2, -4, 4); rail('z', 13, -4, 4);
  rail('z', 24, -9, 9);
  // escaliers mécaniques à l'arrêt : marches d'acier, flancs, mains courantes ; dessous plein (ramp). za : le pied (rez-de-chaussée), zb : le
  // haut (l'étage). (Jusqu'en 6.3.1, le verre, la main courante et le garde-corps invisible de l'escalier ouest prenaient les hauteurs de la
  // rampe, rangées par z croissant : ils montaient à l'envers des marches.)
  for (const [x0, x1, za, zb] of [[-10, -7, 3.5, -4], [7, 10, -3.5, 4]]) {
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb), yAt = (t) => lerp(0, SL, t);
    ramp(x0, x1, z0, z1, 'z', za < zb ? 0 : SL, za < zb ? SL : 0, 'steel', [0.72, 0.74, 0.76], { mat: 'steel' });
    for (const x of [x0, x1]) {
      // au-dessus du flanc plein (celui de la rampe), un garde-corps de verre en pente et sa main courante noire
      const xo = x + (x === x0 ? -0.025 : 0.025);
      M.save().color([0.85, 0.95, 0.95]); M.cls = 1; M.quad('galGlass', [xo, 0.05, za], [xo, SL + 0.05, zb], [xo, SL + 1.0, zb], [xo, 1.0, za], [x === x0 ? -1 : 1, 0, 0]); M.restore();
      RAILS.push({ x: xo, y: 0, a0: za, a1: zb, axis: 'z', ys: [0, SL] }); // (scellé par railingsSeal ; la main courante est celle de galEscalatorTrim)
    }
    galEscalatorTrim(x0, x1, za, zb);
    // garde-corps invisible au-dessus des flancs (on ne saute pas du haut de l'escalier dans l'atrium)
    for (const x of [x0, x1]) for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, ya = yAt(t0), yb = yAt(t1), zz0 = lerp(za, zb, t0), zz1 = lerp(za, zb, t1); COL.push({ x0: x - 0.03, x1: x + 0.03, y0: Math.min(ya, yb) + 0.2, y1: Math.max(ya, yb) + 1.9, z0: Math.min(zz0, zz1), z1: Math.max(zz0, zz1), m: 'glass', ray: false, noRay: true, inv: true, noTop: true }); }
  }
  // la fontaine (bassin rond, muret à hauteur d'assise), les kiosques (lunettes, téléphones), bancs, bacs à plantes, poubelles
  M.save().color([0.78, 0.76, 0.72]).move(-4.5, 0, 0); M.cyl('concrete', 1.6, 0.48, 24, {}); M.restore();
  M.save().color([0.1, 0.16, 0.2]).move(-4.5, 0.46, 0); M.cyl('dark', 1.42, 0.03, 24, {}); M.restore();
  M.save().color([0.72, 0.72, 0.7]).move(-4.5, 0.48, 0); M.cyl('steel', 0.18, 1.4, 10, {}); M.restore();
  DECOR.col(-6.0, -3.0, 0, 0.48, -1.5, 1.5, 'concrete');
  for (const [x, z, c] of [[4.5, 1.5, [0.85, 0.3, 0.2]], [4.5, -1.5, [0.2, 0.4, 0.75]]]) {
    box('paint', x - 0.9, x + 0.9, 0, 1.05, z - 0.6, z + 0.6, { tint: c }); box('paint', x - 1.0, x + 1.0, 2.2, 2.35, z - 0.7, z + 0.7, { tint: c, collide: false });
    for (const sx of [-1, 1]) box('steel', x + sx * 0.88, x + sx * 0.92, 1.05, 2.2, z - 0.02, z + 0.02, { tint: GPAL.steel, collide: false });
  }
  for (const x of [-21.5, -17.5, 17.5, 21.5]) for (const z of [-1.5, 1.5]) { DECOR.place(PF.platformBench(), x, 0, z * 2.4, z > 0 ? Math.PI : 0); }
  for (const x of [-19.5, 19.5]) { box('concrete', x - 1.0, x + 1.0, 0, 0.6, -1.0, 1.0, { tint: [0.6, 0.58, 0.55] }); for (let i = 0; i < 3; i++) DECOR.place(PF.bush(0.8 + GAL.R() * 0.3), x + (i - 1) * 0.5, 0.6, (GAL.R() - 0.5) * 0.6, GAL.R() * TAU, { nocol: true }); }
  for (const [x, z] of [[-12.5, 6.5], [12.5, -6.5], [-20.5, -6.5], [20.5, 6.5], [0.5, -6.5]]) DECOR.dyn('fdBin', x, 0, z, 0, { a: [0.25, 0.27, 0.28] });
  // le plan de la galerie (borne), près du hall d'entrée
  box('paint', -1.0, 1.0, 0, 2.2, 7.4, 7.6, { tint: [0.15, 0.15, 0.16] }); gSign(0, 1.5, 7.38, 1.8, 0.45, 0, -1, GSN.plan); gSign(0, 1.5, 7.62, 1.8, 0.45, 0, 1, GSN.plan);
  // suspensions de l'atrium (longues tiges depuis le toit), dalles lumineuses sous les coursives et au plafond de l'étage
  for (const [x, z] of [[-10, 0], [-5, 0], [5, 0], [10, 0]]) DECOR.place(PF.hangLamp(false, 2.6), x, RF, z, 0, { nocol: true });
  for (let x = -21; x <= 21; x += 6) for (const z of [-6.5, 6.5]) gLamp(x, GL.CL - 0.01, z, 1.4, 0.35, false, 1.3, 8);
  for (let x = -20; x <= 20; x += 8) for (const z of [-6.5, 6.5]) gLamp(x, RF - 0.03, z, 1.4, 0.35, false, 1.2, 8);
  for (const x of [-18.5, 18.5]) gLamp(x, RF - 0.03, 0, 1.4, 0.35, false, 1.2, 8);
  // les rideaux coupe-feu des deux ailes, aux deux niveaux (x = ±15, travers du mail) : un caisson rouge sous le plafond ; le poste de sécurité
  // les manœuvre (survLockSet), les morts les forcent
  for (const [x, w] of [[-15, 'w'], [15, 'e']]) for (const lv of [0, 1]) {
    const y0 = lv ? SL : 0, top = lv ? RF : GL.CL;
    box('paint', x - 0.25, x + 0.25, top - 0.45, top, GL.nf, GL.sf, { tint: [0.5, 0.1, 0.08], m: 'metal' });
    gOpen('portail', 'z', x, GL.nf + 0.07, GL.sf - 0.07, y0, top - 0.45 - y0, x < 0 ? -1 : 1, 'galerie', { gate: 'fire', noBoards: true, wing: w, t: 0.3, name: w === 'w' ? _t('Le rideau coupe-feu de l\u0027aile ouest') : _t('Le rideau coupe-feu de l\u0027aile est') });
  }
  // portes coupe-feu des couloirs de service, aux mêmes limites : ouvertes au départ (cales), le poste de sécurité les ferme avec les rideaux
  for (const [x, w] of [[-15, 'w'], [15, 'e']]) {
    gOpen('porte', 'z', x, -20.6, -18.4, 0, 2.4, x < 0 ? -1 : 1, 'srvN', { gate: 'door', wing: w, name: _t('Une porte coupe-feu') });
    gOpen('porte', 'z', x, -20.6, -18.4, SL, 2.4, x < 0 ? -1 : 1, 'srvNU', { gate: 'door', wing: w, name: _t('Une porte coupe-feu') });
    gOpen('porte', 'z', x, 18.4, 20.6, 0, 2.4, x < 0 ? -1 : 1, 'srvS', { gate: 'door', wing: w, name: _t('Une porte coupe-feu') });
  }
  // la grille du hall d'entrée (sur le mail) : une seconde ligne quand les portes vitrées tombent
  gOpen('portail', 'x', GL.sf, -3, 3, 0, 3.6, -1, 'hall', { gate: 'grille', name: _t('La grille du hall d\u0027entrée') });
  // le quai : la porte du personnel sur le mail, en bas et en haut
  gOpen('porte', 'x', GL.nf, 3.9, 5.1, 0, 2.25, 1, 'quai', { gate: 'door', closed: true, name: _t('La porte du quai') });
  gOpen('porte', 'x', GL.nf, 3.9, 5.1, SL, 2.25, 1, 'quai', { gate: 'door', closed: true, name: _t('La porte de la mezzanine') });
  // les portes de service du hall d'entrée
  for (const x of [-3, 3]) gOpen('porte', 'z', x, 18.9, 20.1, 0, 2.2, x < 0 ? -1 : 1, 'hall', { gate: 'door', closed: true, name: _t('Une porte de service') });
  // affiches de soldes, enseigne de la restauration, sortie sur le hall
  gSign(-13, 3.2, 8.86, 1.6, 0.4, 0, -1, GSN.soldes); gSign(13, 8.2, -8.86, 1.6, 0.4, 0, 1, GSN.soldes);
  gSign(23.93, 7.4, 0, 3.2, 0.8, -1, 0, GSN.restau);
}

/* ---------- Le grand magasin (Whitcombe) ---------- */
function galAnchor() {
  const { SL, RF, CL } = GL, X0 = GL.X0, X1 = -24.3, M = DECOR, R = GAL.R;
  // la réserve (au nord, z de -21 à -14, aux deux niveaux) : porte sur le magasin ; au rez-de-chaussée, la cage cadenassée
  gWall('x', -14, X0, X1, 0, CL, [gDoor(-30.5, 1.6, 2.3)], { tint: GPAL.srv }); gWall('x', -14, X0, X1, SL, RF - SL, [gDoor(-30.5, 1.6, 2.3)], { tint: GPAL.srv });
  for (const y0 of [0, SL]) { gLamp(-31, y0 ? RF - 0.03 : CL - 0.01, -17.5, 1.2, 0.3, true, 1.2, 7); }
  // la cage : grillage, palettes, planches, tôles (objectif cage : avec les outils)
  // (la cage : grillage sur trois côtés contre le mur nord, entre la porte de la cour et celle du couloir ; on ne prend rien sans l'ouvrir)
  for (const [a, b, c, d] of [[-31.5, -27.5, -17.25, -17.2], [-31.55, -31.5, -20.95, -17.2], [-27.55, -27.5, -20.95, -17.2]]) box('steel', a, b, 0, 2.6, c, d, { tint: [0.5, 0.52, 0.54], collide: false });
  for (let x = -31.3; x < -27.6; x += 0.25) box('steel', x - 0.008, x + 0.008, 0, 2.6, -17.24, -17.21, { tint: [0.4, 0.42, 0.44], collide: false });
  DECOR.col(-31.55, -27.5, 0, 2.6, -20.95, -17.2, 'metal', false, false);
  for (const [x, z] of [[-30.6, -19.8], [-28.5, -19.8], [-29.6, -18.3]]) DECOR.place(PF.pallet(), x, 0, z, 0);
  survObjective('cage', -29.5, -16.5, { y: 0 });
  survCache('planks', -36.5, 0, -15.2, 0); survCache('metal', -36.5, 0, -18.6, 0);
  for (let i = 0; i < 6; i++) M.dyn('cardboard', -26.5 - R() * 1.2, 0, -16.5 + R() * 2, R(), { a: [0.6, 0.45, 0.45] });
  // rez-de-chaussée : parfumerie et cosmétiques près de l'entrée du mail, portants, chaussures ; l'escalier vers l'étage, au sud
  for (const [x, z] of [[-27.5, -2.5], [-27.5, 2.5], [-31.5, -6.5], [-31.5, 6.5]]) { box('paint', x - 1.1, x + 1.1, 0, 1.0, z - 0.45, z + 0.45, { tint: [0.92, 0.9, 0.86] }); gGlass(x - 1.1, x + 1.1, 1.0, 1.3, z - 0.44, z + 0.44); }
  for (let i = 0; i < 4; i++) { const z = -11 + i * 2.6, x = -35.5; box('steel', x - 1.3, x + 1.3, 1.5, 1.53, z - 0.02, z + 0.02, { tint: GPAL.steel, collide: false }); for (let j = 0; j < 20; j++) box('canvas', x - 1.25 + j * 0.13, x - 1.2 + j * 0.13, 0.6, 1.48, z - 0.22, z + 0.22, { tint: [[0.1, 0.1, 0.12], [0.8, 0.78, 0.74], [0.35, 0.4, 0.55]][j % 3], collide: false }); M.col(x - 1.3, x + 1.3, 0, 1.5, z - 0.24, z + 0.24, 'dirt'); }
  ramp(-36, -33, 5, 12.5, 'z', SL, 0, 'galFloor', [0.75, 0.74, 0.72], { mat: 'concrete' });
  railing(-33, null, 0, 5, 12.5, 'z', [SL, 0], GPAL.trim); railing(-36, null, 0, 5, 12.5, 'z', [SL, 0], GPAL.trim);
  for (const [a, b, f, ax] of [[-36, -33, 12.5, 'x'], [5, 12.5, -36, 'z'], [5, 12.5, -33, 'z']]) {
    if (ax === 'x') railing(f, null, SL, a, b, 'x', null, GPAL.trim); else railing(f, null, SL, a, b, 'z', null, GPAL.trim);
  }
  for (let z = -10; z <= 18; z += 7) for (const x of [-34, -28]) gLamp(x, CL - 0.01, z, 1.4, 0.35, false, 1.2, 8);
  for (let z = -10; z <= 18; z += 7) for (const x of [-34, -28]) gLamp(x, RF - 0.03, z, 1.4, 0.35, false, 1.1, 8);
  for (const [x, z, r, y] of [[-26.5, 6.5, 1.2, 0], [-26.5, -6.5, 2.0, 0], [-30.2, 9.4, -0.6, 0], [-27, 8, 0.4, SL]]) DECOR.place(PF.galMannequin(), x, y, z, r);
  // cabines d'essayage au sud ; la porte de service vers le couloir sud
  for (let i = 0; i < 4; i++) box('canvas', -33 + i * 1.6, -32.95 + i * 1.6, 0, 2.2, 17, 20.6, { tint: [0.3, 0.32, 0.36] });
  // étage : le rayon meubles (de quoi barricader), lits, lampes
  survProp('couch', -28.5, SL, -6, 0); survProp('couch', -32.5, SL, -6, 0); survProp('wardrobe', -37.6, SL, -9, Math.PI / 2); survProp('dresser', -28.5, SL, -2, Math.PI); survProp('dresser', -32.5, SL, 16, 0);
  for (const [x, z] of [[-29.5, 16.5], [-35.5, 16.5], [-28.5, 2.5]]) { box('wood', x - 1.0, x + 1.0, SL, SL + 0.5, z - 1.0, z + 1.0, { tint: [0.5, 0.38, 0.28] }); box('canvas', x - 0.95, x + 0.95, SL + 0.5, SL + 0.65, z - 0.95, z + 0.95, { tint: [0.85, 0.83, 0.78], collide: false }); }
  // l'enseigne sur le mail (aux deux niveaux) et sur la façade ouest
  gSign(-24.0 + 0.04, 4.1, 0, 3.6, 0.9, 1, 0, GSN.whitcombe); gSign(-24.0 + 0.04, SL + 3.95, 0, 3.6, 0.9, 1, 0, GSN.whitcombe);
  gSign(X0 - 0.52, 9.65, 0, 4.8, 1.2, -1, 0, GSN.whitcombe);
  // ses ouvertures : l'entrée sur le mail (rideau de 8 m en bas, 6 m en haut), les portes des couloirs, la porte de la réserve
  gOpen('portail', 'z', -24.15, -4, 4, 0, 3.8, 1, 'whitcombe', { gate: 'grille', t: 0.3, name: _t('Le rideau de {0}', 'Whitcombe') });
  gOpen('portail', 'z', -24.15, -3, 3, SL, 3.4, 1, 'whitcombe', { gate: 'grille', t: 0.3, name: _t('Le rideau de {0}', 'Whitcombe') });
  gOpen('porte', 'z', -24.15, -20.1, -18.9, 0, 2.2, 1, 'whitcombe', { gate: 'door', closed: true, t: 0.3, name: _t('L\u0027arrière de {0}', 'Whitcombe') });
  gOpen('porte', 'z', -24.15, 18.9, 20.1, 0, 2.2, 1, 'whitcombe', { gate: 'door', closed: true, t: 0.3, name: _t('L\u0027arrière de {0}', 'Whitcombe') });
  gOpen('porte', 'z', -24.15, -20.1, -18.9, SL, 2.2, 1, 'whitcombe', { gate: 'door', closed: true, t: 0.3, name: _t('L\u0027arrière de {0}', 'Whitcombe') });
  void X1;
}

/* ---------- La restauration : quatre comptoirs et leurs cuisines, les tables, une verrière ---------- */
function galFood() {
  const { CL } = GL, M = DECOR, R = GAL.R;
  const V = [['napoli', 'n', 24, 31], ['smokehouse', 'n', 31, 38], ['wok', 's', 24, 31], ['brew', 's', 31, 38]];
  for (const [id, row, x0, x1] of V) {
    const n = row === 'n', f = n ? GL.nf : GL.sf, sg = n ? -1 : 1, Z = (d) => f + sg * d, a0 = x0 + 0.5, a1 = x1 - 0.5;
    // le comptoir (on passe par le portillon au bout), le rideau par-dessus ; la cuisine : fours, plans de travail, bonbonnes de gaz
    box('paint', a0, a1 - 1.6, 0, 1.05, Math.min(Z(1.6), Z(2.4)), Math.max(Z(1.6), Z(2.4)), { tint: [0.55, 0.52, 0.48], m: 'metal' });
    box('steel', a0, a1 - 1.6, 1.05, 1.1, Math.min(Z(1.55), Z(2.45)), Math.max(Z(1.55), Z(2.45)), { tint: [0.72, 0.73, 0.75], collide: false });
    const bk = (x0 + x1) / 2; for (const [a, b] of [[x0 + 0.3, bk - 1.2], [bk + 1.2, x1 - 0.3]]) box('steel', a, b, 0, 0.95, Math.min(Z(8.2), Z(8.9)), Math.max(Z(8.2), Z(8.9)), { tint: [0.6, 0.62, 0.64] });
    box('steel', x0 + 0.6, x0 + 2.4, 0.95, 1.9, Math.min(Z(8.3), Z(8.9)), Math.max(Z(8.3), Z(8.9)), { tint: [0.35, 0.35, 0.36] });
    box('steel', x0 + 2.5, x1 - 2.5, 0, 0.9, Math.min(Z(4.4), Z(5.4)), Math.max(Z(4.4), Z(5.4)), { tint: [0.68, 0.7, 0.72] });
    for (const dx of [0.6, 1.2]) DECOR.dyn('gasBottle', x1 - 0.6, 0, Z(7.2 - dx), 0, {});
    const fz = f - sg * 0.07; gSign((a0 + a1) / 2, 3.95, fz - sg * 0.13, 4.6, 0.9, 0, -sg, GSN[id]); box('paint', x0 + 0.1, x1 - 0.1, 3.4, 4.5, n ? fz : fz - 0.12, n ? fz + 0.12 : fz, { tint: [0.12, 0.12, 0.13], collide: false });
    gLamp((x0 + x1) / 2, CL - 0.01, Z(4), 1.6, 0.4, true, 1.2, 8);
    gOpen('portail', 'x', f, a0, a1, 0, 3.2, -sg, id, { gate: 'grille', name: _t('Le rideau de {0}', GNAME[id]) });
    gOpen('porte', 'x', n ? GL.nb : GL.sb, bk - 0.6, bk + 0.6, 0, 2.2, sg, id, { gate: 'door', closed: true, name: _t('L\u0027arrière de {0}', GNAME[id]) });
    void M;
  }
  // les tables (props : on les renverse, les morts les bousculent), des chaises renversées
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = 26.5 + i * 3, z = -6.5 + j * 4.33; if (Math.abs(z) < 2.8 && i >= 2) continue;
    DECOR.dyn('cafeTable', x, 0, z, 0, {});
    for (const [dx, dz] of [[-0.85, 0], [0.85, 0], [0, 0.85]]) if (R() < 0.85) DECOR.dyn('chair', x + dx, 0, z + dz, Math.atan2(dx, dz) + Math.PI, R() < 0.2 ? { rz: Math.PI / 2 } : {});
  }
  for (const [x, z] of [[25.5, 7.5], [36.5, -7.5]]) DECOR.dyn('fdBin', x, 0, z, 0, { a: [0.25, 0.27, 0.28] });
  for (const [x, z] of [[28, -3], [34, -3], [28, 3], [34, 3]]) DECOR.place(PF.hangLamp(false, 3.4), x, GL.RF, z, 0, { nocol: true });
}

/* ---------- Le quai, les couloirs de service, le placard d'entretien ---------- */
function galService() {
  const { SL, RF, CL } = GL, M = DECOR, R = GAL.R;
  // le quai : l'escalier de service (le long du mur sud, de x = -5 à 3), sa rampe ; la mezzanine (garde-corps) ; le groupe électrogène
  ramp(-5, 3, -11, -9.07, 'x', 0, SL, 'steel', [0.36, 0.37, 0.4], { mat: 'steel' });
  railing(-11, null, 0, -5, 3, 'x', [0, SL], [0.75, 0.6, 0.1]);
  railing(-18, null, SL, -6, 3, 'x', null, [0.75, 0.6, 0.1]); railing(3, null, SL, -18, -11, 'z', null, [0.75, 0.6, 0.1]);
  DECOR.place(PF.generator(), -4.5, 0, -16.5, Math.PI / 2); survObjective('power', -4.5, -16.5, { y: 0 });
  survCache('metal', 1.5, 0, -15.4, 0); survCache('planks', -1.5, 0, -13.6, Math.PI / 2);
  for (const [x, z] of [[-3.2, -12.6], [-2.4, -12.6], [0.4, -17.5]]) DECOR.place(PF.pallet(), x, 0, z, R() * 0.2);
  for (const [x, z] of [[2.5, -12.2], [2.5, -13.0]]) DECOR.dyn('barrel', x, 0, z, 0, { tint: [0.62, 0.12, 0.1] });
  for (let i = 0; i < 8; i++) M.dyn('cardboard', -1 + R() * 3.5, 0, -17.5 + R() * 2, R(), { a: [0.6, 0.45, 0.45] });
  DECOR.dyn('jerrycan', -3.4, 0, -15.2, 0.3, { tint: [0.7, 0.12, 0.08] });
  // la salle de pause abandonnée : table, chaises, gobelets
  tableSet(DECOR, 4.5, -15.5, 0, [[-0.4, 0.72], [0.45, -0.72]], [0.4, 0.42, 0.44]);
  gLamp(-3, CL - 0.01, -19.5, 1.4, 0.3, true, 1.2, 8); gLamp(4.5, CL - 0.01, -14, 1.4, 0.3, true, 1.2, 8); gLamp(-2, RF - 0.03, -13.5, 1.4, 0.3, true, 1.4, 10); gLamp(1.5, RF - 0.03, -13.5, 1.4, 0.3, true, 1.4, 10);
  gSign(0, 5.0, GL.Z0 - 0.53, 2.4, 0.6, 0, -1, GSN.livraison);
  // couloirs : néons, tuyaux au plafond, panneaux d'issue de secours, accès réservé
  for (const [z, x0, x1, y] of [[-19.5, -22, 36, 0], [19.5, -22, 36, 0], [-19.5, -22, 22, SL]]) {
    for (let x = x0; x <= x1; x += 8) if (Math.abs(x) > 6.5 || y) gLamp(x + 0.5, y + (y ? RF - SL : CL) - 0.01, z, 1.2, 0.18, true, 0.9, 7);
    for (const [a, b] of z > 0 ? [[x0 - 2, -3], [3, x1 + 2]] : [[x0 - 2, x1 + 2]]) box('steel', a, b, (y ? RF : CL) - 0.35, (y ? RF : CL) - 0.25, z + 1.15, z + 1.25, { tint: [0.45, 0.47, 0.48], collide: false });
  }
  for (const [x, z, nx, nz, y] of [[-22.5, -20.97, 0, 1, 2.6], [-22.5, 20.97, 0, -1, 2.6], [12.5, 20.97, 0, -1, 2.65], [37.97, -19.5, -1, 0, 2.65], [37.97, 19.5, -1, 0, 2.65], [-34.5, -20.97, 0, 1, 2.65]]) {
    gSign(x, y, z, 0.62, 0.16, nx, nz, GSN.sortie, 'galSignE'); DECOR.lamp(x + nx * 0.4, y - 0.2, z + nz * 0.4, [0.3, 1.0, 0.5], 0.5, 3.5);
  }
  for (const [x, z, nx, nz] of [[4.5, -8.92, 0, 1], [-3.08, 19.5, -1, 0], [3.08, 19.5, 1, 0]]) gSign(x, 2.6, z, 0.36, 0.36 * 0.25, nx, nz, GSN.prive); // (portes du personnel)
  // le placard d'entretien (couloir sud, derrière Stride) : la caisse à outils, seaux, balais
  gWall('z', -11, 16, GL.sb, 0, CL, [], { tint: GPAL.srv }); gWall('x', 16, -11, -8, 0, CL, [], { tint: GPAL.srv });
  survCache('tools', -10.62, 0.6, 16.9, Math.PI / 2); box('wood', -10.93, -10.33, 0, 0.6, 16.1, 17.7, { tint: [0.45, 0.35, 0.26] });
  for (const z of [16.4, 16.8]) { M.save().color([0.2, 0.4, 0.7]).move(-8.45, 0, z); M.cyl('plastic', 0.15, 0.3, 10, {}); M.restore(); }
  gOpen('porte', 'x', GL.sb, -10.1, -8.9, 0, 2.2, 1, 'entretien', { gate: 'door', closed: true, name: '' });
  gLamp(-9.5, CL - 0.01, 17, 0.6, 0.2, true, 0.7, 4);
  // cartons et poubelles le long des couloirs, une palette abandonnée
  for (const [x, z] of [[-20.5, -20.5], [8.5, -20.6], [26.5, -20.6], [-14, 20.6], [7.5, 20.5], [28.5, 20.6]]) { DECOR.dyn('fdBin', x, 0, z, 0, { a: [0.2, 0.32, 0.22] }); M.dyn('cardboard', x + 1.0, 0, z, R(), { a: [0.6, 0.5, 0.5] }); }
}

/* ---------- Dehors : la marquise de l'entrée, le parking, la cour de livraison, les voitures abandonnées, la lisière de la ville ---------- */
function galOutside() {
  const M = DECOR, R = GAL.R, Z1 = GL.Z1 + 0.5, Z0 = GL.Z0 - 0.5;
  // marquise de l'entrée principale, ses poteaux ; l'enseigne HALCYON au-dessus ; marquises des entrées est et ouest
  box('paint', -7, 7, 4.2, 4.6, Z1, Z1 + 4.5, { tint: [0.2, 0.22, 0.25], m: 'metal' }); for (const x of [-6.6, 6.6]) box('steel', x - 0.12, x + 0.12, 0, 4.2, Z1 + 4.1, Z1 + 4.35, { tint: GPAL.steel });
  gLamp(-3, 4.19, Z1 + 2.2, 1.2, 0.3, false, 1.6, 9); gLamp(3, 4.19, Z1 + 2.2, 1.2, 0.3, false, 1.6, 9);
  // façades : pilastres tous les 8 m, bandeau à l'étage, bandes vitrées sombres de l'étage (sans collision : à fleur du mur)
  for (const [ax, f, s, a0, a1] of [['x', Z1, 1, GL.X0 - 0.5, GL.X1 + 0.5], ['x', Z0, -1, GL.X0 - 0.5, GL.X1 + 0.5], ['z', GL.X1 + 0.5, 1, Z0, Z1], ['z', GL.X0 - 0.5, -1, Z0, Z1]]) {
    // (ni devant une entrée, ni contre une porte ou un pan à brèche de cette face)
    const holes = SURV.open.filter((o) => o.ext && o.axis === ax && Math.abs(o.fixed - f) < 0.6), near = (a) => (ax === 'x' && f > 0 && Math.abs(a) < 7.5) || holes.some((o) => a > o.a0 - 1.2 && a < o.a1 + 1.2);
    const bx = (a, b, y0, y1, d0, d1, key, o) => (ax === 'x' ? box(key, a, b, y0, y1, f + s * d0, f + s * d1, o) : box(key, f + s * d0, f + s * d1, y0, y1, a, b, o));
    for (let a = a0 + 4; a < a1 - 3; a += 8) if (!near(a)) bx(a - 0.35, a + 0.35, 0, GL.RF + 1.1, 0, 0.3, 'concrete', { tint: [0.5, 0.49, 0.47] });
    bx(a0, a1, 4.6, 5.1, 0, 0.18, 'paint', { tint: [0.2, 0.22, 0.25], collide: false });
    for (let a = a0 + 4.6; a < a1 - 3.6; a += 8) if (!near(a + 3.4) && !near(a)) bx(a, a + 6.8, 6.1, 8.3, 0, 0.04, 'glass', { tint: [0.18, 0.22, 0.26], collide: false });
  }
  gSign(0, 9.85, Z1 + 0.03, 7.2, 1.8, 0, 1, GSN.halcyon);
  // le totem du parking : HALCYON en haut d'un mât, se voit de loin
  box('concrete', -21.6, -20.4, 0, 7.6, 25.4, 26.2, { tint: [0.42, 0.42, 0.44] }); gSign(-21, 8.4, 26.23, 3.6, 0.9, 0, 1, GSN.halcyon); gSign(-21, 8.4, 25.37, 3.6, 0.9, 0, -1, GSN.halcyon);
  box('paint', -22.9, -19.1, 7.6, 9.2, 25.3, 26.3, { tint: [0.08, 0.1, 0.14], collide: false }); gSign(12.5, 3.0, Z1 + 0.02, 0.5, 0.5 * 0.25, 0, 1, GSN.prive);
  for (const [x, nx] of [[GL.X1 + 0.5, 1], [GL.X0 - 0.5, -1]]) { box('paint', Math.min(x, x + nx * 4), Math.max(x, x + nx * 4), 4.2, 4.6, -5, 5, { tint: [0.2, 0.22, 0.25], m: 'metal' }); for (const z of [-4.6, 4.6]) box('steel', x + nx * 3.6 - 0.12, x + nx * 3.6 + 0.12, 0, 4.2, z - 0.12, z + 0.12, { tint: GPAL.steel }); }
  gSign(GL.X1 + 0.53, 9.5, 0, 3.6, 0.9, 1, 0, GSN.restau);
  // le parking (au sud) : lignes des places, voitures abandonnées (destructibles : 04c-degats.js), abris à chariots, lampadaires
  for (let x = -44; x <= 44; x += 2.8) for (const z0 of [30, 39.5]) if (Math.abs(x) > 8.5 || z0 > 35) box('paint', x - 0.06, x + 0.06, 0.02, 0.03, z0, z0 + 5, { tint: [0.92, 0.92, 0.88], collide: false, ao: false });
  for (const z of [30, 35, 39.5, 44.5]) box('paint', -44, 44, 0.02, 0.03, z - 0.06, z + 0.06, { tint: [0.92, 0.92, 0.88], collide: false, ao: false });
  const cars = [['sedan', -18.2, 32.5, 0.05, [0.5, 0.1, 0.1]], ['hatch', -9.8, 42, -0.04, [0.2, 0.3, 0.5]], ['suv', 15.4, 32.6, 3.1, [0.15, 0.15, 0.16]], ['mpv', 27, 42.2, 0.1, [0.75, 0.75, 0.72]], ['cross', -31.4, 41.8, 3.2, [0.35, 0.4, 0.3]], ['sedan', 4.5, 27.6, 1.15, [0.85, 0.85, 0.82]], ['hatch', 36.5, 32.4, 0.0, [0.6, 0.45, 0.15]], ['sedan', -38.6, 32.5, 3.05, [0.25, 0.28, 0.32]]];
  for (const [m, x, z, r, t] of cars) vehicle(PF.car(m, {}), x, 0, z, r, { tint: t });
  for (const [x, z] of [[-24, 37.2], [22, 37.2]]) { for (const dz of [-0.5, 0.5]) box('steel', x - 3, x + 3, 0.9, 0.96, z + dz - 0.03, z + dz + 0.03, { tint: GPAL.steel, collide: false }); M.col(x - 3, x + 3, 0, 1.0, z - 0.55, z + 0.55, 'metal'); for (let i = 0; i < 4; i++) DECOR.dyn('galCart', x - 2.2 + i * 0.75, 0, z, Math.PI / 2, {}); }
  for (const [x, z, rz] of [[-6, 26.5, Math.PI / 2], [8.5, 31, 0], [-2.5, 36, 1.2]]) DECOR.dyn('galCart', x, 0, z, R() * TAU, rz ? { rz } : {}); // chariots abandonnés, l'un renversé
  for (const [x, z] of [[-30, 35], [-10, 35], [10, 35], [30, 35], [-40, -32], [40, -32], [50, 0], [-50, 0]]) DECOR.place(PF.lampPost(), x, 0, z, R() * TAU);
  gSign(-44, 3.2, 28.5, 0.8, 0.2, 0, 1, GSN.parking);
  // la cour de livraison (au nord) : le camion du quai (objectif : le réparer, puis fuir), bennes, palettes, chariot élévateur
  vehicle(PF.truck('box', {}), -3.5, 0, Z0 - 5.6, 0, { tint: [0.82, 0.82, 0.8], fixed: true }); survObjective('truck', -1.5, Z0 - 7.4, { y: 0 }); // (le camion du quai : on le répare côté cabine)
  for (const [x, z, t] of [[-14, Z0 - 2.4, [0.16, 0.32, 0.22]], [-17, Z0 - 2.4, [0.18, 0.24, 0.4]], [14, Z0 - 2.4, [0.16, 0.32, 0.22]]]) DECOR.place(PF.dumpster(), x, 0, z, 0, { tint: t });
  for (const x of [-3.5, 3.5]) { box('steel', x - 0.25, x + 0.25, 4.7, 4.85, Z0 - 0.4, Z0, { tint: GPAL.trim, collide: false }); box('lamp', x - 0.2, x + 0.2, 4.68, 4.7, Z0 - 0.35, Z0 - 0.05, { collide: false }); DECOR.lamp(x, 4.4, Z0 - 0.8, [1.0, 0.8, 0.55], 1.6, 9, 0.7); }
  for (const [x, z] of [[9, Z0 - 3], [9.2, Z0 - 4.3], [11, Z0 - 3.2]]) DECOR.place(PF.pallet(), x, 0, z, R() * 0.3);
  DECOR.place(PF.forklift(), 6.5, 0, Z0 - 7, 2.2);
  for (const x of [-5.5, -1.5, 1.5, 5.5]) box('rubber', x - 0.2, x + 0.2, 0.6, 1.2, Z0 - 0.15, Z0, { tint: [0.08, 0.08, 0.08], collide: false }); // butoirs du quai
  for (const [x, z] of [[-26, Z0 - 2], [22, Z0 - 2.5], [-9, Z0 - 1.5]]) DECOR.dyn('trashBag', x, 0, z, R(), {});
  // traces de l'évacuation ratée : barrières renversées, sacs de courses, une voiture de police en travers, flaques sombres
  for (const [x, z, r] of [[-5.5, 25, 0.4], [5, 25.2, -0.3]]) { box('paint', x - 1.1, x + 1.1, 0, 0.95, z - 0.04, z + 0.04, { tint: [0.95, 0.95, 0.95], rot: r }); }
  vehicle(PF.car('sedan', {}), 12.5, 0, 25.8, 1.9, { tint: [0.08, 0.08, 0.1] });
  for (const [x, z, s] of [[-1.2, 22.6, 1.1], [1.8, 23.4, 0.8], [-0.4, 19.6, 0.7], [36.5, 1.2, 0.9], [-36.4, -1, 0.8], [-12.6, -19.4, 0.6], [20.4, 19.8, 0.7]]) { const w = s * (0.8 + R() * 0.6); box('plastic', x - w, x + w, 0.022, 0.026, z - w * 0.4, z + w * 0.4, { tint: [0.24, 0.03, 0.03], collide: false, rot: R() * 3 }); }
  for (let i = 0; i < 6; i++) { const x = -3 + R() * 6, z = 24 + R() * 4; box('cardboard', x - 0.18, x + 0.18, 0, 0.36, z - 0.08, z + 0.08, { tint: [[0.85, 0.2, 0.2], [0.95, 0.95, 0.9], [0.2, 0.3, 0.6]][i % 3], collide: false, rot: R() * 3 }); }
  // trottoirs, bordures ; arbres et haie aux limites ; la ville, éteinte, au loin
  const kinds = ['linden', 'maple', 'oak'];
  for (let x = -52; x <= 52; x += 7) for (const z of [47, -43]) M.place(PF.tree(kinds[Math.floor(R() * 3)], R.range(7, 10), R.range(2.4, 3.4), 1 + Math.floor(R() * 5)), x + R() * 2, 0, z + R(), R() * TAU, { nocol: true });
  for (let z = -40; z <= 44; z += 7) for (const x of [-55, 55]) M.place(PF.tree(kinds[Math.floor(R() * 3)], R.range(7, 10), R.range(2.4, 3.4), 1 + Math.floor(R() * 5)), x + R(), 0, z + R() * 2, R() * TAU, { nocol: true });
  for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU, r = 95 + R() * 40; farBuilding(Math.cos(a) * r, Math.sin(a) * r, 18 + R() * 16, 14 + R() * 12, 10 + R() * 26, [0.42, 0.42, 0.44], R); }
}

/* ---------- Sol ---------- */
function galGround() {
  const sp = new Splat();
  // fond : l'asphalte du parking ; r : béton (la cour de livraison, sous le bâtiment) ; g : pavés (trottoirs) ; b : pelouse (bandes du bord) ; a : taches
  sp.rect(0, -32, 32, -46, GL.Z0, 0.6, 1, 0.8); sp.rect(0, GL.X0 - 1, GL.X1 + 1, GL.Z0 - 1, GL.Z1 + 1, 0.2, 1, 0.1);
  sp.rect(1, GL.X0 - 4, GL.X1 + 4, GL.Z1, GL.Z1 + 3.5, 0.2, 1, 0.3); sp.rect(1, GL.X1, GL.X1 + 6, -8, 8, 0.2, 1, 0.3); sp.rect(1, GL.X0 - 6, GL.X0, -8, 8, 0.2, 1, 0.3);
  sp.rect(2, -60, -49, -50, 54, 0.6, 1, 0.8); sp.rect(2, 49, 60, -50, 54, 0.6, 1, 0.8); sp.rect(2, -60, 60, 46, 54, 0.6, 1, 0.8); sp.rect(2, -60, 60, -50, -43.5, 0.6, 1, 0.8);
  for (let i = 0; i < 14; i++) { const x = -40 + GAL.R() * 80, z = 27 + GAL.R() * 18; sp.rect(3, x - 0.8, x + 0.8, z - 0.5, z + 0.5, 0.6, 0.5, 1.2); }
  GAL.splat = sp;
  MAT.ground = groundMat(sp.finish(0.12), [SPLAT.x0, SPLAT.z0, SPLAT.w, SPLAT.d], GROUND_GALERIE);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.5, 0.5, 0.5]).local(1); M.aoFn = null; M.plane('ground', 660, 660, 1, 1); M.restore();
  WORLD.force = null;
}
const GROUND_GALERIE = { base: 'asphalt', l1: 'concrete', l2: 'pavers', l3: 'lawn', pom: [0, 0, 0.02, 0], dirt: [0.42, 0.4, 0.38], mul: 0, env: 0.35 };
function galSurface(p) {
  const S = GAL.splat; if (!S || p.y > 0.2) return 'concrete';
  if (S.at(2, p.x, p.z) > 0.5) return 'grass';
  return 'concrete';
}

/* ---------- Chaque image : enseignes et écrans suivent le courant ; quelques-uns vacillent ---------- */
function galUpdate(t, dt) {
  const on = !SV.on || (SV.power && SV.blackT <= 0), k = on ? 1.35 : 0.1;
  if (MAT.galSign) MAT.galSign.color.setScalar(damp(MAT.galSign.color.r, k, 6, dt));
  if (MAT.galSignF) MAT.galSignF.color.setScalar(on ? (Math.random() < 0.06 ? 0.2 : 1.3) : Math.random() < 0.02 ? 0.5 : 0.08);
  if (MAT.galTV) { const m = MAT.galTV.map; if (m) { m.offset.set(Math.random(), Math.random()); } MAT.galTV.color.setScalar(on ? 0.75 : 0.06); }
  if (MAT.galExit) MAT.galExit.color.setRGB(0.25, Math.random() < 0.01 ? 0.4 : 1.6, 0.6);
  if (MAT.galNeon) MAT.galNeon.color.setScalar(damp(MAT.galNeon.color.r, on ? 1.4 : 0.06, 5, dt));
  GAL.t += dt;
}
/* La fuite : le courant revient, les rideaux du quai se lèvent (et les morts de la cour entrent) */
function galExtract() {
  for (const op of SURV.open) if (op.dock && op.gate && op.gate.hp > 0 && op.gate.down) survGateSet(op, false);
  survPub('b'); survAnnounce(_t('Les rideaux du quai se lèvent'), 'warn');
}

/* ---------- Mannequin de vitrine : socle, jambes, buste, tête lisse (sans visage) ---------- */
PF.galMannequin = () => prefab('galMannequin', (M) => {
  M.local(1); M.color([0.16, 0.16, 0.17]); M.cyl('steel', 0.22, 0.03, 12, {});
  M.save().move(0, 0.03, 0); M.cyl('steel', 0.015, 0.62, 6, {}); M.restore();
  M.color([0.86, 0.85, 0.82]);
  M.save().move(0, 0.6, 0); M.lathe('plastic', [[0.0, 0], [0.13, 0.02], [0.15, 0.12], [0.13, 0.3], [0.15, 0.48], [0.18, 0.62], [0.12, 0.7], [0.045, 0.74], [0.045, 0.8], [0.09, 0.86], [0.1, 0.95], [0.07, 1.03], [0, 1.06]], 12, {}); M.restore();
  for (const sx of [-1, 1]) { M.save().move(sx * 0.19, 1.22, 0).rotZ(sx * 0.12).rotX(Math.PI); M.cyl('plastic', 0.035, 0.55, 6, {}); M.restore(); }
  M.col(-0.22, 0.22, 0, 1.7, -0.22, 0.22, 'dirt');
});
/* ---------- Chariot de supermarché (prop physique : les morts et les balles le déplacent, il roule) ---------- */
PF.galCart = () => prefab('galCart', (M) => {
  M.local(1); M.color([0.72, 0.74, 0.76]);
  for (const sx of [-0.27, 0.27]) M.boxB('steel', sx - 0.012, sx + 0.012, 0.42, 0.95, -0.45, 0.42, {});
  for (const z of [-0.45, 0.42]) M.boxB('steel', -0.28, 0.28, 0.42, 0.95, z - 0.012, z + 0.012, {});
  M.boxB('steel', -0.27, 0.27, 0.42, 0.44, -0.45, 0.42, {});
  for (let i = 0; i < 6; i++) M.boxB('steel', -0.27, 0.27, 0.5 + i * 0.075, 0.506 + i * 0.075, -0.45, -0.444, {});
  M.color([0.85, 0.2, 0.15]); M.boxB('plastic', -0.3, 0.3, 1.0, 1.04, 0.5, 0.56, {}); // la poignée
  M.color([0.72, 0.74, 0.76]); for (const sx of [-0.25, 0.25]) M.boxB('steel', sx - 0.012, sx + 0.012, 0.12, 0.42, 0.38, 0.44, {}), M.boxB('steel', sx - 0.012, sx + 0.012, 0.12, 0.42, -0.4, -0.34, {});
  M.color([0.1, 0.1, 0.1]); for (const sx of [-0.25, 0.25]) for (const z of [-0.37, 0.41]) { M.save().move(sx, 0.06, z).rotZ(Math.PI / 2); M.cyl('rubber', 0.06, 0.04, 10, {}); M.restore(); }
});
propType('galCart', { pf: () => PF.galCart(), shapes: [BOX(0, 0.5, -0.01, 0.29, 0.5, 0.46)], mass: 14, mu: 0.18, e: 0.2, rr: 1.2, resp: 2.6, blast: 7, mat: 'metal', snd: 'metal' });

/* ---------- Ambiance : nuit en ville, lueur orangée à l'horizon, intérieur au néon ---------- */
const ATMO_GALERIE = Object.assign({}, ATMO_DEFAULT, {
  sun: [-0.3, 0.62, 0.4], sunColor: 0xaab4c4, sunI: 0.36, vmSun: 0x9aa4b4, // (une lune pâle : bleue et forte, renvoyée par les puits de lumière et les verrières, elle teintait l'intérieur)
  fog: [0.05, 0.055, 0.07], fogD: 0.022, fogH: [12, 0], fogSun: 0.12,
  hemi: [0x34373f, 0x1a1612, 0.36], vmHemi: [0x353a46, 0x1a1612],
  sky: {
    zen: [0.006, 0.009, 0.02], mid: [0.025, 0.028, 0.045], hor: [0.16, 0.1, 0.07], gnd: [0.02, 0.02, 0.02],
    glow: [0.3, 0.22, 0.2], halo: [0.45, 0.48, 0.6], disk: [3.0, 3.2, 3.6], cloudLo: [0.08, 0.06, 0.06], cloudHi: [0.2, 0.15, 0.13], cloud: [0.65, 0.92, 0.6],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x0c0c0e, hdri: 'park', lit: true, lamps: 1.6, winLit: 0.3,
  bounce: [0.62, 0.58, 0.52], dust: [0.32, 0.32, 0.36], motes: [0.5, 0.5, 0.6],
  grade: { lo: [0.94, 0.97, 1.05], hi: [1.04, 0.99, 0.92], exp: 1.35, sat: 0.8, con: 1.08 }, rays: [0.3, 0.32, 0.4],
  impact: [0.35, 0.33, 0.3], wind: [380, 0.03],
  bloom: [0.7, 0.6, 0.7], aoFloor: 0.2, raysThr: 9, raysCap: 1, satExp: 1.6, interior: [2.9, 0.3, 0.4], // (sous le toit, moins de ciel bleu : mêlé aux lampes chaudes, il teintait les murs de lilas)
});

/* ---------- Définition de la carte ---------- */
MAP_DEFS.galerie = {
  type: 'close', zombie: true, only: ['zombie'], night: true,
  bounds: { x0: -56, x1: 56, z0: -46, z1: 50 },
  textures: ['plaster', 'concrete', 'steel', 'asphalt', 'pavers', 'lawn', 'wood', 'paintwood', 'crate', 'cardboard', 'canvas', 'rollshutter', 'stone', 'slate', 'bark', 'dirt', 'pathgravel', 'rooftiles', 'timber'],
  surfaces: ['hedge'],
  sound: { pack: 'amb_floreal', bed: 0.08, spots: [] },
  kit: () => galKit(),
  materials: (M) => galMaterials(M),
  art: { cam: [22, 7.2, 8.2], look: [-6, 2.2, -1], fov: 62 },
  grass: { dens: 30, density: (x, z) => { const S = GAL.splat; if (!S) return 0; return clamp(S.at(2, x, z) * 1.4 - 0.4, 0, 1); }, height: (x, z, r) => 0.12 + 0.16 * r, colors: [[0.05, 0.07, 0.03], [0.12, 0.17, 0.07], [0.2, 0.22, 0.12]], wind: [0.9, 0.8, 0.3], width: 0.012, amb: 0.3, seed: 6303 },
  landmarks: [[0, 10, 0, 'galerie'], [-31, 10, 0, 'whitcombe'], [31, 10, 0, 'restauration']],
  splat: { x0: -64, z0: -56, w: 128, d: 112, ppm: 4 },
  light: { d: 0.5 },
  far: 240,
  build() { galeriesLevel(); },
  update(t, dt) { floraUpdate(t, dt); galUpdate(t, dt); },
  unload() { GAL.splat = null; GAL.R = null; GAL.breaks = []; },
  // les survivants : au rez-de-chaussée du mail, autour de l'atrium
  spawns: [[-12, 5.5], [12, -5.5], [-18, 2.5], [18, -2.5], [0.5, 6.5], [0.5, -6.5], [-6.5, -6.5], [6.5, 6.5]],
  // caisses de munitions (08n-ravitaillement.js) : le magasin de sport, le poste de sécurité, le quai, une cuisine, le rayon meubles du grand magasin
  ammo: [[-23.2, 0, -14.5, Math.PI / 2], [13.6, GL.SL, -11.2, 0], [4.5, 0, -12.2, Math.PI], [36.2, 0, -14.5, Math.PI / 2], [-36.8, GL.SL, -3, Math.PI / 2]],
  // où naissent les morts : au bout du parking, dans la cour de livraison, aux deux bouts du bâtiment
  zspawns: [[-44, 46], [-22, 47], [0, 47.5], [22, 47], [44, 46], [53, 26], [54, 2], [53, -24], [-53, 26], [-54, 2], [-53, -24], [-40, -43], [-16, -44], [16, -44], [40, -43]],
  poi: [[0, 0, 0, 'M'], [-18, 0, 0, 'L'], [18, 0, 0, 'E'], [-31, 0, 0, 'L'], [31, 0, 0, 'E'], [0, 0, -14, 'M']],
  lane: (x) => (x < -12 ? 'L' : x > 12 ? 'E' : 'M'),
  sniper: [0, GL.SL, -6.5], coverZ: 30, heli: [40, 40], cam: 52,
  surface: (p) => galSurface(p),
  // pièces de la survie (survRoomAt) : [nom, x0, x1, z0, z1, y0, y1, bâtiment] ; la première qui contient le point l'emporte
  rooms: galRooms(),
  zones: [
    [_t('Hall d\u0027entrée'), -3, 3, 9, 21], [_t('Atrium'), -13, 13, -4, 4], [_t('Restauration'), 24, 38, -21, 21], ['Whitcombe', -38, -24, -21, 21],
    [_t('Quai de réception'), -6, 6, -21, -9], [_t('Couloir de service'), -24, 38, -21, -18], [_t('Couloir de service'), -24, 38, 18, 21],
    [_t('Galerie'), -24, 24, -9, 9], [_t('Boutiques'), -24, 24, -18, -9], [_t('Boutiques'), -24, 24, 9, 18],
    [_t('Cour de livraison'), -56, 56, -46, -21.5], [_t('Parking'), -56, 56, 21.5, 50], [_t('Abords'), -56, 56, -46, 50],
  ],
  atmo: ATMO_GALERIE,
  surv: {
    siege: true, softK: 2.2, waveK: 1.25, dim: 0.42,
    prep: _t('Fermez la galerie avant la nuit'),
    flee: _t('Fuyez : tous au camion du quai'), need: _t('Pour fuir, rétablissez le courant et réparez le camion du quai'),
    truckLabel: _t('Réparer le camion de livraison'), truckDone: _t('Le camion de livraison démarre'),
    holdTxt: _t('Tenez près du camion : {0} s'), joinTxt: _t('Rejoignez le camion du quai'),
    buy: { x: -21.6, y: 0, z: -15.8, cost: 250 },
    hordes: [{ n: _t('l\u0027entrée principale'), x: 0, z: 46 }, { n: _t('le quai de livraison'), x: 0, z: -44 }, { n: _t('la restauration'), x: 54, z: 0 }, { n: _t('le grand magasin'), x: -54, z: 0 }],
    breaks: () => GAL.breaks,
    drops: [[-40, -10, 27, 44], [10, 40, 27, 44], [-24, 24, -42, -28]],
    skins: { shambler: ['zshopper', 'zcivil', 'zworker', 'zstaff'], runner: ['zshopper', 'zcivil', 'zguard'], crawler: ['zshopper', 'zcivil'], brute: ['zworker', 'zguard'], screamer: ['zshopper', 'zstaff'] },
    onExtract: () => galExtract(),
  },
};
/* Les pièces : boutiques, quai, couloirs, hall, grand magasin, comptoirs ; le mail et la restauration en dernier (ce qui reste du dedans) */
function galRooms() {
  const B = 'galerie', L = [['entretien', -11, -8, 16, 18, -1, GL.CL, 'galerie']], { CL, RF } = GL, top = RF + 0.2;
  for (const S of GAL_SHOPS) { const n = S.row === 'n', f = n ? GL.nf : GL.sf, b = f + (n ? -9 : S.lv ? 12 : 9); L.push([S.id, S.x0, S.x1, Math.min(f, b), Math.max(f, b), S.lv ? CL : -1, S.lv ? top : CL, B]); }
  L.push(['quai', -6, 6, -21.5, -9, -1, top, B], ['hall', -3, 3, 9, 21.5, -1, CL, B]);
  // (les pièces qui touchent le dehors vont jusqu'à la face extérieure du mur : un mort dans l'embrasure d'une porte est dedans)
  L.push(['srvN', -24, 38.5, -21.5, -18, -1, CL, B], ['srvNU', -24, 24, -21.5, -18, CL, top, B], ['srvS', -24, 38.5, 18, 21.5, -1, CL, B]);
  L.push(['whitcombe', -38.5, -24, -21.5, 21.5, -1, top, B]);
  for (const [id, row, x0, x1] of [['napoli', 'n', 24, 31], ['smokehouse', 'n', 31, 38], ['wok', 's', 24, 31], ['brew', 's', 31, 38]]) L.push([id, x0, x1, row === 'n' ? -18 : 9, row === 'n' ? -9 : 18, -1, CL, B]);
  L.push(['galerie', -24, 38.5, -9, 9, -1, top, B]);
  return L;
}
