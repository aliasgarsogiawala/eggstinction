import { useState } from "react";
import { POWERUPS } from "../game/powerups";
import { fmtMoney } from "../game/outcomes";

export default function Marketplace({ netWorth, owned, onBuy, onClose }) {
  const ownedSet = new Set(owned);
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null); // { key, reason }

  const buy = async (p) => {
    if (busy || ownedSet.has(p.key)) return;
    setBusy(p.key);
    const res = await onBuy(p.key);
    setBusy(null);
    if (res && res.ok === false) setFlash({ key: p.key, reason: res.reason });
    else setFlash(null);
  };

  return (
    <div className="overlay">
      <div className="shop">
        <header className="shop-head">
          <h2>🛒 MARKETPLACE</h2>
          <div className={`networth ${netWorth < 0 ? "networth-broke" : ""}`}>
            💰 {fmtMoney(netWorth)}
          </div>
        </header>
        <p className="shop-sub">
          Spend your Net Worth on permanent upgrades. (Yes — it costs you
          leaderboard rank. Power has a price.)
        </p>

        <div className="shop-grid">
          {POWERUPS.map((p) => {
            const have = ownedSet.has(p.key);
            const broke = netWorth < p.cost;
            const err = flash?.key === p.key;
            return (
              <div key={p.key} className={`shop-card ${have ? "shop-owned" : ""}`}>
                <div className="shop-emoji">{p.emoji}</div>
                <div className="shop-info">
                  <h3>{p.name}</h3>
                  <p>{p.desc}</p>
                </div>
                {have ? (
                  <div className="shop-badge">OWNED ✓</div>
                ) : (
                  <button
                    className={`shop-buy ${broke ? "shop-buy-broke" : ""}`}
                    disabled={busy === p.key || broke}
                    onClick={() => buy(p)}
                  >
                    {busy === p.key
                      ? "…"
                      : err && flash.reason === "broke"
                        ? "Too broke!"
                        : fmtMoney(p.cost)}
                  </button>
                )}
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
