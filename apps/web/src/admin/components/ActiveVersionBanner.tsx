import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listDatasetVersions, listProfileVersions } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function ActiveVersionBanner() {
  const datasetVersionsQuery = useQuery({
    queryKey: queryKeys.datasetVersions,
    queryFn: listDatasetVersions
  });
  const profileVersionsQuery = useQuery({
    queryKey: queryKeys.profileVersions,
    queryFn: listProfileVersions
  });

  const activeDatasetVersion = datasetVersionsQuery.data?.find((version) => version.is_active);
  const activeProfileVersion = profileVersionsQuery.data?.find((version) => version.is_active);

  if (datasetVersionsQuery.isLoading || profileVersionsQuery.isLoading) {
    return <div className="admin-banner">Loading active versions...</div>;
  }

  if (datasetVersionsQuery.error || profileVersionsQuery.error) {
    return <div className="admin-banner admin-error">Could not load active versions.</div>;
  }

  return (
    <div className="admin-banner">
      <div>
        Active attribute version: <strong>{activeDatasetVersion?.name ?? "None"}</strong>{" "}
        <span className="admin-muted">({activeDatasetVersion?.id ?? "not set"})</span>{" "}
        <Link to="/admin/dataset-versions">switch attribute version</Link>
      </div>
      <div>
        Active profile version: <strong>{activeProfileVersion?.name ?? "None"}</strong>{" "}
        <span className="admin-muted">({activeProfileVersion?.id ?? "not set"})</span>{" "}
        <Link to="/admin/profile-versions">switch profile version</Link>
      </div>
    </div>
  );
}
