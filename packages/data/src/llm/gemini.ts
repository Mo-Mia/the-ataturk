import { GoogleGenAI, ThinkingLevel } from "@google/genai";

import { PLAYER_PROFILE_TIERS, type PlayerProfileTier, type Position } from "../types";

export const PROFILE_EXTRACTION_MODEL = "gemini-3-flash-preview";
export const PROFILE_EXTRACTION_GENERATED_BY = "llm-gemini-3-flash";

export interface ProfileExtractionInput {
  researchDocument: string;
  playerName: string;
  position?: Position;
  ageAtMatch?: number;
}

export interface ProfileExtractionResult {
  tier: PlayerProfileTier;
  role_2004_05: string;
  qualitative_descriptor: string;
}

export class ProfileExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProfileExtractionError";
  }
}

export const PROFILE_EXTRACTION_SYSTEM_PROMPT = `You are extracting structured player profiles for The Atatürk, a football management game centred on the 2004/05 UEFA Champions League.

You will receive:
- the full canonical research document
- one target player name
- optionally the player's primary position and age at the 2005 final

Use only the research document. Do not invent facts or use outside knowledge. If the document is silent on the player's style, keep the descriptor neutral and brief rather than fabricating detail.

Return JSON only with exactly these fields:
- tier: one of "S", "A", "B", "C", "D"
- role_2004_05: a 1-2 sentence description of the player's role and contribution that season
- qualitative_descriptor: a 2-3 sentence scout report capturing playing style, key strengths, and notable weaknesses

Tier criteria:
S - Generational. Ballon d'Or contender that season.
A - World-class. Top 50 in the world at their position.
B - Solid top-flight. Reliable for a top club.
C - Squad player. Capable but limited.
D - Fringe. Rotation or cover only.

Prefer conservative tiers when the research evidence is thin. Use en-GB spelling.`;

const PROFILE_EXTRACTION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tier: {
      type: "string",
      enum: PLAYER_PROFILE_TIERS
    },
    role_2004_05: {
      type: "string"
    },
    qualitative_descriptor: {
      type: "string"
    }
  },
  required: ["tier", "role_2004_05", "qualitative_descriptor"]
} as const;

export async function extractPlayerProfile(
  input: ProfileExtractionInput
): Promise<ProfileExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ProfileExtractionError("GEMINI_API_KEY is required for profile extraction");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: PROFILE_EXTRACTION_MODEL,
      contents: buildUserPrompt(input),
      config: {
        systemInstruction: PROFILE_EXTRACTION_SYSTEM_PROMPT,
        temperature: 1.0,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW
        },
        responseMimeType: "application/json",
        responseJsonSchema: PROFILE_EXTRACTION_RESPONSE_SCHEMA
      }
    });

    return parseProfileExtractionResponse(response.text);
  } catch (error) {
    if (error instanceof ProfileExtractionError) {
      throw error;
    }

    throw new ProfileExtractionError("Gemini profile extraction failed", { cause: error });
  }
}

function buildUserPrompt(input: ProfileExtractionInput): string {
  const grounding = [
    `Target player: ${input.playerName}`,
    input.position ? `Known position: ${input.position}` : null,
    input.ageAtMatch === undefined ? null : `Age at 2005 final: ${input.ageAtMatch}`
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `${grounding}

Canonical research document:

${input.researchDocument}`;
}

function parseProfileExtractionResponse(rawText: string | undefined): ProfileExtractionResult {
  if (!rawText) {
    throw new ProfileExtractionError("Gemini returned an empty profile extraction response");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new ProfileExtractionError("Gemini returned invalid JSON for profile extraction", {
      cause: error
    });
  }

  if (!isRecord(parsed)) {
    throw new ProfileExtractionError("Gemini profile extraction response must be an object");
  }

  if (!isPlayerProfileTier(parsed.tier)) {
    throw new ProfileExtractionError("Gemini profile extraction response has an invalid tier");
  }

  if (typeof parsed.role_2004_05 !== "string" || parsed.role_2004_05.trim().length === 0) {
    throw new ProfileExtractionError(
      "Gemini profile extraction response must include role_2004_05"
    );
  }

  if (
    typeof parsed.qualitative_descriptor !== "string" ||
    parsed.qualitative_descriptor.trim().length === 0
  ) {
    throw new ProfileExtractionError(
      "Gemini profile extraction response must include qualitative_descriptor"
    );
  }

  return {
    tier: parsed.tier,
    role_2004_05: parsed.role_2004_05,
    qualitative_descriptor: parsed.qualitative_descriptor
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerProfileTier(value: unknown): value is PlayerProfileTier {
  return PLAYER_PROFILE_TIERS.includes(value as PlayerProfileTier);
}
