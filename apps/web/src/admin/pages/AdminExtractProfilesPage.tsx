import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  listProfileVersions,
  runProfileExtraction,
  type ProfileExtractionProgressEvent,
  type ProfileExtractionSummary
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminExtractProfilesPage() {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: queryKeys.profileVersions,
    queryFn: listProfileVersions
  });
  const activeProfileVersion = versionsQuery.data?.find((version) => version.is_active);
  const [profileVersion, setProfileVersion] = useState("");
  const [events, setEvents] = useState<ProfileExtractionProgressEvent[]>([]);
  const [summary, setSummary] = useState<ProfileExtractionSummary | null>(null);
  const selectedVersion = profileVersion || activeProfileVersion?.id || "";
  const extractionMutation = useMutation({
    mutationFn: () =>
      runProfileExtraction({ profile_version: selectedVersion }, (event) => {
        if (event.event === "player") {
          setEvents((current) => [...current, event.data]);
        }

        if (event.event === "summary") {
          setSummary(event.data);
        }
      }),
    onMutate: () => {
      setEvents([]);
      setSummary(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileVersions });
      await queryClient.invalidateQueries({ queryKey: ["playerProfile"] });
      await queryClient.invalidateQueries({ queryKey: ["profileHistory"] });
    }
  });

  function startExtraction(): void {
    if (!selectedVersion) {
      return;
    }

    extractionMutation.mutate();
  }

  return (
    <section className="admin-grid">
      <div className="admin-panel">
        <h2>Extract player profiles</h2>
        <p className="admin-muted">
          Runs Gemini profile extraction sequentially over un-curated profiles in the selected
          version. Each full run costs roughly $0.10-0.30 in API credits.
        </p>
        <div className="admin-form">
          <label>
            Target profile version
            <select
              value={selectedVersion}
              onChange={(event) => setProfileVersion(event.target.value)}
            >
              {(versionsQuery.data ?? []).map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id} {version.is_active ? "(active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedVersion || extractionMutation.isPending}
            onClick={startExtraction}
          >
            {extractionMutation.isPending ? "Extracting..." : "Extract all profiles"}
          </button>
        </div>
        {extractionMutation.error ? (
          <p className="admin-error">
            {extractionMutation.error instanceof Error
              ? extractionMutation.error.message
              : "Extraction failed"}
          </p>
        ) : null}
        {summary ? (
          <p>
            {summary.succeeded} of {summary.total} succeeded; {summary.failed} failed.
          </p>
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
                  {event.status === "started" ? "Extracting..." : null}
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
