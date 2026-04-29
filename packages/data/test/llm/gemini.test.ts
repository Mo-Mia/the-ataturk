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

    constructor(options: unknown) {
      googleGenAiMocks.constructor(options);
    }
  },
  ThinkingLevel: {
    LOW: "LOW"
  }
}));

import {
  PROFILE_EXTRACTION_MODEL,
  ProfileExtractionError,
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
