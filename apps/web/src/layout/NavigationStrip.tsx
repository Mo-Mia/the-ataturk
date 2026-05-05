import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import type { MatchRunListResponse, PersistedMatchRun } from "../match/visualiser/runTypes";

interface SquadManagerContext {
  activeVersion: {
    id: string;
    name: string;
  } | null;
}

type LoadState = "loading" | "ready" | "error";

const NAV_ITEMS = [
  { id: "nav-link-dashboard", label: "Dashboard", to: "/" },
  { id: "nav-link-sim-runner", label: "Sim Runner", to: "/visualise/run" },
  { id: "nav-link-snapshot-replay", label: "Snapshot Replay", to: "/visualise" },
  { id: "nav-link-compare", label: "Compare", to: "/visualise/compare" },
  { id: "nav-link-squad-manager", label: "Squad Manager", to: "/admin/squad-manager", admin: true }
] as const;

export function NavigationStrip() {
  const location = useLocation();
  const [contextState, setContextState] = useState<LoadState>("loading");
  const [runsState, setRunsState] = useState<LoadState>("loading");
  const [activeDatasetName, setActiveDatasetName] = useState<string | null>(null);
  const [runs, setRuns] = useState<PersistedMatchRun[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext(): Promise<void> {
      try {
        const response = await fetch("/api/ai/squad-manager/context");
        if (!response.ok) {
          throw new Error(`Context failed with ${response.status}`);
        }
        const body = (await response.json()) as SquadManagerContext;
        if (!cancelled) {
          setActiveDatasetName(body.activeVersion?.name ?? null);
          setContextState("ready");
        }
      } catch {
        if (!cancelled) {
          setContextState("error");
          setActiveDatasetName(null);
        }
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns(): Promise<void> {
      try {
        const response = await fetch("/api/match-engine/runs?page=1&limit=10");
        if (!response.ok) {
          throw new Error(`Runs failed with ${response.status}`);
        }
        const body = (await response.json()) as MatchRunListResponse;
        if (!cancelled) {
          setRuns(body.runs);
          setRunsState("ready");
        }
      } catch {
        if (!cancelled) {
          setRuns([]);
          setRunsState("error");
        }
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestBatchId = useMemo(() => runs.find((run) => run.batchId)?.batchId ?? null, [runs]);
  const compareDisabled = runsState === "ready" && runs.length < 2;
  const compareTitle = compareDisabled ? "Compare needs at least two persisted runs" : undefined;
  const datasetLabel =
    contextState === "loading"
      ? "Dataset loading..."
      : contextState === "error"
        ? "Dataset unavailable"
        : activeDatasetName
          ? `Active dataset: ${activeDatasetName}`
          : "No active FC dataset";

  return (
    <header className="workbench-nav-shell" data-uat="workbench-navigation-shell">
      <nav className="workbench-nav" aria-label="Workbench navigation" data-uat="workbench-navigation">
        <div className="workbench-nav__links">
          {NAV_ITEMS.map((item) =>
            item.id === "nav-link-compare" && compareDisabled ? (
              <span
                key={item.id}
                id={item.id}
                className={`workbench-nav__link workbench-nav__link--disabled${
                  location.pathname === item.to ? " workbench-nav__link--active" : ""
                }`}
                role="link"
                aria-disabled="true"
                title={compareTitle}
                data-uat={item.id}
                data-state="disabled"
              >
                {item.label}
              </span>
            ) : (
              <NavLink
                key={item.id}
                id={item.id}
                to={item.to}
                end={item.to === "/" || item.to === "/visualise"}
                className={({ isActive }) =>
                  [
                    "workbench-nav__link",
                    isActive ? "workbench-nav__link--active" : "",
                    "admin" in item && item.admin ? "workbench-nav__link--admin" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                data-uat={item.id}
                data-state="enabled"
              >
                {"admin" in item && item.admin ? (
                  <span className="workbench-nav__badge">Admin</span>
                ) : null}
                {item.label}
              </NavLink>
            )
          )}
          {latestBatchId ? (
            <Link
              id="nav-link-latest-batch"
              className="workbench-nav__link workbench-nav__link--secondary"
              to={`/visualise/batch/${encodeURIComponent(latestBatchId)}`}
              data-uat="nav-link-latest-batch"
              data-state="enabled"
              data-batch-id={latestBatchId}
            >
              Latest Batch
            </Link>
          ) : (
            <span
              id="nav-link-latest-batch"
              className="workbench-nav__link workbench-nav__link--secondary workbench-nav__link--disabled"
              role="link"
              aria-disabled="true"
              title="No recent batch runs"
              data-uat="nav-link-latest-batch"
              data-state="disabled"
            >
              Latest Batch
            </span>
          )}
        </div>
        <p className="workbench-nav__context" data-uat="nav-context-line" data-state={contextState}>
          {datasetLabel}
        </p>
      </nav>
    </header>
  );
}
