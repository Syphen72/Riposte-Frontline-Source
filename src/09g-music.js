/* ==========================================================================
   MUSIQUE DES MENUS
   Le thème joue dans les menus principaux et s'éteint en fondu dès le lancement d'une partie (écran de chargement, choix de la classe
   compris ; il revient si on annule). Au retour d'une partie il repart du début de la piste. Ni la pause, ni les résultats n'ont de musique.
   Breachline : sans fichier dist/menu-theme.mp3 (le thème d'origine, créé avec Suno, était réservé à un usage non commercial), le thème est
   composé ici et rendu une fois, hors ligne (musicSynth), la première fois que les menus le demandent : boucle de 16 mesures en ré mineur
   à 84 à la noire, jouée par un élément audio (adresse blob:) comme l'était le fichier. Un fichier menu-theme.mp3 posé dans dist/ par
   build.py reste prioritaire.
   Le volume est Musique x Volume général (Options, Audio).
   ========================================================================== */
const MUS = { el: null, url: '', vol: 0, pending: false, blocked: false, dead: false, synth: false, rendering: false };
const MUS_FADE_IN = 1.2, MUS_FADE_OUT = 3.5; // vitesses de fondu (par seconde)

function musicInit() {
  const m = document.querySelector('meta[name="menu-music"]');
  MUS.url = m ? m.content : ''; if (!MUS.url) MUS.synth = !!(window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!MUS.url && !MUS.synth) MUS.dead = true;
  // le navigateur n'autorise le son qu'après un geste : le premier clic ou la première touche relance la lecture
  // (Safari sur iPhone n'accepte la lecture que dans un geste complet : on relance aussi à la fin du toucher et au clic, directement dans le geste)
  const unlock = () => { MUS.blocked = false; if (MUS.el && MUS.el.paused && MATCH.state === 'menu') { const p = MUS.el.play(); if (p && p.catch) p.catch(() => { /* refusé : musicTick réessaiera */ }); } };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && MUS.el) MUS.el.pause(); });
}
/* Retour au menu principal (partie quittée ou terminée) : le thème repart du début de la piste, en fondu */
function musicRestart() {
  MUS.vol = 0;
  if (!MUS.el) return;
  MUS.el.volume = 0;
  try { MUS.el.currentTime = 0; } catch (e) { /* flux pas encore prêt : il démarrera au début de toute façon */ }
}
/* Tampon stéréo -> fichier WAV 16 bits (Blob) */
function musicWav(b) {
  const ch = b.numberOfChannels, n = b.length, sr = b.sampleRate, buf = new ArrayBuffer(44 + n * ch * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const d = []; for (let c = 0; c < ch; c++) d.push(b.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 32767, true); o += 2; }
  return new Blob([buf], { type: 'audio/wav' });
}
/* Le thème : nappe de cordes (deux dents de scie désaccordées, filtre lent), basse, ostinato de croches à partir de la mesure 3, taikos sur
   chaque premier temps, roulement de toms en fin de phrase, appel aigu en cloche à partir de la mesure 9. Harmonie par blocs de 4 mesures :
   ré mineur, si bémol, sol mineur, la majeur. Le rendu déborde de 3 s, repliées sur le début : la boucle se raccorde sans coupure. */
function musicSynth(cb) {
  try {
    const sr = 24000, beat = 60 / 84, bar = beat * 4, L = bar * 16, tail = 3, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = new OAC(2, Math.round(sr * (L + tail)), sr), noise = rkNoise(c), bus = rkRoom(c, 2.0, 0.36); // 24 kHz, salle de 2 s : rendu léger (quelques secondes sur un téléphone)
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12); // numéro MIDI -> Hz
    const CH = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]; // Dm, Bb, Gm, A (octave 3)
    const voice = (t, f, dur, type, cut, gain, att, rel) => {
      const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + att); g.gain.setValueAtTime(gain, t + Math.max(att, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); return o;
    };
    for (let blk = 0; blk < 4; blk++) {
      const t0 = blk * bar * 4, chord = CH[blk], dur = bar * 4 + 1.2;
      for (const m of chord) for (const det of [-7, 6]) { const o = voice(t0, hz(m), dur, 'sawtooth', 620 + blk * 60, 0.022, 1.4, 1.4); o.detune.value = det; }
      voice(t0, hz(chord[0] - 12), dur, 'triangle', 400, 0.12, 0.3, 1.0); voice(t0, hz(chord[0] - 24), dur, 'sine', 200, 0.16, 0.3, 1.0);
    }
    for (let b = 0; b < 16; b++) {
      const t0 = b * bar, chord = CH[b >> 2], r = chord[0];
      // taiko : coup grave sur le premier temps, plus léger sur le « et » du troisième à partir de la mesure 5
      for (const [dt, k] of b >= 4 ? [[0, 1], [beat * 2.5, 0.55]] : [[0, 1]]) {
        const o = c.createOscillator(), g = c.createGain(), t = t0 + dt; o.type = 'sine';
        o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.35);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * k, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1);
        rkHit(c, bus, noise, t, 0.3, 'lowpass', 420, 0.8, 0.35 * k);
      }
      if ((b & 3) === 3) for (let i = 0; i < 4; i++) { const t = t0 + beat * 3 + i * beat / 4, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130 - i * 12, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.2); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 + i * 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.35); }
      // ostinato de croches : fondamentale, fondamentale, octave, fondamentale... (accent sur les temps)
      if (b >= 2) for (let i = 0; i < 8; i++) { const m = [r, r, r + 12, r, r, r + 12, r, r + 7][i]; voice(t0 + i * beat / 2, hz(m), 0.2, 'sawtooth', 1100 + (b >= 8 ? 500 : 0), i % 2 ? 0.03 : 0.045, 0.004, 0.15); }
      // caisse claire balayée sur 2 et 4, à partir de la mesure 9
      if (b >= 8) for (const k of [1, 3]) rkHit(c, bus, noise, t0 + k * beat, 0.16, 'bandpass', 1900, 0.7, 0.06);
    }
    // appel en cloche : la, fa, mi, ré (puis si bémol, la) sur les mesures 9 à 16
    const motif = [[8, 0, 69], [8, 1.5, 65], [8, 3, 64], [9, 0, 62], [10, 0, 70], [10, 1.5, 69], [11, 0, 65], [12, 0, 69], [12, 1.5, 72], [12, 3, 74], [13, 0, 69], [14, 0, 73], [14, 2, 76], [15, 0, 69]];
    for (const [b, bt, m] of motif) { const t = b * bar + bt * beat; voice(t, hz(m), 1.6, 'triangle', 3200, 0.06, 0.004, 1.5); voice(t, hz(m + 12), 0.8, 'sine', 5000, 0.02, 0.003, 0.7); }
    rkRender(c, 0.85, (b) => {
      if (!b) return cb('');
      const n = Math.round(sr * L), nt = b.length - n;
      for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < nt; i++) d[i] += d[n + i]; }
      const out = c.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) out.copyToChannel(b.getChannelData(ch).subarray(0, n), ch);
      cb(URL.createObjectURL(musicWav(out)));
    });
  } catch (e) { cb(''); }
}
/* Appelée à chaque image de la boucle de jeu */
function musicTick(dt) {
  const M = MUS; if (M.dead) return;
  const want = MATCH.state === 'menu' && !UI.flow && !document.hidden; // le lancement d'une partie (chargement compris) coupe la musique
  const target = want ? clamp(Settings.music * Settings.volume, 0, 1) : 0;
  M.vol += (target - M.vol) * Math.min(1, dt * (target > M.vol ? MUS_FADE_IN : MUS_FADE_OUT));
  if (!M.el) {
    if (!want) return;
    if (!M.url) { // thème composé : rendu une fois, en arrière-plan
      if (!M.rendering) { M.rendering = true; musicSynth((u) => { M.url = u; if (!u) M.dead = true; }); }
      return;
    }
    M.el = new Audio(); M.el.preload = 'none'; M.el.loop = true; M.el.volume = 0;
    M.el.addEventListener('error', () => { M.dead = true; });
    M.el.src = M.url;
  }
  if (want && M.el.paused && !M.blocked && !M.pending) {
    M.pending = true;
    const p = M.el.play();
    if (p && p.then) p.then(() => { M.pending = false; }, (e) => { M.pending = false; if (e && e.name === 'NotAllowedError') M.blocked = true; else M.dead = true; });
    else M.pending = false;
  }
  M.el.volume = clamp(M.vol, 0, 1);
  if (!want && M.vol < 0.003 && !M.el.paused) M.el.pause();
}
