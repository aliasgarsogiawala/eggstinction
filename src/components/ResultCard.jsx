import { outcomeByKey, fmtMoney, survivalLuck } from "../game/outcomes";

export default function ResultCard({ resultKey, kills, survived, netWorth, onAgain, onHome }) {
  const o = outcomeByKey(resultKey);
  const gain = o.delta >= 0;
  const seconds = Math.round(survived || 0);
  const luckPct = Math.round(survivalLuck(kills, survived || 0) * 100);

  return (
    <div className="overlay">
      <div className={`result-card ${gain ? "card-gain" : "card-loss"}`}>
        <div className="result-emoji">{o.emoji}</div>
        <h2 className="result-title">{o.label}</h2>
        <p className="result-flavor">{o.flavor}</p>
        <div className={`result-delta ${gain ? "delta-gain" : "delta-loss"}`}>
          {gain ? "+" : ""}{fmtMoney(o.delta)}
        </div>
        <div className="result-stats">
          <span>💥 {kills} swimmers stopped</span>
          <span>⏱ {seconds}s survived</span>
          <span>💰 Net Worth: {fmtMoney(netWorth)}</span>
        </div>
        <p className="result-luck">
          🍀 Survival luck boost: <strong>{luckPct}%</strong>
          {luckPct < 100 && " — last longer for better odds"}
        </p>
        <button className="btn-big" onClick={onAgain}>
          DEFEND THE NEXT EGG 🥚
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
