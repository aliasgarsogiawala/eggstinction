import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    playerId: v.string(), // client-generated anonymous id
    name: v.string(),
    netWorth: v.number(),
    babies: v.number(), // total gacha rolls (eggs fertilized)
    // Optional so older player docs (created before these fields) keep validating.
    totalKills: v.optional(v.number()), // lifetime swimmers destroyed — Destroyer score
    bestKillStreak: v.optional(v.number()), // most kills in a single run
    powerups: v.optional(v.array(v.string())), // owned marketplace upgrades
    lastOutcome: v.optional(v.string()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_netWorth", ["netWorth"])
    .index("by_totalKills", ["totalKills"]),
});
