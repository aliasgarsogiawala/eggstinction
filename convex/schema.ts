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
    // Stackable consumable powerup charges, keyed by powerup → count.
    inventory: v.optional(v.record(v.string(), v.number())),
    // Permanent meta-progression upgrade levels, keyed by upgrade → level.
    upgrades: v.optional(v.record(v.string(), v.number())),
    // The player's Prehistoric Preserve — placed decorations (normalised coords).
    preserve: v.optional(
      v.array(v.object({ k: v.string(), x: v.number(), y: v.number() }))
    ),
    powerups: v.optional(v.array(v.string())), // legacy field (pre-inventory docs)
    lastOutcome: v.optional(v.string()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_netWorth", ["netWorth"])
    .index("by_totalKills", ["totalKills"]),
});
