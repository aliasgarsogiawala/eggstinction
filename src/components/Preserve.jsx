import { useEffect, useRef, useState } from "react";
import { PreserveScene } from "../game/preserve";
import { DECOR, DECOR_CATS, decorByKey } from "../game/decor";
import { achievementByKey } from "../game/meta";
import { fmtMoney } from "../game/outcomes";
import { sound } from "../game/sound";

const SCENERY_OPTS = [
  { key: "jungle", emoji: "🌴", name: "Jungle" },
  { key: "volcanic", emoji: "🌋", name: "Volcanic" },
  { key: "swamp", emoji: "🐊", name: "Swamp" },
  { key: "desert", emoji: "🏜️", name: "Desert" },
  { key: "tundra", emoji: "❄️", name: "Tundra" },
];

// The Prehistoric Preserve — a cozy diorama you decorate with the DNA you earn
// defending the nest. Pick a prop, click to place, drag to move, Delete to remove.
export default function Preserve({ netWorth, items, scenery = "jungle", achievements = [], onAdd, onSave, onSetScenery, onClose }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const initialItems = useRef(items || []);
  const dnaRef = useRef(netWorth);
  const [dna, setDna] = useState(netWorth);
  const [placing, setPlacing] = useState(null);
  const [hasSel, setHasSel] = useState(false);
  const [sceneryKey, setSceneryKey] = useState(scenery);

  const unlocked = new Set(achievements);
  const canPlace = (d) => (d.unlock ? unlocked.has(d.unlock) : true);

  useEffect(() => {
    const sc = new PreserveScene(canvasRef.current, {
      items: initialItems.current,
      scenery,
      onPlace: (key) => {
        const cost = decorByKey(key)?.cost ?? 0;
        // Trophies are free (cost 0) once unlocked — never blocked on funds.
        if (cost > 0 && dnaRef.current < cost) {
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
    sceneRef.current = sc;
    sc.start();
    return () => sc.destroy();
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

  const chooseScenery = (key) => {
    setSceneryKey(key);
    sceneRef.current?.setScenery(key);
    onSetScenery?.(key);
    sound.play("ui");
  };

  return (
    <div className="preserve">
      <canvas ref={canvasRef} className="preserve-canvas" />

      <div className="preserve-top">
        <h2 className="preserve-title">🏞️ YOUR PRESERVE</h2>
        <div className="scenery-picker">
          {SCENERY_OPTS.map((s) => (
            <button
              key={s.key}
              className={`scenery-btn ${sceneryKey === s.key ? "scenery-on" : ""}`}
              onClick={() => chooseScenery(s.key)}
              title={s.name}
            >
              {s.emoji}
            </button>
          ))}
        </div>
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
              if (d.unlock) {
                const open = unlocked.has(d.unlock);
                const ach = achievementByKey(d.unlock);
                return (
                  <button
                    key={d.key}
                    className={`pal-item pal-trophy ${placing === d.key ? "pal-on" : ""} ${open ? "" : "pal-locked"}`}
                    disabled={!open}
                    onClick={() => open && pick(d.key)}
                    title={
                      open
                        ? `${d.name} — free to place (earned)`
                        : `${d.name} — locked. Unlock “${ach?.name}”: ${ach?.desc}`
                    }
                  >
                    <span className="pal-emoji">{open ? d.emoji : "🔒"}</span>
                    <span className="pal-cost">{open ? "🏆" : ach?.emoji}</span>
                  </button>
                );
              }
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
            : "Dinos are alive — keep 💧 water + food (🌿 plants / 🍖 meat) nearby or they'll go hungry"}
      </div>
    </div>
  );
}
