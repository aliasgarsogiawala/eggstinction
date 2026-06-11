import { useEffect, useRef, useState } from "react";
import { EggDefense } from "../game/engine";

export default function GameCanvas({ onFertilized }) {
  const canvasRef = useRef(null);
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
    game.start();

    return () => {
      window.removeEventListener("resize", fit);
      game.destroy();
    };
  }, [onFertilized]);

  return (
    <div className={`game-stage ${fertilized ? "shake-hard" : ""}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="kill-counter">💥 {kills}</div>
      <div className="hint">hold to shoot — protect the egg!</div>
      {fertilized && <div className="fertilized-banner">FERTILIZED!</div>}
    </div>
  );
}
