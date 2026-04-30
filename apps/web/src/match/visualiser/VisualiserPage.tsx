import { useState, useEffect, useRef } from "react";
import { simulateMatch } from "@the-ataturk/match-engine";
import type { MatchSnapshot, Team, PlayerInput } from "@the-ataturk/match-engine";

function createMockTeam(id: string, name: string): Team {
  const players: PlayerInput[] = [];
  const positions: Array<PlayerInput["position"]> = [
    "GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST", "ST"
  ];
  for (let i = 0; i < 11; i++) {
    players.push({
      id: `${id}-p${i}`, name: `Player ${i}`, shortName: `P${i}`, position: positions[i]!,
      attributes: { passing: 50, shooting: 50, tackling: 50, saving: 50, agility: 50, strength: 50, penaltyTaking: 50, perception: 50, jumping: 50, control: 50 }
    });
  }
  return {
    id, name, shortName: name.slice(0, 3).toUpperCase(), players,
    tactics: { formation: "4-4-2", mentality: "balanced", tempo: "normal", pressing: "medium", lineHeight: "normal", width: "normal" }
  };
}

export function VisualiserPage() {
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [tickIndex, setTickIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);

  const generateMatch = () => {
    setIsPlaying(false);
    setTickIndex(0);
    const snap = simulateMatch({
      homeTeam: createMockTeam("home-1", "Liverpool"),
      awayTeam: createMockTeam("away-1", "Milan"),
      duration: "second_half",
      seed: Date.now()
    });
    setSnapshot(snap);
  };

  useEffect(() => {
    if (isPlaying && snapshot) {
      animationRef.current = window.setInterval(() => {
        setTickIndex(i => {
          if (i >= snapshot.ticks.length - 1) {
            setIsPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 100); // Fast playback: 10 ticks per sec. (30 sec match time per sec real time)
    } else if (animationRef.current) {
      window.clearInterval(animationRef.current);
    }
    return () => {
      if (animationRef.current) window.clearInterval(animationRef.current);
    };
  }, [isPlaying, snapshot]);

  if (!snapshot) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Match Visualiser</h1>
        <button onClick={generateMatch}>Generate Match</button>
      </main>
    );
  }

  const currentTick = snapshot.ticks[tickIndex]!;
  const PITCH_W = 680;
  const PITCH_H = 1050;

  return (
    <main style={{ display: "flex", height: "100vh", background: "#1a1a1a", color: "#fff", fontFamily: "sans-serif" }}>
      <section style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column" }}>
        
        <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2>{snapshot.meta.homeTeam.name} {currentTick.score.home} - {currentTick.score.away} {snapshot.meta.awayTeam.name}</h2>
            <p>Clock: {currentTick.matchClock.minute}:{currentTick.matchClock.seconds.toString().padStart(2, "0")}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={generateMatch}>Regenerate</button>
            <button onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? "Pause" : "Play"}</button>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20 }}>
          <input 
            type="range" 
            min="0" 
            max={snapshot.ticks.length - 1} 
            value={tickIndex} 
            onChange={(e) => {
              setIsPlaying(false);
              setTickIndex(parseInt(e.target.value, 10));
            }}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", minHeight: 0 }}>
          <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} style={{ height: "100%", background: "#2e7d32", border: "2px solid #fff" }}>
            {/* Simple Pitch lines */}
            <rect x="0" y="0" width={PITCH_W} height={PITCH_H} fill="none" stroke="#fff" strokeWidth="2" />
            <line x1="0" y1={PITCH_H/2} x2={PITCH_W} y2={PITCH_H/2} stroke="#fff" strokeWidth="2" />
            <circle cx={PITCH_W/2} cy={PITCH_H/2} r="90" fill="none" stroke="#fff" strokeWidth="2" />
            
            {/* Penalty boxes */}
            <rect x={140} y="0" width={400} height={165} fill="none" stroke="#fff" strokeWidth="2" />
            <rect x={248} y="0" width={183} height={55} fill="none" stroke="#fff" strokeWidth="2" />
            <rect x={140} y={PITCH_H - 165} width={400} height={165} fill="none" stroke="#fff" strokeWidth="2" />
            <rect x={248} y={PITCH_H - 55} width={183} height={55} fill="none" stroke="#fff" strokeWidth="2" />

            {/* Players */}
            {currentTick.players.map(p => {
              if (!p.onPitch) return null;
              const color = p.teamId === "home" ? "red" : "white";
              const stroke = p.teamId === "home" ? "darkred" : "black";
              return (
                <circle 
                  key={p.id} 
                  cx={p.position[0]} 
                  cy={p.position[1]} 
                  r="12" 
                  fill={color} 
                  stroke={stroke} 
                  strokeWidth="2" 
                  style={{ transition: "cy 0.1s linear, cx 0.1s linear" }}
                />
              );
            })}

            {/* Ball */}
            <circle 
              cx={currentTick.ball.position[0]} 
              cy={currentTick.ball.position[1]} 
              r="6" 
              fill="yellow" 
              stroke="black"
              style={{ transition: "cy 0.1s linear, cx 0.1s linear" }}
            />
          </svg>
        </div>
      </section>

      <aside style={{ width: 350, background: "#222", padding: 20, overflowY: "auto", borderLeft: "1px solid #444" }}>
        <h3>Events (Max 50 recents)</h3>
        {snapshot.ticks.slice(0, tickIndex + 1).flatMap(t => t.events).reverse().slice(0, 50).map((ev, i) => (
          <div key={i} style={{ marginBottom: 10, padding: 10, background: "#333", borderRadius: 4, borderLeft: `4px solid ${ev.team === "home" ? "red" : "white"}` }}>
            <strong>{ev.minute}:{ev.second.toString().padStart(2, "0")}</strong> - {ev.type.toUpperCase()}
            {ev.playerId && <div style={{ fontSize: "0.85em", color: "#aaa" }}>{ev.playerId}</div>}
          </div>
        ))}
      </aside>
    </main>
  );
}
