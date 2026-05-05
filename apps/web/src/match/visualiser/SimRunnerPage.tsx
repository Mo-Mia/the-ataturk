import type { MatchDuration, TeamTactics } from "@the-ataturk/match-engine";
import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  LineupSelectionSummary,
  LineupWarning,
  MatchRunListResponse,
  PersistedMatchRun,
  RunLineupPlayer,
  SimError,
  SimResponse
} from "./runTypes";
import { playerDisplayName } from "./runTypes";

interface Fc25Club {
  id: string;
  name: string;
  short_name: string;
}

type TeamSide = "home" | "away";

interface SquadPlayer {
  id: string;
  name: string;
  shortName: string;
  displayName?: string;
  sourceName?: string;
  sourceShortName?: string | null;
  squadNumber?: number;
  overall: number;
  position: string;
  sourcePosition: string;
  alternativePositions: string[];
  preferredFoot: "left" | "right" | "either";
  weakFootRating: 1 | 2 | 3 | 4 | 5;
}

interface SquadResponse {
  clubId: string;
  formation: TeamTactics["formation"];
  roles: string[];
  squad: SquadPlayer[];
  autoXi: RunLineupPlayer[];
  bench: RunLineupPlayer[];
  warnings: LineupWarning[];
}

interface TeamSelectionState {
  squad: SquadPlayer[];
  autoXi: RunLineupPlayer[];
  bench: RunLineupPlayer[];
  selectedIds: string[];
  mode: "auto" | "manual";
  status: "idle" | "loading" | "error";
  error: string | null;
}

interface ScheduledSubState {
  id: string;
  minute: string;
  playerOutId: string;
  playerInId: string;
}

interface RunFilters {
  clubId: string;
  duration: "" | MatchDuration;
  formation: string;
  batchId: string;
  seed: string;
  from: string;
  to: string;
}

const DEFAULT_TACTICS: TeamTactics = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

const FORMATIONS = ["4-4-2", "4-3-1-2", "4-3-3", "4-2-3-1"] as const;
const MENTALITIES: TeamTactics["mentality"][] = ["balanced", "attacking", "defensive"];
const TEMPOS: TeamTactics["tempo"][] = ["normal", "fast", "slow"];
const PRESSING_LEVELS: TeamTactics["pressing"][] = ["medium", "high", "low"];
const LINE_HEIGHTS: TeamTactics["lineHeight"][] = ["normal", "high", "deep"];
const WIDTHS: TeamTactics["width"][] = ["normal", "wide", "narrow"];
const EMPTY_TEAM_SELECTION: TeamSelectionState = {
  squad: [],
  autoXi: [],
  bench: [],
  selectedIds: [],
  mode: "auto",
  status: "idle",
  error: null
};
const EMPTY_RUN_FILTERS: RunFilters = {
  clubId: "",
  duration: "",
  formation: "",
  batchId: "",
  seed: "",
  from: "",
  to: ""
};

export function SimRunnerPage() {
  const [clubs, setClubs] = useState<Fc25Club[]>([]);
  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const [homeTactics, setHomeTactics] = useState<TeamTactics>(DEFAULT_TACTICS);
  const [awayTactics, setAwayTactics] = useState<TeamTactics>(DEFAULT_TACTICS);
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [batch, setBatch] = useState<1 | 50>(1);
  const [duration, setDuration] = useState<MatchDuration>("full_90");
  const [autoSubs, setAutoSubs] = useState(true);
  const [homeSelection, setHomeSelection] = useState<TeamSelectionState>(EMPTY_TEAM_SELECTION);
  const [awaySelection, setAwaySelection] = useState<TeamSelectionState>(EMPTY_TEAM_SELECTION);
  const [homeScheduledSubs, setHomeScheduledSubs] = useState<ScheduledSubState[]>([]);
  const [awayScheduledSubs, setAwayScheduledSubs] = useState<ScheduledSubState[]>([]);
  const [history, setHistory] = useState<PersistedMatchRun[]>([]);
  const [runFilters, setRunFilters] = useState<RunFilters>(EMPTY_RUN_FILTERS);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<SimError[]>([]);
  const [status, setStatus] = useState<"loading-clubs" | "idle" | "running" | "error">(
    "loading-clubs"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbench(): Promise<void> {
      try {
        const [clubResponse, runResponse] = await Promise.all([
          fetch("/api/match-engine/clubs"),
          fetch(runHistoryUrl(EMPTY_RUN_FILTERS))
        ]);
        if (!clubResponse.ok) {
          throw new Error(`Club request failed with ${clubResponse.status}`);
        }
        if (!runResponse.ok) {
          throw new Error(`Run history request failed with ${runResponse.status}`);
        }
        const loadedClubs = (await clubResponse.json()) as Fc25Club[];
        const loadedRuns = (await runResponse.json()) as MatchRunListResponse;
        if (cancelled) {
          return;
        }
        setClubs(loadedClubs);
        setHistory(loadedRuns.runs);
        setHomeClubId(preferredClubId(loadedClubs, "liverpool") ?? loadedClubs[0]?.id ?? "");
        setAwayClubId(
          preferredClubId(loadedClubs, "manchester-city") ??
            loadedClubs.find((club) => club.id !== loadedClubs[0]?.id)?.id ??
            ""
        );
        setStatus("idle");
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(requestError instanceof Error ? requestError.message : "Could not load clubs");
      }
    }

    void loadWorkbench();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadSquad("home", homeClubId, homeTactics.formation);
  }, [homeClubId, homeTactics.formation]);

  useEffect(() => {
    void loadSquad("away", awayClubId, awayTactics.formation);
  }, [awayClubId, awayTactics.formation]);

  const canRun = useMemo(
    () =>
      status !== "running" &&
      homeClubId.length > 0 &&
      awayClubId.length > 0 &&
      seed.length > 0 &&
      validateSelection(homeSelection).valid &&
      validateSelection(awaySelection).valid &&
      validateScheduledSubs(homeScheduledSubs, homeSelection).valid &&
      validateScheduledSubs(awayScheduledSubs, awaySelection).valid,
    [
      awayClubId,
      awayScheduledSubs,
      awaySelection,
      homeClubId,
      homeScheduledSubs,
      homeSelection,
      seed,
      status
    ]
  );

  async function loadSquad(
    side: TeamSide,
    clubId: string,
    formation: TeamTactics["formation"]
  ): Promise<void> {
    const setSelection = side === "home" ? setHomeSelection : setAwaySelection;
    if (!clubId) {
      setSelection(EMPTY_TEAM_SELECTION);
      return;
    }

    setSelection((current) => ({ ...current, status: "loading", error: null }));
    try {
      const response = await fetch(
        `/api/match-engine/clubs/${encodeURIComponent(clubId)}/squad?formation=${encodeURIComponent(
          formation
        )}`
      );
      if (!response.ok) {
        throw new Error(`Squad request failed with ${response.status}`);
      }
      const squad = (await response.json()) as SquadResponse;
      const autoIds = squad.autoXi.map((player) => player.id);
      setSelection({
        squad: squad.squad,
        autoXi: squad.autoXi,
        bench: squad.bench,
        selectedIds: autoIds,
        mode: "auto",
        status: "idle",
        error: null
      });
    } catch (requestError) {
      setSelection((current) => ({
        ...current,
        status: "error",
        error: requestError instanceof Error ? requestError.message : "Could not load squad"
      }));
    }
  }

  async function loadRunHistory(filters: RunFilters): Promise<void> {
    try {
      const response = await fetch(runHistoryUrl(filters));
      if (!response.ok) {
        throw new Error(`Run history request failed with ${response.status}`);
      }
      const payload = (await response.json()) as MatchRunListResponse;
      setHistory(payload.runs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load run history");
    }
  }

  async function runSimulation(): Promise<void> {
    setStatus("running");
    setError(null);
    setRunErrors([]);

    try {
      const parsedSeed = Number(seed);
      if (!Number.isInteger(parsedSeed) || parsedSeed < 1) {
        throw new Error("Seed must be a positive integer");
      }

      const response = await fetch("/api/match-engine/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: {
            clubId: homeClubId,
            tactics: homeTactics,
            ...(homeSelection.mode === "manual"
              ? { startingPlayerIds: homeSelection.selectedIds }
              : {}),
            scheduledSubstitutions: scheduledSubPayload(homeScheduledSubs)
          },
          away: {
            clubId: awayClubId,
            tactics: awayTactics,
            ...(awaySelection.mode === "manual"
              ? { startingPlayerIds: awaySelection.selectedIds }
              : {}),
            scheduledSubstitutions: scheduledSubPayload(awayScheduledSubs)
          },
          seed: parsedSeed,
          batch,
          duration,
          autoSubs
        })
      });
      const payload = (await response.json()) as SimResponse | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : `Simulation failed with ${response.status}`
        );
      }

      setHistory((current) => [...payload.runs, ...current]);
      setRunErrors(payload.errors);
      setStatus("idle");
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Simulation failed");
    }
  }

  function updateTactics(side: TeamSide, nextTactics: TeamTactics): void {
    if (side === "home") {
      setHomeTactics(nextTactics);
    } else {
      setAwayTactics(nextTactics);
    }
  }

  return (
    <main className="sim-runner-shell" data-uat="sim-runner-page" data-state={status}>
      <header className="sim-runner-header">
        <div>
          <p className="eyebrow">Match Visualiser</p>
          <h1>FC25 Sim Runner</h1>
          <p className="sim-runner-note">Real FC25 squads, formation-aware XIs, batch output.</p>
        </div>
        <a className="sim-runner-link" href="/visualise">
          Replay panel
        </a>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {clubs.length === 0 && status !== "loading-clubs" ? (
        <p className="sim-runner-empty">No active FC25 dataset found. Import FC25 data first.</p>
      ) : null}

      <section
        className="sim-runner-grid"
        aria-label="Simulation setup"
        data-uat="sim-runner-setup"
      >
        <TeamPanel
          title="Home"
          clubs={clubs}
          clubId={homeClubId}
          tactics={homeTactics}
          selection={homeSelection}
          onClubChange={setHomeClubId}
          onTacticsChange={(nextTactics) => updateTactics("home", nextTactics)}
          onSelectionChange={setHomeSelection}
          scheduledSubs={homeScheduledSubs}
          onScheduledSubsChange={setHomeScheduledSubs}
        />
        <TeamPanel
          title="Away"
          clubs={clubs}
          clubId={awayClubId}
          tactics={awayTactics}
          selection={awaySelection}
          onClubChange={setAwayClubId}
          onTacticsChange={(nextTactics) => updateTactics("away", nextTactics)}
          onSelectionChange={setAwaySelection}
          scheduledSubs={awayScheduledSubs}
          onScheduledSubsChange={setAwayScheduledSubs}
        />
      </section>

      <section
        className="sim-runner-controls"
        aria-label="Run controls"
        data-uat="sim-runner-controls"
      >
        <label>
          Match duration
          <select
            value={duration}
            onChange={(event) => setDuration(event.target.value as MatchDuration)}
          >
            <option value="full_90">Full match (90 min)</option>
            <option value="second_half">Second half (calibrated)</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={autoSubs}
            onChange={(event) => setAutoSubs(event.target.checked)}
          />
          Auto Subs
        </label>
        <label>
          Seed
          <input
            type="number"
            min="1"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <button type="button" onClick={() => setSeed(String(randomSeed()))}>
          Random seed
        </button>
        <label>
          Batch
          <select
            value={batch}
            onChange={(event) => setBatch(Number(event.target.value) as 1 | 50)}
          >
            <option value={1}>1 run</option>
            <option value={50}>50 runs</option>
          </select>
        </label>
        <button type="button" onClick={() => void runSimulation()} disabled={!canRun}>
          {status === "running" ? "Running..." : "Run simulation"}
        </button>
      </section>

      {runErrors.length > 0 ? (
        <section className="sim-runner-errors" aria-label="Batch errors">
          <h2>Batch errors</h2>
          <ul>
            {runErrors.map((runError) => (
              <li key={runError.seed}>
                Seed {runError.seed}: {runError.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="sim-runner-history"
        aria-label="Run history"
        data-uat="sim-runner-history"
      >
        <h2>Run history</h2>
        <RunHistoryFilters
          clubs={clubs}
          filters={runFilters}
          onChange={setRunFilters}
          onApply={() => void loadRunHistory(runFilters)}
          onReset={() => {
            setRunFilters(EMPTY_RUN_FILTERS);
            void loadRunHistory(EMPTY_RUN_FILTERS);
          }}
        />
        {history.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <div className="sim-runner-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Seed</th>
                  <th>Duration</th>
                  <th>Score</th>
                  <th>Shots</th>
                  <th>Fouls</th>
                  <th>Cards</th>
                  <th>Possession</th>
                  <th>XI</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <Fragment key={run.id}>
                    <tr
                      key={run.id}
                      data-uat="sim-runner-run-row"
                      data-run-id={run.id}
                      data-artifact-id={run.artefactId}
                      data-batch-id={run.batchId ?? ""}
                    >
                      <td>{run.seed}</td>
                      <td>{durationLabel(run.summary.duration)}</td>
                      <td>
                        {run.summary.score.home}-{run.summary.score.away}
                      </td>
                      <td>
                        {run.summary.shots.home}/{run.summary.shots.away}
                      </td>
                      <td>
                        {run.summary.fouls.home}/{run.summary.fouls.away}
                      </td>
                      <td>
                        {run.summary.cards.home}/{run.summary.cards.away}
                      </td>
                      <td>
                        {run.summary.possession.home}%/{run.summary.possession.away}%
                      </td>
                      <td>
                        <button
                          type="button"
                          className="sim-runner-inline-button"
                          onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                        >
                          {expandedRunId === run.id ? "Hide XI" : "Show XI"}
                        </button>
                      </td>
                      <td>
                        <a href={`/visualise?artifact=${encodeURIComponent(run.artefactId)}`}>
                          Replay
                        </a>
                        {" · "}
                        <a href={`/visualise/compare?a=${encodeURIComponent(run.id)}`}>Compare</a>
                        {run.batchId ? (
                          <>
                            {" · "}
                            <a href={`/visualise/batch/${encodeURIComponent(run.batchId)}`}>
                              Batch
                            </a>
                          </>
                        ) : null}
                      </td>
                    </tr>
                    {expandedRunId === run.id ? (
                      <tr key={`${run.id}-xi`}>
                        <td colSpan={9}>
                          <LineupSummary run={run} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function LineupSummary({ run }: { run: PersistedMatchRun }) {
  const xi = run.summary.xi;
  if (!xi) {
    return <p className="sim-runner-note">XI not recorded for this run.</p>;
  }

  return (
    <>
      <div className="lineup-mode-summary">
        <span>Home: {selectionLabel(run.summary.xiSelection?.home)}</span>
        <span>Away: {selectionLabel(run.summary.xiSelection?.away)}</span>
        <span>Auto Subs: {run.summary.autoSubs === false ? "Off" : "On"}</span>
      </div>
      <div className="lineup-summary">
        <LineupColumn title="Home XI" players={xi.home} />
        <LineupColumn title="Away XI" players={xi.away} />
        {run.summary.bench ? (
          <>
            <LineupColumn title="Home bench" players={run.summary.bench.home} />
            <LineupColumn title="Away bench" players={run.summary.bench.away} />
          </>
        ) : null}
      </div>
      <SubstitutionSummary run={run} />
      <SetPieceSummary run={run} />
    </>
  );
}

function SetPieceSummary({ run }: { run: PersistedMatchRun }) {
  const home = run.summary.setPieces?.home;
  const away = run.summary.setPieces?.away;
  if (!home || !away) {
    return <p className="sim-runner-note">Set-piece data not recorded.</p>;
  }

  return (
    <p className="sim-runner-note">
      Set pieces: corners {home.corners}/{away.corners}, free kicks{" "}
      {home.directFreeKicks + home.indirectFreeKicks}/
      {away.directFreeKicks + away.indirectFreeKicks}, penalties {home.penalties}/{away.penalties},
      set-piece goals {home.setPieceGoals}/{away.setPieceGoals}.
    </p>
  );
}

function SubstitutionSummary({ run }: { run: PersistedMatchRun }) {
  const substitutions = run.summary.substitutions;
  const home = substitutions?.home ?? [];
  const away = substitutions?.away ?? [];
  if (home.length === 0 && away.length === 0) {
    return <p className="sim-runner-note">No substitutions recorded.</p>;
  }

  return (
    <div className="lineup-summary">
      <SubstitutionColumn title="Home substitutions" substitutions={home} />
      <SubstitutionColumn title="Away substitutions" substitutions={away} />
    </div>
  );
}

function SubstitutionColumn({
  title,
  substitutions
}: {
  title: string;
  substitutions: NonNullable<PersistedMatchRun["summary"]["substitutions"]>["home"];
}) {
  return (
    <section>
      <h3>{title}</h3>
      {substitutions.length === 0 ? (
        <p className="sim-runner-note">None</p>
      ) : (
        <ol>
          {substitutions.map((substitution) => (
            <li
              key={`${substitution.playerOutId}-${substitution.playerInId}-${substitution.minute}`}
            >
              {substitution.minute}: {substitution.playerOutId} to {substitution.playerInId} (
              {substitution.reason})
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LineupColumn({
  title,
  players
}: {
  title: string;
  players: NonNullable<PersistedMatchRun["summary"]["xi"]>["home"];
}) {
  return (
    <section>
      <h3>{title}</h3>
      <ol>
        {players.map((player) => (
          <li key={player.id}>
            {player.position} · {playerDisplayName(player)}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RunHistoryFilters({
  clubs,
  filters,
  onChange,
  onApply,
  onReset
}: {
  clubs: Fc25Club[];
  filters: RunFilters;
  onChange: (filters: RunFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="run-history-filters" aria-label="Run history filters">
      <label>
        Club
        <select
          value={filters.clubId}
          onChange={(event) => onChange({ ...filters, clubId: event.target.value })}
        >
          <option value="">Any club</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Duration
        <select
          value={filters.duration}
          onChange={(event) =>
            onChange({ ...filters, duration: event.target.value as RunFilters["duration"] })
          }
        >
          <option value="">Any duration</option>
          <option value="full_90">Full match</option>
          <option value="second_half">Second half</option>
        </select>
      </label>
      <label>
        Formation
        <select
          value={filters.formation}
          onChange={(event) => onChange({ ...filters, formation: event.target.value })}
        >
          <option value="">Any formation</option>
          {FORMATIONS.map((formation) => (
            <option key={formation} value={formation}>
              {formatOption(formation)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Batch ID
        <input
          value={filters.batchId}
          onChange={(event) => onChange({ ...filters, batchId: event.target.value })}
        />
      </label>
      <label>
        Seed
        <input
          type="number"
          min="1"
          value={filters.seed}
          onChange={(event) => onChange({ ...filters, seed: event.target.value })}
        />
      </label>
      <label>
        From
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>
      <button type="button" onClick={onApply}>
        Apply filters
      </button>
      <button type="button" onClick={onReset}>
        Reset filters
      </button>
    </div>
  );
}

function TeamPanel({
  title,
  clubs,
  clubId,
  tactics,
  selection,
  onClubChange,
  onTacticsChange,
  onSelectionChange,
  scheduledSubs,
  onScheduledSubsChange
}: {
  title: string;
  clubs: Fc25Club[];
  clubId: string;
  tactics: TeamTactics;
  selection: TeamSelectionState;
  onClubChange: (clubId: string) => void;
  onTacticsChange: (tactics: TeamTactics) => void;
  onSelectionChange: (selection: TeamSelectionState) => void;
  scheduledSubs: ScheduledSubState[];
  onScheduledSubsChange: (substitutions: ScheduledSubState[]) => void;
}) {
  return (
    <section
      className="sim-runner-panel"
      aria-label={`${title} team setup`}
      data-uat="sim-runner-team-panel"
      data-team-side={title.toLowerCase()}
      data-club-id={clubId}
    >
      <h2>{title}</h2>
      <label>
        Club
        <select value={clubId} onChange={(event) => onClubChange(event.target.value)}>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>
      <TacticsControls tactics={tactics} onChange={onTacticsChange} />
      <SquadPicker title={`${title} squad`} selection={selection} onChange={onSelectionChange} />
      <ScheduledSubsPanel
        title={`${title} scheduled substitutions`}
        selection={selection}
        substitutions={scheduledSubs}
        onChange={onScheduledSubsChange}
      />
    </section>
  );
}

function ScheduledSubsPanel({
  title,
  selection,
  substitutions,
  onChange
}: {
  title: string;
  selection: TeamSelectionState;
  substitutions: ScheduledSubState[];
  onChange: (substitutions: ScheduledSubState[]) => void;
}) {
  const starters = selection.selectedIds
    .map((playerId) => selection.squad.find((player) => player.id === playerId))
    .filter((player): player is SquadPlayer => Boolean(player));
  const bench = selection.squad.filter((player) => !selection.selectedIds.includes(player.id));
  const validation = validateScheduledSubs(substitutions, selection);

  function updateSubstitution(id: string, patch: Partial<ScheduledSubState>): void {
    onChange(
      substitutions.map((substitution) =>
        substitution.id === id ? { ...substitution, ...patch } : substitution
      )
    );
  }

  function addSubstitution(): void {
    if (substitutions.length >= 5) {
      return;
    }
    onChange([
      ...substitutions,
      {
        id: String(Date.now() + substitutions.length),
        minute: "65",
        playerOutId: starters.find((player) => player.sourcePosition !== "GK")?.id ?? "",
        playerInId: bench.find((player) => player.sourcePosition !== "GK")?.id ?? ""
      }
    ]);
  }

  return (
    <section className="scheduled-subs" aria-label={title} data-uat="sim-runner-scheduled-subs">
      <div className="squad-picker-header">
        <div>
          <h3>{title}</h3>
          <p>Pre-match scheduled only. Manual picks override Auto Subs.</p>
        </div>
        <button type="button" onClick={addSubstitution} disabled={substitutions.length >= 5}>
          Add sub
        </button>
      </div>
      {!validation.valid ? <p className="error">{validation.message}</p> : null}
      {substitutions.length === 0 ? (
        <p className="sim-runner-note">No scheduled substitutions.</p>
      ) : (
        <div className="scheduled-subs-list">
          {substitutions.map((substitution) => (
            <div className="scheduled-sub-row" key={substitution.id}>
              <label>
                Minute
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={substitution.minute}
                  onChange={(event) =>
                    updateSubstitution(substitution.id, { minute: event.target.value })
                  }
                />
              </label>
              <label>
                Off
                <select
                  value={substitution.playerOutId}
                  onChange={(event) =>
                    updateSubstitution(substitution.id, { playerOutId: event.target.value })
                  }
                >
                  <option value="">Select starter</option>
                  {starters.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerDisplayName(player)} ({player.sourcePosition})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                On
                <select
                  value={substitution.playerInId}
                  onChange={(event) =>
                    updateSubstitution(substitution.id, { playerInId: event.target.value })
                  }
                >
                  <option value="">Select bench player</option>
                  {bench.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerDisplayName(player)} ({player.sourcePosition})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange(substitutions.filter((candidate) => candidate.id !== substitution.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SquadPicker({
  title,
  selection,
  onChange
}: {
  title: string;
  selection: TeamSelectionState;
  onChange: (selection: TeamSelectionState) => void;
}) {
  const validation = validateSelection(selection);
  const selected = new Set(selection.selectedIds);

  function setSelectedIds(
    selectedIds: string[],
    mode: TeamSelectionState["mode"] = "manual"
  ): void {
    onChange({ ...selection, selectedIds, mode });
  }

  function togglePlayer(playerId: string): void {
    const next = selected.has(playerId)
      ? selection.selectedIds.filter((id) => id !== playerId)
      : [...selection.selectedIds, playerId];
    setSelectedIds(next);
  }

  function resetToAuto(): void {
    setSelectedIds(
      selection.autoXi.map((player) => player.id),
      "auto"
    );
  }

  function autoFillRemainder(): void {
    // Manual picks stay locked; the current auto selector fills remaining starter slots.
    const manualIds = selection.selectedIds.filter((id) =>
      selection.squad.some((player) => player.id === id)
    );
    const nextIds = [...manualIds];
    for (const player of selection.autoXi) {
      if (nextIds.length >= 11) {
        break;
      }
      if (!nextIds.includes(player.id)) {
        nextIds.push(player.id);
      }
    }
    for (const player of [...selection.squad].sort(
      (a, b) => b.overall - a.overall || a.id.localeCompare(b.id)
    )) {
      if (nextIds.length >= 11) {
        break;
      }
      if (!nextIds.includes(player.id)) {
        nextIds.push(player.id);
      }
    }
    setSelectedIds(nextIds.slice(0, 11));
  }

  return (
    <section className="squad-picker" aria-label={title} data-uat="sim-runner-squad-picker">
      <div className="squad-picker-header">
        <div>
          <h3>{title}</h3>
          <p>
            {selection.selectedIds.length} / 11 selected ·{" "}
            {selection.mode === "auto" ? "Auto XI" : "Manual XI"}
          </p>
        </div>
        <div className="squad-picker-actions">
          <button type="button" onClick={autoFillRemainder}>
            Auto-fill remainder
          </button>
          <button type="button" onClick={resetToAuto}>
            Reset to auto XI
          </button>
        </div>
      </div>
      {selection.status === "loading" ? <p>Loading squad...</p> : null}
      {selection.error ? <p className="error">{selection.error}</p> : null}
      {!validation.valid ? <p className="error">{validation.message}</p> : null}
      <div className="squad-picker-list">
        {selection.squad.map((player) => (
          <label
            key={player.id}
            className="squad-picker-row"
            data-uat="sim-runner-squad-player"
            data-player-id={player.id}
            data-display-name={playerDisplayName(player)}
            data-source-name={player.sourceName ?? player.name}
          >
            <input
              type="checkbox"
              checked={selected.has(player.id)}
              onChange={() => togglePlayer(player.id)}
            />
            <span>{playerDisplayName(player)}</span>
            <span>{player.sourcePosition}</span>
            <span>{player.overall}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function TacticsControls({
  tactics,
  onChange
}: {
  tactics: TeamTactics;
  onChange: (tactics: TeamTactics) => void;
}) {
  return (
    <div className="sim-runner-tactics">
      <SelectField
        label="Formation"
        value={tactics.formation}
        options={FORMATIONS}
        onChange={(formation) => onChange({ ...tactics, formation })}
      />
      <SelectField
        label="Mentality"
        value={tactics.mentality}
        options={MENTALITIES}
        onChange={(mentality) => onChange({ ...tactics, mentality })}
      />
      <SelectField
        label="Tempo"
        value={tactics.tempo}
        options={TEMPOS}
        onChange={(tempo) => onChange({ ...tactics, tempo })}
      />
      <SelectField
        label="Pressing"
        value={tactics.pressing}
        options={PRESSING_LEVELS}
        onChange={(pressing) => onChange({ ...tactics, pressing })}
      />
      <SelectField
        label="Line height"
        value={tactics.lineHeight}
        options={LINE_HEIGHTS}
        onChange={(lineHeight) => onChange({ ...tactics, lineHeight })}
      />
      <SelectField
        label="Width"
        value={tactics.width}
        options={WIDTHS}
        onChange={(width) => onChange({ ...tactics, width })}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function preferredClubId(clubs: Fc25Club[], clubId: string): string | null {
  return clubs.find((club) => club.id === clubId)?.id ?? null;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 999_999) + 1;
}

function formatOption(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function durationLabel(value: MatchDuration | undefined): string {
  return value === "full_90" ? "Full match" : "Second half";
}

function selectionLabel(selection: LineupSelectionSummary | undefined): string {
  if (!selection) {
    return "XI mode not recorded";
  }
  const warningText =
    selection.warnings.length === 0 ? "no warnings" : `${selection.warnings.length} warning(s)`;
  return `${selection.mode === "manual" ? "Manual XI" : "Auto XI"} (${warningText})`;
}

function scheduledSubPayload(substitutions: ScheduledSubState[]): Array<{
  minute: number;
  playerOutId: string;
  playerInId: string;
}> {
  return substitutions.map((substitution) => ({
    minute: Number(substitution.minute),
    playerOutId: substitution.playerOutId,
    playerInId: substitution.playerInId
  }));
}

function validateSelection(selection: TeamSelectionState): {
  valid: boolean;
  message: string | null;
} {
  if (selection.status === "loading") {
    return { valid: false, message: null };
  }
  if (selection.squad.length === 0) {
    return { valid: false, message: null };
  }
  if (selection.selectedIds.length !== 11) {
    return {
      valid: false,
      message: `Select exactly 11 starters; currently selected ${selection.selectedIds.length}.`
    };
  }
  const uniqueIds = new Set(selection.selectedIds);
  if (uniqueIds.size !== selection.selectedIds.length) {
    return { valid: false, message: "Starting XI contains duplicate players." };
  }
  const players = selection.selectedIds
    .map((playerId) => selection.squad.find((player) => player.id === playerId))
    .filter((player): player is SquadPlayer => Boolean(player));
  if (players.length !== selection.selectedIds.length) {
    return { valid: false, message: "Starting XI contains a player outside the loaded squad." };
  }
  const goalkeeperCount = players.filter((player) => player.sourcePosition === "GK").length;
  if (goalkeeperCount !== 1) {
    return {
      valid: false,
      message: `Select exactly one goalkeeper; currently selected ${goalkeeperCount}.`
    };
  }
  return { valid: true, message: null };
}

function validateScheduledSubs(
  substitutions: ScheduledSubState[],
  selection: TeamSelectionState
): { valid: boolean; message: string | null } {
  if (substitutions.length > 5) {
    return { valid: false, message: "A team cannot schedule more than 5 substitutions." };
  }
  const starterIds = new Set(selection.selectedIds);
  const benchIds = new Set(
    selection.squad.filter((player) => !starterIds.has(player.id)).map((player) => player.id)
  );
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();

  for (const substitution of substitutions) {
    const minute = Number(substitution.minute);
    if (!Number.isInteger(minute) || minute < 1 || minute > 90) {
      return { valid: false, message: "Scheduled substitution minute must be 1-90." };
    }
    if (!starterIds.has(substitution.playerOutId)) {
      return { valid: false, message: "Each scheduled player off must be in the selected XI." };
    }
    if (!benchIds.has(substitution.playerInId)) {
      return { valid: false, message: "Each scheduled player on must be on the bench." };
    }
    if (usedOut.has(substitution.playerOutId)) {
      return { valid: false, message: "A starter cannot be scheduled off more than once." };
    }
    if (usedIn.has(substitution.playerInId)) {
      return { valid: false, message: "A bench player cannot be scheduled on more than once." };
    }
    usedOut.add(substitution.playerOutId);
    usedIn.add(substitution.playerInId);
  }

  return { valid: true, message: null };
}

function runHistoryUrl(filters: RunFilters): string {
  const params = new URLSearchParams({ page: "1", limit: "50" });
  for (const [key, value] of Object.entries(filters) as Array<[keyof RunFilters, string]>) {
    if (value.length === 0) {
      continue;
    }
    params.set(key, key === "from" || key === "to" ? new Date(value).toISOString() : value);
  }
  return `/api/match-engine/runs?${params.toString()}`;
}
