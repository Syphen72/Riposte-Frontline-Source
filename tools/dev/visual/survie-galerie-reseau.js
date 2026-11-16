/* Survie en ligne à deux joueurs sur la galerie marchande (Halcyon) : node survie-galerie-reseau.js   (PAGE=autre version)
   Le banc de survie-reseau.js (deux pages du jeu reliées par un faux PeerJS, le vrai chemin de salon, de lancement et de jeu), sur la galerie :
   - DÉPART : les deux en survie sur la galerie, chacun voit l'autre ;
   - RIDEAU : l'invité baisse le rideau d'une boutique ; baissé chez les deux (collision, réseau des bots fermé) ; il le relève ;
   - VERRE : des coups de l'hôte brisent la porte vitrée de l'entrée : en éclats chez l'invité (plus de collision) ; l'invité tire dans une
     autre porte vitrée : l'hôte la brise, chez les deux ;
   - DIFFÉRENCES : entre deux paquets complets (chaque seconde), l'hôte n'envoie que les ouvertures qui changent (s.bx) ; une planche abîmée
     chez l'hôte l'est chez l'invité dès le paquet suivant ;
   - CONFINEMENT : l'hôte ferme l'aile ouest (courant rétabli) : les rideaux coupe-feu tombent chez l'invité ; ils se relèvent ;
   - ADRÉNALINE : l'invité prend la seringue de la pharmacie : décomptée chez l'hôte, l'invité se relèvera seul ;
   - MUR : un pan du couloir de service cède chez l'hôte, et chez l'invité ;
   - FUITE : l'hôte passe à la fuite, les rideaux du quai se lèvent chez l'invité.
   C'est une simulation : pas de vrai réseau (latence, pertes) ; elle vérifie les messages et leur effet de part et d'autre. */
const { openGame } = require('./common');
const MOCK = `
  window.NET_RELAY_URL = '';
  window.__net = { out: [], conns: {}, peer: null };
  class MockConn {
    constructor(remote, id) { this.peer = remote; this.open = false; this._h = {}; this._id = id; this.metadata = {}; this.reliable = true; this.serialization = 'json'; this.label = id; }
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
    off() { return this; }
    emit(e, ...a) { for (const f of this._h[e] || []) { try { f(...a); } catch (err) { console.error('mock ' + e + ' ' + (err && err.stack || err)); } } }
    send(m) { if (this.open) window.__net.out.push({ c: this._id, m: JSON.stringify(m) }); }
    close() { if (!this.open) return; this.open = false; window.__net.out.push({ c: this._id, close: 1 }); this.emit('close'); }
  }
  class MockPeer {
    constructor(id, opts) { if (typeof id !== 'string') id = 'cli' + Math.random().toString(36).slice(2, 8); this.id = id; this._h = {}; this.destroyed = false; this.disconnected = false; window.__net.peer = this; setTimeout(() => this.emit('open', id), 30); }
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
    off() { return this; }
    emit(e, ...a) { for (const f of this._h[e] || []) { try { f(...a); } catch (err) { console.error('mockpeer ' + e + ' ' + (err && err.stack || err)); } } }
    connect(remote) { const id = 'k' + Math.random().toString(36).slice(2, 9), c = new MockConn(remote, id); window.__net.conns[id] = c; window.__net.out.push({ connect: id, from: this.id, to: remote }); return c; }
    destroy() { this.destroyed = true; } disconnect() { this.disconnected = true; } reconnect() { this.disconnected = false; }
  }
  window.Peer = MockPeer; window.__MockConn = MockConn;
`;
(async () => {
  const fails = [], out = {}, fail = (m) => { fails.push(m); console.log('ÉCHEC ' + m); };
  const settings = { quality: 'low', map: 'galerie', mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1, lang: 'fr' };
  const A = await openGame({ w: 480, h: 270, noHdri: true, settings, init: MOCK, page: process.env.PAGE }); // hôte
  const B = await openGame({ w: 480, h: 270, noHdri: true, settings, init: MOCK, page: process.env.PAGE }); // invité
  const H = A.page, C = B.page;
  for (const p of [H, C]) await p.evaluate(() => { window.__net.peerId = () => window.__net.peer && window.__net.peer.id; });
  // relais : connexions, messages, fermetures, d'une page à l'autre
  const pages = [H, C];
  const relay = async () => {
    for (let k = 0; k < 2; k++) {
      const src = pages[k], dst = pages[1 - k];
      const items = await src.evaluate(() => window.__net.out.splice(0));
      for (const it of items) {
        if (it.connect) {
          await dst.evaluate((it) => { const P = window.__net.peer; if (!P || P.id !== it.to) return; const c = new window.__MockConn(it.from, it.connect); window.__net.conns[it.connect] = c; c.open = true; P.emit('connection', c); setTimeout(() => c.emit('open'), 0); }, it);
          await src.evaluate((id) => { const c = window.__net.conns[id]; if (c) { c.open = true; setTimeout(() => c.emit('open'), 0); } }, it.connect);
        } else if (it.close) await dst.evaluate((id) => { const c = window.__net.conns[id]; if (c && c.open) { c.open = false; c.emit('close'); } }, it.c);
        else await dst.evaluate((it) => { const c = window.__net.conns[it.c]; if (c && c.open) c.emit('data', JSON.parse(it.m)); }, it);
      }
    }
  };
  const settle = async (ms) => { const t = Date.now(); while (Date.now() - t < ms) { await relay(); await new Promise((r) => setTimeout(r, 40)); } };
  const tick = async (sec) => { for (let i = 0; i < Math.round(sec * 10); i++) { for (const p of pages) await p.evaluate(() => { for (let k = 0; k < 3; k++) if (MATCH.state === 'playing' || MATCH.state === 'finish') matchTick(1 / 30, true); }); await relay(); } };
  try {
    // salon, arrivée, lancement
    // (attentes sur l'état, pas sur une durée : une machine chargée met plus longtemps)
    const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { await relay(); if (await H.evaluate(f)) return true; await new Promise((r) => setTimeout(r, 60)); } return false; };
    await H.evaluate(() => netHost({}));
    await until(() => NET.joined, 30000);
    const code = await H.evaluate(() => NET.code);
    await C.evaluate((code) => netJoinLobby(code), code);
    await until(() => NET.players.size === 2, 60000);
    out.salon = await H.evaluate(() => ({ joueurs: NET.players.size, mode: NET.cfg.mode, carte: NET.cfg.map }));
    if (out.salon.joueurs !== 2) fail('l’invité ne rejoint pas le salon (' + out.salon.joueurs + ' joueurs)');
    if (out.salon.mode !== 'zombie') fail('le salon n’est pas en survie (' + out.salon.mode + ')');
    await H.evaluate(() => netLaunch());
    for (let i = 0; i < 600; i++) {
      await settle(500); const st = await Promise.all(pages.map((p) => p.evaluate(() => MATCH.state + '/' + NET.phase + '/' + (NET.on ? 'on' : 'off'))));
      if (i % 20 === 0) console.log('chargement ' + (i / 2) + ' s : ' + st.join(' | '));
      if (st.every((s) => s.startsWith('playing'))) break;
    }
    for (const p of pages) await p.evaluate(() => { LOCK.fallback = true; SV.phase = 'prep'; SV.t = 1e9; for (const z of ZOMBIES) if (z.alive) zombieStow(z); });
    await tick(1);
    out.depart = await Promise.all(pages.map((p) => p.evaluate(() => ({ etat: MATCH.state, carte: CURMAP.id, sv: SV.on, autres: entities.filter((e) => e.isRemote).length, ouvertures: SURV.open.length }))));
    if (!out.depart.every((d) => d.etat === 'playing' && d.carte === 'galerie' && d.sv && d.autres === 1)) fail('les deux pages ne jouent pas la survie sur la galerie : ' + JSON.stringify(out.depart));
    await H.evaluate(() => { PL.ent.pos.set(0, 0, 0); }); await C.evaluate(() => { PL.ent.pos.set(10.5, 0, -6); });
    // le rideau d'une boutique, baissé puis levé par l'invité
    const g = await H.evaluate(() => SURV.open.findIndex((o) => o.room === 'elec' && o.gate && o.gate.type === 'grille'));
    const gst = (P) => P.evaluate((g) => { const op = SURV.open[g]; return { bas: op.gate.down, collision: op.gate.c.x0 < 1e5, ferme: !findPath(new V3(10.5, 0, -4), new V3(10.5, 0, -13)) }; }, g);
    await C.evaluate((g) => survReq('gate', g), g); await tick(1.2);
    out.rideau = { hote: await gst(H), invite: await gst(C) };
    await C.evaluate((g) => survReq('gate', g), g); await tick(1.2);
    out.rideau.releve = { hote: await gst(H), invite: await gst(C) };
    if (!out.rideau.hote.bas || !out.rideau.invite.bas || !out.rideau.invite.collision || !out.rideau.hote.ferme || !out.rideau.invite.ferme) fail('le rideau baissé par l’invité ne l’est pas chez les deux : ' + JSON.stringify(out.rideau));
    if (out.rideau.releve.hote.bas || out.rideau.releve.invite.bas || out.rideau.releve.invite.collision) fail('le rideau relevé par l’invité reste baissé : ' + JSON.stringify(out.rideau.releve));
    // la porte vitrée de l'entrée : des coups chez l'hôte la brisent ; l'invité tire dans celle de la restauration
    const gl = await H.evaluate(() => SURV.open.findIndex((o) => o.gate && o.gate.type === 'glass' && o.axis === 'x'));
    const gl2 = await H.evaluate(() => SURV.open.findIndex((o) => o.gate && o.gate.type === 'glass' && o.axis === 'z' && o.fixed > 0));
    await H.evaluate((i) => { const op = SURV.open[i]; for (let k = 0; k < 6 && op.gate.hp > 0; k++) survOpenHit(op, 40, ZOMBIES[0]); }, gl); await tick(1.2);
    const gls = (P, i) => P.evaluate((i) => { const op = SURV.open[i], m = op.gate.mesh; return { pv: op.gate.hp, collision: op.gate.c.x0 < 1e5, verre: !!(m && m.userData.leaf.children.some((v) => v.userData.glass && v.userData.glass.visible)) }; }, i);
    out.verre = { coups: { hote: await gls(H, gl), invite: await gls(C, gl) } };
    await C.evaluate((i) => { const op = SURV.open[i]; const end = survOpenFace(op, new V3()); for (let k = 0; k < 8; k++) dmgWorldShot(op.gate.c, end, new V3(-1, 0, 0), 32, PL.ent); }, gl2); await tick(1.2);
    out.verre.balles = { hote: await gls(H, gl2), invite: await gls(C, gl2) };
    for (const [k, v] of Object.entries(out.verre)) if (v.hote.pv > 0 || v.invite.pv > 0 || v.invite.collision || v.invite.verre) fail('porte vitrée (' + k + ') : pas brisée chez les deux : ' + JSON.stringify(v));
    // différences : une planche abîmée chez l'hôte arrive chez l'invité par s.bx, sans attendre le paquet complet
    const op = await H.evaluate(() => SURV.open.findIndex((o) => o.room === 'pharma' && o.kind === 'porte'));
    await H.evaluate((i) => { SURV_RES.planks = 20; survApply('nail', i, PL.ent); }, op); await tick(1.5);
    const hp0 = await C.evaluate((i) => { const s = SURV.open[i].slots.find((q) => q.hp > 0); return s ? s.hp : -1; }, op);
    await H.evaluate(() => { SV.bT = performance.now(); window.__net.out.length = 0; }); // (le paquet complet vient de partir : le suivant n'est dû que dans une seconde)
    await H.evaluate((i) => { survOpenHit(SURV.open[i], 30, ZOMBIES[0]); }, op);
    for (const p of pages) await p.evaluate(() => matchTick(1 / 30, true));
    // (les paquets d'état de l'hôte partis pendant cette image : ce que porte leur partie survie)
    const sent = await H.evaluate(() => window.__net.out.map((x) => { try { const m = JSON.parse(x.m || 'null'); return m && m.sv ? { b: Array.isArray(m.sv.b), bx: Array.isArray(m.sv.bx), n: (x.m || '').length } : null; } catch (e) { return null; } }).filter(Boolean));
    await relay(); for (const p of pages) await p.evaluate(() => matchTick(1 / 30, true)); await relay();
    const hp1 = await C.evaluate((i) => { const s = SURV.open[i].slots.find((q) => q.hp > 0); return s ? s.hp : -1; }, op);
    out.differences = { avant: hp0, apres: hp1, bx: sent.some((m) => m.bx), complet: sent.some((m) => m.b), octets: sent.reduce((a, m) => a + m.n, 0), paquets: sent.length };
    if (!(hp0 > 0) || !(hp1 < hp0)) fail('différences : la planche abîmée chez l’hôte ne l’est pas chez l’invité au paquet suivant : ' + JSON.stringify(out.differences));
    if (!out.differences.bx || out.differences.complet) fail('différences : l’hôte n’envoie pas l’ouverture changée seule (s.bx) : ' + JSON.stringify(out.differences));
    // confinement : l'hôte ferme l'aile ouest
    await H.evaluate(() => { SV.power = true; survLights(true); const i = SURV.objs.findIndex((o) => o.kind === 'lock' && o.w === 'w'); survObjDone(i, PL.ent); }); await tick(1.5);
    const wst = (P) => P.evaluate(() => { const L = SURV.open.filter((o) => o.wing === 'w' && o.gate.type === 'fire'); return { bas: L.filter((o) => o.gate.down).length + '/' + L.length, collision: L.every((o) => o.gate.c.x0 < 1e5), objectif: SURV.objs.find((o) => o.kind === 'lock' && o.w === 'w').done, courant: SV.power }; });
    out.confinement = { hote: await wst(H), invite: await wst(C) };
    await H.evaluate(() => { const i = SURV.objs.findIndex((o) => o.kind === 'lock' && o.w === 'w'); survObjDone(i, PL.ent); }); await tick(1.5);
    out.confinement.rouvert = await wst(C);
    if (out.confinement.invite.bas !== out.confinement.hote.bas || !out.confinement.invite.collision || !out.confinement.invite.objectif || !out.confinement.invite.courant) fail('confinement : l’aile fermée chez l’hôte ne l’est pas chez l’invité : ' + JSON.stringify(out.confinement));
    if (!out.confinement.rouvert.bas.startsWith('0/')) fail('confinement : l’aile rouverte reste fermée chez l’invité : ' + JSON.stringify(out.confinement.rouvert));
    // adrénaline : l'invité prend la seringue de la pharmacie
    const med = await H.evaluate(() => SURV.caches.findIndex((c) => c.kind === 'med'));
    await C.evaluate((i) => { SURV_DOWN.self = 0; const c = SURV.caches[i]; PL.ent.pos.set(c.x, 0, c.z + 0.8); survReq('take', i); }, med); await tick(1.2);
    out.adrenaline = { hote: await H.evaluate((i) => SURV.caches[i].left, med), invite: await C.evaluate((i) => ({ reste: SURV.caches[i].left, seul: SURV_DOWN.self }), med) };
    if (out.adrenaline.hote !== 1 || out.adrenaline.invite.reste !== 1 || out.adrenaline.invite.seul !== 1) fail('adrénaline : ' + JSON.stringify(out.adrenaline));
    // un mur du couloir de service cède chez l'hôte
    await H.evaluate(() => { const w = CURMAP.def.surv.breaks()[0], b = BRCH.list[w.id]; breachSet(b, true, true); netEvent({ k: 'wb', n: b.id }, PL.ent); }); await tick(1.2);
    out.mur = { hote: await H.evaluate(() => BRCH.open[CURMAP.def.surv.breaks()[0].id]), invite: await C.evaluate(() => BRCH.open[CURMAP.def.surv.breaks()[0].id]) };
    if (!out.mur.hote || !out.mur.invite) fail('mur : le pan tombé chez l’hôte tient chez l’invité : ' + JSON.stringify(out.mur));
    // la fuite : les rideaux du quai se lèvent chez l'invité
    await H.evaluate(() => { SV.power = true; SV.truck = true; SV.limit = 10; SV.wave = 10; SV.phase = 'wave'; SV.toSpawn = 0; for (const z of ZOMBIES) zombieStow(z); }); await tick(1.5);
    out.fuite = await C.evaluate(() => ({ phase: SV.phase, quai: SURV.open.filter((o) => o.dock).map((o) => (o.gate.down ? 1 : 0)).join('') }));
    if (out.fuite.phase !== 'extract' || out.fuite.quai !== '00') fail('fuite : ' + JSON.stringify(out.fuite));
  } catch (e) { fail('exception : ' + String(e && e.stack || e).slice(0, 400)); }
  console.log(JSON.stringify(out, null, 1));
  for (const [n, L] of [['hôte', A.logs], ['invité', B.logs]]) { const errs = L.filter((l) => l.includes('pageerror') || l.includes('mock')); if (errs.length) { console.log(n + ' :\n' + errs.slice(0, 8).join('\n')); fails.push('erreurs dans la page de l’' + n); } }
  await A.browser.close(); await B.browser.close();
  if (fails.length) { console.log('ÉCHECS :\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('survie en ligne, galerie : rien à signaler');
})();
