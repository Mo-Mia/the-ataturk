import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  activateProfileVersion,
  createProfileVersion,
  listProfileVersions,
  type CreateProfileVersionRequest
} from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function AdminProfileVersionsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateProfileVersionRequest>({
    id: "",
    name: "",
    description: "",
    parent_version_id: "v0-empty"
  });
  const versionsQuery = useQuery({
    queryKey: queryKeys.profileVersions,
    queryFn: listProfileVersions
  });
  const createMutation = useMutation({
    mutationFn: createProfileVersion,
    onSuccess: async () => {
      setForm({ id: "", name: "", description: "", parent_version_id: "v0-empty" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileVersions });
    }
  });
  const activateMutation = useMutation({
    mutationFn: activateProfileVersion,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    }
  });

  function submitForm(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      id: form.id,
      name: form.name,
      description: form.description || null,
      parent_version_id: form.parent_version_id || null
    });
  }

  return (
    <section className="admin-grid">
      <div className="admin-panel">
        <h2>Profile versions</h2>
        {versionsQuery.isLoading ? <p>Loading profile versions...</p> : null}
        {versionsQuery.error ? (
          <p className="admin-error">Could not load profile versions.</p>
        ) : null}
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Active</th>
              <th>Parent</th>
              <th>Profiles</th>
              <th>Un-curated</th>
              <th>Failed</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(versionsQuery.data ?? []).map((version) => (
              <tr key={version.id}>
                <td>{version.id}</td>
                <td>{version.name}</td>
                <td>{version.is_active ? "Yes" : "No"}</td>
                <td>{version.parent_version_id ?? "-"}</td>
                <td>{version.profile_count}</td>
                <td>{version.uncurated_count}</td>
                <td>{version.failed_count}</td>
                <td>{version.description ?? "-"}</td>
                <td>
                  <button
                    type="button"
                    disabled={version.is_active || activateMutation.isPending}
                    onClick={() => activateMutation.mutate(version.id)}
                  >
                    Activate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activateMutation.error ? (
          <p className="admin-error">
            {activateMutation.error instanceof Error
              ? activateMutation.error.message
              : "Activation failed"}
          </p>
        ) : null}
      </div>

      <div className="admin-panel">
        <h2>Create profile version</h2>
        <form className="admin-form" onSubmit={submitForm}>
          <label>
            ID
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.id}
              onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
            />
          </label>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label>
            Fork from parent
            <select
              value={form.parent_version_id ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, parent_version_id: event.target.value }))
              }
            >
              <option value="">No parent</option>
              {(versionsQuery.data ?? []).map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </button>
        </form>
        {createMutation.error ? (
          <p className="admin-error">
            {createMutation.error instanceof Error ? createMutation.error.message : "Create failed"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
