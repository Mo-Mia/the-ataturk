import type { SquadManagerSuggestion } from "../lib/api";

interface PlayerEditorWidgetProps {
  suggestion: SquadManagerSuggestion | null;
}

export function PlayerEditorWidget({ suggestion }: PlayerEditorWidgetProps) {
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

  const fields =
    suggestion.type === "player_addition"
      ? suggestion.proposed
      : suggestion.type === "player_update"
        ? suggestion.changes
        : { squadRole: "reserve" };

  return (
    <section className="player-editor-widget">
      <h2>Player editor</h2>
      <div className="retro-form-grid">
        {Object.entries(fields).map(([field, value]) => (
          <label key={field}>
            {field}
            <input readOnly value={String(value ?? "")} />
          </label>
        ))}
      </div>
    </section>
  );
}
