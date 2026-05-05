import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ApplyDialog } from "../components/ApplyDialog";
import { PlayerEditorWidget } from "../components/PlayerEditorWidget";
import { SquadList } from "../components/SquadList";
import {
  VerificationPanel,
  classifySuggestionRisk,
  type SuggestionRiskLevel
} from "../components/VerificationPanel";
import {
  activateFc25DatasetVersion,
  applySquadSuggestions,
  getSquadManagerContext,
  getSquadManagerSquad,
  verifySquad,
  type Fc25SquadPlayer,
  type SquadManagerSuggestion,
  type VerifySquadResponse
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import "../styles/squad-manager.css";

export function AdminSquadManagerPage() {
  const queryClient = useQueryClient();
  const [datasetVersionId, setDatasetVersionId] = useState<string>("");
  const [homeClubId, setHomeClubId] = useState("liverpool");
  const [awayClubId, setAwayClubId] = useState("manchester-city");
  const [focusedClubId, setFocusedClubId] = useState("liverpool");
  const [verification, setVerification] = useState<VerifySquadResponse | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [inspectedSuggestion, setInspectedSuggestion] = useState<SquadManagerSuggestion | null>(
    null
  );
  const [applyOpen, setApplyOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(true);
  const [pendingApplyRisk, setPendingApplyRisk] = useState<SuggestionRiskLevel>("low");
  const [applyResult, setApplyResult] = useState<{
    state: "success" | "error";
    message: string;
    newDatasetVersionId?: string;
  } | null>(null);

  const contextQuery = useQuery({
    queryKey: queryKeys.squadManagerContext,
    queryFn: getSquadManagerContext
  });

  useEffect(() => {
    if (!datasetVersionId && contextQuery.data?.activeVersion) {
      setDatasetVersionId(contextQuery.data.activeVersion.id);
    }
  }, [contextQuery.data?.activeVersion, datasetVersionId]);

  const homeSquadQuery = useQuery({
    queryKey: queryKeys.squadManagerSquad(homeClubId, datasetVersionId),
    queryFn: () => getSquadManagerSquad(homeClubId, datasetVersionId),
    enabled: Boolean(homeClubId && datasetVersionId)
  });
  const awaySquadQuery = useQuery({
    queryKey: queryKeys.squadManagerSquad(awayClubId, datasetVersionId),
    queryFn: () => getSquadManagerSquad(awayClubId, datasetVersionId),
    enabled: Boolean(awayClubId && datasetVersionId)
  });

  const verifyMutation = useMutation({
    mutationFn: verifySquad,
    onSuccess: (result) => {
      setVerification(result);
      setAcceptedIds(
        new Set(allSuggestionsFrom(result).filter(isLowRisk).map((item) => item.suggestionId))
      );
      setInspectedSuggestion(null);
      setApplyResult(null);
    }
  });

  const applyMutation = useMutation({
    mutationFn: applySquadSuggestions,
    onSuccess: async (result) => {
      setApplyOpen(false);
      const appliedIds = new Set(result.audit.suggestionIds);
      setAcceptedIds((current) => {
        const next = new Set(current);
        for (const suggestionId of appliedIds) {
          next.delete(suggestionId);
        }
        return next;
      });
      setVerification((current) => (current ? removeSuggestions(current, appliedIds) : current));
      setApplyResult({
        state: "success",
        message: result.idempotent
          ? `These suggestions were already applied in ${result.newDatasetVersionId}.`
          : `Created inactive dataset version ${result.newDatasetVersionId}.`,
        newDatasetVersionId: result.newDatasetVersionId
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.squadManagerContext });
    },
    onError: (error) => {
      setApplyResult({
        state: "error",
        message: error instanceof Error ? error.message : "Apply failed"
      });
    }
  });

  const activateMutation = useMutation({
    mutationFn: activateFc25DatasetVersion,
    onSuccess: async (result) => {
      setDatasetVersionId(result.id);
      setApplyResult({
        state: "success",
        message: `Activated dataset version ${result.id}.`,
        newDatasetVersionId: result.id
      });
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      setApplyResult({
        state: "error",
        message: error instanceof Error ? error.message : "Activation failed"
      });
    }
  });

  const allSuggestions = useMemo(() => {
    if (!verification) {
      return [];
    }
    return [
      ...verification.verification.missingPlayers,
      ...verification.verification.suggestions,
      ...verification.verification.attributeWarnings
    ];
  }, [verification]);

  const acceptedSuggestions = allSuggestions.filter((suggestion) =>
    acceptedIds.has(suggestion.suggestionId)
  );
  const selectedLowRiskSuggestions = acceptedSuggestions.filter(isLowRisk);
  const applyAvailable = selectedLowRiskSuggestions.length > 0 && !reviewMode;
  const focusedSquad =
    focusedClubId === homeClubId
      ? (homeSquadQuery.data?.squad ?? [])
      : focusedClubId === awayClubId
        ? (awaySquadQuery.data?.squad ?? [])
        : [];

  function toggleAccepted(suggestionId: string): void {
    setAcceptedIds((current) => {
      const next = new Set(current);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  }

  function toggleAcceptedMany(suggestionIds: string[], shouldAccept: boolean): void {
    setAcceptedIds((current) => {
      const next = new Set(current);
      for (const suggestionId of suggestionIds) {
        if (shouldAccept) {
          next.add(suggestionId);
        } else {
          next.delete(suggestionId);
        }
      }
      return next;
    });
  }

  function runVerification(): void {
    verifyMutation.mutate({ clubId: focusedClubId, datasetVersionId });
  }

  function applyAccepted(): void {
    if (reviewMode || pendingApplyRisk !== "low") {
      return;
    }
    applyMutation.mutate({
      clubId: focusedClubId,
      datasetVersionId,
      riskLevel: "low",
      suggestions: selectedLowRiskSuggestions
    });
  }

  useEffect(() => {
    if (reviewMode) {
      setApplyOpen(false);
    }
  }, [reviewMode]);

  function inspectSuggestion(suggestion: SquadManagerSuggestion | null): void {
    setInspectedSuggestion(suggestion);
  }

  function openApplyDialog(riskLevel: SuggestionRiskLevel): void {
    if (riskLevel !== "low") {
      return;
    }
    setPendingApplyRisk(riskLevel);
    setApplyOpen(true);
  }

  function localPlayerForSuggestion(
    suggestion: SquadManagerSuggestion
  ): Fc25SquadPlayer | undefined {
    if (suggestion.type === "player_addition") {
      return undefined;
    }
    return focusedSquad.find((player) => player.id === suggestion.playerId);
  }

  const clubs = contextQuery.data?.clubs ?? [];
  const focusedClub = clubs.find((club) => club.id === focusedClubId);
  const focusedFootballData = focusedClub?.footballData;
  const selectedDatasetVersion = contextQuery.data?.datasetVersions.find(
    (version) => version.id === datasetVersionId
  );

  return (
    <section
      className="squad-manager"
      data-uat="squad-manager-page"
      data-state={contextQuery.isLoading ? "loading" : "ready"}
    >
      <header className="squad-manager__masthead">
        <div>
          <p>FootSim Admin</p>
          <h1>Squad Manager</h1>
        </div>
        <button
          type="button"
          onClick={runVerification}
          disabled={!datasetVersionId || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify squad"}
        </button>
      </header>

      <section className="squad-manager__controls" aria-label="Squad manager controls">
        <label>
          Dataset
          <select
            data-uat="squad-manager-dataset-select"
            value={datasetVersionId}
            onChange={(event) => setDatasetVersionId(event.target.value)}
          >
            {(contextQuery.data?.datasetVersions ?? []).map((version) => (
              <option key={version.id} value={version.id}>
                {datasetVersionLabel(version)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => activateMutation.mutate(datasetVersionId)}
            disabled={
              !datasetVersionId ||
              selectedDatasetVersion?.is_active === true ||
              activateMutation.isPending
            }
          >
            {activateMutation.isPending ? "Activating..." : "Activate selected"}
          </button>
        </label>
        <label>
          Home club
          <select
            data-uat="squad-manager-home-club-select"
            value={homeClubId}
            onChange={(event) => setHomeClubId(event.target.value)}
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Away club
          <select
            data-uat="squad-manager-away-club-select"
            value={awayClubId}
            onChange={(event) => setAwayClubId(event.target.value)}
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Verify
          <select
            data-uat="squad-manager-focused-club-select"
            value={focusedClubId}
            onChange={(event) => setFocusedClubId(event.target.value)}
          >
            {[homeClubId, awayClubId].map((clubId) => {
              const club = clubs.find((item) => item.id === clubId);
              return (
                <option key={clubId} value={clubId}>
                  {club?.name ?? clubId}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      <p
        className="squad-manager__verification-source"
        data-uat="squad-manager-football-data-status"
        data-club-id={focusedClubId}
        data-football-data-state={focusedFootballData ? "mapped" : "unmapped"}
        data-football-data-team-id={focusedFootballData?.footballDataTeamId ?? ""}
        data-football-data-name={focusedFootballData?.footballDataName ?? ""}
      >
        football-data.org:{" "}
        {focusedFootballData
          ? `${focusedFootballData.footballDataName} (${focusedFootballData.footballDataTeamId})`
          : "Not mapped"}
      </p>

      <label className="squad-manager__review-mode">
        Review mode
        <input
          type="checkbox"
          data-uat="squad-manager-review-mode-toggle"
          checked={reviewMode}
          onChange={(event) => setReviewMode(event.target.checked)}
        />
      </label>

      {contextQuery.error || homeSquadQuery.error || awaySquadQuery.error ? (
        <p className="squad-manager-error">Could not load squad-manager data.</p>
      ) : null}
      {verifyMutation.error ? (
        <p className="squad-manager-error">
          {verifyMutation.error instanceof Error
            ? verifyMutation.error.message
            : "Verification failed"}
        </p>
      ) : null}
      {applyMutation.error ? (
        <p className="squad-manager-error">
          {applyMutation.error instanceof Error ? applyMutation.error.message : "Apply failed"}
        </p>
      ) : null}
      {applyResult ? (
        <p
          className={
            applyResult.state === "success"
              ? "squad-manager__apply-result"
              : "squad-manager-error"
          }
          data-uat="squad-manager-apply-result"
          data-state={applyResult.state}
          data-new-dataset-version-id={applyResult.newDatasetVersionId ?? ""}
        >
          {applyResult.message}{" "}
          {applyResult.state === "success" ? (
            <a href="/">View dashboard active dataset</a>
          ) : null}
        </p>
      ) : null}

      <div className="squad-manager__board" data-uat="squad-manager-board">
        <SquadList title="Home squad" squad={homeSquadQuery.data?.squad ?? []} />
        <div className="squad-manager__centre">
          <VerificationPanel
            result={verification}
            acceptedIds={acceptedIds}
            inspectedSuggestionId={inspectedSuggestion?.suggestionId ?? null}
            reviewMode={reviewMode}
            onToggle={toggleAccepted}
            onToggleMany={toggleAcceptedMany}
            onInspect={inspectSuggestion}
            onApplyRisk={openApplyDialog}
            renderEditor={(suggestion) => (
              <PlayerEditorWidget
                suggestion={suggestion}
                localPlayer={localPlayerForSuggestion(suggestion)}
              />
            )}
          />
          <p
            className="squad-manager__apply-guard"
            data-uat="squad-manager-apply-guard"
            data-review-mode={reviewMode ? "on" : "off"}
            data-apply-available={applyAvailable ? "true" : "false"}
          >
            {reviewMode
              ? "Review mode is on; apply is guarded."
              : "Review mode is off; selected suggestions can be applied."}
          </p>
        </div>
        <SquadList title="Away squad" squad={awaySquadQuery.data?.squad ?? []} />
      </div>

      <ApplyDialog
        open={applyOpen}
        baseVersionId={datasetVersionId}
        clubName={focusedClub?.name ?? focusedClubId}
        acceptedSuggestions={selectedLowRiskSuggestions}
        applying={applyMutation.isPending}
        onCancel={() => setApplyOpen(false)}
        onConfirm={applyAccepted}
      />
    </section>
  );
}

function allSuggestionsFrom(result: VerifySquadResponse): SquadManagerSuggestion[] {
  return [
    ...result.verification.missingPlayers,
    ...result.verification.suggestions,
    ...result.verification.attributeWarnings
  ];
}

function isLowRisk(suggestion: SquadManagerSuggestion): boolean {
  return classifySuggestionRisk(suggestion) === "low";
}

function removeSuggestions(
  result: VerifySquadResponse,
  suggestionIds: Set<string>
): VerifySquadResponse {
  return {
    ...result,
    verification: {
      missingPlayers: result.verification.missingPlayers.filter(
        (suggestion) => !suggestionIds.has(suggestion.suggestionId)
      ),
      suggestions: result.verification.suggestions.filter(
        (suggestion) => !suggestionIds.has(suggestion.suggestionId)
      ),
      attributeWarnings: result.verification.attributeWarnings.filter(
        (suggestion) => !suggestionIds.has(suggestion.suggestionId)
      )
    }
  };
}

function datasetVersionLabel(version: { name: string; description: string | null }): string {
  const audit = squadManagerAuditSummary(version.description);
  if (!audit) {
    return version.name;
  }
  return `${version.name} [Squad Manager apply: ${audit.clubId}, ${audit.suggestionCount} low-risk]`;
}

function squadManagerAuditSummary(
  description: string | null
): { clubId: string; suggestionCount: number } | null {
  if (!description) {
    return null;
  }
  try {
    const parsed = JSON.parse(description) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "kind" in parsed &&
      parsed.kind === "squad-manager-apply" &&
      "clubId" in parsed &&
      typeof parsed.clubId === "string" &&
      "suggestionIds" in parsed &&
      Array.isArray(parsed.suggestionIds)
    ) {
      return { clubId: parsed.clubId, suggestionCount: parsed.suggestionIds.length };
    }
  } catch {
    return null;
  }
  return null;
}
