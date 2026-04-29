import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { AttributeEditor } from "../components/AttributeEditor";
import { ProfileEditor } from "../components/ProfileEditor";
import {
  getPlayer,
  getPlayerAttributeHistory,
  getPlayerAttributes,
  getPlayerProfile,
  getPlayerProfileHistory,
  listDatasetVersions,
  listProfileVersions,
  runProfileExtraction,
  type PlayerAttributes,
  type PlayerProfile
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminPlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = id ?? "";
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: queryKeys.datasetVersions,
    queryFn: listDatasetVersions
  });
  const profileVersionsQuery = useQuery({
    queryKey: queryKeys.profileVersions,
    queryFn: listProfileVersions
  });
  const activeVersion = versionsQuery.data?.find((version) => version.is_active);
  const activeProfileVersion = profileVersionsQuery.data?.find((version) => version.is_active);
  const playerQuery = useQuery({
    queryKey: queryKeys.player(playerId),
    queryFn: () => getPlayer(playerId),
    enabled: playerId.length > 0
  });
  const attributesQuery = useQuery({
    queryKey: queryKeys.playerAttributes(playerId, activeVersion?.id),
    queryFn: () => getPlayerAttributes(playerId, activeVersion?.id),
    enabled: playerId.length > 0 && activeVersion !== undefined
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.attributeHistory(playerId, activeVersion?.id, 50),
    queryFn: () => getPlayerAttributeHistory(playerId, activeVersion?.id, 50),
    enabled: playerId.length > 0 && activeVersion !== undefined
  });
  const profileQuery = useQuery({
    queryKey: queryKeys.playerProfile(playerId, activeProfileVersion?.id),
    queryFn: () => getPlayerProfile(playerId, activeProfileVersion?.id),
    enabled: playerId.length > 0 && activeProfileVersion !== undefined
  });
  const profileHistoryQuery = useQuery({
    queryKey: queryKeys.profileHistory(playerId, activeProfileVersion?.id, 50),
    queryFn: () => getPlayerProfileHistory(playerId, activeProfileVersion?.id, 50),
    enabled: playerId.length > 0 && activeProfileVersion !== undefined
  });

  async function handleSaved(updatedAttributes: PlayerAttributes): Promise<void> {
    queryClient.setQueryData(
      queryKeys.playerAttributes(playerId, updatedAttributes.dataset_version),
      updatedAttributes
    );
    await queryClient.invalidateQueries({ queryKey: ["attributeHistory"] });
    await queryClient.invalidateQueries({ queryKey: ["clubSquad", playerQuery.data?.club_id] });
  }

  async function handleProfileSaved(updatedProfile: PlayerProfile): Promise<void> {
    queryClient.setQueryData(
      queryKeys.playerProfile(playerId, updatedProfile.profile_version),
      updatedProfile
    );
    await queryClient.invalidateQueries({ queryKey: ["profileHistory"] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileVersions });
  }

  async function extractThisPlayer(): Promise<void> {
    if (!activeProfileVersion) {
      return;
    }

    await runProfileExtraction(
      {
        profile_version: activeProfileVersion.id,
        player_ids: [playerId]
      },
      () => undefined
    );
    await queryClient.invalidateQueries({ queryKey: ["playerProfile", playerId] });
    await queryClient.invalidateQueries({ queryKey: ["profileHistory", playerId] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profileVersions });
  }

  if (playerQuery.isLoading || versionsQuery.isLoading || profileVersionsQuery.isLoading) {
    return <p>Loading player...</p>;
  }

  if (playerQuery.error || !playerQuery.data) {
    return <p className="admin-error">Could not load player.</p>;
  }

  return (
    <section className="admin-grid">
      <div className="admin-panel">
        <h2>{playerQuery.data.name}</h2>
        <p>
          <Link to={`/admin/clubs/${playerQuery.data.club_id}`}>Back to club</Link>
        </p>
        <table className="admin-table">
          <tbody>
            <tr>
              <th>Primary position</th>
              <td>{playerQuery.data.position_primary}</td>
            </tr>
            <tr>
              <th>Secondary position</th>
              <td>{playerQuery.data.position_secondary ?? "-"}</td>
            </tr>
            <tr>
              <th>Origin</th>
              <td>{playerQuery.data.player_origin}</td>
            </tr>
            <tr>
              <th>Active version</th>
              <td>{activeVersion?.id ?? "None"}</td>
            </tr>
            <tr>
              <th>Active profile version</th>
              <td>{activeProfileVersion?.id ?? "None"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="admin-panel">
        <h2>Profile extraction</h2>
        <p className="admin-muted">
          Extract or retry this player in the active profile version. Attribute derivation remains
          deferred to Step 2B.
        </p>
        <button
          type="button"
          disabled={!activeProfileVersion}
          onClick={() => void extractThisPlayer()}
        >
          Extract this player profile
        </button>
      </div>

      {profileQuery.data ? (
        <ProfileEditor
          profile={profileQuery.data}
          onSaved={(updatedProfile) => void handleProfileSaved(updatedProfile)}
        />
      ) : (
        <p className="admin-error">No profile found for the active profile version.</p>
      )}

      {attributesQuery.data ? (
        <AttributeEditor
          attributes={attributesQuery.data}
          onSaved={(updatedAttributes) => void handleSaved(updatedAttributes)}
        />
      ) : (
        <p className="admin-error">No attributes found for the active version.</p>
      )}

      <section className="admin-panel">
        <h2>Attribute edit history</h2>
        {historyQuery.isLoading ? <p>Loading history...</p> : null}
        {historyQuery.error ? <p className="admin-error">Could not load history.</p> : null}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Changed at</th>
              <th>Version</th>
              <th>Attribute</th>
              <th>Old</th>
              <th>New</th>
              <th>Changed by</th>
            </tr>
          </thead>
          <tbody>
            {(historyQuery.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.changed_at}</td>
                <td>{row.dataset_version}</td>
                <td>{row.attribute_name}</td>
                <td>{row.old_value}</td>
                <td>{row.new_value}</td>
                <td>{row.changed_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-panel">
        <h2>Profile edit history</h2>
        {profileHistoryQuery.isLoading ? <p>Loading profile history...</p> : null}
        {profileHistoryQuery.error ? (
          <p className="admin-error">Could not load profile history.</p>
        ) : null}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Changed at</th>
              <th>Version</th>
              <th>Field</th>
              <th>Old</th>
              <th>New</th>
              <th>Changed by</th>
            </tr>
          </thead>
          <tbody>
            {(profileHistoryQuery.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.changed_at}</td>
                <td>{row.profile_version}</td>
                <td>{row.field_name}</td>
                <td>{row.old_value ?? "-"}</td>
                <td>{row.new_value ?? "-"}</td>
                <td>{row.changed_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
