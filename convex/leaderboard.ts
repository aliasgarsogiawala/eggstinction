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

/** Roll the gacha and apply the result to the player's persistent Net Worth. */
export const rollGacha = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    killStreak: v.number(),
    survivedSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const outcome = rollOutcome(args.killStreak, args.survivedSeconds ?? 0);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    // The DNA Splicer upgrade boosts DNA earned per kill.
    const greed = existing?.upgrades?.greed ?? 0;
    const killEarnings = Math.round(
      args.killStreak * KILL_REWARD * (1 + 0.25 * greed)
    );
    const totalDelta = outcome.delta + killEarnings;

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        netWorth: existing.netWorth + totalDelta,
        babies: existing.babies + 1,
        totalKills: (existing.totalKills ?? 0) + args.killStreak,
        bestKillStreak: Math.max(existing.bestKillStreak ?? 0, args.killStreak),
        lastOutcome: outcome.key,
      });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.name,
        netWorth: totalDelta,
        babies: 1,
        totalKills: args.killStreak,
        bestKillStreak: args.killStreak,
        inventory: {},
        lastOutcome: outcome.key,
      });
    }
    return { outcomeKey: outcome.key, delta: outcome.delta, killEarnings };
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
    };
  },
});
