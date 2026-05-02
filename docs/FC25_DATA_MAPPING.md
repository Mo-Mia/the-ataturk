# FC25 Data Mapping — FootSim Phase 1

Last updated: 2026-05-02

This document fixes the sprint-1 mapping from `data/fc-25/male_players.csv`
to the existing match-engine `PlayerInputV2` boundary. It is intentionally
limited to five hardcoded Premier League clubs and second-half-only simulation.

## Source Files

Authoritative sprint-1 source:

- `data/fc-25/male_players.csv`

Out of scope for this sprint:

- `data/fc-25/players_data-2025_2026.csv`
- `data/fc-25/players_data_light-2025_2026.csv`

Those two files are FBref-style performance data, not FC25 rating data. They
are not ingested in Phase 1.

## Club Whitelist

The CSV has no numeric team id column. `fc25_team_id` therefore stores the
source `Team` label.

| UI name | App club id | CSV `Team` | CSV count | Sprint import |
| --- | --- | --- | ---: | ---: |
| Arsenal | `arsenal` | `Arsenal` | 28 | top 25 by `OVR` |
| Manchester City | `manchester-city` | `Manchester City` | 28 | top 25 by `OVR` |
| Manchester United | `manchester-united` | `Man Utd` | 32 | top 25 by `OVR` |
| Liverpool | `liverpool` | `Liverpool` | 45 | top 25 by `OVR` |
| Aston Villa | `aston-villa` | `Aston Villa` | 28 | top 25 by `OVR` |

Expected import total: 125 players.

## CSV → PlayerInputV2 Mapping

### Identity and metadata

| CSV column | Destination |
| --- | --- |
| `url` trailing numeric id | player `id` source component and `fc25_player_id` |
| `Name` | `name`, `shortName` |
| `OVR` | stored as `overall`; used for import cap and starter selection |
| `Position` | `position` after engine mapping |
| `Alternative positions` | stored as text/list metadata |
| `Height` | `height` in cm, parsed from the metric prefix |
| `Weight` | `weight` in kg, parsed from the metric prefix |
| `Age` | `age` |
| `Preferred foot` | `preferredFoot` (`Left`/`Right` -> `left`/`right`) |
| `Weak foot` | `weakFootRating` |
| `Skill moves` | `skillMovesRating` |
| `Nation` | stored as `nationality` metadata |
| `League` | stored on club as `league` |
| `Team` | source team join key and `fc25_team_id` |

`male_players.csv` does not contain shirt numbers, so `fc25_squads.shirt_number`
is nullable and remains null in this sprint.

### Attribute mapping

| CSV column | `PlayerInputV2.attributes` field |
| --- | --- |
| `Acceleration` | `acceleration` |
| `Sprint Speed` | `sprintSpeed` |
| `Finishing` | `finishing` |
| `Shot Power` | `shotPower` |
| `Long Shots` | `longShots` |
| `Positioning` | `positioning` |
| `Volleys` | `volleys` |
| `Penalties` | `penalties` |
| `Vision` | `vision` |
| `Crossing` | `crossing` |
| `Free Kick Accuracy` | `freeKickAccuracy` |
| `Short Passing` | `shortPassing` |
| `Long Passing` | `longPassing` |
| `Curve` | `curve` |
| `Dribbling` | `dribbling` |
| `Agility` | `agility` |
| `Balance` | `balance` |
| `Reactions` | `reactions` |
| `Ball Control` | `ballControl` |
| `Composure` | `composure` |
| `Interceptions` | `interceptions` |
| `Heading Accuracy` | `headingAccuracy` |
| `Def Awareness` | `defensiveAwareness` |
| `Standing Tackle` | `standingTackle` |
| `Sliding Tackle` | `slidingTackle` |
| `Jumping` | `jumping` |
| `Stamina` | `stamina` |
| `Strength` | `strength` |
| `Aggression` | `aggression` |

### Goalkeeper attributes

| CSV column | `PlayerInputV2.gkAttributes` field |
| --- | --- |
| `GK Diving` | `gkDiving` |
| `GK Handling` | `gkHandling` |
| `GK Kicking` | `gkKicking` |
| `GK Positioning` | `gkPositioning` |
| `GK Reflexes` | `gkReflexes` |

GK attributes are required for rows whose mapped primary position is `GK`.
They are nullable in storage for outfield rows.

## Position Mapping

The match-engine v2 boundary accepts:

`GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LM`, `RM`, `LW`, `RW`, `ST`

Mapping from FC25 CSV:

| CSV position | Engine position |
| --- | --- |
| `GK` | `GK` |
| `CB` | `CB` |
| `LB` | `LB` |
| `RB` | `RB` |
| `CDM` | `DM` |
| `CM` | `CM` |
| `CAM` | `AM` |
| `LM` | `LM` |
| `RM` | `RM` |
| `LW` | `LW` |
| `RW` | `RW` |
| `ST` | `ST` |

## Tactics and Formation UI

Verified from `packages/match-engine/src/types.ts`:

```ts
interface TeamTactics {
  formation: string;
  mentality: "defensive" | "balanced" | "attacking";
  tempo: "slow" | "normal" | "fast";
  pressing: "low" | "medium" | "high";
  lineHeight: "deep" | "normal" | "high";
  width: "narrow" | "normal" | "wide";
}
```

Formation support verified from `packages/match-engine/src/utils/formations.ts`:

- Exact templates: `4-4-2`, `4-3-1-2`
- Generic numeric parser: any formation with at least three positive numeric
  lines, including `4-3-3` and `4-2-3-1`

Sprint-1 UI formation options:

- `4-4-2`
- `4-3-1-2`
- `4-3-3`
- `4-2-3-1`

## Starter XI Compromise

The imported starting XI is formation-neutral and locked at ingest time. It is
reused across all tactical formations in this sprint.

Selection order:

1. best GK
2. LB, 2 CB, RB
3. DM/CDM
4. 2 CM/AM
5. left wide player
6. right wide player
7. ST
8. fallback missing slots with highest-OVR remaining outfield players

Rows after the XI are assigned `sub` until seven substitutes are filled, then
`reserve`. Formation-aware XI selection is deferred until the workbench grows
squad/role selection.

## Implementation Commit Sequence

1. `docs: record FootSim phase 1 scope and FC25 mapping`
2. `feat(data): add FC25 schema parser and types`
3. `feat(data): adapt FC25 rows to engine v2 players`
   - contains the row → `PlayerInputV2` adapter
   - contains the five golden tests: Ødegaard, Rodri or Haaland, Bruno
     Fernandes, Alisson, Emiliano Martínez
4. `feat(data): add FC25 import service and CLI`
5. `feat(server): add match-engine simulation endpoint`
6. `feat(web): add FC25 sim runner workbench`
7. `feat(web): allow visualiser artifact query loading`

If the final implementation needs a status-doc refresh, include it in commit 7
unless it is large enough to merit a separate docs-only follow-up.

