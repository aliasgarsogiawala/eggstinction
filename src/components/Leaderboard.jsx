import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { outcomeByKey, fmtMoney } from "../game/outcomes";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ playerId, connected }) {
  if (!connected) {
    return (
      <aside className="leaderboard">
        <h3>🌍 GLOBAL RICH LIST</h3>
        <p className="lb-empty">
          Leaderboard offline.<br />
          Run <code>npx convex dev</code> to go live.
        </p>
      </aside>
    );
  }
  return <LiveBoard playerId={playerId} />;
}

function LiveBoard({ playerId }) {
  const top = useQuery(api.leaderboard.topPlayers);

  return (
    <aside className="leaderboard">
      <h3>🌍 GLOBAL RICH LIST</h3>
      {top === undefined && <p className="lb-empty">loading…</p>}
      {top && top.length === 0 && (
        <p className="lb-empty">No parents yet. Be the first!</p>
      )}
      {top && (
        <ol className="lb-list">
          {top.map((p, i) => (
            <li
              key={p.playerId}
              className={`lb-row ${p.playerId === playerId ? "lb-me" : ""} ${
                p.netWorth < 0 ? "lb-broke" : ""
              }`}
            >
              <span className="lb-rank">{MEDALS[i] ?? `#${i + 1}`}</span>
              <span className="lb-name">
                {p.name}
                {p.lastOutcome && (
                  <em className="lb-last">{outcomeByKey(p.lastOutcome)?.emoji}</em>
                )}
              </span>
              <span className="lb-worth">{fmtMoney(p.netWorth)}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
