import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side outcome table. The roll happens HERE, not on the client,
 * so players can't forge a $500k Doctor. The client only animates the
 * result the server returns.
 */
const OUTCOMES = [
  // apex hatchlings
  { key: "trex", label: "Tyrannosaurus Rex", weight: 1, delta: 2_000_000 },
  { key: "spino", label: "Spinosaurus", weight: 3, delta: 1_000_000 },
  { key: "quetz", label: "Quetzalcoatlus", weight: 3, delta: 750_000 },
  { key: "trike", label: "Triceratops", weight: 8, delta: 500_000 },
  { key: "raptor", label: "Velociraptor", weight: 5, delta: 420_000 },
  { key: "anky", label: "Ankylosaurus", weight: 7, delta: 300_000 },
  { key: "steg", label: "Stegosaurus", weight: 5, delta: 250_000 },
  { key: "allo", label: "Allosaurus", weight: 6, delta: 200_000 },
  // the steady herd
  { key: "bary", label: "Baryonyx", weight: 14, delta: 150_000 },
  { key: "gallim", label: "Gallimimus", weight: 7, delta: 80_000 },
  { key: "iguanodon", label: "Iguanodon", weight: 6, delta: 45_000 },
  { key: "parasaur", label: "Parasaurolophus", weight: 8, delta: 30_000 },
  { key: "compy", label: "Compsognathus", weight: 16, delta: 10_000 },
  // evolutionary dead ends
  { key: "dodo", label: "The Dodo", weight: 8, delta: -30_000 },
  { key: "dimetrodon", label: "Dimetrodon", weight: 12, delta: -50_000 },
  { key: "trilobite", label: "Trilobite", weight: 7, delta: -80_000 },
  { key: "ammonite", label: "Ammonite", weight: 5, delta: -150_000 },
  { key: "roach", label: "Just a Cockroach", weight: 6, delta: -250_000 },
  { key: "mosquito", label: "The Amber Mosquito", weight: 4, delta: -400_000 },
  { key: "rock", label: "A Sentient Rock", weight: 2, delta: -666_000 },
] as const;

// Surviving longer (and killing more) bends the odds toward better careers.
// A 1-second run rolls the base table; a long, high-kill run boosts the
// jackpots and suppresses the catastrophes. Mirrors src/game/outcomes.js.
const TILT = 2.2;
const MAX_POS = 2_000_000;
const MAX_NEG = 666_000;

// Every swimmer destroyed also pays out — so a long run banks cash even before
// the gacha, and you're never too broke to restock powerups. Mirror in
// src/game/outcomes.js.
const KILL_REWARD = 2_000;

function survivalLuck(kills: number, seconds: number) {
  const timePart = Math.min(seconds / 60, 1);
  const killPart = Math.min(kills / 100, 1);
  return Math.min(0.65 * timePart + 0.35 * killPart, 1);
}

function rollOutcome(kills: number, seconds: number) {
  const luck = survivalLuck(kills, seconds);
  const weights = OUTCOMES.map((o) => {
    const goodness = o.delta >= 0 ? o.delta / MAX_POS : o.delta / MAX_NEG;
    return o.weight * Math.exp(TILT * luck * goodness);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < OUTCOMES.length; i++) {
    r -= weights[i];
    if (r <= 0) return OUTCOMES[i];
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

// ---------------- meta progression (mirror src/game/meta.js) ----------------
type Challenge = { key: string; type: string; target: number; reward: number };
const CHALLENGE_POOL: Challenge[] = [
  { key: "kills50", type: "kills", target: 50, reward: 100_000 },
  { key: "survive90", type: "time", target: 90, reward: 100_000 },
  { key: "combo20", type: "combo", target: 20, reward: 80_000 },
  { key: "nopwr30", type: "killsNoPower", target: 30, reward: 120_000 },
  { key: "wave5", type: "wave", target: 5, reward: 90_000 },
  { key: "boss1", type: "boss", target: 1, reward: 110_000 },
  { key: "kills100", type: "kills", target: 100, reward: 200_000 },
  { key: "combo35", type: "combo", target: 35, reward: 160_000 },
];

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function todaysChallenges(dateStr: string): Challenge[] {
  let h = hashStr(dateStr);
  const pool = CHALLENGE_POOL.slice();
  const pick: Challenge[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    pick.push(pool.splice(h % pool.length, 1)[0]);
  }
  return pick;
}
type Run = { kills: number; time: number; combo: number; usedPowerup: boolean; wave: number; bossKills: number };
function challengeMet(c: Challenge, r: Run) {
  switch (c.type) {
    case "kills": return r.kills >= c.target;
    case "time": return r.time >= c.target;
    case "combo": return r.combo >= c.target;
    case "killsNoPower": return !r.usedPowerup && r.kills >= c.target;
    case "wave": return r.wave >= c.target;
    case "boss": return r.bossKills >= c.target;
    default: return false;
  }
}

type Stats = {
  totalKills: number; totalBossKills: number; bestCombo: number; bestTime: number;
  dexCount: number; prestige: number; preserveCount: number; trex: number;
};
const ACHIEVEMENTS: { key: string; reward: number; check: (s: Stats) => boolean }[] = [
  { key: "first_kill", reward: 5_000, check: (s) => s.totalKills >= 1 },
  { key: "trex", reward: 100_000, check: (s) => s.trex >= 1 },
  { key: "kills200", reward: 30_000, check: (s) => s.totalKills >= 200 },
  { key: "kills1000", reward: 120_000, check: (s) => s.totalKills >= 1000 },
  { key: "survive300", reward: 100_000, check: (s) => s.bestTime >= 300 },
  { key: "combo50", reward: 80_000, check: (s) => s.bestCombo >= 50 },
  { key: "dex5", reward: 40_000, check: (s) => s.dexCount >= 5 },
  { key: "dex10", reward: 90_000, check: (s) => s.dexCount >= 10 },
  { key: "dexall", reward: 500_000, check: (s) => s.dexCount >= 20 },
  { key: "boss10", reward: 80_000, check: (s) => s.totalBossKills >= 10 },
  { key: "ranger", reward: 30_000, check: (s) => s.preserveCount >= 10 },
  { key: "prestige1", reward: 0, check: (s) => s.prestige >= 1 },
];
const PRESTIGE_COST = 5_000_000;

/** Roll the gacha, bank DNA, and resolve daily challenges + achievements. */
export const rollGacha = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    killStreak: v.number(),
    survivedSeconds: v.optional(v.number()),
    maxCombo: v.optional(v.number()),
    usedPowerup: v.optional(v.boolean()),
    wave: v.optional(v.number()),
    bossKills: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const seconds = args.survivedSeconds ?? 0;
    const outcome = rollOutcome(args.killStreak, seconds);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    const run: Run = {
      kills: args.killStreak,
      time: seconds,
      combo: args.maxCombo ?? 0,
      usedPowerup: args.usedPowerup ?? false,
      wave: args.wave ?? 0,
      bossKills: args.bossKills ?? 0,
    };

    const prestige = existing?.prestige ?? 0;
    const mult = 1 + 0.25 * prestige;
    const greed = existing?.upgrades?.greed ?? 0;
    const killEarnings = Math.round(args.killStreak * KILL_REWARD * (1 + 0.25 * greed));

    // Lifetime stat rollup.
    const totalKills = (existing?.totalKills ?? 0) + args.killStreak;
    const totalBossKills = (existing?.totalBossKills ?? 0) + run.bossKills;
    const bestCombo = Math.max(existing?.bestCombo ?? 0, run.combo);
    const bestTime = Math.max(existing?.bestTime ?? 0, seconds);

    // Hatchling dex.
    const collection = { ...(existing?.collection ?? {}) };
    const prev = collection[outcome.key] ?? { count: 0, bestTime: 0 };
    collection[outcome.key] = { count: prev.count + 1, bestTime: Math.max(prev.bestTime, seconds) };

    // Daily challenges (reset on a new day).
    const day = todayStr();
    let challengeDay = existing?.challengeDay;
    let challengesDone = existing?.challengesDone ?? [];
    if (challengeDay !== day) {
      challengeDay = day;
      challengesDone = [];
    }
    const newChallenges: string[] = [];
    let bonus = 0;
    for (const c of todaysChallenges(day)) {
      if (!challengesDone.includes(c.key) && challengeMet(c, run)) {
        challengesDone = [...challengesDone, c.key];
        newChallenges.push(c.key);
        bonus += c.reward;
      }
    }

    // Achievements.
    const stats: Stats = {
      totalKills, totalBossKills, bestCombo, bestTime,
      dexCount: Object.keys(collection).length,
      prestige,
      preserveCount: existing?.preserve?.length ?? 0,
      trex: collection["trex"]?.count ?? 0,
    };
    const have = existing?.achievements ?? [];
    const newAchievements: string[] = [];
    let achBonus = 0;
    for (const a of ACHIEVEMENTS) {
      if (!have.includes(a.key) && a.check(stats)) {
        newAchievements.push(a.key);
        achBonus += a.reward;
      }
    }
    const achievements = [...have, ...newAchievements];

    // Total DNA this run — prestige multiplies positive gains.
    let gained = outcome.delta + killEarnings + bonus + achBonus;
    if (gained > 0) gained = Math.round(gained * mult);
    const nextWorth = (existing?.netWorth ?? 0) + gained;

    const fields = {
      name: args.name,
      netWorth: nextWorth,
      totalKills,
      bestKillStreak: Math.max(existing?.bestKillStreak ?? 0, args.killStreak),
      totalBossKills,
      bestCombo,
      bestTime,
      collection,
      challengeDay,
      challengesDone,
      achievements,
      lastOutcome: outcome.key,
    };
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, babies: existing.babies + 1 });
    } else {
      await ctx.db.insert("players", { ...fields, playerId: args.playerId, babies: 1 });
    }
    return {
      outcomeKey: outcome.key,
      delta: outcome.delta,
      killEarnings,
      bonusDNA: bonus + achBonus,
      mult,
      newChallenges,
      newAchievements,
    };
  },
});

/** Cash out at PRESTIGE_COST DNA for a permanent +25% multiplier per level. */
export const prestige = mutation({
  args: { playerId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (!existing || existing.netWorth < PRESTIGE_COST) {
      return { ok: false as const, reason: "locked" as const };
    }
    const nextP = (existing.prestige ?? 0) + 1;
    const have = existing.achievements ?? [];
    const achievements = have.includes("prestige1") ? have : [...have, "prestige1"];
    await ctx.db.patch(existing._id, { netWorth: 0, prestige: nextP, achievements });
    return { ok: true as const, prestige: nextP, mult: 1 + 0.25 * nextP };
  },
});

/** Top 10 global players by Net Worth — reactive, updates live for everyone. */
export const topPlayers = query({
  args: {},
  handler: async (ctx) => {
    const top = await ctx.db
      .query("players")
      .withIndex("by_netWorth")
      .order("desc")
      .take(10);
    return top.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      netWorth: p.netWorth,
      babies: p.babies,
      prestige: p.prestige ?? 0,
      lastOutcome: p.lastOutcome,
    }));
  },
});

/** Top 10 global Sperm Destroyers by lifetime kills — reactive. */
export const topDestroyers = query({
  args: {},
  handler: async (ctx) => {
    const top = await ctx.db
      .query("players")
      .withIndex("by_totalKills")
      .order("desc")
      .take(10);
    return top.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      totalKills: p.totalKills ?? 0,
      bestKillStreak: p.bestKillStreak ?? 0,
      lastOutcome: p.lastOutcome,
    }));
  },
});

/** Server-authoritative powerup prices (mirror src/game/powerups.js). */
const POWERUP_COSTS: Record<string, number> = {
  rapidfire: 25_000,
  tripleshot: 40_000,
  slowfield: 30_000,
  pierce: 35_000,
  shield: 50_000,
};

/** Buy one charge of a powerup. They stack — buy as many as you can afford. */
export const buyPowerup = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    powerup: v.string(),
  },
  handler: async (ctx, args) => {
    const cost = POWERUP_COSTS[args.powerup];
    if (cost === undefined) throw new Error("Unknown powerup");

    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    const netWorth = existing?.netWorth ?? 0;
    if (netWorth < cost) {
      return { ok: false as const, reason: "broke" as const };
    }

    const inventory = { ...(existing?.inventory ?? {}) };
    inventory[args.powerup] = (inventory[args.powerup] ?? 0) + 1;
    const nextWorth = netWorth - cost;

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        netWorth: nextWorth,
        inventory,
      });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.name,
        netWorth: nextWorth,
        babies: 0,
        totalKills: 0,
        bestKillStreak: 0,
        inventory,
      });
    }
    return { ok: true as const, netWorth: nextWorth, inventory };
  },
});

/** Server-authoritative meta-upgrade prices (mirror src/game/upgrades.js). */
const UPGRADE_DEFS: Record<string, { base: number; max: number }> = {
  damage: { base: 60_000, max: 4 },
  firerate: { base: 70_000, max: 4 },
  roarpower: { base: 80_000, max: 4 },
  egghp: { base: 120_000, max: 3 },
  greed: { base: 90_000, max: 4 },
};

/** Buy the next level of a permanent upgrade. Price scales with level. */
export const buyUpgrade = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    upgrade: v.string(),
  },
  handler: async (ctx, args) => {
    const def = UPGRADE_DEFS[args.upgrade];
    if (!def) throw new Error("Unknown upgrade");

    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    const upgrades = { ...(existing?.upgrades ?? {}) };
    const level = upgrades[args.upgrade] ?? 0;
    if (level >= def.max) return { ok: false as const, reason: "maxed" as const };

    const cost = def.base * (level + 1);
    const netWorth = existing?.netWorth ?? 0;
    if (netWorth < cost) return { ok: false as const, reason: "broke" as const };

    upgrades[args.upgrade] = level + 1;
    const nextWorth = netWorth - cost;

    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, netWorth: nextWorth, upgrades });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.name,
        netWorth: nextWorth,
        babies: 0,
        totalKills: 0,
        bestKillStreak: 0,
        upgrades,
      });
    }
    return { ok: true as const, netWorth: nextWorth, upgrades };
  },
});

/** Spend one charge of a powerup (when the player activates it in-game). */
export const consumePowerup = mutation({
  args: {
    playerId: v.string(),
    powerup: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (!existing) return { ok: false as const, reason: "empty" as const };

    const inventory = { ...(existing.inventory ?? {}) };
    if (!inventory[args.powerup] || inventory[args.powerup] <= 0) {
      return { ok: false as const, reason: "empty" as const };
    }
    inventory[args.powerup] -= 1;
    if (inventory[args.powerup] <= 0) delete inventory[args.powerup];

    await ctx.db.patch(existing._id, { inventory });
    return { ok: true as const, inventory };
  },
});

/** Server-authoritative decoration prices (mirror src/game/decor.js). */
const DECOR_COSTS: Record<string, number> = {
  fern: 2_000, cycad: 3_000, bush: 3_000, palm: 4_000, conifer: 4_000,
  rock: 1_000, boulder: 2_500, pond: 8_000, nest: 6_000, meat: 5_000,
  ptero: 12_000, raptor: 15_000, stego: 25_000, trike: 30_000,
  bronto: 40_000, trex: 50_000,
};

/** Spend DNA to add a decoration to the preserve (price enforced server-side). */
export const addDecoration = mutation({
  args: { playerId: v.string(), name: v.string(), decor: v.string() },
  handler: async (ctx, args) => {
    const cost = DECOR_COSTS[args.decor];
    if (cost === undefined) throw new Error("Unknown decoration");
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    const netWorth = existing?.netWorth ?? 0;
    if (netWorth < cost) return { ok: false as const, reason: "broke" as const };

    const nextWorth = netWorth - cost;
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, netWorth: nextWorth });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId, name: args.name, netWorth: nextWorth,
        babies: 0, totalKills: 0, bestKillStreak: 0,
      });
    }
    return { ok: true as const, netWorth: nextWorth };
  },
});

/** Save the preserve layout (positions). Capped to keep documents sane. */
export const updatePreserve = mutation({
  args: {
    playerId: v.string(),
    items: v.array(v.object({ k: v.string(), x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (!existing) return { ok: false as const };
    await ctx.db.patch(existing._id, { preserve: args.items.slice(0, 120) });
    return { ok: true as const };
  },
});

/** Pick the preserve's biome/scenery (free — purely cosmetic). */
export const setScenery = mutation({
  args: { playerId: v.string(), name: v.string(), scenery: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { preserveScenery: args.scenery });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId, name: args.name, netWorth: 0,
        babies: 0, totalKills: 0, bestKillStreak: 0, preserveScenery: args.scenery,
      });
    }
    return { ok: true as const };
  },
});

/** Fetch the current player's persistent record (net worth carries over). */
export const getPlayer = query({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (!p) return null;
    const day = todayStr();
    return {
      name: p.name,
      netWorth: p.netWorth,
      babies: p.babies,
      totalKills: p.totalKills ?? 0,
      bestKillStreak: p.bestKillStreak ?? 0,
      inventory: p.inventory ?? {},
      upgrades: p.upgrades ?? {},
      preserve: p.preserve ?? [],
      preserveScenery: p.preserveScenery ?? "jungle",
      prestige: p.prestige ?? 0,
      totalBossKills: p.totalBossKills ?? 0,
      bestCombo: p.bestCombo ?? 0,
      bestTime: p.bestTime ?? 0,
      achievements: p.achievements ?? [],
      collection: p.collection ?? {},
      daily: {
        day,
        keys: todaysChallenges(day).map((c) => c.key),
        done: p.challengeDay === day ? p.challengesDone ?? [] : [],
      },
    };
  },
});
