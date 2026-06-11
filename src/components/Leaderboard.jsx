import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { outcomeByKey, fmtMoney } from "../game/outcomes";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ playerId, connected }) {
  const [tab, setTab] = useState("worth"); // worth | destroyer

  return (
    <aside className="leaderboard">
      <div className="lb-tabs">
        <button
          className={`lb-tab ${tab === "worth" ? "lb-tab-on" : ""}`}
          onClick={() => setTab("worth")}
        >
          🧬 Genome
        </button>
        <button
          className={`lb-tab ${tab === "destroyer" ? "lb-tab-on" : ""}`}
          onClick={() => setTab("destroyer")}
        >
          🦴 Predators
        </button>
      </div>

      {!connected ? (
        <p className="lb-empty">
          Leaderboard offline.
          <br />
          Run <code>npx convex dev</code> to go live.
        </p>
      ) : tab === "worth" ? (
        <WorthBoard playerId={playerId} />
      ) : (
        <DestroyerBoard playerId={playerId} />
      )}
    </aside>
  );
}

function WorthBoard({ playerId }) {
  const top = useQuery(api.leaderboard.topPlayers);
  return (
    <>
      <h3>🦖 APEX GENOME</h3>
      <BoardList
        rows={top}
        playerId={playerId}
        emptyLabel="No data yet."
        value={(p) => `${fmtMoney(p.netWorth)} 🧬`}
        negative={(p) => p.netWorth < 0}
      />
    </>
  );
}

function DestroyerBoard({ playerId }) {
  const top = useQuery(api.leaderboard.topDestroyers);
  return (
    <>
      <h3>🦴 PEST EXTERMINATORS</h3>
      <BoardList
        rows={top}
        playerId={playerId}
        emptyLabel="No data yet."
        value={(p) => `${p.totalKills.toLocaleString("en-US")} 🦴`}
        negative={() => false}
      />
    </>
  );
}

function BoardList({ rows, playerId, emptyLabel, value, negative }) {
  if (rows === undefined) return <p className="lb-empty">loading…</p>;
  if (rows.length === 0) return <p className="lb-empty">{emptyLabel}</p>;
  return (
    <ol className="lb-list">
      {rows.map((p, i) => (
        <li
          key={p.playerId}
          className={`lb-row ${p.playerId === playerId ? "lb-me" : ""} ${
            negative(p) ? "lb-broke" : ""
          }`}
        >
          <span className="lb-rank">{MEDALS[i] ?? `#${i + 1}`}</span>
          <span className="lb-name">
            {p.name}
            {p.lastOutcome && (
              <em className="lb-last">{outcomeByKey(p.lastOutcome)?.emoji}</em>
            )}
          </span>
          <span className="lb-worth">{value(p)}</span>
        </li>
      ))}
    </ol>
  );
}
