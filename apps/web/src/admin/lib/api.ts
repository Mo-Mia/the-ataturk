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
export type PlayerProfileTier = "S" | "A" | "B" | "C" | "D";
export type PlayerProfileFieldName = "tier" | "role_2004_05" | "qualitative_descriptor";

export const PLAYER_PROFILE_TIERS = ["S", "A", "B", "C", "D"] as const;

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

export interface PlayerProfileVersion {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerProfileVersionSummary extends PlayerProfileVersion {
  profile_count: number;
  uncurated_count: number;
  failed_count: number;
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

export interface PlayerProfile {
  id: string;
  player_id: string;
  profile_version: string;
  tier: PlayerProfileTier;
  role_2004_05: string | null;
  qualitative_descriptor: string | null;
  generated_by: string;
  generated_at: string;
  edited: boolean;
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

export interface PlayerProfileHistory {
  id: number;
  player_id: string;
  profile_version: string;
  field_name: PlayerProfileFieldName;
  old_value: string | null;
  new_value: string | null;
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

export interface CreateProfileVersionRequest {
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

export interface UpdatePlayerProfileRequest {
  profile_version: string;
  changes: Partial<Record<PlayerProfileFieldName, string | null>>;
  changed_by?: string;
}

export interface ProfileExtractionRequest {
  profile_version: string;
  player_ids?: string[];
}

export interface ProfileExtractionProgressEvent {
  player_id: string;
  player_name: string;
  status: "started" | "succeeded" | "failed";
  error?: string;
}

export interface ProfileExtractionSummary {
  total: number;
  succeeded: number;
  failed: number;
  failed_player_ids: string[];
  aborted?: boolean;
  abort_reason?: string;
}

export type ProfileExtractionEvent =
  | { event: "player"; data: ProfileExtractionProgressEvent }
  | { event: "summary"; data: ProfileExtractionSummary }
  | { event: "error"; data: ApiErrorResponse };

export interface AttributeDerivationRequest {
  dataset_version: string;
  profile_version?: string;
  player_ids?: string[];
}

export interface AttributeDerivationPreflight {
  ready: boolean;
  candidate_count: number;
  errors?: string[];
  blocking_player_ids?: string[];
}

export interface AttributeDerivationProgressEvent {
  player_id: string;
  player_name: string;
  status: "started" | "succeeded" | "failed";
  error?: string;
}

export interface AttributeDerivationSummary {
  total: number;
  succeeded: number;
  failed: number;
  failed_player_ids: string[];
  aborted?: boolean;
  abort_reason?: string;
}

export type AttributeDerivationEvent =
  | { event: "player"; data: AttributeDerivationProgressEvent }
  | { event: "summary"; data: AttributeDerivationSummary }
  | { event: "error"; data: ApiErrorResponse };

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

export function listProfileVersions(): Promise<PlayerProfileVersionSummary[]> {
  return requestJson<PlayerProfileVersionSummary[]>("/api/profile-versions");
}

export function createDatasetVersion(body: CreateDatasetVersionRequest): Promise<DatasetVersion> {
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

export function createProfileVersion(
  body: CreateProfileVersionRequest
): Promise<PlayerProfileVersion> {
  return requestJson<PlayerProfileVersion>("/api/profile-versions", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function activateProfileVersion(id: string): Promise<PlayerProfileVersion> {
  return requestJson<PlayerProfileVersion>(`/api/profile-versions/${id}/activate`, {
    method: "POST"
  });
}

export function getPlayer(playerId: string): Promise<Player> {
  return requestJson<Player>(`/api/players/${playerId}`);
}

export function getPlayerAttributes(playerId: string, version?: string): Promise<PlayerAttributes> {
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return requestJson<PlayerAttributes>(`/api/players/${playerId}/attributes${query}`);
}

export function getPlayerProfile(playerId: string, version?: string): Promise<PlayerProfile> {
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return requestJson<PlayerProfile>(`/api/players/${playerId}/profile${query}`);
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

export function updatePlayerProfile(
  playerId: string,
  body: UpdatePlayerProfileRequest
): Promise<PlayerProfile> {
  return requestJson<PlayerProfile>(`/api/players/${playerId}/profile`, {
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

export function getPlayerProfileHistory(
  playerId: string,
  version?: string,
  limit = 50
): Promise<PlayerProfileHistory[]> {
  const params = new URLSearchParams({ limit: String(limit) });

  if (version) {
    params.set("version", version);
  }

  return requestJson<PlayerProfileHistory[]>(
    `/api/players/${playerId}/profile-history?${params.toString()}`
  );
}

export function getAttributeDerivationPreflight(
  datasetVersion: string,
  profileVersion?: string
): Promise<AttributeDerivationPreflight> {
  const params = new URLSearchParams({ dataset_version: datasetVersion });

  if (profileVersion) {
    params.set("profile_version", profileVersion);
  }

  return requestJson<AttributeDerivationPreflight>(
    `/api/attribute-derivation/preflight?${params.toString()}`
  );
}

export async function runProfileExtraction(
  body: ProfileExtractionRequest,
  onEvent: (event: ProfileExtractionEvent) => void
): Promise<ProfileExtractionSummary> {
  const response = await fetch("/api/profile-extraction/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const errorBody = (await response.json()) as ApiErrorResponse;
      message = errorBody.error ?? message;
    } catch {
      // Keep the status-based fallback if the response body is not JSON.
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Profile extraction response did not include a stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: ProfileExtractionSummary | null = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseProfileExtractionSseFrame(frame);
      if (!event) {
        continue;
      }

      onEvent(event);

      if (event.event === "summary") {
        summary = event.data;
      }

      if (event.event === "error") {
        throw new Error(event.data.error);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const event = parseProfileExtractionSseFrame(buffer);
    if (event) {
      onEvent(event);
      if (event.event === "summary") {
        summary = event.data;
      }
    }
  }

  if (!summary) {
    throw new Error("Profile extraction finished without a summary");
  }

  return summary;
}

export async function runAttributeDerivation(
  body: AttributeDerivationRequest,
  onEvent: (event: AttributeDerivationEvent) => void
): Promise<AttributeDerivationSummary> {
  const response = await fetch("/api/attribute-derivation/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const errorBody = (await response.json()) as ApiErrorResponse;
      message = errorBody.error ?? message;
    } catch {
      // Keep the status-based fallback if the response body is not JSON.
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Attribute derivation response did not include a stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: AttributeDerivationSummary | null = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseAttributeDerivationSseFrame(frame);
      if (!event) {
        continue;
      }

      onEvent(event);

      if (event.event === "summary") {
        summary = event.data;
      }

      if (event.event === "error") {
        throw new Error(event.data.error);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const event = parseAttributeDerivationSseFrame(buffer);
    if (event) {
      onEvent(event);
      if (event.event === "summary") {
        summary = event.data;
      }
    }
  }

  if (!summary) {
    throw new Error("Attribute derivation finished without a summary");
  }

  return summary;
}

function parseProfileExtractionSseFrame(frame: string): ProfileExtractionEvent | null {
  return parseSseFrame(frame) as ProfileExtractionEvent | null;
}

function parseAttributeDerivationSseFrame(frame: string): AttributeDerivationEvent | null {
  return parseSseFrame(frame) as AttributeDerivationEvent | null;
}

function parseSseFrame(frame: string): ProfileExtractionEvent | AttributeDerivationEvent | null {
  const eventLine = frame
    .split("\n")
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length);
  const dataLine = frame
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);

  if (!eventLine || !dataLine) {
    return null;
  }

  const parsedData = JSON.parse(dataLine) as unknown;

  if (eventLine === "player") {
    return { event: "player", data: parsedData as ProfileExtractionProgressEvent };
  }

  if (eventLine === "summary") {
    return { event: "summary", data: parsedData as ProfileExtractionSummary };
  }

  if (eventLine === "error") {
    return { event: "error", data: parsedData as ApiErrorResponse };
  }

  return null;
}
