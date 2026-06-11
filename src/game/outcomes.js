// Client-side display data. Weights/deltas mirror the server table in
// convex/leaderboard.ts — the authoritative roll happens server-side.
// When the nest is breached the egg hatches into one of these — its Genome
// Value (🧬) is added to (or torn from) your score.
export const OUTCOMES = [
  // ---- apex hatchlings (rare, huge) ----
  {
    key: "trex",
    label: "Tyrannosaurus Rex",
    emoji: "🦖",
    delta: 2_000_000,
    weight: 1,
    flavor: "The whole valley goes silent. The food chain has a new top, and it's yours.",
  },
  {
    key: "spino",
    label: "Spinosaurus",
    emoji: "🐊",
    delta: 1_000_000,
    weight: 3,
    flavor: "Bigger than the Rex — and it swims. Genuinely, cosmically unfair.",
  },
  {
    key: "quetz",
    label: "Quetzalcoatlus",
    emoji: "🦅",
    delta: 750_000,
    weight: 3,
    flavor: "Wingspan of a small plane. Owns the entire sky and pays no rent.",
  },
  {
    key: "trike",
    label: "Triceratops",
    emoji: "🦕",
    delta: 500_000,
    weight: 8,
    flavor: "Three horns, zero fear. A walking fortress that calls every Sunday.",
  },
  {
    key: "raptor",
    label: "Velociraptor",
    emoji: "🦖",
    delta: 420_000,
    weight: 5,
    flavor: "Pack hunter, problem solver, can open doors. Be very afraid (and proud).",
  },
  {
    key: "anky",
    label: "Ankylosaurus",
    emoji: "🐢",
    delta: 300_000,
    weight: 7,
    flavor: "A living tank with a club for a tail. Nothing gets through the armor.",
  },
  {
    key: "steg",
    label: "Stegosaurus",
    emoji: "🦎",
    delta: 250_000,
    weight: 5,
    flavor: "Spiked tail, walnut brain, enormous vibes. Survives purely on attitude.",
  },
  {
    key: "allo",
    label: "Allosaurus",
    emoji: "🦖",
    delta: 200_000,
    weight: 6,
    flavor: "The Jurassic mid-boss. Reliable, vicious, always gets the job done.",
  },
  // ---- the steady herd ----
  {
    key: "bary",
    label: "Baryonyx",
    emoji: "🐊",
    delta: 150_000,
    weight: 14,
    flavor: "Fishes for a living. Modest, competent, no notes. Fixed your spear once.",
  },
  {
    key: "gallim",
    label: "Gallimimus",
    emoji: "🐦",
    delta: 80_000,
    weight: 7,
    flavor: "Fast, flighty, panics in a herd. Survives mostly by sprinting away.",
  },
  {
    key: "iguanodon",
    label: "Iguanodon",
    emoji: "🦕",
    delta: 45_000,
    weight: 6,
    flavor: "Has a thumb spike and a steady temperament. The dependable everyman.",
  },
  {
    key: "parasaur",
    label: "Parasaurolophus",
    emoji: "🦕",
    delta: 30_000,
    weight: 8,
    flavor: "Honks beautifully. Mostly just wants to graze in peace and be left alone.",
  },
  {
    key: "compy",
    label: "Compsognathus",
    emoji: "🐔",
    delta: 10_000,
    weight: 16,
    flavor: "Chicken-sized, scrappy, hunts in numbers. Could be worse, honestly.",
  },
  // ---- evolutionary dead ends (negative) ----
  {
    key: "dodo",
    label: "The Dodo",
    emoji: "🦤",
    delta: -30_000,
    weight: 8,
    flavor: "A cousin from the future. Famously, catastrophically did not make it.",
  },
  {
    key: "dimetrodon",
    label: "Dimetrodon",
    emoji: "🦎",
    delta: -50_000,
    weight: 12,
    flavor: "Not even technically a dinosaur. Peaked in the Permian and never recovered.",
  },
  {
    key: "trilobite",
    label: "Trilobite",
    emoji: "🐛",
    delta: -80_000,
    weight: 7,
    flavor: "Survived 270 million years, then didn't. Tragically hard to root for.",
  },
  {
    key: "ammonite",
    label: "Ammonite",
    emoji: "🐚",
    delta: -150_000,
    weight: 5,
    flavor: "A snail with ambitions. The ambitions, regrettably, did not pan out.",
  },
  {
    key: "roach",
    label: "Just a Cockroach",
    emoji: "🪳",
    delta: -250_000,
    weight: 6,
    flavor: "Will outlive literally everything and contribute literally nothing.",
  },
  {
    key: "mosquito",
    label: "The Amber Mosquito",
    emoji: "🦟",
    delta: -400_000,
    weight: 4,
    flavor: "Trapped in tree sap for eternity. At least it'll be famous one day?",
  },
  {
    key: "rock",
    label: "A Sentient Rock",
    emoji: "🪨",
    delta: -666_000,
    weight: 2,
    flavor: "The mutation went catastrophically sideways. It is, now, just a rock.",
  },
];

export const outcomeByKey = (key) => OUTCOMES.find((o) => o.key === key);

// ---- performance-weighted rolling ----
// Surviving longer (and culling more predators) tilts the hatch toward apex
// species. A 1-second run rolls the base table; a long, high-kill run
// meaningfully boosts the legends and suppresses the dead ends.
// MUST stay in sync with convex/leaderboard.ts.
const TILT = 2.2; // how hard performance bends the odds
const MAX_POS = 2_000_000; // best outcome delta (normalizer)
const MAX_NEG = 666_000; // worst outcome |delta| (normalizer)

// DNA earned per predator destroyed (mirror convex/leaderboard.ts).
export const KILL_REWARD = 2_000;

// 0 → no edge (rolled base table), 1 → maxed out. ~60s or ~100 kills tops it.
export function survivalLuck(kills = 0, seconds = 0) {
  const timePart = Math.min(seconds / 60, 1);
  const killPart = Math.min(kills / 100, 1);
  return Math.min(0.65 * timePart + 0.35 * killPart, 1);
}

function effectiveWeights(luck) {
  return OUTCOMES.map((o) => {
    const goodness = o.delta >= 0 ? o.delta / MAX_POS : o.delta / MAX_NEG;
    return o.weight * Math.exp(TILT * luck * goodness);
  });
}

// Local fallback roll, used only when Convex isn't connected yet.
export function rollLocal(kills = 0, seconds = 0) {
  const weights = effectiveWeights(survivalLuck(kills, seconds));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < OUTCOMES.length; i++) {
    r -= weights[i];
    if (r <= 0) return OUTCOMES[i];
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

// Genome Value is a plain (sometimes negative) number — no currency symbol.
export const fmtMoney = (n) =>
  `${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-US")}`;
