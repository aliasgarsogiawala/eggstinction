import { useState } from "react";
import { listReplays, deleteReplay } from "../game/replays";
import { difficultyByKey } from "../game/difficulty";
import ReplayPlayer from "./ReplayPlayer";
import { sound } from "../game/sound";

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : "");

// Lists your saved best runs (one per difficulty) and plays them back.
export default function Replays({ onClose }) {
  const [rows, setRows] = useState(() => listReplays());
  const [watching, setWatching] = useState(null);

  const watch = (row) => {
    sound.play("ui");
    setWatching(row);
  };

  const remove = (difficulty) => {
    deleteReplay(difficulty);
    setRows(listReplays());
    sound.play("ui");
  };

  if (watching) {
    return (
      <ReplayPlayer
        replay={watching.replay}
        summary={watching.summary}
        onExit={() => setWatching(null)}
      />
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="trophies" onClick={(e) => e.stopPropagation()}>
        <header className="shop-head">
          <h2>📽️ REPLAYS</h2>
        </header>
        <p className="shop-sub">
          Your best run in each mode is recorded automatically. Watch it back, frame for frame.
        </p>

        {rows.length === 0 ? (
          <div className="replay-empty">
            <div className="replay-empty-emoji">🎬</div>
            <p>No runs recorded yet. Defend a nest and your best run will appear here.</p>
          </div>
        ) : (
          <div className="troph-list">
            {rows.map((row) => {
              const s = row.summary;
              const d = difficultyByKey(s.difficulty);
              return (
                <div key={s.difficulty} className="replay-row">
                  <span className="troph-emoji">{d.emoji}</span>
                  <span className="troph-info">
                    <strong>{d.name} — best run</strong>
                    <span className="replay-row-stats">
                      🦴 {s.kills} · 💥 {s.maxCombo} · 🌊 {s.wave} · ⏱ {fmtTime(s.time)}
                      {s.date ? ` · ${fmtDate(s.date)}` : ""}
                    </span>
                  </span>
                  <button className="btn-shop replay-watch" onClick={() => watch(row)}>
                    ▶ Watch
                  </button>
                  <button
                    className="btn-ghost replay-del"
                    title="Delete this replay"
                    onClick={() => remove(s.difficulty)}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button className="btn-big shop-close" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
