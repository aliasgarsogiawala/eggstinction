import { outcomeByKey, fmtMoney, survivalLuck, KILL_REWARD } from "../game/outcomes";

export default function ResultCard({ resultKey, kills, survived, netWorth, onAgain, onHome }) {
  const o = outcomeByKey(resultKey);
  const gain = o.delta >= 0;
  const seconds = Math.round(survived || 0);
  const luckPct = Math.round(survivalLuck(kills, survived || 0) * 100);
  const killEarnings = kills * KILL_REWARD;

  return (
    <div className="overlay">
      <div className={`result-card ${gain ? "card-gain" : "card-loss"}`}>
        <div className="result-emoji">{o.emoji}</div>
        <h2 className="result-title">{o.label}</h2>
        <p className="result-flavor">{o.flavor}</p>
        <div className={`result-delta ${gain ? "delta-gain" : "delta-loss"}`}>
          {gain ? "+" : ""}{fmtMoney(o.delta)} 🧬
        </div>
        <div className="result-stats">
          <span>🦴 {kills} predators culled</span>
          <span>⏱ {seconds}s survived</span>
          <span className="earn">🧬 +{fmtMoney(killEarnings)} DNA from prey</span>
          <span>🧬 Genome: {fmtMoney(netWorth)}</span>
        </div>
        <p className="result-luck">
          🥚 Hatch luck boost: <strong>{luckPct}%</strong>
          {luckPct < 100 && " — survive longer for better odds"}
        </p>
        <button className="btn-big" onClick={onAgain}>
          GUARD THE NEXT NEST 🥚
        </button>
        {onHome && (
          <button className="btn-ghost" onClick={onHome}>
            🏠 HOME
          </button>
        )}
      </div>
    </div>
  );
}
