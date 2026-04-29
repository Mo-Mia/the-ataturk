import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listDatasetVersions } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function ActiveVersionBanner() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.datasetVersions,
    queryFn: listDatasetVersions
  });

  const activeVersion = data?.find((version) => version.is_active);

  if (isLoading) {
    return <div className="admin-banner">Loading active dataset version...</div>;
  }

  if (error) {
    return <div className="admin-banner admin-error">Could not load dataset versions.</div>;
  }

  return (
    <div className="admin-banner">
      Active dataset version: <strong>{activeVersion?.name ?? "None"}</strong>{" "}
      <span className="admin-muted">({activeVersion?.id ?? "not set"})</span>{" "}
      <Link to="/admin/dataset-versions">switch active version</Link>
    </div>
  );
}
