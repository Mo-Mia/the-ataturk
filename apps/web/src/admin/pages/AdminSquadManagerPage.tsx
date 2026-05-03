import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ApplyDialog } from "../components/ApplyDialog";
import { PlayerEditorWidget } from "../components/PlayerEditorWidget";
import { SquadList } from "../components/SquadList";
import { VerificationPanel } from "../components/VerificationPanel";
import {
  applySquadSuggestions,
  getSquadManagerContext,
  getSquadManagerSquad,
  verifySquad,
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
      setAcceptedIds(new Set());
      setInspectedSuggestion(null);
    }
  });

  const applyMutation = useMutation({
    mutationFn: applySquadSuggestions,
    onSuccess: async () => {
      setApplyOpen(false);
      setAcceptedIds(new Set());
      setVerification(null);
      await queryClient.invalidateQueries();
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

  function runVerification(): void {
    verifyMutation.mutate({ clubId: focusedClubId, datasetVersionId });
  }

  function applyAccepted(): void {
    applyMutation.mutate({
      clubId: focusedClubId,
      baseDatasetVersionId: datasetVersionId,
      suggestions: acceptedSuggestions,
      rationale: "Accepted via Squad Manager admin UI"
    });
  }

  const clubs = contextQuery.data?.clubs ?? [];

  return (
    <section className="squad-manager">
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
            value={datasetVersionId}
            onChange={(event) => setDatasetVersionId(event.target.value)}
          >
            {(contextQuery.data?.datasetVersions ?? []).map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Home club
          <select value={homeClubId} onChange={(event) => setHomeClubId(event.target.value)}>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Away club
          <select value={awayClubId} onChange={(event) => setAwayClubId(event.target.value)}>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Verify
          <select value={focusedClubId} onChange={(event) => setFocusedClubId(event.target.value)}>
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

      <div className="squad-manager__board">
        <SquadList title="Home squad" squad={homeSquadQuery.data?.squad ?? []} />
        <div className="squad-manager__centre">
          <VerificationPanel
            result={verification}
            acceptedIds={acceptedIds}
            onToggle={toggleAccepted}
            onInspect={setInspectedSuggestion}
          />
          <PlayerEditorWidget suggestion={inspectedSuggestion} />
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={acceptedSuggestions.length === 0}
          >
            Apply accepted
          </button>
        </div>
        <SquadList title="Away squad" squad={awaySquadQuery.data?.squad ?? []} />
      </div>

      <ApplyDialog
        open={applyOpen}
        baseVersionId={datasetVersionId}
        acceptedSuggestions={acceptedSuggestions}
        applying={applyMutation.isPending}
        onCancel={() => setApplyOpen(false)}
        onConfirm={applyAccepted}
      />
    </section>
  );
}
