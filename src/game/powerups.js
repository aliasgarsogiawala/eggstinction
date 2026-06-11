// Marketplace powerups. Bought with Net Worth (your leaderboard score is the
// currency — spending it for power costs you rank). Owned permanently and
// applied at the start of every run. Costs MUST mirror the server table in
// convex/leaderboard.ts (POWERUP_COSTS) — the server is authoritative on price.
export const POWERUPS = [
  {
    key: "rapidfire",
    name: "Rapid Fire",
    emoji: "⚡",
    cost: 80_000,
    desc: "Turret fires almost twice as fast.",
  },
  {
    key: "tripleshot",
    name: "Triple Shot",
    emoji: "🔱",
    cost: 200_000,
    desc: "Spit three bullets in a spread instead of one.",
  },
  {
    key: "slowfield",
    name: "Slow Field",
    emoji: "🐌",
    cost: 150_000,
    desc: "Swimmers swim 30% slower, all run long.",
  },
  {
    key: "pierce",
    name: "Piercing Rounds",
    emoji: "🎯",
    cost: 175_000,
    desc: "Bullets punch through swimmers instead of stopping.",
  },
  {
    key: "shield",
    name: "Egg Shield",
    emoji: "🛡️",
    cost: 300_000,
    desc: "Survive the first hit each run — blows the swarm back.",
  },
];

export const powerupByKey = (key) => POWERUPS.find((p) => p.key === key);
