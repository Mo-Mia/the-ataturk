export const PLAYER_ATTRIBUTE_NAMES = [
  "passing",
  "shooting",
  "tackling",
  "saving",
  "agility",
  "strength",
  "penalty_taking",
  "perception",
  "jumping",
  "control"
] as const;

export type PlayerAttributeName = (typeof PLAYER_ATTRIBUTE_NAMES)[number];
export type PlayerAttributeChanges = Partial<Record<PlayerAttributeName, number>>;
export type PlayerOrigin = "real" | "user_created";
export type Position = "GK" | "CB" | "LB" | "RB" | "DM" | "CM" | "AM" | "LW" | "RW" | "ST";

export interface Club {
  id: string;
  name: string;
  short_name: string;
  country: string;
  league: string;
  manager_real: string;
  stadium_name: string;
  stadium_capacity: number | null;
  kit_primary_hex: string | null;
  kit_secondary_hex: string | null;
  created_at: string;
  updated_at: string;
}

interface PlayerBase {
  id: string;
  club_id: string;
  name: string;
  short_name: string;
  squad_number: number | null;
  position_primary: Position;
  position_secondary: Position | null;
  date_of_birth: string | null;
  nationality: string;
  height_cm: number | null;
  is_captain: boolean;
  is_eligible_european: boolean;
  injury_status: "fit" | "doubt" | "injured" | "long-term";
  fitness: number;
  form: number;
  real_player_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealPlayer extends PlayerBase {
  player_origin: "real";
  user_id: null;
  preset_archetype: null;
  budget_used: null;
}

export interface UserCreatedPlayer extends PlayerBase {
  player_origin: "user_created";
  user_id: string;
  preset_archetype: string;
  budget_used: number;
}

export type Player = RealPlayer | UserCreatedPlayer;

export interface DatasetVersion {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerAttributes {
  id: string;
  player_id: string;
  dataset_version: string;
  passing: number;
  shooting: number;
  tackling: number;
  saving: number;
  agility: number;
  strength: number;
  penalty_taking: number;
  perception: number;
  jumping: number;
  control: number;
  rationale: string | null;
  generated_by: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlayerAttributeHistory {
  id: number;
  player_id: string;
  dataset_version: string;
  attribute_name: PlayerAttributeName;
  old_value: number;
  new_value: number;
  changed_at: string;
  changed_by: string;
}

export interface SquadPlayerWithAttributes {
  player: Player;
  attributes: PlayerAttributes | null;
}

export interface CreateDatasetVersionRequest {
  id: string;
  name: string;
  description?: string | null;
  parent_version_id?: string | null;
}

export interface UpdatePlayerAttributesRequest {
  dataset_version: string;
  changes: PlayerAttributeChanges;
  changed_by?: string;
}

interface ApiErrorResponse {
  error: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const body = (await response.json()) as ApiErrorResponse;
      message = body.error ?? message;
    } catch {
      // Keep the status-based fallback if the response body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function listClubs(): Promise<Club[]> {
  return requestJson<Club[]>("/api/clubs");
}

export function listClubSquad(clubId: string): Promise<SquadPlayerWithAttributes[]> {
  return requestJson<SquadPlayerWithAttributes[]>(`/api/clubs/${clubId}/squad`);
}

export function listDatasetVersions(): Promise<DatasetVersion[]> {
  return requestJson<DatasetVersion[]>("/api/dataset-versions");
}

export function createDatasetVersion(
  body: CreateDatasetVersionRequest
): Promise<DatasetVersion> {
  return requestJson<DatasetVersion>("/api/dataset-versions", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function activateDatasetVersion(id: string): Promise<DatasetVersion> {
  return requestJson<DatasetVersion>(`/api/dataset-versions/${id}/activate`, {
    method: "POST"
  });
}

export function getPlayer(playerId: string): Promise<Player> {
  return requestJson<Player>(`/api/players/${playerId}`);
}

export function getPlayerAttributes(
  playerId: string,
  version?: string
): Promise<PlayerAttributes> {
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return requestJson<PlayerAttributes>(`/api/players/${playerId}/attributes${query}`);
}

export function updatePlayerAttributes(
  playerId: string,
  body: UpdatePlayerAttributesRequest
): Promise<PlayerAttributes> {
  return requestJson<PlayerAttributes>(`/api/players/${playerId}/attributes`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function getPlayerAttributeHistory(
  playerId: string,
  version?: string,
  limit = 50
): Promise<PlayerAttributeHistory[]> {
  const params = new URLSearchParams({ limit: String(limit) });

  if (version) {
    params.set("version", version);
  }

  return requestJson<PlayerAttributeHistory[]>(
    `/api/players/${playerId}/attribute-history?${params.toString()}`
  );
}
