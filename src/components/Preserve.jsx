import { useEffect, useRef, useState } from "react";
import { PreserveScene } from "../game/preserve";
import { DECOR, DECOR_CATS, decorByKey } from "../game/decor";
import { fmtMoney } from "../game/outcomes";
import { sound } from "../game/sound";

// The Prehistoric Preserve — a cozy diorama you decorate with the DNA you earn
// defending the nest. Pick a prop, click to place, drag to move, Delete to remove.
export default function Preserve({ netWorth, items, onAdd, onSave, onClose }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const initialItems = useRef(items || []);
  const dnaRef = useRef(netWorth);
  const [dna, setDna] = useState(netWorth);
  const [placing, setPlacing] = useState(null);
  const [hasSel, setHasSel] = useState(false);

  useEffect(() => {
    const scene = new PreserveScene(canvasRef.current, {
      items: initialItems.current,
      onPlace: (key) => {
        const cost = decorByKey(key)?.cost ?? 0;
        if (dnaRef.current < cost) {
          sound.play("ui");
          return false;
        }
        dnaRef.current -= cost;
        setDna(dnaRef.current);
        onAdd?.(key);
        sound.play("power");
        return true;
      },
      onChange: (its) => onSave?.(its.map((i) => ({ k: i.k, x: i.x, y: i.y }))),
      onSelect: (h) => setHasSel(h),
    });
    sceneRef.current = scene;
    scene.start();
    return () => scene.destroy();
    // Mount once — the scene owns its own item list from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (key) => {
    const next = placing === key ? null : key;
    setPlacing(next);
    sceneRef.current?.setPlacing(next);
    sound.play("ui");
  };

  const del = () => {
    sceneRef.current?.deleteSelected();
    setHasSel(false);
    sound.play("ui");
  };

  return (
    <div className="preserve">
      <canvas ref={canvasRef} className="preserve-canvas" />

      <div className="preserve-top">
        <h2 className="preserve-title">🏞️ YOUR PRESERVE</h2>
        <div className={`networth ${dna < 0 ? "networth-broke" : ""}`}>🧬 {fmtMoney(dna)}</div>
        <div className="preserve-actions">
          <button className="btn-ghost" disabled={!hasSel} onClick={del}>
            🗑 Delete
          </button>
          <button className="btn-shop" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>

      <div className="palette">
        {DECOR_CATS.map((cat) => (
          <div key={cat} className="pal-group">
            <span className="pal-cat">{cat}</span>
            {DECOR.filter((d) => d.cat === cat).map((d) => {
              const broke = dna < d.cost;
              return (
                <button
                  key={d.key}
                  className={`pal-item ${placing === d.key ? "pal-on" : ""} ${broke ? "pal-broke" : ""}`}
                  onClick={() => pick(d.key)}
                  title={`${d.name} — ${fmtMoney(d.cost)} DNA`}
                >
                  <span className="pal-emoji">{d.emoji}</span>
                  <span className="pal-cost">{Math.round(d.cost / 1000)}k</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="preserve-hint">
        {placing
          ? "Click to place · pick again to cancel"
          : hasSel
            ? "Drag to move · Delete to remove"
            : "Pick a prop below, then click the ground to place it"}
      </div>
    </div>
  );
}
