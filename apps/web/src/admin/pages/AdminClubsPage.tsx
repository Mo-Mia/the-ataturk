import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listClubs, listClubSquad } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminClubsPage() {
  const clubsQuery = useQuery({
    queryKey: queryKeys.clubs,
    queryFn: listClubs
  });
  const squadQueries = useQueries({
    queries: (clubsQuery.data ?? []).map((club) => ({
      queryKey: queryKeys.clubSquad(club.id),
      queryFn: () => listClubSquad(club.id)
    }))
  });

  if (clubsQuery.isLoading) {
    return <p>Loading clubs...</p>;
  }

  if (clubsQuery.error) {
    return <p className="admin-error">Could not load clubs.</p>;
  }

  return (
    <section className="admin-panel">
      <h2>Clubs</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Club</th>
            <th>Short name</th>
            <th>Country</th>
            <th>League</th>
            <th>Squad size</th>
          </tr>
        </thead>
        <tbody>
          {(clubsQuery.data ?? []).map((club, index) => (
            <tr key={club.id}>
              <td>
                <Link to={`/admin/clubs/${club.id}`}>{club.name}</Link>
              </td>
              <td>{club.short_name}</td>
              <td>{club.country}</td>
              <td>{club.league}</td>
              <td>{squadQueries[index]?.data?.length ?? "..."}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
