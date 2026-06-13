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
    preserveScenery: v.optional(v.string()), // chosen biome for the preserve
    // --- meta progression ---
    totalBossKills: v.optional(v.number()),
    bestCombo: v.optional(v.number()),
    bestTime: v.optional(v.number()), // best survival seconds in a single run
    prestige: v.optional(v.number()), // number of times cashed out
    achievements: v.optional(v.array(v.string())), // unlocked achievement keys
    challengeDay: v.optional(v.string()), // YYYY-M-D of the current daily set
    challengesDone: v.optional(v.array(v.string())), // challenge keys done today
    // --- daily login streak ---
    loginStreak: v.optional(v.number()), // consecutive days a daily bonus was claimed
    lastClaimDay: v.optional(v.string()), // YYYY-M-D the daily bonus was last claimed
    // Hatchling dex: species key → { count, bestTime }.
    collection: v.optional(
      v.record(v.string(), v.object({ count: v.number(), bestTime: v.number() }))
    ),
    powerups: v.optional(v.array(v.string())), // legacy field (pre-inventory docs)
    lastOutcome: v.optional(v.string()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_netWorth", ["netWorth"])
    .index("by_totalKills", ["totalKills"]),
});
