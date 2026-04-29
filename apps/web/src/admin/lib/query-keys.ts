export const queryKeys = {
  attributeHistory: (playerId: string, version: string | undefined, limit: number) =>
    ["attributeHistory", playerId, version ?? "active", limit] as const,
  clubSquad: (clubId: string) => ["clubSquad", clubId] as const,
  clubs: ["clubs"] as const,
  datasetVersions: ["datasetVersions"] as const,
  player: (playerId: string) => ["player", playerId] as const,
  playerAttributes: (playerId: string, version: string | undefined) =>
    ["playerAttributes", playerId, version ?? "active"] as const
};
