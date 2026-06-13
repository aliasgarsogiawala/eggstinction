import { useEffect, useRef, useState } from "react";
import { EggDefense } from "../game/engine";
import { difficultyByKey } from "../game/difficulty";
import { fmtMoney, KILL_REWARD } from "../game/outcomes";

const SPEEDS = [1, 2, 4];
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Plays back a recorded run by re-simulating it in the deterministic engine.
export default function ReplayPlayer({ replay, summary, onExit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const diff = difficultyByKey(summary?.difficulty);

  useEffect(() => {
    const canvas = canvasRef.current;
    // The sim is resolution-dependent — match the recording's canvas exactly,
    // then let CSS scale the (fixed-resolution) canvas to fit the stage.
    canvas.width = replay.w;
    canvas.height = replay.h;

    const game = new EggDefense(canvas, {
      replay,
      difficulty: summary?.difficulty,
      onReplayEnd: () => setEnded(true),
    });
    gameRef.current = game;
    game.start();

    const poll = setInterval(() => {
      if (gameRef.current) setProgress(gameRef.current.replayProgress);
    }, 80);

    return () => {
      clearInterval(poll);
      game.destroy();
      gameRef.current = null;
    };
    // Mount once per replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    const g = gameRef.current;
    if (!g || ended) return;
    const p = !paused;
    setPaused(p);
    g.setPaused(p);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (gameRef.current) gameRef.current.replaySpeed = SPEEDS[next];
  };

  const restart = () => {
    const g = gameRef.current;
    if (!g) return;
    g.stop();
    g.replaySpeed = SPEEDS[speedIdx];
    g.start();
    g.setPaused(false);
    setPaused(false);
    setEnded(false);
    setProgress(0);
  };

  return (
    <div className="overlay">
      <div className="replay-modal">
        <header className="shop-head">
          <h2>📽️ REPLAY · {diff.emoji} {diff.name}</h2>
          <div className="replay-summary">
            🦴 {summary.kills} · 💥 {summary.maxCombo} · 🌊 wave {summary.wave} · ⏱ {fmtTime(summary.time)}
          </div>
        </header>

        <div className="replay-stage" style={{ aspectRatio: `${replay.w} / ${replay.h}` }}>
          <canvas ref={canvasRef} className="replay-canvas" />
          {ended && <div className="replay-ended">HATCHED — replay complete</div>}
        </div>

        <div className="replay-bar">
          <div className="replay-progress">
            <div className="replay-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <div className="replay-controls">
          <button className="btn-ghost" onClick={ended ? restart : togglePause}>
            {ended ? "↻ Replay again" : paused ? "▶ Play" : "⏸ Pause"}
          </button>
          <button className="btn-ghost" onClick={cycleSpeed} disabled={ended}>
            ⏩ {SPEEDS[speedIdx]}×
          </button>
          <button className="btn-ghost" onClick={restart}>
            ⟲ Restart
          </button>
          <button className="btn-shop" onClick={onExit}>
            ← Back
          </button>
        </div>
        <p className="replay-note">
          Best {diff.name} run · earned 🧬 {fmtMoney(Math.round(summary.kills * KILL_REWARD * diff.rewardMul))}+ from prey
        </p>
      </div>
    </div>
  );
}
