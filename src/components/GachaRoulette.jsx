import { useEffect, useRef, useState } from "react";
import { OUTCOMES } from "../game/outcomes";

// Slot-machine reel. The result is already decided (server-side roll) —
// this just spins the reel and dramatically lands on it.
export default function GachaRoulette({ resultKey, onDone }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const target = Math.max(0, OUTCOMES.findIndex((o) => o.key === resultKey));
    let i = 0;
    let delay = 60;
    // Spin at least ~24 ticks, then land exactly on the target outcome.
    let remaining = 24;
    while (remaining % OUTCOMES.length !== target) remaining++;

    const tick = () => {
      i++;
      setIndex(i % OUTCOMES.length);
      if (i >= remaining) {
        setDone(true);
        setTimeout(() => onDone(), 700);
        return;
      }
      // Decelerate near the end for suspense.
      const left = remaining - i;
      delay = left < 6 ? delay * 1.45 : 60;
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
    return () => clearTimeout(timer.current);
  }, [resultKey, onDone]);

  const o = OUTCOMES[index];

  return (
    <div className="overlay">
      <div className={`slot-machine ${done ? "slot-locked" : ""}`}>
        <h2 className="slot-title">🎰 WHAT WILL THE BABY BECOME? 🎰</h2>
        <div className="slot-window">
          <div className="slot-cell" key={index}>
            <span className="slot-emoji">{o.emoji}</span>
            <span className="slot-label">{o.label}</span>
          </div>
        </div>
        <div className="slot-lights">
          {OUTCOMES.map((x, j) => (
            <span key={x.key} className={j === index ? "light on" : "light"} />
          ))}
        </div>
      </div>
    </div>
  );
}
