// Marketplace powerups — now CONSUMABLE charges. Buy as many as you like
// (they stack); activate them mid-run with the on-screen buttons or number
// keys 1–5. Each use spends one charge.
//
// `type: "buff"` effects last `duration` seconds; `type: "shield"` is a single
// one-hit guard. Costs MUST mirror the server table in convex/leaderboard.ts
// (POWERUP_COSTS) — the server is authoritative on price.
export const POWERUPS = [
  {
    key: "rapidfire",
    name: "Frenzy",
    emoji: "🔥",
    cost: 25_000,
    type: "buff",
    duration: 8,
    desc: "Hurl rocks almost twice as fast for 8s.",
  },
  {
    key: "tripleshot",
    name: "Triple Hurl",
    emoji: "☄️",
    cost: 40_000,
    type: "buff",
    duration: 8,
    desc: "Launch three boulders at once for 8s.",
  },
  {
    key: "slowfield",
    name: "Tar Pit",
    emoji: "🛢️",
    cost: 30_000,
    type: "buff",
    duration: 6,
    desc: "Predators crawl at 40% speed for 6s.",
  },
  {
    key: "pierce",
    name: "Bone Shards",
    emoji: "🦴",
    cost: 35_000,
    type: "buff",
    duration: 8,
    desc: "Boulders punch through predators for 8s.",
  },
  {
    key: "shield",
    name: "Amber Ward",
    emoji: "🛡️",
    cost: 50_000,
    type: "shield",
    desc: "Block the next hit — blasts the swarm back.",
  },
];

export const powerupByKey = (key) => POWERUPS.find((p) => p.key === key);
