import type { SquadManagerSuggestion } from "../lib/api";

interface ApplyDialogProps {
  open: boolean;
  baseVersionId: string;
  acceptedSuggestions: SquadManagerSuggestion[];
  applying?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ApplyDialog({
  open,
  baseVersionId,
  acceptedSuggestions,
  applying = false,
  onCancel,
  onConfirm
}: ApplyDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title">
      <div className="apply-dialog__panel">
        <h2 id="apply-title">Apply accepted suggestions</h2>
        <p>
          Preview: {baseVersionId} via squad-manager · {acceptedSuggestions.length} accepted
        </p>
        <div className="apply-dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={applying}>
            {applying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
