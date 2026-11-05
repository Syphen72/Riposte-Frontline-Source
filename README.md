<h1 align="center"><img src="assets/logo.webp" alt="Breachline" width="640"></h1>

**Breachline** is a free first-person shooter played in the browser, on desktop and on phones.

It is built on the open-source code of Riposte: Frontline by BenDBSS (https://github.com/BenDBSS/Riposte-Frontline-Source),
version 5.6.0, used under the MIT License (`LICENSE`). Breachline has its own name, logo and icons; `NOTICE.md` lists the other
items of the original that are not under the MIT License (music, soldier animations, some sounds) and their terms.

## What Breachline adds

Breachline 6.0 builds on Riposte: Frontline 5.6 with environmental destruction, vertical movement, deployables and new
killstreaks. Everything is procedural code in `src/`, with no new asset files.

| System | Where | In play |
| --- | --- | --- |
| Breachable walls | `src/04d-breches.js`, `wallOpen` option `breach` | Marked wall sections open under a rocket, two grenades or an airstrike. The opening is real: collision goes, bullets and sight pass, and bots path through it at once (their nav is built with the openings and gated while closed). Khamsin has 8. |
| Decor damage | `src/04c-degats.js` | Facade windows shatter (state kept and synced). Parked cars and trucks smoke, burn, explode and leave wrecks. Red barrels, gas bottles and red jerrycans cook off and chain. Small crates splinter. |
| RPG-7 and Demolition class | `src/06ob-lanceurs.js`, `src/07f-roquettes.js` | Secondary-slot launcher with a visible rocket, smoke trail and backblast. Arms after 6 m (a dud before that), strong against helicopters, mechas, vehicles and walls. New preset class: MP5, RPG-7, mines. |
| Mines | `src/08i-mines.js` | Bounding mine and claymore, placed with the equipment key. Blinking light, red beams and a soft beep give them away; a bullet destroys them, a nearby blast sets them off. |
| Grapple | `src/08k-grappin.js` | V, gamepad LB (B in the bumper layout) or the touch button. Two charges, 9 s recharge. Hooks walls and block tops with somewhere to stand and vaults you onto the top. Jump to let go. |
| Sentry turret (5 kills) | `src/08j-tourelle.js` | Placed in front of you, locks on with a red laser, fires heavy tracers for 75 s or 240 rounds. Bots shoot it. |
| Robot dog (9 kills) | `src/08l-chien.js` | Procedural quadruped with a back turret. Follows you on the bot nav, attacks visible enemies, self-destructs after a short warning when destroyed. |
| Vehicle combat | `src/08d-heli.js`, `src/08f-mecha.js`, `src/04-fx.js` | Heavy tracers on every helicopter and mecha round with near-miss feedback. Explosions hurt helicopters; they smoke, burn, crash into roofs or streets, explode and burn as wrecks. The mecha's death has secondary explosions. |
| Shared unit base | `src/08h-unites.js` | Owner-simulated deployables (mines, turret, dog) with hit rays, blast damage, presence sync for late joiners, and bot reactions. |

Multiplayer follows the existing model: the shooter or owner simulates, decor that changes collision (vehicles, barrels, breach
walls) is decided by the host, and the host's state packets carry the decor state for players who join mid-match.

### Survival (6.1, 6.2)

A co-op mode against waves of the dead, on its own map (Holloway, an isolated farm at night). It is reached from the main menu
(Survie) or by picking the farm in a lobby; the other modes stay as they were.

| System | Where | In play |
| --- | --- | --- |
| Mode and waves | `src/09ia-survie.js` | 1 to 4 survivors (bot companions when solo). Preparation, then waves that grow with the wave number, the player count and the difficulty, mixing the five kinds. Objectives (generator, pickup) and an escape after the last wave, or endless. Announced events: a horde from one side, a power failure, a supply drop. Downed instead of dead, revived by a teammate or once by adrenaline; dead players watch a teammate and come back with the next wave. Points, end statistics. |
| Ammunition | `src/08n-ravitaillement.js` | Each weapon gets its own share of its full reserve (launchers half as much). End of wave: a top-up to 70/55/45 % by difficulty, a full refill every fifth wave. Ammo crates placed on the map (`ammo` in the map definition): two takes each (three with three survivors or more), a take comes back over time, all at the end of the wave. Pouches dropped by the dead, more often when the team is low (guests report their reserve). An emergency magazine after 5 s dry. A supply drop every other wave from wave 4, 17-25 m out, a full refill per survivor. Full refill for points at the house crate and for every objective. Online, the host owns crates, pouches and drops and sends each guest its share. |
| The dead | `src/07g-zombies.js` | Ordinary entities of team 2 built on the soldier body (same hit zones and ragdoll), with civilian clothes and their own gait, perception (sight, smell through floors, footsteps in the same building, gunshots, explosions), pathing, separation and melee. Shambler, runner, crawler, brute, screamer. When the open path is closed, a plan (`zombiePlan`) picks the cheapest thing to get through: the first obstacle on a "soft" path (barricade, furniture) or a window, avoiding openings where others already crowd. They attack it, shove it, climb over low furniture, push physics props aside, and clamber up to a target perched within 2.1 m. Stuck detection escalates: new path, attack what is in reach, soft path, a detour, and as a last resort (out of sight, never towards the living) a step back onto the network or a return to the woods. |
| Barricades | `src/08m-barricades.js` | Planks are real collision boxes nailed one by one on windows and doors (shoot between them, nobody walks through), damaged in visible stages, torn off by the dead. A metal sheet over the boards takes the first blows. A closed door closes its nodes in the bot network (`NAV.bgate`). Heavy furniture (bookcase, wardrobe, dresser, couch) can be carried anywhere; wherever it stands it closes the network nodes it covers (`NAV.pblock`), and it wears down, shoves back and breaks, freeing its collision and its nodes. Caches of planks, tools, nails and metal sheets. One action key for everything. |
| The farm | `src/02yo-ferme.js` | Stone farmhouse (two floors joined by stairs with an open landing, solid attic), barn with a hayloft, tool shed, yard, fields, treeline. Collision defined with the map: nothing walkable above the roofs, bars on the upstairs window over the flat porch roof. |

The bot network links steep stairs (up to 1.05 m per cell, `NAV_RAMP_DH`, only on ramps and only where the climb is continuous),
finds the nearest node by score rather than stopping at the first non-empty ring, and does not let a smoothed path cross a thin wall
between levels. Stairs everywhere have a solid core under their steps.

Online, the host simulates the dead, the waves, the stockpiles, planks and furniture, and sends them in its state packet; guests
send their hits, requests, downed state and revives. If the host leaves, its replacement takes the dead over where they stand.

The grapple is removed from survival through a per-mode rule (`modeAllows`, `MODES.<id>.ban`), applied to every input and to other
players' ropes.

### Collision

Roofs, domes and rooftop equipment get collision taken from their rendered triangles (`Maker.capBegin` / `capEnd` in
`src/02a-kit.js`): solid where they sit on a wall or slab, a shell over an open hall. A ray that starts more than 12 cm inside a solid
box is stopped (no more shooting out of geometry you cannot be hit in). Fast movement is sub-stepped and cannot pass through thin walls
or ceilings; a body that still ends up inside geometry returns to its last safe place. The grapple checks the landing spot, the room to
stand and the body's whole path, and finishes with a short mantle.

Headless benches for these systems are in `tools/dev/visual/`: `degats.js`, `lourdes.js`, `roquettes.js`, `mines.js`,
`tourelle.js`, `grappin.js`, `breches.js`, `chien.js`, `helico.js`; for survival and collision, `survie.js`, `survie-nav.js` (the farm: every floor on the network, the dead upstairs and in the hayloft,
furniture across the landing and a doorway, a fully fortified house, a stale path, and a search for any place a player can stand that the
dead cannot reach), `survie-munitions.js` (every ammo source, then a twelve-wave solo session), `survie-reseau.js` (two game
pages joined through a stand-in for PeerJS), `toits.js` (roof cavities on a map) and `grappin-toits.js` (grapples, high-speed movement
and ray symmetry on a map). `docs/BREACHLINE-ASSETS.md` lists what remains to replace
before a commercial release.

## What is inside

The whole game: renderer (three.js), maps, scenery, weapons, soldiers and outfits, bots, physics, sound, menus, keyboard, mouse,
gamepad and touch controls, browser to browser multiplayer. All geometry is built by code, with no imported 3D model.

The server side of the official site is not included: accounts, saved progress, leaderboard, friends, community, moderation and the
game server for online lobbies. Without it, the game runs solo and online matches go from browser to browser (PeerJS). The account
screens say that accounts are not available.

## Build and play

Nothing to install, Python 3 is enough:

```bash
python3 build.py
```

The script assembles `dist/breachline.html`, the game page, along with `dist/tex/` and `dist/sfx/` (textures and sounds,
loaded when a map starts). Open `dist/breachline.html` in a recent browser (Chrome, Edge, Firefox) with those folders next to
it. The `dist/` folder of this repository is already built.

## How the code is organized

The game is written in French: code, comments and tool output. `src/*.js` is joined in alphabetical order, then injected into
`shell.html` (page, styles and menus). Each function is declared only once (`python3 tools/dev/check_decl.py`).

| Files | Content |
| --- | --- |
| `src/00-*`, `src/01-*` | translations, startup, rendering and GPU settings |
| `src/02-*` | maps and scenery: terrain, materials, lighting, water, vegetation, each map's kit |
| `src/03-*`, `src/07-*` | bot navigation and AI |
| `src/04-*` | effects, object physics |
| `src/05-*` | sound |
| `src/06-*` | weapons and their models, soldiers, animations, outfits, ragdolls |
| `src/08-*` | player, controls, killstreaks, vehicles |
| `src/09-*` | match, loading, network, menus, touch and gamepad controls, interface |
| `i18n/en.txt` | English texts (the game is written in French, English is the default language) |
| `assets/` | textures, sounds, baked animations, icons |
| `tools/` | asset building (`build_*.py`), checks and visual tests (`tools/dev/`) |

The visual tests in `tools/dev/visual/` open the game in Chromium (`cd tools/dev && npm ci`, then for example
`node tools/dev/visual/menus.js`).
