# FC25 Formation-Aware XI Selection

Last updated: 2026-05-02 22:05 SAST

## Purpose

FootSim Phase 3 selects the starting XI at simulate time from the full imported
FC25 squad. The importer still stores `fc25_squads.squad_role` for backward
compatibility, but the simulate endpoint no longer uses that role as lineup
truth.

## Supported Formations

The selector supports the same four formations exposed by the workbench:

- `4-4-2`
- `4-3-1-2`
- `4-3-3`
- `4-2-3-1`

Role order is the engine line order. For the two known engine templates
(`4-4-2`, `4-3-1-2`) this follows the existing coordinate ordering. For generic
engine templates (`4-3-3`, `4-2-3-1`) this follows left-to-right generated
formation lines.

## Role Templates

| Formation | Roles |
| --- | --- |
| `4-4-2` | GK, RB, CB, CB, LB, RM, CM, CM, LM, ST, ST |
| `4-3-1-2` | GK, RB, CB, CB, LB, CM, DM, CM, AM, ST, ST |
| `4-3-3` | GK, LB, CB, CB, RB, DM, CM, CM, LW, ST, RW |
| `4-2-3-1` | GK, LB, CB, CB, RB, DM, DM, LW, AM, RW, ST |

## Selection Rules

For each role slot:

1. Pick the highest-overall unselected player whose FC25 primary position
   matches the role.
2. If no primary match exists, pick the highest-overall unselected player whose
   alternative positions include the role.
3. If no alternative-position match exists, use the adjacency fallback table.
4. Tie-break by `overall desc`, then `id asc`.

The selected player is cloned with `position` set to the role-in-XI for that run.
This is the position the engine receives and the position persisted in
`match_runs.summary.xi`.

## Adjacency Fallbacks

| Role | Fallback positions |
| --- | --- |
| GK | none |
| LB | CB, RB |
| RB | CB, LB |
| CB | RB, LB, DM |
| DM | CM, CB, AM |
| CM | DM, AM, LM, RM |
| AM | CM, LW, RW, ST |
| LM | LW, CM, AM, RM |
| RM | RW, CM, AM, LM |
| LW | LM, RW, ST, AM |
| RW | RM, LW, ST, AM |
| ST | LW, RW, AM |

If no player can be selected for a role, the selector throws
`Fc25LineupSelectionError`.

## Persistence

Persisted run summaries store rich XI entries:

```ts
{
  id: string;
  name: string;
  shortName: string;
  position: Position; // role-in-XI for this run
  squadNumber?: number;
}
```

This keeps historical run display stable even if FC25 data is re-imported later.
