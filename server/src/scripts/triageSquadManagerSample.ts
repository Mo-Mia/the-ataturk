import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import type { Fc25ClubId } from "@the-ataturk/data";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const [{ buildApp }, data, triage] = await Promise.all([
  import("../app"),
  import("@the-ataturk/data"),
  import("../squad-manager/triageSample")
]);

const outputDir = fileURLToPath(new URL("../../../docs", import.meta.url));
const clubs = parseClubList(process.argv.slice(2));
const app = buildApp();

try {
  const result = await triage.runSquadManagerTriageSample({
    app,
    outputDir,
    ...(clubs.length > 0 ? { clubs } : {})
  });
  console.log(
    JSON.stringify(
      {
        mode: result.report.mode,
        activeDatasetVersionId: result.report.datasetAfter.activeDatasetVersionId,
        noDatasetMutation: result.report.noDatasetMutation,
        summary: result.report.summary,
        jsonPath: result.jsonPath,
        markdownPath: result.markdownPath
      },
      null,
      2
    )
  );

  if (result.report.summary.failed > 0) {
    process.exitCode = 1;
  }
} finally {
  await app.close();
}

function parseClubList(args: string[]): Fc25ClubId[] {
  const raw =
    args.find((arg) => arg.startsWith("--clubs="))?.slice("--clubs=".length) ??
    process.env.SQUAD_MANAGER_TRIAGE_CLUBS;

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((club) => club.trim())
    .filter((club): club is Fc25ClubId => data.FC25_CLUB_IDS.includes(club as Fc25ClubId));
}
