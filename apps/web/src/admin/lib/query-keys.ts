export const queryKeys = {
  attributeDerivationPreflight: (
    datasetVersion: string | undefined,
    profileVersion: string | undefined
  ) =>
    ["attributeDerivationPreflight", datasetVersion ?? "none", profileVersion ?? "active"] as const,
  attributeHistory: (playerId: string, version: string | undefined, limit: number) =>
    ["attributeHistory", playerId, version ?? "active", limit] as const,
  clubSquad: (clubId: string) => ["clubSquad", clubId] as const,
  clubs: ["clubs"] as const,
  datasetVersions: ["datasetVersions"] as const,
  player: (playerId: string) => ["player", playerId] as const,
  playerAttributes: (playerId: string, version: string | undefined) =>
    ["playerAttributes", playerId, version ?? "active"] as const,
  playerProfile: (playerId: string, version: string | undefined) =>
    ["playerProfile", playerId, version ?? "active"] as const,
  profileHistory: (playerId: string, version: string | undefined, limit: number) =>
    ["profileHistory", playerId, version ?? "active", limit] as const,
  profileVersions: ["profileVersions"] as const,
  squadManagerContext: ["squadManagerContext"] as const,
  squadManagerSquad: (clubId: string | undefined, datasetVersionId: string | undefined) =>
    ["squadManagerSquad", clubId ?? "none", datasetVersionId ?? "active"] as const,
  squadVerification: (clubId: string | undefined, datasetVersionId: string | undefined) =>
    ["squadVerification", clubId ?? "none", datasetVersionId ?? "active"] as const
};
