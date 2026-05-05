import { describe, expect, it } from "vitest";

import {
  FC25_CLUBS,
  FC25_FOOTSIM_CLUBS,
  FC25_SOURCE_TEAM_NAMES,
  Fc25ParseError,
  displayNameForFc25Player,
  parseFc25PlayersCsv,
  parseFc25PlayerRecord,
  parseFc26PlayerRecord
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

  it("exposes the PL20 universe and five-club FootSim subset", () => {
    expect(FC25_CLUBS).toHaveLength(20);
    expect(FC25_CLUBS.map((club) => club.id)).toContain("chelsea");
    expect(FC25_FOOTSIM_CLUBS.map((club) => club.id)).toEqual([
      "arsenal",
      "aston-villa",
      "liverpool",
      "manchester-city",
      "manchester-united"
    ]);
    expect(FC25_SOURCE_TEAM_NAMES).toContain("AFC Bournemouth");
    expect(FC25_SOURCE_TEAM_NAMES).toContain("Manchester City");
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

  it("parses FC26 SoFIFA rows into the FC25 row model", () => {
    const wirtz = parseFc26PlayerRecord(fc26Record(), 2);

    expect(wirtz).toMatchObject({
      fc25PlayerId: "256630",
      name: "Florian Wirtz",
      sourceShortName: "F. Wirtz",
      overall: 89,
      position: "AM",
      sourcePosition: "CAM",
      alternativePositions: ["ST", "CM"],
      age: 22,
      nationality: "Germany",
      sourceTeam: "Liverpool",
      squadNumber: 7,
      sourceSquadRole: "CAM",
      preferredFoot: "right",
      weakFootRating: 4,
      skillMovesRating: 4
    });
    expect(wirtz.attributes.shortPassing).toBe(89);
    expect(wirtz.fc26Metadata).toMatchObject({
      potential: 91,
      valueEur: 132000000,
      wageEur: 230000,
      releaseClauseEur: 254100000,
      bodyType: "Lean",
      workRate: "High/Med",
      internationalReputation: 4,
      playerTraits: "Finesse Shot",
      playerTags: "#Dribbler",
      categoryPace: 82,
      positionRatings: { cam: 89, st: 86 }
    });
  });

  it("auto-detects FC26 headers and supports explicit format overrides", () => {
    const record = fc26Record({ player_positions: "CAM" });
    const csv = `${Object.keys(record).join(",")}\n${Object.values(record).join(",")}`;

    expect(parseFc25PlayersCsv(csv)).toHaveLength(1);
    expect(parseFc25PlayersCsv(csv, { format: "fc26" })[0]?.name).toBe("Florian Wirtz");
    expect(() => parseFc25PlayersCsv(csv, { format: "fc25" })).toThrow(Fc25ParseError);
  });

  it("derives stable FC26 display names without mutating source names", () => {
    expect(
      displayNameForFc25Player({
        id: "209331",
        sourceName: "Mohamed Salah Hamed Ghalyمحمد صلاح",
        sourceShortName: "M. Salah"
      })
    ).toBe("Mohamed Salah");
    expect(
      displayNameForFc25Player({
        id: "231866",
        sourceName: "Rodrigo Hernández Cascante",
        sourceShortName: "Rodri"
      })
    ).toBe("Rodri");
    expect(
      displayNameForFc25Player({
        id: "203376",
        sourceName: "Virgil van Dijk",
        sourceShortName: "V. van Dijk"
      })
    ).toBe("Virgil van Dijk");
    expect(
      displayNameForFc25Player({
        id: "240638",
        sourceName: "Tijjani Martinus Jan Reijnders Lekatompessy",
        sourceShortName: "T. Reijnders"
      })
    ).toBe("Tijjani Reijnders");
    expect(
      displayNameForFc25Player({
        id: "256675",
        sourceName: "Omar Khaled Mohamed Marmoush",
        sourceShortName: "O. Marmoush"
      })
    ).toBe("Omar Marmoush");
    expect(
      displayNameForFc25Player({
        id: "230621",
        sourceName: "Gianluigi Donnarumma",
        sourceShortName: "G. Donnarumma"
      })
    ).toBe("Gianluigi Donnarumma");
  });
});

function fc26Record(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    player_id: "256630",
    player_url: "https://sofifa.com/player/256630/florian-wirtz/260001",
    short_name: "F. Wirtz",
    long_name: "Florian Wirtz",
    player_positions: "CAM, ST, CM",
    overall: "89",
    potential: "91",
    value_eur: "132000000",
    wage_eur: "230000",
    age: "22",
    dob: "2003-05-03",
    height_cm: "177",
    weight_kg: "71",
    league_name: "Premier League",
    club_name: "Liverpool",
    club_position: "CAM",
    club_jersey_number: "7",
    nationality_name: "Germany",
    preferred_foot: "Right",
    weak_foot: "4",
    skill_moves: "4",
    international_reputation: "4",
    work_rate: "High/Med",
    body_type: "Lean",
    release_clause_eur: "254100000",
    player_tags: "#Dribbler",
    player_traits: "Finesse Shot",
    pace: "82",
    shooting: "84",
    passing: "88",
    dribbling: "91",
    defending: "52",
    physic: "70",
    attacking_crossing: "83",
    attacking_finishing: "88",
    attacking_heading_accuracy: "54",
    attacking_short_passing: "89",
    attacking_volleys: "83",
    skill_dribbling: "91",
    skill_curve: "87",
    skill_fk_accuracy: "80",
    skill_long_passing: "85",
    skill_ball_control: "92",
    movement_acceleration: "86",
    movement_sprint_speed: "79",
    movement_agility: "91",
    movement_reactions: "90",
    movement_balance: "88",
    power_shot_power: "82",
    power_jumping: "62",
    power_stamina: "82",
    power_strength: "67",
    power_long_shots: "86",
    mentality_aggression: "59",
    mentality_interceptions: "54",
    mentality_positioning: "91",
    mentality_vision: "91",
    mentality_penalties: "78",
    mentality_composure: "89",
    defending_marking_awareness: "50",
    defending_standing_tackle: "54",
    defending_sliding_tackle: "47",
    goalkeeping_diving: "13",
    goalkeeping_handling: "7",
    goalkeeping_kicking: "9",
    goalkeeping_positioning: "14",
    goalkeeping_reflexes: "11",
    goalkeeping_speed: "",
    ls: "86",
    st: "86+3",
    rs: "86",
    lw: "88",
    lf: "89",
    cf: "89",
    rf: "89",
    rw: "88",
    lam: "89",
    cam: "89",
    ram: "89",
    lm: "88",
    lcm: "88",
    cm: "88",
    rcm: "88",
    rm: "88",
    lwb: "78",
    ldm: "80",
    cdm: "80",
    rdm: "80",
    rwb: "78",
    lb: "74",
    lcb: "73",
    cb: "73",
    rcb: "73",
    rb: "74",
    gk: "22",
    ...overrides
  };
}
