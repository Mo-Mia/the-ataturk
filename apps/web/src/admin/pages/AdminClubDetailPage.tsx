import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { listClubs, listClubSquad, PLAYER_ATTRIBUTE_NAMES } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clubId = id ?? "";
  const clubsQuery = useQuery({
    queryKey: queryKeys.clubs,
    queryFn: listClubs
  });
  const squadQuery = useQuery({
    queryKey: queryKeys.clubSquad(clubId),
    queryFn: () => listClubSquad(clubId),
    enabled: clubId.length > 0
  });
  const club = clubsQuery.data?.find((candidate) => candidate.id === clubId);

  if (squadQuery.isLoading || clubsQuery.isLoading) {
    return <p>Loading squad...</p>;
  }

  if (squadQuery.error) {
    return <p className="admin-error">Could not load squad.</p>;
  }

  return (
    <section className="admin-panel">
      <h2>{club?.name ?? clubId}</h2>
      <p className="admin-muted">
        {club?.manager_real} · {club?.stadium_name}
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Player</th>
            <th>Position</th>
            {PLAYER_ATTRIBUTE_NAMES.map((attributeName) => (
              <th key={attributeName}>{attributeName.replace("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(squadQuery.data ?? []).map(({ player, attributes }) => (
            <tr key={player.id}>
              <td>{player.squad_number ?? "-"}</td>
              <td>
                <Link to={`/admin/players/${player.id}`}>{player.name}</Link>
              </td>
              <td>
                {player.position_primary}
                {player.position_secondary ? ` / ${player.position_secondary}` : ""}
              </td>
              {PLAYER_ATTRIBUTE_NAMES.map((attributeName) => (
                <td key={attributeName}>{attributes?.[attributeName] ?? "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
