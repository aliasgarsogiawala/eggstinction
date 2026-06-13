import { outcomeByKey, fmtMoney, survivalLuck, KILL_REWARD } from "../game/outcomes";
import { challengeByKey, achievementByKey } from "../game/meta";
import { difficultyByKey } from "../game/difficulty";

export default function ResultCard({ resultKey, kills, survived, netWorth, rewards, onAgain, onHome }) {
  const o = outcomeByKey(resultKey);
  const gain = o.delta >= 0;
  const seconds = Math.round(survived || 0);
  const luckPct = Math.round(survivalLuck(kills, survived || 0) * 100);
  const killEarnings = kills * KILL_REWARD;
  const r = rewards || {};
  const hasRewards =
    (r.newChallenges?.length || 0) + (r.newAchievements?.length || 0) > 0 ||
    (r.bonusDNA || 0) > 0 ||
    (r.mult || 1) > 1 ||
    (r.difficulty && difficultyByKey(r.difficulty).rewardMul !== 1);

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

        {hasRewards && (
          <div className="result-rewards">
            {(r.mult || 1) > 1 && (
              <div className="reward-line">✨ Prestige bonus ×{r.mult.toFixed(2)} applied</div>
            )}
            {r.difficulty && difficultyByKey(r.difficulty).rewardMul !== 1 && (
              <div className="reward-line">
                {difficultyByKey(r.difficulty).emoji} {difficultyByKey(r.difficulty).name} payout
                ×{difficultyByKey(r.difficulty).rewardMul} applied
              </div>
            )}
            {r.newChallenges?.map((k) => (
              <div key={k} className="reward-line reward-good">
                🎯 Daily done: {challengeByKey(k)?.label} (+{fmtMoney(challengeByKey(k)?.reward || 0)} 🧬)
              </div>
            ))}
            {r.newAchievements?.map((k) => (
              <div key={k} className="reward-line reward-good">
                🏅 {achievementByKey(k)?.emoji} {achievementByKey(k)?.name} unlocked
                {achievementByKey(k)?.reward > 0 && ` (+${fmtMoney(achievementByKey(k).reward)} 🧬)`}
              </div>
            ))}
          </div>
        )}

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
