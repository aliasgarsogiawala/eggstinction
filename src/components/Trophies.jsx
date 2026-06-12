import { useState } from "react";
import {
  challengeByKey,
  ACHIEVEMENTS,
  achievementByKey,
  prestigeMult,
  PRESTIGE_COST,
} from "../game/meta";
import { OUTCOMES, fmtMoney } from "../game/outcomes";
import { sound } from "../game/sound";

const fmtTime = (s) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—";

export default function Trophies({ meta, netWorth, totalKills, onPrestige, onClose }) {
  const [tab, setTab] = useState("daily");
  const [busy, setBusy] = useState(false);

  const prestige = meta.prestige || 0;
  const mult = prestigeMult(prestige);
  const canPrestige = netWorth >= PRESTIGE_COST;
  const have = new Set(meta.achievements || []);
  const dexCount = Object.keys(meta.collection || {}).length;

  const doPrestige = async () => {
    if (busy || !canPrestige) return;
    setBusy(true);
    const res = await onPrestige();
    setBusy(false);
    if (res && res.ok) sound.play("hatch");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="trophies" onClick={(e) => e.stopPropagation()}>
        <header className="shop-head">
          <h2>🏆 TROPHIES &amp; DEX</h2>
          <div className="networth">🧬 {fmtMoney(netWorth)}</div>
        </header>

        <div className="shop-tabs">
          {[
            ["daily", "📅 Daily"],
            ["ach", "🏅 Achievements"],
            ["dex", "📖 Dex"],
            ["prestige", "⭐ Prestige"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`shop-tab ${tab === k ? "shop-tab-on" : ""}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <>
            <p className="shop-sub">Three fresh objectives every day — clear them for bonus DNA.</p>
            <div className="troph-list">
              {(meta.daily?.keys || []).map((key) => {
                const c = challengeByKey(key);
                if (!c) return null;
                const done = (meta.daily?.done || []).includes(key);
                return (
                  <div key={key} className={`troph-row ${done ? "troph-done" : ""}`}>
                    <span className="troph-emoji">{c.emoji}</span>
                    <span className="troph-info">
                      <strong>{c.label}</strong>
                      <span className="troph-reward">+{fmtMoney(c.reward)} 🧬</span>
                    </span>
                    <span className="troph-state">{done ? "✅" : "⬜"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "ach" && (
          <>
            <p className="shop-sub">
              {have.size}/{ACHIEVEMENTS.length} unlocked.
            </p>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => {
                const got = have.has(a.key);
                return (
                  <div key={a.key} className={`ach-card ${got ? "ach-on" : "ach-off"}`}>
                    <div className="ach-emoji">{got ? a.emoji : "🔒"}</div>
                    <div className="ach-info">
                      <strong>{a.name}</strong>
                      <p>{a.desc}</p>
                      {a.reward > 0 && <span className="troph-reward">+{fmtMoney(a.reward)} 🧬</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "dex" && (
          <>
            <p className="shop-sub">
              {dexCount}/{OUTCOMES.length} species discovered — every hatchling you've ever rolled.
            </p>
            <div className="dex-grid">
              {OUTCOMES.map((o) => {
                const e = (meta.collection || {})[o.key];
                const got = !!e;
                return (
                  <div key={o.key} className={`dex-card ${got ? "" : "dex-locked"}`}>
                    <div className="dex-emoji">{got ? o.emoji : "❔"}</div>
                    <div className="dex-name">{got ? o.label : "????"}</div>
                    {got && (
                      <div className="dex-stats">
                        ×{e.count} · best {fmtTime(e.bestTime)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "prestige" && (
          <div className="prestige-pane">
            <div className="prestige-mult">×{mult.toFixed(2)} DNA</div>
            <p className="shop-sub">
              You've prestiged <strong>{prestige}</strong> time{prestige === 1 ? "" : "s"}. Every
              prestige permanently multiplies all DNA you earn.
            </p>
            <p className="prestige-warn">
              Cashing out spends <strong>{fmtMoney(PRESTIGE_COST)} 🧬</strong> — it resets your
              Genome to 0 (you'll drop on the Apex board) in exchange for{" "}
              <strong>+25% DNA forever</strong>.
            </p>
            <button
              className={`btn-big ${canPrestige ? "" : "prestige-locked"}`}
              disabled={!canPrestige || busy}
              onClick={doPrestige}
            >
              {canPrestige ? `⭐ PRESTIGE → ×${prestigeMult(prestige + 1).toFixed(2)}` : `Reach ${fmtMoney(PRESTIGE_COST)} 🧬`}
            </button>
            <div className="prestige-stats">
              🦴 {totalKills.toLocaleString("en-US")} lifetime culls · 🦖 {meta.totalBossKills || 0} bosses ·
              💥 best combo {meta.bestCombo || 0} · ⏱ best {fmtTime(meta.bestTime || 0)}
            </div>
          </div>
        )}

        <button className="btn-big shop-close" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
