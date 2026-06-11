import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side outcome table. The roll happens HERE, not on the client,
 * so players can't forge a $500k Doctor. The client only animates the
 * result the server returns.
 */
const OUTCOMES = [
  // jackpots
  { key: "moviestar", label: "The Movie Star", weight: 1, delta: 2_000_000 },
  { key: "ceo", label: "The Tech CEO", weight: 3, delta: 1_000_000 },
  { key: "astronaut", label: "The Astronaut", weight: 3, delta: 750_000 },
  { key: "doctor", label: "The Doctor", weight: 8, delta: 500_000 },
  { key: "cryptobro", label: "The Crypto Bro", weight: 5, delta: 420_000 },
  { key: "lawyer", label: "The Lawyer", weight: 7, delta: 300_000 },
  { key: "progamer", label: "The Pro Gamer", weight: 5, delta: 250_000 },
  { key: "influencer", label: "The Influencer", weight: 6, delta: 200_000 },
  // middle
  { key: "engineer", label: "The Engineer", weight: 14, delta: 150_000 },
  { key: "chef", label: "The Chef", weight: 7, delta: 80_000 },
  { key: "cop", label: "The Cop", weight: 6, delta: 45_000 },
  { key: "teacher", label: "The Teacher", weight: 8, delta: 30_000 },
  { key: "average", label: "The Average Joe", weight: 16, delta: 10_000 },
  // disappointments
  { key: "couch", label: "The Couch Streamer", weight: 8, delta: -30_000 },
  { key: "failure", label: "The Failure", weight: 12, delta: -50_000 },
  { key: "musician", label: "The Struggling Musician", weight: 7, delta: -80_000 },
  { key: "scammer", label: "The MLM 'Boss Babe'", weight: 5, delta: -150_000 },
  { key: "footballer", label: "The Failed Footballer", weight: 6, delta: -250_000 },
  { key: "gambler", label: "The Gambling Addict", weight: 4, delta: -400_000 },
  { key: "rugpull", label: "The One Who Bought The Top", weight: 2, delta: -666_000 },
] as const;

function rollOutcome() {
  const total = OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of OUTCOMES) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

/** Roll the gacha and apply the result to the player's persistent Net Worth. */
export const rollGacha = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    killStreak: v.number(),
  },
  handler: async (ctx, args) => {
    const outcome = rollOutcome();
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        netWorth: existing.netWorth + outcome.delta,
        babies: existing.babies + 1,
        totalKills: (existing.totalKills ?? 0) + args.killStreak,
        bestKillStreak: Math.max(existing.bestKillStreak ?? 0, args.killStreak),
        lastOutcome: outcome.key,
      });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.name,
        netWorth: outcome.delta,
        babies: 1,
        totalKills: args.killStreak,
        bestKillStreak: args.killStreak,
        powerups: [],
        lastOutcome: outcome.key,
      });
    }
    return { outcomeKey: outcome.key, delta: outcome.delta };
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
  rapidfire: 80_000,
  tripleshot: 200_000,
  slowfield: 150_000,
  pierce: 175_000,
  shield: 300_000,
};

/** Spend Net Worth to unlock a powerup. Price + ownership enforced server-side. */
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

    const owned = existing?.powerups ?? [];
    if (owned.includes(args.powerup)) {
      return { ok: false, reason: "owned" as const };
    }
    const netWorth = existing?.netWorth ?? 0;
    if (netWorth < cost) {
      return { ok: false, reason: "broke" as const };
    }

    const nextWorth = netWorth - cost;
    const nextPowerups = [...owned, args.powerup];

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        netWorth: nextWorth,
        powerups: nextPowerups,
      });
    } else {
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.name,
        netWorth: nextWorth,
        babies: 0,
        totalKills: 0,
        bestKillStreak: 0,
        powerups: nextPowerups,
      });
    }
    return { ok: true as const, netWorth: nextWorth, powerups: nextPowerups };
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
      powerups: p.powerups ?? [],
    };
  },
});
