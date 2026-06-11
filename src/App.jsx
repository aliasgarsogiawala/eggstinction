import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import GameCanvas from "./components/GameCanvas";
import GachaRoulette from "./components/GachaRoulette";
import ResultCard from "./components/ResultCard";
import Leaderboard from "./components/Leaderboard";
import { rollLocal, fmtMoney } from "./game/outcomes";

// ---------- anonymous identity ----------
function getPlayerId() {
  let id = localStorage.getItem("mdbd_playerId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mdbd_playerId", id);
  }
  return id;
}

const ADJ = ["Anxious", "Hopeful", "Broke", "Wealthy", "Frantic", "Chill", "Sweaty", "Lucky"];
const NOUN = ["Parent", "Guardian", "Investor", "Defender", "Landlord", "Gambler"];
function defaultName() {
  let n = localStorage.getItem("mdbd_name");
  if (!n) {
    n = `${ADJ[(Math.random() * ADJ.length) | 0]}${NOUN[(Math.random() * NOUN.length) | 0]}${(Math.random() * 99) | 0}`;
    localStorage.setItem("mdbd_name", n);
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

  const doRoll = useCallback(
    (kills) => rollGacha({ playerId, name, killStreak: kills }),
    [rollGacha, playerId, name]
  );

  return (
    <GameShell
      connected
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={player?.netWorth ?? 0}
      doRoll={doRoll}
    />
  );
}

// ---------- local fallback (before `npx convex dev`) ----------
function OfflineApp() {
  const [playerId] = useState(getPlayerId);
  const [name, setName] = useState(defaultName);
  const [netWorth, setNetWorth] = useState(() =>
    Number(localStorage.getItem("mdbd_netWorth") || 0)
  );

  const doRoll = useCallback(async () => {
    const o = rollLocal();
    setNetWorth((w) => {
      const next = w + o.delta;
      localStorage.setItem("mdbd_netWorth", String(next));
      return next;
    });
    return { outcomeKey: o.key, delta: o.delta };
  }, []);

  return (
    <GameShell
      connected={false}
      playerId={playerId}
      name={name}
      setName={setName}
      netWorth={netWorth}
      doRoll={doRoll}
    />
  );
}

// ---------- shared shell / phase machine ----------
function GameShell({ connected, playerId, name, setName, netWorth, doRoll }) {
  const [phase, setPhase] = useState("menu"); // menu | playing | rolling | result
  const [kills, setKills] = useState(0);
  const [resultKey, setResultKey] = useState(null);

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
          <h1 className="logo">🥚 MILLION DOLLAR BABY DEFENSE</h1>
          <div className={`networth ${netWorth < 0 ? "networth-broke" : ""}`}>
            💰 {fmtMoney(netWorth)}
          </div>
        </header>

        {phase === "menu" && (
          <div className="menu">
            <div className="menu-egg">🥚</div>
            <p className="menu-pitch">
              Swarms are coming for your egg. Hold to shoot.
              <br />
              When (not if) it gets fertilized… you roll for the kid's career.
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
                  localStorage.setItem("mdbd_name", e.target.value);
                }}
              />
            </label>
            <button className="btn-big" onClick={() => setPhase("playing")}>
              DEFEND THE EGG
            </button>
          </div>
        )}

        {phase === "playing" && <GameCanvas onFertilized={onFertilized} />}
        {(phase === "rolling" || phase === "result") && (
          <div className="game-stage stage-dim" />
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
          />
        )}
      </main>

      <Leaderboard playerId={playerId} connected={connected} />
    </div>
  );
}
