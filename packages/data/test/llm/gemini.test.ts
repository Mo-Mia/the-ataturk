import { afterEach, describe, expect, it, vi } from "vitest";

interface GenerateContentRequest {
  model: string;
  contents: string;
  config: {
    temperature: number;
    thinkingConfig: { thinkingLevel: string };
    responseMimeType: string;
    responseJsonSchema: {
      required: string[];
    };
  };
}

const googleGenAiMocks = vi.hoisted(() => ({
  generateContent: vi.fn<(request: GenerateContentRequest) => Promise<{ text: string }>>(),
  constructor: vi.fn<(options: { apiKey: string }) => void>()
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: googleGenAiMocks.generateContent
    };

    constructor(options: { apiKey: string }) {
      googleGenAiMocks.constructor(options);
    }
  },
  ThinkingLevel: {
    LOW: "LOW"
  }
}));

import {
  ATTRIBUTE_DERIVATION_MODEL,
  AttributeDerivationError,
  PROFILE_EXTRACTION_MODEL,
  ProfileExtractionError,
  derivePlayerAttributes,
  extractPlayerProfile
} from "../../src/llm/gemini";

const previousGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  googleGenAiMocks.generateContent.mockReset();
  googleGenAiMocks.constructor.mockReset();

  if (previousGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = previousGeminiApiKey;
  }
});

describe("Gemini attribute derivation client", () => {
  it("sends the rubric as system instruction and parses valid attributes", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        passing: 90,
        shooting: 86,
        tackling: 84,
        saving: 12,
        agility: 88,
        strength: 83,
        penalty_taking: 80,
        perception: 93,
        jumping: 82,
        control: 91
      })
    });

    const result = await derivePlayerAttributes({
      rubricDocument: "Rubric text",
      playerName: "Steven Gerrard",
      position: "CM",
      ageAtMatch: 24,
      tier: "S",
      role_2004_05: "Liverpool captain and midfield talisman.",
      qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
    });

    expect(result.passing).toBe(90);
    const request = googleGenAiMocks.generateContent.mock.calls[0]?.[0];
    expect(request?.model).toBe(ATTRIBUTE_DERIVATION_MODEL);
    expect(request?.contents).toContain('"name": "Steven Gerrard"');
    expect(request?.config.temperature).toBe(1.0);
    expect(request?.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(request?.config.responseMimeType).toBe("application/json");
    expect(request?.config.responseJsonSchema.required).toEqual([
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
    ]);
  });

  it("throws a non-transient typed error when the API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      derivePlayerAttributes({
        rubricDocument: "Rubric text",
        playerName: "Steven Gerrard",
        position: "CM",
        ageAtMatch: 24,
        tier: "S",
        role_2004_05: "Liverpool captain and midfield talisman.",
        qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
      })
    ).rejects.toMatchObject({ transient: false });
  });

  it("throws a non-transient typed error for invalid JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockResolvedValueOnce({ text: "not-json" });

    await expect(
      derivePlayerAttributes({
        rubricDocument: "Rubric text",
        playerName: "Steven Gerrard",
        position: "CM",
        ageAtMatch: 24,
        tier: "S",
        role_2004_05: "Liverpool captain and midfield talisman.",
        qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
      })
    ).rejects.toBeInstanceOf(AttributeDerivationError);
  });

  it("marks 429 Gemini errors as transient", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockRejectedValueOnce(Object.assign(new Error("quota"), { status: 429 }));

    await expect(
      derivePlayerAttributes({
        rubricDocument: "Rubric text",
        playerName: "Steven Gerrard",
        position: "CM",
        ageAtMatch: 24,
        tier: "S",
        role_2004_05: "Liverpool captain and midfield talisman.",
        qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
      })
    ).rejects.toMatchObject({ transient: true, status: 429 });
  });

  it("marks 5xx Gemini errors as transient", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockRejectedValueOnce(Object.assign(new Error("server"), { status: 503 }));

    await expect(
      derivePlayerAttributes({
        rubricDocument: "Rubric text",
        playerName: "Steven Gerrard",
        position: "CM",
        ageAtMatch: 24,
        tier: "S",
        role_2004_05: "Liverpool captain and midfield talisman.",
        qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
      })
    ).rejects.toMatchObject({ transient: true, status: 503 });
  });
});

describe("Gemini profile extraction client", () => {
  it("sends the expected Gemini 3 Flash structured-output request", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        tier: "A",
        role_2004_05: "First-choice centre-back throughout the European run.",
        qualitative_descriptor: "Dominant aerial defender with elite positioning."
      })
    });

    const result = await extractPlayerProfile({
      researchDocument: "Research text",
      playerName: "Sami Hyypiä",
      position: "CB",
      ageAtMatch: 31
    });

    expect(result.tier).toBe("A");
    expect(googleGenAiMocks.constructor).toHaveBeenCalledWith({ apiKey: "test-key" });
    const request = googleGenAiMocks.generateContent.mock.calls[0]?.[0];
    expect(request?.model).toBe(PROFILE_EXTRACTION_MODEL);
    expect(request?.contents).toContain("Target player: Sami Hyypiä");
    expect(request?.config.temperature).toBe(1.0);
    expect(request?.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(request?.config.responseMimeType).toBe("application/json");
    expect(request?.config.responseJsonSchema.required).toEqual([
      "tier",
      "role_2004_05",
      "qualitative_descriptor"
    ]);
  });

  it("throws a typed error when the API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      extractPlayerProfile({
        researchDocument: "Research text",
        playerName: "Steven Gerrard"
      })
    ).rejects.toBeInstanceOf(ProfileExtractionError);
  });

  it("rejects invalid structured output", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    googleGenAiMocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        tier: "Z",
        role_2004_05: "Invalid tier.",
        qualitative_descriptor: "Invalid tier."
      })
    });

    await expect(
      extractPlayerProfile({
        researchDocument: "Research text",
        playerName: "Sami Hyypiä"
      })
    ).rejects.toBeInstanceOf(ProfileExtractionError);
  });
});
