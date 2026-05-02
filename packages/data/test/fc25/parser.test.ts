import { describe, expect, it } from "vitest";

import {
  FC25_CLUBS,
  FC25_SOURCE_TEAM_NAMES,
  Fc25ParseError,
  parseFc25PlayersCsv,
  parseFc25PlayerRecord
} from "../../src/fc25";

const FC25_FIXTURE = `Unnamed: 0,Rank,Name,OVR,Acceleration,Sprint Speed,Positioning,Finishing,Shot Power,Long Shots,Volleys,Penalties,Vision,Crossing,Free Kick Accuracy,Short Passing,Long Passing,Curve,Dribbling,Agility,Balance,Reactions,Ball Control,Composure,Interceptions,Heading Accuracy,Def Awareness,Standing Tackle,Sliding Tackle,Jumping,Stamina,Strength,Aggression,Position,Weak foot,Skill moves,Preferred foot,Height,Weight,Alternative positions,Age,Nation,League,Team,play style,url,GK Diving,GK Handling,GK Kicking,GK Positioning,GK Reflexes
"1","2","Rodri","91","65","66","76","74","92","89","71","62","84","76","64","93","91","86","84","66","67","93","90","94","84","81","92","87","82","83","91","83","85","CDM","4","3","Right","191cm / 6'3""","82kg / 181lb","CM","28","Spain","Premier League","Manchester City","Tiki Taka+, Aerial, Bruiser, Long Ball Pass, Power Shot, Press Proven","https://www.ea.com/games/ea-sports-fc/ratings/player-ratings/rodri/231866","","","","",""
"9","15","Alisson","89","60","49","13","13","64","14","20","23","66","17","18","60","58","19","27","40","37","87","42","66","11","29","15","19","16","82","32","78","27","GK","3","1","Right","193cm / 6'4""","91kg / 201lb","","31","Brazil","Premier League","Liverpool","Deflector+, 1v1 Close Down, Far Throw","https://www.ea.com/games/ea-sports-fc/ratings/player-ratings/alisson/212831","86.0","85.0","85.0","90.0","89.0"`;

describe("FC25 CSV parser", () => {
  it("parses outfield rows into typed FC25 rows", () => {
    const rows = parseFc25PlayersCsv(FC25_FIXTURE);
    const rodri = rows.find((row) => row.name === "Rodri");

    expect(rows).toHaveLength(2);
    expect(rodri).toMatchObject({
      sourceIndex: 1,
      rank: 2,
      fc25PlayerId: "231866",
      name: "Rodri",
      overall: 91,
      position: "DM",
      sourcePosition: "CDM",
      age: 28,
      nationality: "Spain",
      league: "Premier League",
      sourceTeam: "Manchester City",
      preferredFoot: "right",
      weakFootRating: 4,
      skillMovesRating: 3,
      heightCm: 191,
      weightKg: 82,
      gkAttributes: null
    });
    expect(rodri?.alternativePositions).toEqual(["CM"]);
    expect(rodri?.attributes.shortPassing).toBe(93);
    expect(rodri?.attributes.longPassing).toBe(91);
    expect(rodri?.attributes.defensiveAwareness).toBe(92);
  });

  it("parses goalkeeper rows and decimal GK source values", () => {
    const rows = parseFc25PlayersCsv(FC25_FIXTURE);
    const alisson = rows.find((row) => row.name === "Alisson");

    expect(alisson).toMatchObject({
      fc25PlayerId: "212831",
      position: "GK",
      sourceTeam: "Liverpool",
      preferredFoot: "right",
      weakFootRating: 3,
      skillMovesRating: 1
    });
    expect(alisson?.alternativePositions).toEqual([]);
    expect(alisson?.gkAttributes).toEqual({
      gkDiving: 86,
      gkHandling: 85,
      gkKicking: 85,
      gkPositioning: 90,
      gkReflexes: 89
    });
  });

  it("exposes the five-club Phase 1 whitelist", () => {
    expect(FC25_CLUBS.map((club) => club.id)).toEqual([
      "arsenal",
      "manchester-city",
      "manchester-united",
      "liverpool",
      "aston-villa"
    ]);
    expect(FC25_SOURCE_TEAM_NAMES).toEqual([
      "Arsenal",
      "Manchester City",
      "Man Utd",
      "Liverpool",
      "Aston Villa"
    ]);
  });

  it("throws a typed parse error for unsupported source positions", () => {
    expect(() =>
      parseFc25PlayerRecord(
        {
          Position: "RWB"
        },
        12
      )
    ).toThrow(Fc25ParseError);
  });
});
