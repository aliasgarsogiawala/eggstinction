import { useEffect, useRef, useState } from "react";
import { EggDefense } from "../game/engine";

export default function GameCanvas({ onFertilized, powerups = [], paused = false }) {
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
      powerups,
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
    // Engine is created once per mount; powerups are read at start. Live
    // toggles (e.g. buying mid-pause) are synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFertilized]);

  // Keep the running engine in sync with pause + purchased powerups.
  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.powerups = new Set(powerups);
  }, [powerups]);

  return (
    <div className={`game-stage ${fertilized ? "shake-hard" : ""}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="kill-counter">💥 {kills}</div>
      <div className="hint">hold to shoot — protect the egg! · Esc to pause</div>
      {fertilized && <div className="fertilized-banner">FERTILIZED!</div>}
    </div>
  );
}
