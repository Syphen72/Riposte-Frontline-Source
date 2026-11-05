/* Survie en ligne à deux joueurs (src/09ia-survie.js, 09c-net.js) : node survie-reseau.js   (PAGE=autre version)
   Deux pages du jeu, deux parties complètes et indépendantes, reliées par un faux PeerJS (Peer et DataConnection remplacés avant le
   chargement) : ce banc porte les messages d'une page à l'autre, tels que le jeu les envoie (JSON). Tout le reste est le vrai chemin :
   l'hôte ouvre un salon (netHost), l'invité le rejoint par son code (netJoinLobby), l'hôte lance la survie sur la ferme (netLaunch),
   chacun charge la carte et joue ; les deux pages avancent image par image (matchTick), les messages passent entre deux images.
   Vérifie :
   - DÉPART : les deux en survie, sur la ferme, dans le même camp, l'invité voit l'hôte et l'inverse ;
   - MORTS : la vague de l'hôte apparaît chez l'invité, aux mêmes places (à 1,5 m près) ; l'invité en abat un : l'hôte le tue (une seule
     simulation), l'invité le voit tomber et reçoit ses points ;
   - BARRICADE : l'invité demande une planche, l'hôte la cloue, elle apparaît chez les deux ; les réserves (planches) suivent ;
   - COUPS : un mort de l'hôte collé à l'invité le frappe, chez l'invité ;
   - À TERRE : l'invité tombe à terre ; l'hôte le voit à terre, le relève ; l'invité est relevé ;
   - FIN DE VAGUE : la préparation suivante chez les deux ; l'invité, à sec, est ravitaillé chez lui ;
   - MUNITIONS : l'invité prend à une caisse (l'hôte décompte la prise, l'invité reçoit sa part, la caisse suit chez les deux) ; une cartouchière
     posée par l'hôte apparaît chez l'invité, qui la ramasse en marchant dessus (disparue des deux côtés, munitions chez lui) ; l'invité annonce
     sa réserve à l'hôte ;
   - TÔLE ET MEUBLE : l'invité demande une tôle, posée chez les deux ; l'hôte la cabosse, l'invité le voit ; un meuble éclaté chez l'hôte
     éclate chez l'invité (plus de collision) ;
   - LARGAGE : vu chez l'invité, qui le prend (le plein chez lui, une seule fois) ; l'hôte le prend à son tour, il disparaît chez les deux.
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
  const settings = { quality: 'low', map: 'ferme', mode: 'zombie', limitZombie: 10, survMates: 0, difficulty: 1, lang: 'fr' };
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
    for (const p of pages) await p.evaluate(() => { LOCK.fallback = true; });
    await tick(1);
    out.depart = await Promise.all(pages.map((p) => p.evaluate(() => ({ etat: MATCH.state, mode: MATCH.mode, sv: SV.on, equipe: PL.ent.team, autres: entities.filter((e) => e.isRemote).map((e) => ({ n: e.name, t: e.team, vivant: e.alive })), reserve: ZOMBIES.length }))));
    if (!out.depart.every((d) => d.etat === 'playing' && d.mode === 'zombie' && d.sv)) fail('les deux pages ne jouent pas la survie : ' + JSON.stringify(out.depart));
    if (!out.depart.every((d) => d.autres.length === 1 && d.autres[0].t === d.equipe)) fail('chaque page ne voit pas l’autre joueur dans son camp : ' + JSON.stringify(out.depart.map((d) => d.autres)));
    // la vague : l'hôte la lance, ses morts apparaissent chez l'invité, aux mêmes places
    await H.evaluate(() => { SV.t = 0.05; for (const e of [PL.ent]) { e.pos.set(-3, 0, 0); } });
    await C.evaluate(() => { PL.ent.pos.set(2.5, 0, 1); });
    await tick(8);
    const zh = await H.evaluate(() => ZOMBIES.map((z, i) => z.alive ? [i, +z.pos.x.toFixed(2), +z.pos.z.toFixed(2)] : null).filter(Boolean));
    const zc = await C.evaluate(() => ZOMBIES.map((z, i) => z.alive ? [i, +z.pos.x.toFixed(2), +z.pos.z.toFixed(2), !!z.zNet] : null).filter(Boolean));
    let maxD = 0; for (const a of zh) { const b = zc.find((q) => q[0] === a[0]); maxD = Math.max(maxD, b ? Math.hypot(a[1] - b[1], a[2] - b[2]) : 99); }
    out.morts = { hote: zh.length, invite: zc.length, invitePilotes: zc.filter((q) => q[3]).length, ecartMax: +maxD.toFixed(2), phaseInvite: await C.evaluate(() => SV.phase + ' ' + SV.wave) };
    if (!zh.length) fail('l’hôte ne lance pas la vague');
    if (zc.length !== zh.length) fail(`morts debout : ${zh.length} chez l’hôte, ${zc.length} chez l’invité`);
    if (zc.some((q) => !q[3])) fail('un mort de l’invité est simulé chez lui (il doit suivre l’hôte)');
    if (maxD > 1.5) fail('les morts ne sont pas aux mêmes places chez l’invité (écart ' + maxD.toFixed(2) + ' m)');
    // l'invité en abat un : l'hôte le tue, l'invité le voit tomber et gagne ses points
    const target = zc.length ? zc[0][0] : -1; if (target < 0) throw new Error('aucun mort chez l’invité');
    const pts0 = await C.evaluate(() => SVSTAT.points);
    await C.evaluate((i) => { const z = ZOMBIES[i]; applyDamage(z, 500, PL.ent, 'M4A1', true, new V3(0, 0, -1), PL.ent.pos.clone()); }, target);
    await tick(1.5);
    out.abattu = { hote: await H.evaluate((i) => ZOMBIES[i].alive, target), invite: await C.evaluate((i) => ZOMBIES[i].alive, target), points: (await C.evaluate(() => SVSTAT.points)) - pts0 };
    if (out.abattu.hote) fail('la touche de l’invité ne tue pas le mort chez l’hôte');
    if (out.abattu.invite) fail('le mort abattu reste debout chez l’invité');
    if (!(out.abattu.points > 0)) fail('l’invité ne reçoit pas les points de son mort');
    // barricade demandée par l'invité
    const op = await H.evaluate(() => SURV.open.findIndex((o) => o.kind === 'fenetre' && o.room === 'maison'));
    const pl0 = await H.evaluate(() => SURV_RES.planks);
    await C.evaluate((id) => survReq('nail', id), op);
    await tick(1.2);
    out.barricade = { hote: await H.evaluate((id) => SURV.open[id].slots.filter((s) => s.hp > 0).length, op), invite: await C.evaluate((id) => SURV.open[id].slots.filter((s) => s.hp > 0).length, op), planchesHote: await H.evaluate(() => SURV_RES.planks), planchesInvite: await C.evaluate(() => SURV_RES.planks), avant: pl0 };
    if (out.barricade.hote !== 1 || out.barricade.invite !== 1) fail('la planche demandée par l’invité n’est pas clouée chez les deux : ' + JSON.stringify(out.barricade));
    if (out.barricade.planchesHote !== pl0 - 1 || out.barricade.planchesInvite !== pl0 - 1) fail('les réserves de planches ne suivent pas : ' + JSON.stringify(out.barricade));
    // un mort de l'hôte frappe l'invité
    const hp0 = await C.evaluate(() => { PL.ent.health = 100; return PL.ent.health; });
    await H.evaluate(() => { const g = entities.find((e) => e.isRemote); const z = zombiesUp()[0] || zombieSpawn('shambler', g.pos.x + 0.8, g.pos.z, 0); z.pos.set(g.pos.x + 0.8, g.pos.y, g.pos.z); z.zTgt = g; z.zAtkT = 0; window.__biter = z; });
    for (let i = 0; i < 25; i++) { await H.evaluate(() => { const g = entities.find((e) => e.isRemote), z = window.__biter; if (z && z.alive) { z.pos.set(g.pos.x + 0.8, g.pos.y, g.pos.z); z.zTgt = g; } }); await tick(0.1); }
    out.coup = { avant: hp0, apres: await C.evaluate(() => Math.round(PL.ent.health)) };
    if (!(out.coup.apres < hp0)) fail('le coup d’un mort de l’hôte ne touche pas l’invité');
    await H.evaluate(() => { const z = window.__biter; if (z && z.alive) applyDamage(z, 999, PL.ent, 'M4A1', false, new V3(0, 0, -1), PL.ent.pos.clone()); });
    // à terre chez l'invité, vu par l'hôte, relevé par l'hôte
    await C.evaluate(() => { SURV_DOWN.self = 0; PL.ent.health = 5; applyDamage(PL.ent, 50, ZOMBIES[0], 'Zombie', false, new V3(0, 0, 1), PL.ent.pos.clone()); });
    await tick(1);
    out.aTerre = { invite: await C.evaluate(() => !!PL.ent.downed), vuParHote: await H.evaluate(() => !!entities.find((e) => e.isRemote).downed), phaseHote: await H.evaluate(() => SV.phase) };
    if (!out.aTerre.invite) fail('l’invité ne tombe pas à terre');
    if (!out.aTerre.vuParHote) fail('l’hôte ne voit pas l’invité à terre');
    if (out.aTerre.phaseHote === 'over') fail('un joueur à terre et l’autre debout : la survie finit quand même');
    await H.evaluate(() => { const g = entities.find((e) => e.isRemote); PL.ent.pos.set(g.pos.x + 0.6, g.pos.y, g.pos.z); PL.ent.yaw = Math.atan2(0.6, 0); const a = survReviveAction(PL.ent); window.__rv = !!a; if (a) a.run(); });
    await tick(1);
    out.releve = { action: await H.evaluate(() => window.__rv), invite: await C.evaluate(() => !PL.ent.downed && PL.ent.alive), sante: await C.evaluate(() => PL.ent.health), releveParHote: await H.evaluate(() => SVSTAT.revives) };
    if (!out.releve.action) fail('l’hôte n’a pas d’action pour relever l’invité');
    if (!out.releve.invite) fail('l’invité n’est pas relevé');
    // fin de vague : on abat tout chez l'hôte, la préparation suivante chez les deux (l'invité à sec d'abord)
    await C.evaluate(() => { for (const w of PL.ent.arms.slots.filter(ammoUsable)) { w.mag = 0; w.reserve = 0; } });
    for (let i = 0; i < 40; i++) { await H.evaluate(() => { for (const z of zombiesUp()) applyDamage(z, 999, PL.ent, 'M4A1', false, new V3(0, 0, -1), PL.ent.pos.clone()); }); await tick(0.5); if (await H.evaluate(() => SV.phase === 'prep')) break; }
    await tick(1.5);
    out.finVague = { hote: await H.evaluate(() => SV.phase + ' ' + SV.wave), invite: await C.evaluate(() => SV.phase + ' ' + SV.wave) };
    if (!out.finVague.hote.startsWith('prep') || out.finVague.hote !== out.finVague.invite) fail('la fin de vague ne suit pas chez l’invité : ' + JSON.stringify(out.finVague));
    out.finVague.munitionsInvite = await C.evaluate(() => PL.ent.arms.slots.filter(ammoUsable).map((w) => w.reserve + '/' + ammoMaxOf(w)));
    if (await C.evaluate(() => PL.ent.arms.slots.filter(ammoUsable).some((w) => w.reserve < Math.ceil(ammoMaxOf(w) * 0.5)))) fail('la fin de vague ne ravitaille pas l’invité : ' + out.finVague.munitionsInvite);
    await H.evaluate(() => { SV.t = 1e9; });
    const res = () => C.evaluate(() => PL.ent.arms.slots.filter(ammoUsable).reduce((a, w) => a + w.reserve, 0));
    const drainC = () => C.evaluate(() => { for (const w of PL.ent.arms.slots.filter(ammoUsable)) { w.mag = 0; w.reserve = 0; } });
    // une caisse de munitions, demandée par l'invité
    const box = await H.evaluate(() => SURV.caches.findIndex((c) => c.kind === 'ammo'));
    await drainC(); await C.evaluate((i) => { const c = SURV.caches[i]; PL.ent.pos.set(c.x + 0.6, c.y, c.z); }, box); await tick(0.5);
    const left0 = await H.evaluate((i) => SURV.caches[i].left, box);
    await C.evaluate((i) => survReq('take', i), box); await tick(1.2);
    out.caisse = { avant: left0, hote: await H.evaluate((i) => SURV.caches[i].left, box), invite: await C.evaluate((i) => SURV.caches[i].left, box), reserveInvite: await res() };
    if (out.caisse.hote !== left0 - 1 || out.caisse.invite !== left0 - 1) fail('la caisse ne décompte pas la prise de l’invité chez les deux : ' + JSON.stringify(out.caisse));
    if (!(out.caisse.reserveInvite > 0)) fail('l’invité ne reçoit pas les munitions de la caisse');
    await tick(3.5); const af = await H.evaluate(() => entities.find((e) => e.isRemote).svAmmo), afC = await C.evaluate(() => ammoFracOf(PL.ent));
    out.reserveAnnoncee = { hote: af, invite: +afC.toFixed(2) };
    if (af === undefined || Math.abs(af - afC) > 0.08) fail('l’hôte ne connaît pas la réserve de l’invité : ' + JSON.stringify(out.reserveAnnoncee));
    // une cartouchière de l'hôte, ramassée par l'invité
    await drainC(); await C.evaluate(() => PL.ent.pos.set(-1, 0, 0)); await tick(0.3);
    await H.evaluate(() => { for (const l of SAMMO.loot.slice()) survLootRemove(l); survLootAdd(-3.5, 0, 1.5, 'ammo'); });
    await tick(0.6); const seen = await C.evaluate(() => SAMMO.loot.length);
    await C.evaluate(() => PL.ent.pos.set(-3.5, 0, 1.5)); await tick(1.5);
    out.cartouchiere = { vueInvite: seen, hote: await H.evaluate(() => SAMMO.loot.length), invite: await C.evaluate(() => SAMMO.loot.length), reserveInvite: await res() };
    if (seen !== 1) fail('la cartouchière de l’hôte n’apparaît pas chez l’invité');
    if (out.cartouchiere.hote || out.cartouchiere.invite || !(out.cartouchiere.reserveInvite > 0)) fail('l’invité ne ramasse pas la cartouchière : ' + JSON.stringify(out.cartouchiere));
    // une tôle demandée par l'invité, cabossée par l'hôte
    await H.evaluate(() => { SURV_RES.metal = 2; survPub('r'); }); await tick(0.5);
    await C.evaluate((id) => survReq('plate', id), op); await tick(1.2);
    const pl1 = await H.evaluate((id) => SURV.open[id].plate.hp, op), pc1 = await C.evaluate((id) => SURV.open[id].plate.hp, op);
    await H.evaluate((id) => survOpenHit(SURV.open[id], 200, ZOMBIES[0]), op); await tick(1.2);
    out.tole = { hote: [pl1, await H.evaluate((id) => SURV.open[id].plate.hp, op)], invite: [pc1, await C.evaluate((id) => SURV.open[id].plate.hp, op)], visibleInvite: await C.evaluate((id) => !!(SURV.open[id].plate.mesh && SURV.open[id].plate.mesh.visible), op) };
    if (!(pl1 > 0) || pc1 !== pl1) fail('la tôle demandée par l’invité n’est pas posée chez les deux : ' + JSON.stringify(out.tole));
    if (out.tole.invite[1] !== out.tole.hote[1] || !(out.tole.hote[1] < pl1) || !out.tole.visibleInvite) fail('la tôle cabossée chez l’hôte ne suit pas chez l’invité : ' + JSON.stringify(out.tole));
    // un meuble porté par l'invité, posé contre la porte de la cuisine (de l'intérieur) : chez l'hôte aussi, il y ferme la porte
    // (le regard du joueur, PL.yaw, mène son corps à chaque image : on tourne les deux)
    {
      const kd = await H.evaluate(() => SURV.open.findIndex((o) => o.room === 'maison' && o.kind === 'porte' && o.out < 0));
      const bi = await H.evaluate(() => SURV.props.findIndex((q) => q.kind === 'bookcase'));
      await C.evaluate((bi) => { const q = SURV.props[bi]; PL.ent.pos.set(q.x + 0.8, q.y, q.z); PL.ent.yaw = PL.yaw = Math.PI / 2; }, bi); await tick(0.4);
      await C.evaluate((bi) => survPropTake(PL.ent, SURV.props[bi]), bi); await tick(1.2);
      const carriedH = await H.evaluate((bi) => { const q = SURV.props[bi]; return !!q.carried && q.carried.isRemote && q.c.x0 > 1e5; }, bi), carriedC = await C.evaluate((bi) => SACT.carry === SURV.props[bi], bi);
      await C.evaluate((kd) => { const a = survOpenAnchor(SURV.open[kd], 'in', new V3()); PL.ent.pos.set(a.x, 0, a.z + 1.4); PL.ent.yaw = PL.yaw = 0; }, kd); await tick(0.6);
      await C.evaluate(() => survPropDrop(PL.ent)); await tick(1.5);
      const st = async (P) => P.evaluate(([bi, kd]) => { const q = SURV.props[bi]; return { x: +q.x.toFixed(2), z: +q.z.toFixed(2), porte: SURV.open[kd].prop === q, porte2: survOpenShut(SURV.open[kd]), porteur: !!q.carried, collision: q.c.x0 < 1e5 }; }, [bi, kd]);
      out.meublePorte = { porteHote: carriedH, porteInvite: carriedC, hote: await st(H), invite: await st(C) };
      const h = out.meublePorte.hote, c = out.meublePorte.invite;
      if (!carriedH || !carriedC) fail('le meuble pris par l’invité n’est pas porté chez les deux : ' + JSON.stringify(out.meublePorte));
      if (!h.porte || h.porteur || !h.collision || Math.hypot(h.x - c.x, h.z - c.z) > 0.05 || !c.porte || c.porteur) fail('le meuble posé par l’invité ne ferme pas la porte chez les deux : ' + JSON.stringify(out.meublePorte));
    }
    // un meuble éclaté chez l'hôte
    await H.evaluate(() => { const p = SURV.props.find((q) => q.kind === 'couch'); survPropHit(p, 9999, ZOMBIES[0], null); });
    await tick(1.2);
    out.meuble = await C.evaluate(() => { const p = SURV.props.find((q) => q.kind === 'couch'); return { pv: p.hp, visible: !!(p.mesh && p.mesh.visible), collision: p.c.x0 < 1e5 }; });
    if (out.meuble.pv > 0 || out.meuble.visible || out.meuble.collision) fail('le meuble éclaté chez l’hôte reste chez l’invité : ' + JSON.stringify(out.meuble));
    // le largage
    await H.evaluate(() => { SV.drop = null; survAirdrop(); }); await tick(1);
    const dropC = await C.evaluate(() => ({ vu: !!SV.drop, maillage: !!(SV.dropMesh && SV.dropMesh.visible), id: SURV.caches.findIndex((c) => c.kind === 'drop'), x: SV.drop && SV.drop[0], z: SV.drop && SV.drop[1] }));
    await drainC(); await C.evaluate((d) => { PL.ent.pos.set(d.x + 0.8, groundHeight(d.x, d.z, 2, 0.3), d.z); }, dropC); await tick(0.3);
    await C.evaluate((i) => survReq('take', i), dropC.id); await tick(1.2);
    const full = await C.evaluate(() => PL.ent.arms.slots.filter(ammoUsable).every((w) => w.reserve === ammoMaxOf(w)));
    await drainC(); await C.evaluate((i) => survReq('take', i), dropC.id); await tick(1.2); const twice = (await res()) > 0;
    await H.evaluate((i) => survApply('take', i, PL.ent), dropC.id); await tick(1.2);
    out.largage = { vuInvite: dropC.vu, maillage: dropC.maillage, pleinInvite: full, deuxFois: twice, apres: { hote: await H.evaluate(() => !!SV.drop), invite: await C.evaluate(() => !!SV.drop) } };
    if (!dropC.vu || !dropC.maillage) fail('le largage n’apparaît pas chez l’invité');
    if (!full) fail('le largage ne donne pas le plein à l’invité'); if (twice) fail('l’invité prend le largage deux fois');
    if (out.largage.apres.hote || out.largage.apres.invite) fail('le largage pris par les deux reste en place : ' + JSON.stringify(out.largage.apres));
  } catch (e) { fail('exception : ' + String(e && e.stack || e).slice(0, 400)); }
  console.log(JSON.stringify(out, null, 1));
  for (const [n, L] of [['hôte', A.logs], ['invité', B.logs]]) { const errs = L.filter((l) => l.includes('pageerror') || l.includes('mock')); if (errs.length) { console.log(n + ' :\n' + errs.slice(0, 8).join('\n')); fails.push('erreurs dans la page de l’' + n); } }
  await A.browser.close(); await B.browser.close();
  if (fails.length) { console.log('ÉCHECS :\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('survie en ligne : rien à signaler');
})();
