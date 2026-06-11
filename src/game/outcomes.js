// Client-side display data. Weights/deltas mirror the server table in
// convex/leaderboard.ts — the authoritative roll happens server-side.
export const OUTCOMES = [
  {
    key: "doctor",
    label: "The Doctor",
    emoji: "🧑‍⚕️",
    delta: 500_000,
    weight: 10,
    flavor: "Graduated top of their class. Calls every Sunday. Bought you a boat.",
  },
  {
    key: "engineer",
    label: "The Engineer",
    emoji: "🧑‍💻",
    delta: 150_000,
    weight: 20,
    flavor: "Works at a tech company you've never heard of. Fixed your printer once.",
  },
  {
    key: "average",
    label: "The Average Joe",
    emoji: "🧍",
    delta: 10_000,
    weight: 40,
    flavor: "Has a job, a sedan, and opinions about grilling. Could be worse.",
  },
  {
    key: "failure",
    label: "The Failure",
    emoji: "🛋️",
    delta: -50_000,
    weight: 20,
    flavor: "34 years old. Lives in your basement. 'The streaming career is about to pop off.'",
  },
  {
    key: "footballer",
    label: "The Failed Footballer",
    emoji: "⚽",
    delta: -250_000,
    weight: 10,
    flavor: "12 years of elite training camps. Benched in the Sunday league. Knee's gone too.",
  },
];

export const outcomeByKey = (key) => OUTCOMES.find((o) => o.key === key);

// Local fallback roll, used only when Convex isn't connected yet.
export function rollLocal() {
  const total = OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of OUTCOMES) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

export const fmtMoney = (n) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
