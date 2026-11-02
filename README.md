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

Headless benches for these systems are in `tools/dev/visual/`: `degats.js`, `lourdes.js`, `roquettes.js`, `mines.js`,
`tourelle.js`, `grappin.js`, `breches.js`, `chien.js`, `helico.js`. `docs/BREACHLINE-ASSETS.md` lists what remains to replace
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
