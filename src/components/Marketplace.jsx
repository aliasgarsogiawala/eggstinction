import { useState } from "react";
import { POWERUPS } from "../game/powerups";
import { UPGRADES, upgradeCost } from "../game/upgrades";
import { fmtMoney } from "../game/outcomes";
import { sound } from "../game/sound";

export default function Marketplace({
  netWorth,
  inventory = {},
  upgrades = {},
  onBuy,
  onBuyUpgrade,
  onClose,
}) {
  const [tab, setTab] = useState("charges");
  const [busy, setBusy] = useState(null);

  const buy = async (p) => {
    if (busy || netWorth < p.cost) return;
    setBusy(p.key);
    const res = await onBuy(p.key);
    if (!res || res.ok !== false) sound.play("power");
    setBusy(null);
  };

  const buyUp = async (u) => {
    const level = upgrades[u.key] ?? 0;
    const cost = upgradeCost(u.base, level);
    if (busy || level >= u.max || netWorth < cost) return;
    setBusy(u.key);
    const res = await onBuyUpgrade(u.key);
    if (!res || res.ok !== false) sound.play("power");
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

        <div className="shop-tabs">
          <button
            className={`shop-tab ${tab === "charges" ? "shop-tab-on" : ""}`}
            onClick={() => setTab("charges")}
          >
            ⚡ Charges
          </button>
          <button
            className={`shop-tab ${tab === "upgrades" ? "shop-tab-on" : ""}`}
            onClick={() => setTab("upgrades")}
          >
            🧬 Upgrades
          </button>
        </div>

        {tab === "charges" ? (
          <>
            <p className="shop-sub">
              One-use charges — unleash mid-run with keys 1–5. Buy as many as you
              can afford.
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
          </>
        ) : (
          <>
            <p className="shop-sub">
              Permanent upgrades — applied to every future run. Spend DNA now to
              evolve a deadlier defence.
            </p>
            <div className="shop-grid">
              {UPGRADES.map((u) => {
                const level = upgrades[u.key] ?? 0;
                const maxed = level >= u.max;
                const cost = upgradeCost(u.base, level);
                const broke = netWorth < cost;
                return (
                  <div key={u.key} className="shop-card">
                    <div className="shop-emoji">{u.emoji}</div>
                    <div className="shop-info">
                      <h3>
                        {u.name}
                        <span className="shop-have">
                          {" "}
                          Lv {level}/{u.max}
                        </span>
                      </h3>
                      <p>{u.desc}</p>
                      <div className="up-pips">
                        {Array.from({ length: u.max }).map((_, i) => (
                          <span key={i} className={`up-pip ${i < level ? "on" : ""}`} />
                        ))}
                      </div>
                    </div>
                    <button
                      className={`shop-buy ${broke && !maxed ? "shop-buy-broke" : ""}`}
                      disabled={busy === u.key || maxed || broke}
                      onClick={() => buyUp(u)}
                    >
                      {maxed
                        ? "MAX"
                        : busy === u.key
                          ? "…"
                          : broke
                            ? "Too broke"
                            : fmtMoney(cost)}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button className="btn-big shop-close" onClick={onClose}>
          BACK
        </button>
      </div>
    </div>
  );
}
