# 🥚 The Million Dollar Baby Defense

Meme tower defense: protect the egg from swarming sperm. When it gets
fertilized, a gacha roulette decides the kid's career — and your Net Worth.
Live global leaderboard via Convex.

## Run it

```bash
npm install
npm run dev        # playable immediately (offline mode, local net worth)
```

## Go live (global leaderboard)

```bash
npx convex dev     # links/creates your Convex deployment, runs codegen,
                   # and writes VITE_CONVEX_URL to .env.local
```

Keep `npx convex dev` running in one terminal and `npm run dev` in another.
Restart vite after the first link so it picks up `.env.local`. The
leaderboard panel switches from "offline" to the live top-10 automatically.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Game loop | `src/game/engine.js` | Canvas2D, requestAnimationFrame, difficulty ramps over time |
| Phases | `src/App.jsx` | `menu → playing → rolling → result` state machine |
| Gacha roll | `convex/leaderboard.ts` → `rollGacha` | **Server-side** weighted RNG (anti-cheat); client only animates the result |
| Roulette | `src/components/GachaRoulette.jsx` | Slot reel decelerates onto the server's outcome |
| Leaderboard | `convex/leaderboard.ts` → `topPlayers` | Reactive `useQuery` — updates in real time for all players |
| Schema | `convex/schema.ts` | `players` table, indexed by `playerId` and `netWorth` |

### Outcomes (weighted)

| Career | Chance | Net Worth |
|---|---|---|
| 🧑‍⚕️ The Doctor | 10% | +$500,000 |
| 🧑‍💻 The Engineer | 20% | +$150,000 |
| 🧍 The Average Joe | 40% | +$10,000 |
| 🛋️ The Failure | 20% | −$50,000 |
| ⚽ The Failed Footballer | 10% | −$250,000 |

### Notes

- `convex/_generated/` ships with `anyApi` placeholder stubs so the app
  builds before you link Convex; `npx convex dev` replaces them with real
  typed codegen.
- Player identity is an anonymous UUID in `localStorage`; net worth persists
  across rounds (server-side once connected).
