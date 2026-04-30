import { simulateMatch } from "../src/engine";
import type { Team, PlayerInput } from "../src/types";

function createMockTeam(id: string, name: string): Team {
  const players: PlayerInput[] = [];
  const positions: Array<PlayerInput["position"]> = [
    "GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST", "ST"
  ];
  
  for (let i = 0; i < 11; i++) {
    players.push({
      id: `${id}-p${i}`,
      name: `Player ${i}`,
      shortName: `P${i}`,
      position: positions[i]!,
      attributes: {
        passing: 50, shooting: 50, tackling: 50, saving: 50, agility: 50,
        strength: 50, penaltyTaking: 50, perception: 50, jumping: 50, control: 50
      }
    });
  }

  return {
    id, name, shortName: name.slice(0, 3).toUpperCase(),
    players,
    tactics: { formation: "4-4-2", mentality: "balanced", tempo: "normal", pressing: "medium", lineHeight: "normal", width: "normal" }
  };
}

async function runCalibration() {
  const N = 50;
  
  let shotsTotal = 0;
  let goalsTotal = 0;
  let foulsTotal = 0;
  let cardsTotal = 0;
  
  for (let i = 0; i < N; i++) {
    const home = createMockTeam("home-1", "Liverpool");
    const away = createMockTeam("away-1", "Milan");
    
    // We calibrate for the 2nd half slice (45 mins)
    const snap = simulateMatch({
      homeTeam: home,
      awayTeam: away,
      duration: "second_half",
      seed: i
    });
    
    const hs = snap.finalSummary.statistics.home;
    const as = snap.finalSummary.statistics.away;
    
    goalsTotal += (hs.goals + as.goals);
    shotsTotal += (hs.shots.total + as.shots.total);
    foulsTotal += (hs.fouls + as.fouls);
    cardsTotal += (hs.yellowCards + as.yellowCards + hs.redCards + as.redCards);
  }
  
  const results = {
    avgGoals: (goalsTotal / N).toFixed(2),
    avgShots: (shotsTotal / N).toFixed(2),
    avgFouls: (foulsTotal / N).toFixed(2),
    avgCards: (cardsTotal / N).toFixed(2)
  };
  
  console.log("=== CALIBRATION RESULTS (45 mins, N=50) ===");
  console.log(`Shots:  ${results.avgShots} (Target: 8-12)`);
  console.log(`Goals:  ${results.avgGoals} (Target: 1-3)`);
  console.log(`Fouls:  ${results.avgFouls} (Target: 4-8)`);
  console.log(`Cards:  ${results.avgCards} (Target: 1-3)`);
}

runCalibration().catch(console.error);
