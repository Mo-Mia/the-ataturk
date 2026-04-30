import { useMutation } from "@tanstack/react-query";

import { runAttributeDerivation, type AttributeDerivationRequest } from "../lib/api";

interface DerivePlayerAttributesButtonProps {
  datasetVersion: string | undefined;
  disabledReason?: string | undefined;
  onFinished: () => void;
  playerId: string;
  profileVersion: string | undefined;
  runDerivation?: typeof runAttributeDerivation;
}

export function DerivePlayerAttributesButton({
  datasetVersion,
  disabledReason,
  onFinished,
  playerId,
  profileVersion,
  runDerivation = runAttributeDerivation
}: DerivePlayerAttributesButtonProps) {
  const mutation = useMutation({
    mutationFn: () => {
      if (!datasetVersion || !profileVersion) {
        throw new Error("Both active versions are required");
      }

      const body: AttributeDerivationRequest = {
        dataset_version: datasetVersion,
        profile_version: profileVersion,
        player_ids: [playerId]
      };

      return runDerivation(body, () => undefined);
    },
    onSuccess: () => {
      onFinished();
    }
  });
  const isDisabled = Boolean(disabledReason) || mutation.isPending;

  return (
    <div>
      <button type="button" disabled={isDisabled} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Deriving..." : "Derive this player"}
      </button>
      {disabledReason ? <p className="admin-muted">{disabledReason}</p> : null}
      {mutation.isSuccess ? <p>Attributes derived.</p> : null}
      {mutation.error ? (
        <p className="admin-error">
          {mutation.error instanceof Error ? mutation.error.message : "Attribute derivation failed"}
        </p>
      ) : null}
    </div>
  );
}
