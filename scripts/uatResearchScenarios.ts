export type UatFormation = "4-4-2" | "4-3-1-2" | "4-3-3" | "4-2-3-1";
export type UatMentality = "defensive" | "balanced" | "attacking";
export type UatTempo = "slow" | "normal" | "fast";
export type UatPressing = "low" | "medium" | "high";
export type UatLineHeight = "deep" | "normal" | "high";
export type UatWidth = "narrow" | "normal" | "wide";

export interface UatTactics {
  formation: UatFormation;
  mentality: UatMentality;
  tempo: UatTempo;
  pressing: UatPressing;
  lineHeight: UatLineHeight;
  width: UatWidth;
}

export const DEFAULT_UAT_TACTICS: UatTactics = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

export type UatScenarioState = "pass" | "fail" | "warning";
export type UatScenarioId =
  | "dashboard"
  | "replay"
  | "tactical-contrast"
  | "formation-compare"
  | "batch-distribution"
  | "admin-squad-manager";

type TacticsOverride = Partial<UatTactics>;

export interface UatSimulationRequestDefinition {
  home: {
    clubId: string;
    tactics?: TacticsOverride;
  };
  away: {
    clubId: string;
    tactics?: TacticsOverride;
  };
  seed: number;
  batch: number | "options.batchSize";
  duration: "full_90" | "second_half";
  autoSubs: boolean;
}

export interface UatScenarioDefinition {
  id: UatScenarioId;
  title: string;
  workflowSteps: string[];
  expectedDirections?: Array<{
    metric: string;
    expected: "increase" | "decrease";
  }>;
  evidenceSchema: {
    observations: string[];
    screenshots: string[];
    assertions?: string[];
  };
}

export interface UatDashboardScenarioDefinition extends UatScenarioDefinition {
  expectedDatasetVersionId: "importedDatasetVersionId";
}

export interface UatReplayScenarioDefinition extends UatScenarioDefinition {
  simulation: UatSimulationRequestDefinition;
}

export interface UatTacticalContrastScenarioDefinition extends UatScenarioDefinition {
  baselineSimulation: UatSimulationRequestDefinition;
  variantSimulation: UatSimulationRequestDefinition;
}

export interface UatFormationCompareScenarioDefinition extends UatScenarioDefinition {
  compareAgainstScenario: "replay";
  alternateSimulation: UatSimulationRequestDefinition;
  expectedXiChange: "home";
}

export interface UatBatchScenarioDefinition extends UatScenarioDefinition {
  simulation: UatSimulationRequestDefinition;
}

export interface UatAdminScenarioDefinition extends UatScenarioDefinition {
  selections: {
    homeClubId: string;
    awayClubId: string;
    focusedClubId: string;
  };
  expectedApply: {
    reviewModeDefault: "on";
    riskLevel: "low";
    actor: "squad-manager-ui";
  };
}

export interface UatResearchScenarioCatalog {
  dashboard: UatDashboardScenarioDefinition;
  replay: UatReplayScenarioDefinition;
  tacticalContrast: UatTacticalContrastScenarioDefinition;
  formationCompare: UatFormationCompareScenarioDefinition;
  batchDistribution: UatBatchScenarioDefinition;
  adminSquadManager: UatAdminScenarioDefinition;
}

export const UAT_RESEARCH_SCENARIOS: UatResearchScenarioCatalog = {
  dashboard: {
    id: "dashboard",
    title: "Dashboard Active Dataset",
    workflowSteps: [
      "Navigate to `/`.",
      "Wait for dashboard page and active-dataset widget ready state.",
      "Extract dataset id, club count, and player count.",
      "Capture dashboard screenshot."
    ],
    expectedDatasetVersionId: "importedDatasetVersionId",
    evidenceSchema: {
      observations: ["activeDatasetVersionId", "clubCount", "playerCount"],
      screenshots: ["dashboard"]
    }
  },
  replay: {
    id: "replay",
    title: "Run And Replay",
    workflowSteps: [
      "Navigate to `/visualise/run`.",
      "Submit one full-90 Liverpool v Manchester City run.",
      "Open the produced replay artefact.",
      "Capture replay screenshot."
    ],
    simulation: {
      home: { clubId: "liverpool", tactics: { formation: "4-3-3" } },
      away: { clubId: "manchester-city", tactics: { formation: "4-3-3" } },
      seed: 260501,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    },
    evidenceSchema: {
      observations: ["runId", "seed", "artefactId", "score", "shots", "fouls"],
      screenshots: ["replay"]
    }
  },
  tacticalContrast: {
    id: "tactical-contrast",
    title: "Tactical Contrast",
    workflowSteps: [
      "Submit same-teams/same-seed baseline with low pressing and slow tempo.",
      "Submit same-teams/same-seed variant with attacking mentality, high pressing, fast tempo, and high line.",
      "Compare total fouls directionally."
    ],
    baselineSimulation: {
      home: { clubId: "liverpool", tactics: { pressing: "low", tempo: "slow" } },
      away: { clubId: "manchester-city" },
      seed: 260502,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    },
    variantSimulation: {
      home: {
        clubId: "liverpool",
        tactics: {
          mentality: "attacking",
          pressing: "high",
          tempo: "fast",
          lineHeight: "high"
        }
      },
      away: { clubId: "manchester-city" },
      seed: 260502,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    },
    expectedDirections: [
      {
        metric: "same-seed high pressing and fast tempo total fouls",
        expected: "increase"
      }
    ],
    evidenceSchema: {
      observations: ["seed", "baselineFouls", "variantFouls", "assertionMode"],
      screenshots: [],
      assertions: ["same-seed high pressing and fast tempo total fouls"]
    }
  },
  formationCompare: {
    id: "formation-compare",
    title: "Formation Compare",
    workflowSteps: [
      "Submit alternate Liverpool v Manchester City run with different formations.",
      "Open compare page with replay scenario run and alternate run.",
      "Assert home XI changed.",
      "Capture compare screenshot."
    ],
    compareAgainstScenario: "replay",
    alternateSimulation: {
      home: { clubId: "liverpool", tactics: { formation: "4-2-3-1" } },
      away: { clubId: "manchester-city", tactics: { formation: "4-4-2" } },
      seed: 260503,
      batch: 1,
      duration: "full_90",
      autoSubs: true
    },
    expectedXiChange: "home",
    evidenceSchema: {
      observations: ["baselineRunId", "alternateRunId", "homeXiChanged"],
      screenshots: ["compare"]
    }
  },
  batchDistribution: {
    id: "batch-distribution",
    title: "Batch Distribution",
    workflowSteps: [
      "Submit Liverpool v Arsenal batch using configured batch size.",
      "Open batch distribution page.",
      "Capture mean goals and mean shots.",
      "Capture batch screenshot."
    ],
    simulation: {
      home: { clubId: "liverpool", tactics: { formation: "4-3-3" } },
      away: { clubId: "arsenal", tactics: { formation: "4-2-3-1" } },
      seed: 260600,
      batch: "options.batchSize",
      duration: "full_90",
      autoSubs: true
    },
    evidenceSchema: {
      observations: ["runCount", "batchId", "meanGoals", "meanShots"],
      screenshots: ["batch"]
    }
  },
  adminSquadManager: {
    id: "admin-squad-manager",
    title: "Squad Manager Verify Apply Activate",
    workflowSteps: [
      "Navigate to `/admin/squad-manager`.",
      "Select Liverpool v Manchester City with Liverpool focused.",
      "Verify squad through fixture or live admin route.",
      "Confirm review-mode guard blocks low-risk apply.",
      "Toggle review mode off, confirm low-risk apply, then explicitly activate the new dataset version."
    ],
    selections: {
      homeClubId: "liverpool",
      awayClubId: "manchester-city",
      focusedClubId: "liverpool"
    },
    expectedApply: {
      reviewModeDefault: "on",
      riskLevel: "low",
      actor: "squad-manager-ui"
    },
    evidenceSchema: {
      observations: [
        "reviewModeGuarded",
        "appliedSuggestionCount",
        "newDatasetVersionId",
        "activatedDatasetVersionId",
        "auditActor",
        "auditRiskLevel"
      ],
      screenshots: ["squad-manager-review", "squad-manager-apply-modal", "squad-manager-applied"]
    }
  }
};

export function simulationPayload(
  definition: UatSimulationRequestDefinition,
  input: { batchSize?: number } = {}
) {
  return {
    home: {
      clubId: definition.home.clubId,
      tactics: { ...DEFAULT_UAT_TACTICS, ...definition.home.tactics }
    },
    away: {
      clubId: definition.away.clubId,
      tactics: { ...DEFAULT_UAT_TACTICS, ...definition.away.tactics }
    },
    seed: definition.seed,
    batch: definition.batch === "options.batchSize" ? input.batchSize : definition.batch,
    duration: definition.duration,
    autoSubs: definition.autoSubs
  };
}
