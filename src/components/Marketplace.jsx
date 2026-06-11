import { useState } from "react";
import { POWERUPS } from "../game/powerups";
import { fmtMoney } from "../game/outcomes";

export default function Marketplace({ netWorth, inventory = {}, onBuy, onClose }) {
  const [busy, setBusy] = useState(null);

  const buy = async (p) => {
    if (busy || netWorth < p.cost) return;
    setBusy(p.key);
    await onBuy(p.key);
    setBusy(null);
  };

  return (
    <div className="overlay">
      <div className="shop">
        <header className="shop-head">
          <h2>🦴 BONE MARKET</h2>
          <div className={`networth ${netWorth < 0 ? "networth-broke" : ""}`}>
            🧬 {fmtMoney(netWorth)}
          </div>
        </header>
        <p className="shop-sub">
          Spend DNA on consumable charges, then unleash them mid-run with the
          buttons (or number keys 1–5). Buy as many as you can afford — each is
          spent on use.
        </p>

        <div className="shop-grid">
          {POWERUPS.map((p) => {
            const count = inventory[p.key] || 0;
            const broke = netWorth < p.cost;
            return (
              <div key={p.key} className="shop-card">
                <div className="shop-emoji">{p.emoji}</div>
                <div className="shop-info">
                  <h3>
                    {p.name}
                    {count > 0 && <span className="shop-have"> ×{count}</span>}
                  </h3>
                  <p>{p.desc}</p>
                </div>
                <button
                  className={`shop-buy ${broke ? "shop-buy-broke" : ""}`}
                  disabled={busy === p.key || broke}
                  onClick={() => buy(p)}
                >
                  {busy === p.key ? "…" : broke ? "Too broke" : fmtMoney(p.cost)}
                </button>
              </div>
            );
          })}
        </div>

        <button className="btn-big shop-close" onClick={onClose}>
          BACK
        </button>
      </div>
    </div>
  );
}
