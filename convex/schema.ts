import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    playerId: v.string(), // client-generated anonymous id
    name: v.string(),
    netWorth: v.number(),
    babies: v.number(), // total gacha rolls (eggs fertilized)
    bestKillStreak: v.number(),
    lastOutcome: v.optional(v.string()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_netWorth", ["netWorth"]),
});
