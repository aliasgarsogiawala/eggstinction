// Catalog of placeable props for the Prehistoric Preserve. Bought with DNA
// (Genome Value). Costs MUST mirror DECOR_COSTS in convex/leaderboard.ts.
// The actual artwork for each `key` lives in src/game/preserve.js.
export const DECOR = [
  // --- flora (cheap) ---
  { key: "fern", name: "Fern", emoji: "🪴", cost: 2_000, cat: "Flora" },
  { key: "cycad", name: "Cycad", emoji: "🌿", cost: 3_000, cat: "Flora" },
  { key: "bush", name: "Bush", emoji: "🌳", cost: 3_000, cat: "Flora" },
  { key: "palm", name: "Palm", emoji: "🌴", cost: 4_000, cat: "Flora" },
  { key: "conifer", name: "Conifer", emoji: "🌲", cost: 4_000, cat: "Flora" },
  // --- terrain ---
  { key: "rock", name: "Rock", emoji: "🪨", cost: 1_000, cat: "Terrain" },
  { key: "boulder", name: "Boulder", emoji: "🗿", cost: 2_500, cat: "Terrain" },
  { key: "pond", name: "Pond", emoji: "💧", cost: 8_000, cat: "Terrain" },
  { key: "nest", name: "Nest", emoji: "🥚", cost: 6_000, cat: "Terrain" },
  // --- dinosaurs (pricey trophies) ---
  { key: "ptero", name: "Pteranodon", emoji: "🦅", cost: 12_000, cat: "Dinos" },
  { key: "raptor", name: "Raptor", emoji: "🦎", cost: 15_000, cat: "Dinos" },
  { key: "stego", name: "Stegosaurus", emoji: "🦕", cost: 25_000, cat: "Dinos" },
  { key: "trike", name: "Triceratops", emoji: "🦕", cost: 30_000, cat: "Dinos" },
  { key: "bronto", name: "Brontosaurus", emoji: "🦕", cost: 40_000, cat: "Dinos" },
  { key: "trex", name: "Tyrannosaurus", emoji: "🦖", cost: 50_000, cat: "Dinos" },
];

export const decorByKey = (k) => DECOR.find((d) => d.key === k);
export const DECOR_CATS = ["Flora", "Terrain", "Dinos"];
