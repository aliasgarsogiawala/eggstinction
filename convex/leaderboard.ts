import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side outcome table. The roll happens HERE, not on the client,
 * so players can't forge a $500k Doctor. The client only animates the
 * result the server returns.
 */
const OUTCOMES = [
  { key: "doctor", label: "The Doctor", weight: 10, delta: 500_000 },
  { key: "engineer", label: "The Engineer", weight: 20, delta: 150_000 },
  { key: "average", label: "The Average Joe", weight: 40, delta: 10_000 },
  { key: "failure", label: "The Failure", weight: 20, delta: -50_000 },
  { key: "footballer", label: "The Failed Footballer", weight: 10, delta: -250_000 },
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
        totalKills: existing.totalKills + args.killStreak,
        bestKillStreak: Math.max(existing.bestKillStreak, args.killStreak),
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
      totalKills: p.totalKills,
      bestKillStreak: p.bestKillStreak,
      lastOutcome: p.lastOutcome,
    }));
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
      totalKills: p.totalKills,
      bestKillStreak: p.bestKillStreak,
    };
  },
});
