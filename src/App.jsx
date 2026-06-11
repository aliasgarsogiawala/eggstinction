import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import GameCanvas from "./components/GameCanvas";
import GachaRoulette from "./components/GachaRoulette";
import ResultCard from "./components/ResultCard";
import Leaderboard from "./components/Leaderboard";
import Marketplace from "./components/Marketplace";
import { rollLocal, fmtMoney } from "./game/outcomes";
import { powerupByKey } from "./game/powerups";

// ---------- anonymous identity ----------
function getPlayerId() {
  let id = localStorage.getItem("sdg_playerId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sdg_playerId", id);
  }
  return id;
}

const ADJ = ["Anxious", "Hopeful", "Broke", "Wealthy", "Frantic", "Chill", "Sweaty", "Lucky"];
const NOUN = ["Parent", "Guardian", "Investor", "Defender", "Landlord", "Gambler"];
function defaultName() {
  let n = localStorage.getItem("sdg_name");
  if (!n) {
    n = `${ADJ[(Math.random() * ADJ.length) | 0]}${NOUN[(Math.random() * NOUN.length) | 0]}${(Math.random() * 99) | 0}`;
    localStorage.setItem("sdg_name", n);
  }
  return n;
}

export default function App({ connected }) {
  return connected ? <OnlineApp /> : <OfflineApp />;
}

// ---------- Convex-backed ----------
function OnlineApp() {
  const [playerId] = useState(getPlayerId);
  const [name, setName] = useState(defaultName);
  const player = useQuery(api.leaderboard.getPlayer, { playerId });
  const rollGacha = useMutation(api.leaderboard.rollGacha);
  const buyPowerup = useMutation(api.leaderboard.buyPowerup);

  const doRoll = useCallback(
    (kills) => rollGacha({ playerId, name, killStreak: kills }),
    [rollGacha, playerId, name]
  );
  const doBuy = useCallback(
    (powerup) => buyPowerup({ playerId, name, powerup }),
    [buyPowerup, playerId, name]
  );

  return (
    <GameShell
      connected
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={player?.netWorth ?? 0}
      totalKills={player?.totalKills ?? 0}
      powerups={player?.powerups ?? []}
      doRoll={doRoll}
      doBuy={doBuy}
    />
  );
}

// ---------- local fallback (before `npx convex dev`) ----------
function OfflineApp() {
  const [playerId] = useState(getPlayerId);
  const [name, setName] = useState(defaultName);
  const [netWorth, setNetWorth] = useState(() =>
    Number(localStorage.getItem("sdg_netWorth") || 0)
  );
  const [totalKills, setTotalKills] = useState(() =>
    Number(localStorage.getItem("sdg_totalKills") || 0)
  );
  const [powerups, setPowerups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sdg_powerups") || "[]");
    } catch {
      return [];
    }
  });

  const doRoll = useCallback(async (kills) => {
    const o = rollLocal();
    setNetWorth((w) => {
      const next = w + o.delta;
      localStorage.setItem("sdg_netWorth", String(next));
      return next;
    });
    setTotalKills((k) => {
      const next = k + (kills || 0);
      localStorage.setItem("sdg_totalKills", String(next));
      return next;
    });
    return { outcomeKey: o.key, delta: o.delta };
  }, []);

  const doBuy = useCallback(
    async (key) => {
      const p = powerupByKey(key);
      if (!p) return { ok: false, reason: "unknown" };
      if (powerups.includes(key)) return { ok: false, reason: "owned" };
      if (netWorth < p.cost) return { ok: false, reason: "broke" };
      const nextWorth = netWorth - p.cost;
      const nextPowerups = [...powerups, key];
      setNetWorth(nextWorth);
      localStorage.setItem("sdg_netWorth", String(nextWorth));
      setPowerups(nextPowerups);
      localStorage.setItem("sdg_powerups", JSON.stringify(nextPowerups));
      return { ok: true };
    },
    [netWorth, powerups]
  );

  return (
    <GameShell
      connected={false}
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={netWorth}
      totalKills={totalKills}
      powerups={powerups}
      doRoll={doRoll}
      doBuy={doBuy}
    />
  );
}

// ---------- shared shell / phase machine ----------
function GameShell({
  connected,
  playerId,
  name,
  setName,
  netWorth,
  totalKills,
  powerups,
  doRoll,
  doBuy,
}) {
  const [phase, setPhase] = useState("menu"); // menu | playing | rolling | result
  const [kills, setKills] = useState(0);
  const [resultKey, setResultKey] = useState(null);
  const [paused, setPaused] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const goHome = useCallback(() => {
    setPaused(false);
    setShopOpen(false);
    setResultKey(null);
    setPhase("menu");
  }, []);

  // Esc pauses/resumes during play; also backs out of the marketplace.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (shopOpen) {
        setShopOpen(false);
        return;
      }
      if (phase === "playing") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, shopOpen]);

  const onFertilized = useCallback(
    async ({ kills }) => {
      setKills(kills);
      let res;
      try {
        res = await doRoll(kills);
      } catch {
        // Network hiccup — roll locally so the game never stalls.
        res = { outcomeKey: rollLocal().key };
      }
      setResultKey(res.outcomeKey);
      setPhase("rolling");
    },
    [doRoll]
  );

  return (
    <div className="layout">
      <main className="play-area">
        <header className="hud">
          <h1 className="logo">🥚 SAVEDATEGG</h1>
          <div className="hud-stats">
            <div className="destroyer" title="Lifetime swimmers destroyed">
              💥 {totalKills.toLocaleString("en-US")}
            </div>
            <div className={`networth ${netWorth < 0 ? "networth-broke" : ""}`}>
              💰 {fmtMoney(netWorth)}
            </div>
          </div>
        </header>

        {phase === "menu" && (
          <div className="menu">
            <div className="menu-egg">🥚</div>
            <p className="menu-pitch">
              <strong>How to play:</strong> a turret sits on your egg and aims
              wherever you point. <strong>Hold the mouse to fire.</strong>{" "}
              Swimmers race in from every edge — slow at first, then faster and
              faster. Every one you pop adds to your{" "}
              <strong>💥 Swimmer Destroyer</strong> score.
              <br />
              When (not if) the egg gets fertilized, you spin the gacha for the
              kid's career and your <strong>💰 Net Worth</strong>.
              <br />
              <strong>Doctor? Engineer? …or a 34-year-old in your basement?</strong>
            </p>
            <label className="name-row">
              I am&nbsp;
              <input
                className="name-input"
                value={name}
                maxLength={20}
                onChange={(e) => {
                  setName(e.target.value);
                  localStorage.setItem("sdg_name", e.target.value);
                }}
              />
            </label>
            <div className="menu-buttons">
              <button className="btn-big" onClick={() => setPhase("playing")}>
                DEFEND THE EGG
              </button>
              <button className="btn-shop" onClick={() => setShopOpen(true)}>
                🛒 MARKETPLACE
              </button>
            </div>
          </div>
        )}

        {phase === "playing" && (
          <GameCanvas
            onFertilized={onFertilized}
            powerups={powerups}
            paused={paused || shopOpen}
          />
        )}
        {(phase === "rolling" || phase === "result") && (
          <div className="game-stage stage-dim" />
        )}

        {/* Pause menu */}
        {phase === "playing" && paused && !shopOpen && (
          <div className="overlay">
            <div className="pause-card">
              <h2>⏸ PAUSED</h2>
              <button className="btn-big" onClick={() => setPaused(false)}>
                RESUME
              </button>
              <button className="btn-shop" onClick={() => setShopOpen(true)}>
                🛒 MARKETPLACE
              </button>
              <button className="btn-ghost" onClick={goHome}>
                🏠 HOME
              </button>
              <p className="pause-hint">Esc to resume</p>
            </div>
          </div>
        )}

        {phase === "rolling" && resultKey && (
          <GachaRoulette resultKey={resultKey} onDone={() => setPhase("result")} />
        )}

        {phase === "result" && resultKey && (
          <ResultCard
            resultKey={resultKey}
            kills={kills}
            netWorth={netWorth}
            onAgain={() => {
              setResultKey(null);
              setPhase("playing");
            }}
            onHome={goHome}
          />
        )}

        {shopOpen && (
          <Marketplace
            netWorth={netWorth}
            owned={powerups}
            onBuy={doBuy}
            onClose={() => setShopOpen(false)}
          />
        )}
      </main>

      <Leaderboard playerId={playerId} connected={connected} />
    </div>
  );
}
