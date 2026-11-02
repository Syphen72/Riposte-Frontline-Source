/* ==========================================================================
   SON DE MONTÉE DE NIVEAU : fanfare de 3 s jouée à chaque niveau du joueur gagné en partie (pas aux déblocages d'accessoires).
   Breachline : synthétisée une fois, au démarrage du son (initAudio), par un rendu hors ligne (OfflineAudioContext) ; la fanfare d'origine
   (Rank_Up.mp3, créée avec Suno, usage non commercial) n'est plus livrée. Roulement de caisse claire, trois appels de cuivres (la-la-la),
   accord de ré majeur ouvert sur un coup de timbale, quinte aiguë qui s'éteint. Sans rendu hors ligne possible, le jeu reste muet à cet endroit.
   ========================================================================== */
/* Une note de cuivre : deux dents de scie désaccordées, filtre passe-bas qui s'ouvre à l'attaque puis se referme (le « blat » d'un cuivre) */
function rkBrass(c, out, t, f, dur, gain) {
  const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 6, t + 0.06); lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.035); g.gain.setValueAtTime(gain, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const det of [-6, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.02); }
  lp.connect(g); g.connect(out);
}
/* Un coup de bruit filtré (caisse claire, souffle de timbale, cymbale) */
function rkHit(c, out, noise, t, dur, type, f, q, gain) {
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise; bp.type = type; bp.frequency.value = f; bp.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function rkTimpani(c, out, noise, t, f, gain) {
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.25, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.7);
  rkHit(c, out, noise, t, 0.25, 'lowpass', 700, 0.7, gain * 0.5);
}
/* Salle commune aux sons rendus hors ligne (fanfare, thème des menus) : réponse impulsionnelle de bruit qui s'éteint en len s, plus longue à droite.
   Renvoie le bus d'entrée ; sortie compressée vers la destination du contexte */
function rkRoom(c, len, wetGain) {
  const sr = c.sampleRate, ir = c.createBuffer(2, Math.round(sr * len), sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2 + ch * 0.4); }
  const dry = c.createGain(), wet = c.createGain(), verb = c.createConvolver(), bus = c.createGain(), comp = c.createDynamicsCompressor();
  verb.buffer = ir; dry.gain.value = 0.8; wet.gain.value = wetGain; bus.connect(dry); bus.connect(verb); verb.connect(wet);
  dry.connect(comp); wet.connect(comp); comp.connect(c.destination);
  return bus;
}
function rkNoise(c) { const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
/* Rend un contexte hors ligne (promesse ou évènement selon le navigateur), ramène la crête à peak ; cb(tampon) ou cb(null) */
function rkRender(c, peak, cb) {
  let sent = false;
  const fin = (b) => {
    if (sent) return; sent = true;
    if (!b) return cb(null);
    let p = 0; for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); }
    const k = p > 0 ? peak / p : 1; for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
    cb(b);
  };
  c.oncomplete = (e) => fin(e.renderedBuffer); // (Safari ancien : seulement l'évènement)
  const r = c.startRendering(); if (r && r.then) r.then(fin, () => fin(null));
}
function rankUpPrepare() {
  if (!AU.ctx || AU.rankBuf !== undefined) return;
  AU.rankBuf = null; AU.rankPending = true;
  const done = (b) => { AU.rankPending = false; if (b) AU.rankBuf = b; if (b && AU.rankWant) { AU.rankWant = false; rankUpSound(); } };
  try {
    const sr = 44100, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new OAC(2, Math.round(sr * 3.2), sr);
    const noise = rkNoise(c), bus = rkRoom(c, 1.6, 0.22);
    for (let i = 0; i < 10; i++) rkHit(c, bus, noise, 0.02 + i * 0.045, 0.06, 'bandpass', 2200, 0.9, 0.05 + i * 0.012); // roulement qui enfle
    const A3 = 220, D4 = 293.66, Fs4 = 369.99, A4 = 440, D5 = 587.33;
    for (const t0 of [0.5, 0.66, 0.82]) { rkBrass(c, bus, t0, A3, 0.13, 0.11); rkBrass(c, bus, t0, A4, 0.13, 0.06); rkHit(c, bus, noise, t0, 0.08, 'bandpass', 2400, 1, 0.12); }
    const T = 1.0;
    rkTimpani(c, bus, noise, T, 73.4, 0.9);
    for (const [f, g] of [[D4 / 2, 0.1], [D4, 0.1], [Fs4, 0.08], [A4, 0.08], [D5, 0.05]]) rkBrass(c, bus, T, f, 1.5, g);
    rkHit(c, bus, noise, T, 1.4, 'highpass', 6000, 0.7, 0.05);
    rkBrass(c, bus, T + 1.15, A4 * 1.5, 0.9, 0.035); rkBrass(c, bus, T + 1.15, D5, 0.9, 0.04);
    rkRender(c, 0.7, done);
  } catch (e) { done(null); }
}
/* Joue la fanfare : directement sur le mix (pas d'assourdissement ni d'espace), au niveau du volume général ; pas encore rendue : elle part dès qu'elle l'est.
   Gain 2 (+6 dB, 3.1.0 : « à rehausser », retour du propriétaire) : comme les musiques de fin de partie (END_MUSIC), voir README « Niveaux » */
function rankUpSound() {
  if (!AU.ready || !AU.ctx) return;
  if (AU.rankBuf === undefined) rankUpPrepare();
  if (AU.rankBuf) { const s = AU.ctx.createBufferSource(); s.buffer = AU.rankBuf; s.connect(uiOut(2)); s.start(); }
  else if (AU.rankPending) AU.rankWant = true;
}
