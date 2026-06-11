// Client-side display data. Weights/deltas mirror the server table in
// convex/leaderboard.ts — the authoritative roll happens server-side.
export const OUTCOMES = [
  // ---- jackpots (rare, huge) ----
  {
    key: "moviestar",
    label: "The Movie Star",
    emoji: "🎬",
    delta: 2_000_000,
    weight: 1,
    flavor: "A-list. You walk red carpets now. Paparazzi photograph YOU by accident.",
  },
  {
    key: "ceo",
    label: "The Tech CEO",
    emoji: "💼",
    delta: 1_000_000,
    weight: 3,
    flavor: "Founder, hustler, LinkedIn legend. Owns three cars and all your respect.",
  },
  {
    key: "astronaut",
    label: "The Astronaut",
    emoji: "🚀",
    delta: 750_000,
    weight: 3,
    flavor: "Went to space. Won't stop mentioning the overview effect. Honestly, fair.",
  },
  {
    key: "doctor",
    label: "The Doctor",
    emoji: "🧑‍⚕️",
    delta: 500_000,
    weight: 8,
    flavor: "Graduated top of their class. Calls every Sunday. Bought you a boat.",
  },
  {
    key: "cryptobro",
    label: "The Crypto Bro",
    emoji: "🪙",
    delta: 420_000,
    weight: 5,
    flavor: "Bought low, sold high… this time. Will not shut up about 'fundamentals.'",
  },
  {
    key: "lawyer",
    label: "The Lawyer",
    emoji: "⚖️",
    delta: 300_000,
    weight: 7,
    flavor: "Bills $900/hour to argue. Wins every family debate by default now.",
  },
  {
    key: "progamer",
    label: "The Pro Gamer",
    emoji: "🎮",
    delta: 250_000,
    weight: 5,
    flavor: "Turned the basement habit into a six-figure salary. You were wrong. You admit it.",
  },
  {
    key: "influencer",
    label: "The Influencer",
    emoji: "🤳",
    delta: 200_000,
    weight: 6,
    flavor: "12 million followers ask what's in their bag daily. It's sponsored gum.",
  },
  // ---- the comfortable middle ----
  {
    key: "engineer",
    label: "The Engineer",
    emoji: "🧑‍💻",
    delta: 150_000,
    weight: 14,
    flavor: "Works at a tech company you've never heard of. Fixed your printer once.",
  },
  {
    key: "chef",
    label: "The Chef",
    emoji: "👨‍🍳",
    delta: 80_000,
    weight: 7,
    flavor: "Owns a bistro with a three-week waitlist. Family dinners are elite now.",
  },
  {
    key: "cop",
    label: "The Cop",
    emoji: "👮",
    delta: 45_000,
    weight: 6,
    flavor: "Steady pension, stern eyebrows. Gets you out of every parking ticket.",
  },
  {
    key: "teacher",
    label: "The Teacher",
    emoji: "🧑‍🏫",
    delta: 30_000,
    weight: 8,
    flavor: "Shapes young minds for a salary that does not reflect that. A hero, broke.",
  },
  {
    key: "average",
    label: "The Average Joe",
    emoji: "🧍",
    delta: 10_000,
    weight: 16,
    flavor: "Has a job, a sedan, and strong opinions about grilling. Could be worse.",
  },
  // ---- the disappointments (negative) ----
  {
    key: "couch",
    label: "The Couch Streamer",
    emoji: "🧟",
    delta: -30_000,
    weight: 8,
    flavor: "Live 9 hours a day to a loyal audience of four. One of them is you.",
  },
  {
    key: "failure",
    label: "The Failure",
    emoji: "🛋️",
    delta: -50_000,
    weight: 12,
    flavor: "34 years old. Lives in your basement. 'The streaming career is about to pop off.'",
  },
  {
    key: "musician",
    label: "The Struggling Musician",
    emoji: "🎸",
    delta: -80_000,
    weight: 7,
    flavor: "'The album drops next month.' It has dropped next month for nine years.",
  },
  {
    key: "scammer",
    label: "The MLM 'Boss Babe'",
    emoji: "🧙",
    delta: -150_000,
    weight: 5,
    flavor: "Slid into your DMs about an 'opportunity.' We do not bring it up at Thanksgiving.",
  },
  {
    key: "footballer",
    label: "The Failed Footballer",
    emoji: "⚽",
    delta: -250_000,
    weight: 6,
    flavor: "12 years of elite camps. Benched in the Sunday league. The knee's gone too.",
  },
  {
    key: "gambler",
    label: "The Gambling Addict",
    emoji: "🃏",
    delta: -400_000,
    weight: 4,
    flavor: "Had a system. The system had a flaw. The flaw was the entire system.",
  },
  {
    key: "rugpull",
    label: "The One Who Bought The Top",
    emoji: "💀",
    delta: -666_000,
    weight: 2,
    flavor: "Put the inheritance into $MOONCOIN at the literal peak. It is zero now.",
  },
];

export const outcomeByKey = (key) => OUTCOMES.find((o) => o.key === key);

// ---- performance-weighted rolling ----
// Surviving longer (and racking up kills) tilts the gacha toward better
// careers. A 1-second run rolls the base table; a long, high-kill run
// meaningfully boosts the jackpots and suppresses the catastrophes.
// MUST stay in sync with convex/leaderboard.ts.
const TILT = 2.2; // how hard performance bends the odds
const MAX_POS = 2_000_000; // best outcome delta (normalizer)
const MAX_NEG = 666_000; // worst outcome |delta| (normalizer)

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

export const fmtMoney = (n) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
