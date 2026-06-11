# 🦖 EGGSTINCTION

A canvas tower-defense game. A stone catapult sits on the **last dinosaur egg**
and a relentless swarm of predators charges in to crack it. Hurl boulders,
survive as long as you can — and when the nest *is* breached (it always is), the
egg hatches and a gacha roulette rolls **what your dinosaur becomes**: a
valley-ruling T-Rex, or a tragic evolutionary dead end.

Two live global leaderboards, powered by [Convex](https://convex.dev):
**🦖 Apex Genome** (highest Genome Value) and **🦴 Pest Exterminator** (most
predators culled).

---

## 🎮 How to play

1. **Aim with your mouse.** A catapult on top of the egg always points wherever
   your cursor is.
2. **Hold the left mouse button to hurl boulders.** Release to stop.
3. **Crush the predators before they reach the nest.** Raptors charge in from
   all four edges. **They start slow** — easy pickings — **but the longer you
   survive, the faster they get.** Late game is a feeding frenzy.
4. **Every predator you crush scores a point _and_ pays DNA** (+2,000 🧬 each,
   banked at the end of the run). Kills feed the **🦴 Pest Exterminator** board
   and keep you flush for the Bone Market.
5. **Near-misses trigger slow-mo.** When a predator is about to reach the egg,
   time dilates ("Primal Instinct") so you can pull off the clutch save.
6. **Unleash powerups mid-run.** Buy charges in the 🦴 Bone Market and trigger
   them with the on-screen buttons or number keys **1–5** — Frenzy, Triple Hurl,
   Tar Pit, Bone Shards, or an Amber Ward.
7. **Nest breached = HATCHING.** The round ends.
8. **Then you spin the gacha.** A slot machine rolls what hatches — and **the
   longer you survived, the better your odds.** A T-Rex pads your **🧬 Genome
   Value**; a Sentient Rock guts it. Genome carries over and ranks you on the
   Apex board.
9. **Hit "Guard the Next Nest" and go again.** Esc pauses.

> 💡 Tip: surviving longer compounds — more kills, more DNA, *and* better hatch
> odds — but the swarm speeds up the whole time. There's no winning, only a high
> score.

---

## ▶️ Run it

```bash
npm install
npm run dev        # playable immediately (offline mode, local scores)
```

Offline mode keeps your Genome Value and kills in `localStorage` so the game is
fully playable before you link a backend — the leaderboards just say "offline".

## 🌍 Go live (global leaderboards)

```bash
npx convex dev     # links/creates your Convex deployment, runs codegen,
                   # and writes VITE_CONVEX_URL to .env.local
```

Keep `npx convex dev` running in one terminal and `npm run dev` in another.
Restart vite after the first link so it picks up `.env.local`. The leaderboard
panel switches from "offline" to the live top-10 automatically.

---

## 🏆 Leaderboards

| Board | Ranked by | Index |
|---|---|---|
| 🦖 **Apex Genome** | Cumulative Genome Value from hatches | `by_netWorth` |
| 🦴 **Pest Exterminator** | Lifetime predators culled across all runs | `by_totalKills` |

Flip between them with the tabs at the top of the side panel. Both update in
real time for every connected player.

## 🥚 Hatch outcomes (server-side, weighted)

20 possible hatchlings, from apex legends to evolutionary regret:

| Hatchling | Genome Value |
|---|---|
| 🦖 Tyrannosaurus Rex | +2,000,000 |
| 🐊 Spinosaurus | +1,000,000 |
| 🦅 Quetzalcoatlus | +750,000 |
| 🦕 Triceratops | +500,000 |
| 🦖 Velociraptor | +420,000 |
| 🐢 Ankylosaurus | +300,000 |
| 🦎 Stegosaurus | +250,000 |
| 🦖 Allosaurus | +200,000 |
| 🐊 Baryonyx | +150,000 |
| 🐦 Gallimimus | +80,000 |
| 🦕 Iguanodon | +45,000 |
| 🦕 Parasaurolophus | +30,000 |
| 🐔 Compsognathus | +10,000 |
| 🦤 The Dodo | −30,000 |
| 🦎 Dimetrodon | −50,000 |
| 🐛 Trilobite | −80,000 |
| 🐚 Ammonite | −150,000 |
| 🪳 Just a Cockroach | −250,000 |
| 🦟 The Amber Mosquito | −400,000 |
| 🪨 A Sentient Rock | −666,000 |

The roll happens **on the server** (`convex/leaderboard.ts → rollGacha`) so
nobody can forge a T-Rex — the client only animates the result.

### 🧬 Survival skews the odds

The roll isn't pure luck. **How long you survive (plus your kill count) bends
the distribution toward apex species** — so a player who holds out for 30
seconds has genuinely better odds than someone who lasts one second, even
though both *can* technically hatch anything.

Each outcome's weight is scaled by `weight · exp(TILT · luck · goodness)`,
where `luck` ramps from 0 → 1 over ~60s survived / ~100 kills, and `goodness`
is the outcome's Genome Value normalized to ±1. At `luck = 0` you roll the base
table; maxed out, the legends get up to ~9× their weight and the dead ends drop
to ~0.1×. The formula lives in both `convex/leaderboard.ts` (authoritative) and
`src/game/outcomes.js` (offline + the result card's luck readout).

---

## 🏗️ Architecture

| Piece | Where | Notes |
|---|---|---|
| Game loop | `src/game/engine.js` | Canvas2D, requestAnimationFrame; spawn rate + swim speed ramp over time, near-miss slow-mo, timed buffs |
| Phases | `src/App.jsx` | `menu → playing → rolling → result` state machine, pause + shop overlays |
| Gacha roll | `convex/leaderboard.ts → rollGacha` | **Server-side** weighted RNG (anti-cheat); survival-skewed; also banks kill DNA |
| Roulette | `src/components/GachaRoulette.jsx` | Slot reel decelerates onto the server's outcome |
| Leaderboards | `convex/leaderboard.ts → topPlayers` / `topDestroyers` | Reactive `useQuery` — both update live |
| Marketplace | `src/components/Marketplace.jsx` | Buy stackable consumable powerups with Genome Value |
| Powerups | `src/game/powerups.js` + engine `activate()` | Timed buffs (1–5 hotkeys) + a one-hit Amber Ward |
| Schema | `convex/schema.ts` | `players` table, indexed by `playerId`, `netWorth`, `totalKills`; `inventory` record of charges |

### Notes

- `convex/_generated/` ships with typed codegen produced by `npx convex dev`.
  New optional fields (`totalKills`, `inventory`) keep older player documents
  valid without a migration.
