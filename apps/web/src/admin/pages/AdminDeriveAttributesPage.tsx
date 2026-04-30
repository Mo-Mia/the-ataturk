import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  getAttributeDerivationPreflight,
  listDatasetVersions,
  listProfileVersions,
  runAttributeDerivation,
  type AttributeDerivationProgressEvent,
  type AttributeDerivationSummary
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminDeriveAttributesPage() {
  const queryClient = useQueryClient();
  const datasetVersionsQuery = useQuery({
    queryKey: queryKeys.datasetVersions,
    queryFn: listDatasetVersions
  });
  const profileVersionsQuery = useQuery({
    queryKey: queryKeys.profileVersions,
    queryFn: listProfileVersions
  });
  const activeProfileVersion = profileVersionsQuery.data?.find((version) => version.is_active);
  const [datasetVersion, setDatasetVersion] = useState("");
  const [profileVersion, setProfileVersion] = useState("");
  const [events, setEvents] = useState<AttributeDerivationProgressEvent[]>([]);
  const [summary, setSummary] = useState<AttributeDerivationSummary | null>(null);
  const selectableDatasetVersions = (datasetVersionsQuery.data ?? []).filter(
    (version) => version.id !== "v0-stub"
  );
  const selectedDatasetVersion = datasetVersion || selectableDatasetVersions[0]?.id || "";
  const selectedProfileVersion = profileVersion || activeProfileVersion?.id || "";
  const preflightQuery = useQuery({
    queryKey: queryKeys.attributeDerivationPreflight(
      selectedDatasetVersion,
      selectedProfileVersion
    ),
    queryFn: () => getAttributeDerivationPreflight(selectedDatasetVersion, selectedProfileVersion),
    enabled: selectedDatasetVersion.length > 0 && selectedProfileVersion.length > 0
  });
  const derivationMutation = useMutation({
    mutationFn: () =>
      runAttributeDerivation(
        {
          dataset_version: selectedDatasetVersion,
          profile_version: selectedProfileVersion
        },
        (event) => {
          if (event.event === "player") {
            setEvents((current) => [...current, event.data]);
          }

          if (event.event === "summary") {
            setSummary(event.data);
          }
        }
      ),
    onMutate: () => {
      setEvents([]);
      setSummary(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["playerAttributes"] });
      await queryClient.invalidateQueries({ queryKey: ["attributeHistory"] });
      await queryClient.invalidateQueries({ queryKey: ["clubSquad"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.datasetVersions });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.attributeDerivationPreflight(
          selectedDatasetVersion,
          selectedProfileVersion
        )
      });
    }
  });

  function startDerivation(): void {
    if (!preflightQuery.data?.ready) {
      return;
    }

    derivationMutation.mutate();
  }

  return (
    <section className="admin-grid">
      <div className="admin-panel">
        <h2>Derive player attributes</h2>
        <p className="admin-muted">
          Runs Gemini attribute derivation sequentially from curated player profiles. Each full run
          costs roughly $0.20-0.50 in API credits because each call sends the rubric document.
        </p>
        <div className="admin-form">
          <label>
            Target attribute dataset version
            <select
              value={selectedDatasetVersion}
              onChange={(event) => setDatasetVersion(event.target.value)}
            >
              {selectableDatasetVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id} {version.is_active ? "(active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source profile version
            <select
              value={selectedProfileVersion}
              onChange={(event) => setProfileVersion(event.target.value)}
            >
              {(profileVersionsQuery.data ?? []).map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id} {version.is_active ? "(active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!preflightQuery.data?.ready || derivationMutation.isPending}
            onClick={startDerivation}
          >
            {derivationMutation.isPending ? "Deriving..." : "Derive attributes"}
          </button>
        </div>
        {preflightQuery.data ? (
          <div>
            <p>
              Pre-flight: {preflightQuery.data.ready ? "ready" : "blocked"};{" "}
              {preflightQuery.data.candidate_count} candidates.
            </p>
            {preflightQuery.data.errors ? (
              <ul>
                {preflightQuery.data.errors.map((error) => (
                  <li key={error} className="admin-error">
                    {error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {derivationMutation.error ? (
          <p className="admin-error">
            {derivationMutation.error instanceof Error
              ? derivationMutation.error.message
              : "Attribute derivation failed"}
          </p>
        ) : null}
        {summary ? (
          <>
            <p>
              {summary.succeeded} of {summary.total} succeeded; {summary.failed} failed.
            </p>
            {summary.aborted ? (
              <p className="admin-error">
                {summary.abort_reason ?? "Derivation stopped before the batch completed."}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="admin-panel">
        <h2>Progress</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={`${event.player_id}-${event.status}-${index}`}>
                <td>
                  <Link to={`/admin/players/${event.player_id}`}>{event.player_name}</Link>
                </td>
                <td>
                  {event.status === "started" ? "Deriving..." : null}
                  {event.status === "succeeded" ? "Done" : null}
                  {event.status === "failed" ? "Failed" : null}
                </td>
                <td>{event.error ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
