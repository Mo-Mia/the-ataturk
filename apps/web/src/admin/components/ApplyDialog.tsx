import type { SquadManagerSuggestion } from "../lib/api";

interface ApplyDialogProps {
  open: boolean;
  baseVersionId: string;
  clubName: string;
  acceptedSuggestions: SquadManagerSuggestion[];
  applying?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ApplyDialog({
  open,
  baseVersionId,
  clubName,
  acceptedSuggestions,
  applying = false,
  onCancel,
  onConfirm
}: ApplyDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="apply-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-title"
      data-uat="squad-manager-apply-confirmation-modal"
    >
      <div className="apply-dialog__panel">
        <h2 id="apply-title">Apply low-risk suggestions</h2>
        <p>
          {acceptedSuggestions.length} low-risk suggestions for {clubName} will create a new
          inactive dataset version from {baseVersionId}.
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
