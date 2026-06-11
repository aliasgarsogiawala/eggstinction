# 🥚 savedategg

A meme tower-defense game. A turret sits on a lone egg and a relentless swarm
of sperm swims in to fertilize it. Hold to shoot, survive as long as you can —
and when the egg *does* get fertilized (it always does), a gacha roulette rolls
the kid's career and decides whether you just got richer or much, much poorer.

Two live global leaderboards, powered by [Convex](https://convex.dev):
**💰 Net Worth** (the rich list) and **💥 Sperm Destroyer** (most kills).

---

## 🎮 How to play

1. **Aim with your mouse.** A turret on top of the egg always points wherever
   your cursor is.
2. **Hold the left mouse button to fire.** Bullets stream out toward the
   cursor. Release to stop.
3. **Pop the swimmers before they reach the egg.** Sperm pour in from all four
   edges. **They start slow** and crawl toward the center — easy pickings at
   first — **but the longer you survive, the faster they get.** Late game is
   pure chaos.
4. **Every sperm you destroy scores a point.** Your running kill count is shown
   top-left and feeds the **💥 Sperm Destroyer** leaderboard.
5. **One touch on the egg = FERTILIZED.** Game over for that round.
6. **Then you spin the gacha.** A slot machine rolls the kid's career. A Doctor
   pads your **💰 Net Worth**; a Failed Footballer guts it. Your net worth
   carries over between rounds and ranks you on the rich list.
7. **Hit "Defend the Next Egg" and go again** to climb both boards.

> 💡 Tip: stopping more sperm keeps you alive longer *and* climbs the Destroyer
> board — but the longer you last, the faster they swim. There's no winning,
> only a high score.

---

## ▶️ Run it

```bash
npm install
npm run dev        # playable immediately (offline mode, local scores)
```

Offline mode keeps your Net Worth and kills in `localStorage` so the game is
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
| 💰 **Net Worth** | Cumulative net worth from gacha rolls | `by_netWorth` |
| 💥 **Sperm Destroyer** | Lifetime sperm destroyed across all rounds | `by_totalKills` |

Flip between them with the tabs at the top of the side panel. Both update in
real time for every connected player.

## 🎰 Gacha outcomes (server-side, weighted)

20 possible kids, from generational jackpots to generational regret:

| Career | Net Worth |
|---|---|
| 🎬 The Movie Star | +$2,000,000 |
| 💼 The Tech CEO | +$1,000,000 |
| 🚀 The Astronaut | +$750,000 |
| 🧑‍⚕️ The Doctor | +$500,000 |
| 🪙 The Crypto Bro | +$420,000 |
| ⚖️ The Lawyer | +$300,000 |
| 🎮 The Pro Gamer | +$250,000 |
| 🤳 The Influencer | +$200,000 |
| 🧑‍💻 The Engineer | +$150,000 |
| 👨‍🍳 The Chef | +$80,000 |
| 👮 The Cop | +$45,000 |
| 🧑‍🏫 The Teacher | +$30,000 |
| 🧍 The Average Joe | +$10,000 |
| 🧟 The Couch Streamer | −$30,000 |
| 🛋️ The Failure | −$50,000 |
| 🎸 The Struggling Musician | −$80,000 |
| 🧙 The MLM 'Boss Babe' | −$150,000 |
| ⚽ The Failed Footballer | −$250,000 |
| 🃏 The Gambling Addict | −$400,000 |
| 💀 The One Who Bought The Top | −$666,000 |

Rarer outcomes (the jackpots and the catastrophes) carry lower weights. The
roll happens **on the server** (`convex/leaderboard.ts → rollGacha`) so nobody
can forge a $2M Movie Star — the client only animates the result.

### 🍀 Survival skews the odds

The roll isn't pure luck. **How long you survive (plus your kill count) bends
the distribution toward better careers** — so a player who holds out for 30
seconds has genuinely better odds than someone who lasts one second, even
though both *can* technically hit any outcome.

Each outcome's weight is scaled by `weight · exp(TILT · luck · goodness)`,
where `luck` ramps from 0 → 1 over ~60s survived / ~100 kills, and `goodness`
is the outcome's payout normalized to ±1. At `luck = 0` you roll the base
table; maxed out, the jackpots get up to ~9× their weight and the catastrophes
drop to ~0.1×. The formula lives in both `convex/leaderboard.ts` (authoritative)
and `src/game/outcomes.js` (offline + the result card's luck readout).

---

## 🏗️ Architecture

| Piece | Where | Notes |
|---|---|---|
| Game loop | `src/game/engine.js` | Canvas2D, requestAnimationFrame; spawn rate and swim speed ramp up over time |
| Phases | `src/App.jsx` | `menu → playing → rolling → result` state machine |
| Gacha roll | `convex/leaderboard.ts → rollGacha` | **Server-side** weighted RNG (anti-cheat); also tallies lifetime kills |
| Roulette | `src/components/GachaRoulette.jsx` | Slot reel decelerates onto the server's outcome |
| Leaderboards | `convex/leaderboard.ts → topPlayers` / `topDestroyers` | Reactive `useQuery` — both update live |
| Leaderboard UI | `src/components/Leaderboard.jsx` | Tabbed Net Worth / Sperm Destroyer panel |
| Schema | `convex/schema.ts` | `players` table, indexed by `playerId`, `netWorth`, and `totalKills` |

### Notes

- `convex/_generated/` ships with `anyApi` placeholder stubs so the app builds
  before you link Convex; `npx convex dev` replaces them with real typed
  codegen. (Until then, your editor may flag type errors on the new
  `totalKills` field — they clear after the first `convex dev` run.)
