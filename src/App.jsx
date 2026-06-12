import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import GameCanvas from "./components/GameCanvas";
import GachaRoulette from "./components/GachaRoulette";
import ResultCard from "./components/ResultCard";
import Leaderboard from "./components/Leaderboard";
import Marketplace from "./components/Marketplace";
import Backdrop from "./components/Backdrop";
import Preserve from "./components/Preserve";
import { decorByKey } from "./game/decor";
import { rollLocal, fmtMoney, KILL_REWARD } from "./game/outcomes";
import { powerupByKey } from "./game/powerups";
import { upgradeByKey, upgradeCost } from "./game/upgrades";
import { sound } from "./game/sound";

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

// How-to-play pointers, shown in a modal so the menu stays clean.
const HOW_TO = [
  "🎯 Aim with your mouse — the catapult follows your cursor. Hold to hurl boulders.",
  "🌊 Survive escalating waves of predators. Every 3rd wave brings an Alpha boss.",
  "🐢 Watch the variety: armoured brutes, darting flyers, charging dashers, splitters.",
  "🦴 Every kill scores a point and pays DNA 🧬. Chain kills to build a COMBO.",
  "🦖 A full COMBO charges your ROAR — press Space to blast the whole swarm back.",
  "🐌 Let a predator get close and time slows down for a clutch save.",
  "🛒 Spend DNA in the Bone Market: one-use charges (keys 1–5) + permanent upgrades.",
  "🥚 When the nest breaks the egg hatches — survive longer for far better odds.",
  "🏞️ Spend DNA in the Preserve to build your own prehistoric park.",
];

// ---------- Convex-backed ----------
function OnlineApp() {
  const [playerId] = useState(getPlayerId);
  const [name, setName] = useState(defaultName);
  const player = useQuery(api.leaderboard.getPlayer, { playerId });
  const rollGacha = useMutation(api.leaderboard.rollGacha);
  const buyPowerup = useMutation(api.leaderboard.buyPowerup);
  const consumePowerup = useMutation(api.leaderboard.consumePowerup);
  const buyUpgrade = useMutation(api.leaderboard.buyUpgrade);
  const addDecoration = useMutation(api.leaderboard.addDecoration);
  const updatePreserve = useMutation(api.leaderboard.updatePreserve);
  const setScenery = useMutation(api.leaderboard.setScenery);

  const doRoll = useCallback(
    (kills, seconds) =>
      rollGacha({ playerId, name, killStreak: kills, survivedSeconds: seconds }),
    [rollGacha, playerId, name]
  );
  const doBuy = useCallback(
    (powerup) => buyPowerup({ playerId, name, powerup }),
    [buyPowerup, playerId, name]
  );
  const doConsume = useCallback(
    (powerup) => consumePowerup({ playerId, powerup }),
    [consumePowerup, playerId]
  );
  const doBuyUpgrade = useCallback(
    (upgrade) => buyUpgrade({ playerId, name, upgrade }),
    [buyUpgrade, playerId, name]
  );
  const doAddDecoration = useCallback(
    (decor) => addDecoration({ playerId, name, decor }),
    [addDecoration, playerId, name]
  );
  const doSavePreserve = useCallback(
    (items) => updatePreserve({ playerId, items }),
    [updatePreserve, playerId]
  );
  const doSetScenery = useCallback(
    (scenery) => setScenery({ playerId, name, scenery }),
    [setScenery, playerId, name]
  );

  return (
    <GameShell
      connected
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={player?.netWorth ?? 0}
      totalKills={player?.totalKills ?? 0}
      inventory={player?.inventory ?? {}}
      upgrades={player?.upgrades ?? {}}
      preserve={player?.preserve ?? []}
      scenery={player?.preserveScenery ?? "jungle"}
      doRoll={doRoll}
      doBuy={doBuy}
      doConsume={doConsume}
      doBuyUpgrade={doBuyUpgrade}
      doAddDecoration={doAddDecoration}
      doSavePreserve={doSavePreserve}
      doSetScenery={doSetScenery}
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
  const [inventory, setInventory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sdg_inventory") || "{}");
    } catch {
      return {};
    }
  });
  const [upgrades, setUpgrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sdg_upgrades") || "{}");
    } catch {
      return {};
    }
  });
  const [preserve, setPreserve] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sdg_preserve") || "[]");
    } catch {
      return [];
    }
  });
  const [scenery, setSceneryState] = useState(
    () => localStorage.getItem("sdg_scenery") || "jungle"
  );

  const doRoll = useCallback(async (kills, seconds) => {
    const o = rollLocal(kills, seconds);
    const earnings = (kills || 0) * KILL_REWARD;
    setNetWorth((w) => {
      const next = w + o.delta + earnings;
      localStorage.setItem("sdg_netWorth", String(next));
      return next;
    });
    setTotalKills((k) => {
      const next = k + (kills || 0);
      localStorage.setItem("sdg_totalKills", String(next));
      return next;
    });
    return { outcomeKey: o.key, delta: o.delta, killEarnings: earnings };
  }, []);

  const doBuy = useCallback(
    async (key) => {
      const p = powerupByKey(key);
      if (!p) return { ok: false, reason: "unknown" };
      if (netWorth < p.cost) return { ok: false, reason: "broke" };
      const nextWorth = netWorth - p.cost;
      const nextInv = { ...inventory, [key]: (inventory[key] ?? 0) + 1 };
      setNetWorth(nextWorth);
      localStorage.setItem("sdg_netWorth", String(nextWorth));
      setInventory(nextInv);
      localStorage.setItem("sdg_inventory", JSON.stringify(nextInv));
      return { ok: true };
    },
    [netWorth, inventory]
  );

  const doConsume = useCallback(
    async (key) => {
      if (!inventory[key]) return { ok: false, reason: "empty" };
      const nextInv = { ...inventory };
      nextInv[key] -= 1;
      if (nextInv[key] <= 0) delete nextInv[key];
      setInventory(nextInv);
      localStorage.setItem("sdg_inventory", JSON.stringify(nextInv));
      return { ok: true };
    },
    [inventory]
  );

  const doBuyUpgrade = useCallback(
    async (key) => {
      const u = upgradeByKey(key);
      if (!u) return { ok: false, reason: "unknown" };
      const level = upgrades[key] ?? 0;
      if (level >= u.max) return { ok: false, reason: "maxed" };
      const cost = upgradeCost(u.base, level);
      if (netWorth < cost) return { ok: false, reason: "broke" };
      const next = { ...upgrades, [key]: level + 1 };
      const nextWorth = netWorth - cost;
      setNetWorth(nextWorth);
      localStorage.setItem("sdg_netWorth", String(nextWorth));
      setUpgrades(next);
      localStorage.setItem("sdg_upgrades", JSON.stringify(next));
      return { ok: true };
    },
    [netWorth, upgrades]
  );

  const doAddDecoration = useCallback(
    async (key) => {
      const d = decorByKey(key);
      if (!d) return { ok: false };
      if (netWorth < d.cost) return { ok: false, reason: "broke" };
      const nextWorth = netWorth - d.cost;
      setNetWorth(nextWorth);
      localStorage.setItem("sdg_netWorth", String(nextWorth));
      return { ok: true };
    },
    [netWorth]
  );

  const doSavePreserve = useCallback(async (items) => {
    setPreserve(items);
    localStorage.setItem("sdg_preserve", JSON.stringify(items));
    return { ok: true };
  }, []);

  const doSetScenery = useCallback(async (key) => {
    setSceneryState(key);
    localStorage.setItem("sdg_scenery", key);
    return { ok: true };
  }, []);

  return (
    <GameShell
      connected={false}
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={netWorth}
      totalKills={totalKills}
      inventory={inventory}
      upgrades={upgrades}
      preserve={preserve}
      scenery={scenery}
      doRoll={doRoll}
      doBuy={doBuy}
      doConsume={doConsume}
      doBuyUpgrade={doBuyUpgrade}
      doAddDecoration={doAddDecoration}
      doSavePreserve={doSavePreserve}
      doSetScenery={doSetScenery}
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
  inventory,
  upgrades,
  preserve,
  scenery,
  doRoll,
  doBuy,
  doConsume,
  doBuyUpgrade,
  doAddDecoration,
  doSavePreserve,
  doSetScenery,
}) {
  const [phase, setPhase] = useState("menu"); // menu | playing | rolling | result
  const [kills, setKills] = useState(0);
  const [survived, setSurvived] = useState(0);
  const [resultKey, setResultKey] = useState(null);
  const [paused, setPaused] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [preserveOpen, setPreserveOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [banner, setBanner] = useState(null);
  const [muted, setMuted] = useState(() => !sound.enabled);
  const bannerTimer = useRef(null);

  const goHome = useCallback(() => {
    setPaused(false);
    setShopOpen(false);
    setResultKey(null);
    setPhase("menu");
  }, []);

  const startPlaying = useCallback(() => {
    sound.unlock();
    sound.startMusic();
    sound.play("ui");
    setPhase("playing");
  }, []);

  const toggleMute = useCallback(() => {
    const en = sound.toggle();
    setMuted(!en);
  }, []);

  const onWave = useCallback((info) => {
    if (info.cleared) {
      setBanner({ text: `WAVE ${info.wave} CLEARED`, sub: "brace yourself…" });
    } else {
      setBanner({
        text: info.boss ? "⚠ BOSS WAVE" : `WAVE ${info.wave}`,
        sub: info.boss ? "an Alpha approaches" : "",
      });
    }
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1900);
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
    async ({ kills, time }) => {
      setKills(kills);
      setSurvived(time || 0);
      let res;
      try {
        res = await doRoll(kills, time);
      } catch {
        // Network hiccup — roll locally so the game never stalls.
        res = { outcomeKey: rollLocal(kills, time).key };
      }
      setResultKey(res.outcomeKey);
      setPhase("rolling");
    },
    [doRoll]
  );

  return (
    <>
      <Backdrop />
      <div className="watermark">made by Aliasgar Sogiawala</div>
      <div className="layout">
      <main className="play-area">
        <header className="hud">
          <h1 className="logo">🦖 EGGSTINCTION</h1>
          <div className="hud-stats">
            <button
              className="mute-btn"
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <div className="destroyer" title="Predators culled (lifetime)">
              🦴 {totalKills.toLocaleString("en-US")}
            </div>
            <div
              className={`networth ${netWorth < 0 ? "networth-broke" : ""}`}
              title="Genome Value"
            >
              🧬 {fmtMoney(netWorth)}
            </div>
          </div>
        </header>

        {phase === "menu" && (
          <div className="menu">
            <div className="menu-egg">🥚</div>
            <p className="menu-tagline">
              Defend the last dinosaur egg from the swarm.
              <br />
              Hatch a <strong>legend</strong>… or a <strong>sentient rock</strong>.
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
              <button className="btn-big" onClick={startPlaying}>
                DEFEND THE NEST
              </button>
              <button className="btn-shop" onClick={() => setShopOpen(true)}>
                🦴 BONE MARKET
              </button>
              <button
                className="btn-shop btn-preserve"
                onClick={() => {
                  sound.unlock();
                  setPreserveOpen(true);
                }}
              >
                🏞️ PRESERVE
              </button>
            </div>
            <button className="btn-howto" onClick={() => setHowToOpen(true)}>
              ❓ How to play
            </button>
          </div>
        )}

        {howToOpen && (
          <div className="overlay" onClick={() => setHowToOpen(false)}>
            <div className="howto-card" onClick={(e) => e.stopPropagation()}>
              <h2>🎮 How to Play</h2>
              <ul className="howto-list">
                {HOW_TO.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <button className="btn-big" onClick={() => setHowToOpen(false)}>
                GOT IT
              </button>
            </div>
          </div>
        )}

        {phase === "playing" && (
          <GameCanvas
            onFertilized={onFertilized}
            inventory={inventory}
            onConsume={doConsume}
            upgrades={upgrades}
            onWave={onWave}
            paused={paused || shopOpen}
          />
        )}

        {phase === "playing" && banner && (
          <div className="wave-banner" key={banner.text}>
            <div className="wave-text">{banner.text}</div>
            {banner.sub && <div className="wave-sub">{banner.sub}</div>}
          </div>
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
                🦴 BONE MARKET
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
            survived={survived}
            netWorth={netWorth}
            onAgain={() => {
              setResultKey(null);
              startPlaying();
            }}
            onHome={goHome}
          />
        )}

        {shopOpen && (
          <Marketplace
            netWorth={netWorth}
            inventory={inventory}
            upgrades={upgrades}
            onBuy={doBuy}
            onBuyUpgrade={doBuyUpgrade}
            onClose={() => setShopOpen(false)}
          />
        )}
      </main>

      <Leaderboard playerId={playerId} connected={connected} />
      </div>

      {preserveOpen && (
        <Preserve
          netWorth={netWorth}
          items={preserve}
          scenery={scenery}
          onAdd={doAddDecoration}
          onSave={doSavePreserve}
          onSetScenery={doSetScenery}
          onClose={() => setPreserveOpen(false)}
        />
      )}
    </>
  );
}
