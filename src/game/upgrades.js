// Permanent meta-progression upgrades, bought with Genome Value (DNA) and
// applied at the start of every run. Levels persist per player. Costs MUST
// mirror UPGRADE_DEFS in convex/leaderboard.ts.
export const UPGRADES = [
  {
    key: "damage",
    name: "Sharper Boulders",
    emoji: "🪨",
    base: 60_000,
    max: 4,
    desc: "+1 boulder damage. Crack brutes and bosses far faster.",
  },
  {
    key: "firerate",
    name: "Faster Arms",
    emoji: "⚡",
    base: 70_000,
    max: 4,
    desc: "Crank up the catapult's base fire rate.",
  },
  {
    key: "roarpower",
    name: "Mighty Roar",
    emoji: "🦖",
    base: 80_000,
    max: 4,
    desc: "Bigger ROAR blast radius, more damage, faster charge.",
  },
  {
    key: "egghp",
    name: "Tougher Shell",
    emoji: "🛡️",
    base: 120_000,
    max: 3,
    desc: "The egg survives one extra hit per level.",
  },
  {
    key: "greed",
    name: "DNA Splicer",
    emoji: "🧬",
    base: 90_000,
    max: 4,
    desc: "+25% DNA from every kill, per level.",
  },
];

export const upgradeByKey = (k) => UPGRADES.find((u) => u.key === k);

// Cost of the NEXT level given how many you already own.
export const upgradeCost = (base, level) => base * (level + 1);
