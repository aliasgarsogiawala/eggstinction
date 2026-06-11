import { useEffect, useRef, useState } from "react";
import { EggDefense } from "../game/engine";
import { POWERUPS } from "../game/powerups";

export default function GameCanvas({ onFertilized, inventory = {}, onConsume, paused = false }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [kills, setKills] = useState(0);
  const [fertilized, setFertilized] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fit = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    fit();
    window.addEventListener("resize", fit);

    const game = new EggDefense(canvas, {
      onKill: setKills,
      onFertilized: (stats) => {
        setFertilized(true);
        setTimeout(() => onFertilized(stats), 900);
      },
    });
    gameRef.current = game;
    game.start();

    return () => {
      window.removeEventListener("resize", fit);
      game.destroy();
      gameRef.current = null;
    };
  }, [onFertilized]);

  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  // Fire off a powerup: trigger the effect in the engine and spend a charge.
  const use = (key) => {
    const game = gameRef.current;
    if (!game || game.paused || game.over) return;
    if (!inventory[key]) return;
    game.activate(key);
    onConsume?.(key);
  };

  // Number keys 1–5 map to the powerup slots.
  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= POWERUPS.length) use(POWERUPS[n - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, paused]);

  return (
    <div className={`game-stage ${fertilized ? "shake-hard" : ""}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="kill-counter">🦴 {kills}</div>
      <div className="hint">hold to hurl boulders · Esc to pause</div>

      <div className="powerbar">
        {POWERUPS.map((p, i) => {
          const count = inventory[p.key] || 0;
          return (
            <button
              key={p.key}
              className={`power-btn ${count > 0 ? "" : "power-empty"}`}
              disabled={count === 0}
              onClick={() => use(p.key)}
              title={`${p.name} — ${p.desc} (key ${i + 1})`}
            >
              <span className="power-emoji">{p.emoji}</span>
              <span className="power-count">{count}</span>
              <span className="power-key">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {fertilized && <div className="fertilized-banner">HATCHING!</div>}
    </div>
  );
}
