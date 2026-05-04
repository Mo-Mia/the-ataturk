import type { Fc25SquadPlayer, SquadManagerSuggestion } from "../lib/api";

interface PlayerEditorWidgetProps {
  suggestion: SquadManagerSuggestion | null;
  localPlayer?: Fc25SquadPlayer | undefined;
}

export function PlayerEditorWidget({ suggestion, localPlayer }: PlayerEditorWidgetProps) {
  if (!suggestion) {
    return (
      <section className="player-editor-widget">
        <h2>Player editor</h2>
        <p className="squad-manager-muted">
          Select a verification item to inspect editable fields.
        </p>
      </section>
    );
  }

  const fields = fieldsForSuggestion(suggestion, localPlayer);

  return (
    <section className="player-editor-widget">
      <h2>Player editor</h2>
      <div className="retro-form-grid">
        {fields.map(({ label, value }) => (
          <label key={label}>
            {label}
            <input readOnly value={String(value ?? "")} />
          </label>
        ))}
      </div>
    </section>
  );
}

function fieldsForSuggestion(
  suggestion: SquadManagerSuggestion,
  localPlayer: Fc25SquadPlayer | undefined
): Array<{ label: string; value: string | number | null | undefined }> {
  if (suggestion.type === "player_addition") {
    return [
      { label: "Name", value: suggestion.proposed.name },
      { label: "Position", value: suggestion.proposed.position },
      { label: "Age", value: suggestion.proposed.age },
      { label: "Nationality", value: suggestion.proposed.nationality },
      { label: "Shirt number", value: suggestion.proposed.shirtNumber ?? null }
    ];
  }

  if (suggestion.type === "player_removal") {
    return [
      { label: "Name", value: localPlayer?.name ?? suggestion.playerId },
      { label: "Position", value: localPlayer?.position ?? "" },
      { label: "Age", value: localPlayer?.age ?? "" },
      { label: "Nationality", value: "" },
      { label: "Shirt number", value: localPlayer?.squadNumber ?? "" },
      { label: "Squad role", value: "reserve" }
    ];
  }

  return [
    { label: "Name", value: suggestion.changes.name ?? localPlayer?.name ?? suggestion.playerId },
    { label: "Position", value: suggestion.changes.position ?? localPlayer?.position ?? "" },
    { label: "Age", value: suggestion.changes.age ?? localPlayer?.age ?? "" },
    { label: "Nationality", value: suggestion.changes.nationality ?? "" },
    { label: "Shirt number", value: localPlayer?.squadNumber ?? "" }
  ];
}
