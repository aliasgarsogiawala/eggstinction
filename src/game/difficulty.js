// Difficulty modes — three ways to play the same nest defense. Each tunes the
// engine's pace and the egg's resilience, and carries a reward multiplier that
// is ALSO enforced server-side (mirror DIFF_REWARD in convex/leaderboard.ts).
//
//   speedMul  — base predator speed scale
//   rampMul   — how hard speed ramps with elapsed time
//   spawnMul  — swarm density (more enemies, faster cadence)
//   eggBonus  — extra egg HP granted for the run
//   rewardMul — multiplier applied to positive DNA earned
export const DIFFICULTIES = [
  {
    key: "practice",
    name: "Practice",
    emoji: "🌱",
    tagline: "Slow, forgiving — learn the ropes",
    speedMul: 0.78,
    rampMul: 0.5,
    spawnMul: 0.8,
    eggBonus: 2,
    rewardMul: 0.5,
  },
  {
    key: "survival",
    name: "Survival",
    emoji: "🌊",
    tagline: "The classic endless escalation",
    speedMul: 1,
    rampMul: 1,
    spawnMul: 1,
    eggBonus: 0,
    rewardMul: 1,
  },
  {
    key: "speedrun",
    name: "Speedrun",
    emoji: "⚡",
    tagline: "Brutal pace — but fat payouts",
    speedMul: 1.3,
    rampMul: 1.7,
    spawnMul: 1.45,
    eggBonus: 0,
    rewardMul: 1.6,
  },
];

export const DEFAULT_DIFFICULTY = "survival";

export const difficultyByKey = (key) =>
  DIFFICULTIES.find((d) => d.key === key) ||
  DIFFICULTIES.find((d) => d.key === DEFAULT_DIFFICULTY);
