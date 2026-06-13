// Shared meta-progression definitions: daily challenges, achievements, and
// prestige. The authoritative copies of the reward logic also live in
// convex/leaderboard.ts — keep the two in sync (same pattern as OUTCOMES).

// ---------------- daily challenges ----------------
// Single-run objectives. Three are chosen each day, deterministically by date.
export const CHALLENGE_POOL = [
  { key: "kills50", label: "Cull 50 predators in one run", emoji: "🦴", type: "kills", target: 50, reward: 100_000 },
  { key: "survive90", label: "Survive 90 seconds", emoji: "⏱️", type: "time", target: 90, reward: 100_000 },
  { key: "combo20", label: "Chain a 20-combo", emoji: "💥", type: "combo", target: 20, reward: 80_000 },
  { key: "nopwr30", label: "Get 30 kills with no powerups", emoji: "🚫", type: "killsNoPower", target: 30, reward: 120_000 },
  { key: "wave5", label: "Reach wave 5", emoji: "🌊", type: "wave", target: 5, reward: 90_000 },
  { key: "boss1", label: "Defeat an Alpha boss", emoji: "🦖", type: "boss", target: 1, reward: 110_000 },
  { key: "kills100", label: "Cull 100 predators in one run", emoji: "🦴", type: "kills", target: 100, reward: 200_000 },
  { key: "combo35", label: "Chain a 35-combo", emoji: "💥", type: "combo", target: 35, reward: 160_000 },
];

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

// Local date as YYYY-MM-DD (so the daily resets at the player's midnight).
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// The day before `d`, same format — used to tell whether a login streak continued.
export const yesterdayStr = (d = new Date()) =>
  todayStr(new Date(d.getTime() - 86_400_000));

// ---------------- login streak ----------------
// A daily bonus that grows with consecutive days played, then caps. Mirror the
// constants + math in convex/leaderboard.ts.
export const STREAK_BASE = 20_000; // DNA per streak day
export const STREAK_CAP = 7; // reward stops growing past this many days
export const streakReward = (streak) =>
  STREAK_BASE * Math.min(Math.max(streak, 1), STREAK_CAP);

// What a streak becomes today, given the last day a bonus was claimed.
export function nextStreak(prevStreak = 0, lastClaimDay = "", now = new Date()) {
  if (lastClaimDay === todayStr(now)) return prevStreak; // already claimed today
  if (lastClaimDay === yesterdayStr(now)) return prevStreak + 1; // continued
  return 1; // streak broken (or first ever)
}

// Deterministic pick of 3 challenges for a given day.
export function todaysChallenges(dateStr) {
  let h = hashStr(dateStr);
  const pool = CHALLENGE_POOL.slice();
  const pick = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    pick.push(pool.splice(h % pool.length, 1)[0]);
  }
  return pick;
}

export function challengeByKey(key) {
  return CHALLENGE_POOL.find((c) => c.key === key);
}

// run = { kills, time, combo, usedPowerup, wave, bossKills }
export function challengeMet(c, run) {
  switch (c.type) {
    case "kills": return run.kills >= c.target;
    case "time": return run.time >= c.target;
    case "combo": return run.combo >= c.target;
    case "killsNoPower": return !run.usedPowerup && run.kills >= c.target;
    case "wave": return run.wave >= c.target;
    case "boss": return run.bossKills >= c.target;
    default: return false;
  }
}

// ---------------- achievements ----------------
// stats = { totalKills, totalBossKills, bestCombo, bestTime, dexCount,
//           prestige, netWorth, preserveCount, trex }
export const ACHIEVEMENTS = [
  { key: "first_kill", name: "First Blood", emoji: "🩸", desc: "Cull your first predator.", reward: 5_000, check: (s) => s.totalKills >= 1 },
  { key: "trex", name: "Apex Predator", emoji: "🦖", desc: "Hatch a Tyrannosaurus Rex.", reward: 100_000, check: (s) => s.trex >= 1 },
  { key: "kills200", name: "Exterminator", emoji: "🦴", desc: "200 lifetime predators culled.", reward: 30_000, check: (s) => s.totalKills >= 200 },
  { key: "kills1000", name: "Legend of the Hunt", emoji: "☠️", desc: "1,000 lifetime culls.", reward: 120_000, check: (s) => s.totalKills >= 1000 },
  { key: "survive300", name: "Endurance", emoji: "⏱️", desc: "Survive 5 minutes in one run.", reward: 100_000, check: (s) => s.bestTime >= 300 },
  { key: "combo50", name: "Combo Master", emoji: "💥", desc: "Chain a 50-combo.", reward: 80_000, check: (s) => s.bestCombo >= 50 },
  { key: "dex5", name: "Breeder", emoji: "📖", desc: "Discover 5 species.", reward: 40_000, check: (s) => s.dexCount >= 5 },
  { key: "dex10", name: "Geneticist", emoji: "📚", desc: "Discover 10 species.", reward: 90_000, check: (s) => s.dexCount >= 10 },
  { key: "dexall", name: "Complete the Dex", emoji: "🧬", desc: "Discover all 20 species.", reward: 500_000, check: (s) => s.dexCount >= 20 },
  { key: "boss10", name: "Boss Slayer", emoji: "🦴", desc: "Defeat 10 Alpha bosses.", reward: 80_000, check: (s) => s.totalBossKills >= 10 },
  { key: "ranger", name: "Park Ranger", emoji: "🏞️", desc: "Place 10 decorations in the Preserve.", reward: 30_000, check: (s) => s.preserveCount >= 10 },
  { key: "prestige1", name: "Reborn", emoji: "⭐", desc: "Prestige for the first time.", reward: 0, check: (s) => s.prestige >= 1 },
];

export function achievementByKey(key) {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

// Returns the keys newly satisfied that aren't already in `have`.
export function newlyEarned(stats, have = []) {
  const had = new Set(have);
  return ACHIEVEMENTS.filter((a) => !had.has(a.key) && a.check(stats)).map((a) => a.key);
}

// ---------------- prestige ----------------
export const PRESTIGE_COST = 5_000_000;
export const prestigeMult = (p = 0) => 1 + 0.25 * p;
