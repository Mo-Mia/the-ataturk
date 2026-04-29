import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  PLAYER_ATTRIBUTE_NAMES,
  type PlayerAttributeName,
  type PlayerAttributes,
  updatePlayerAttributes
} from "../lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

interface AttributeEditorProps {
  attributes: PlayerAttributes;
  onSaved(updatedAttributes: PlayerAttributes): void;
  saveAttributes?: typeof updatePlayerAttributes;
}

function labelForAttribute(attributeName: PlayerAttributeName): string {
  return attributeName.replace("_", " ");
}

export function AttributeEditor({
  attributes,
  onSaved,
  saveAttributes = updatePlayerAttributes
}: AttributeEditorProps) {
  const [values, setValues] = useState<Record<PlayerAttributeName, string>>(() =>
    Object.fromEntries(
      PLAYER_ATTRIBUTE_NAMES.map((attributeName) => [attributeName, String(attributes[attributeName])])
    ) as Record<PlayerAttributeName, string>
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PlayerAttributeName, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setValues(
      Object.fromEntries(
        PLAYER_ATTRIBUTE_NAMES.map((attributeName) => [attributeName, String(attributes[attributeName])])
      ) as Record<PlayerAttributeName, string>
    );
  }, [attributes]);

  const mutation = useMutation({
    mutationFn: (input: { attributeName: PlayerAttributeName; value: number }) =>
      saveAttributes(attributes.player_id, {
        dataset_version: attributes.dataset_version,
        changes: { [input.attributeName]: input.value }
      }),
    onMutate: () => {
      setSaveState("saving");
      setSaveError(null);
    },
    onSuccess: (updatedAttributes) => {
      setSaveState("saved");
      onSaved(updatedAttributes);
    },
    onError: (error) => {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Save failed");
    }
  });

  function validateValue(attributeName: PlayerAttributeName, rawValue: string): number | null {
    const value = Number.parseInt(rawValue, 10);

    if (!Number.isInteger(value) || value < 0 || value > 100 || String(value) !== rawValue) {
      setFieldErrors((current) => ({
        ...current,
        [attributeName]: "Enter an integer from 0 to 100."
      }));
      return null;
    }

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[attributeName];
      return next;
    });

    return value;
  }

  function saveAttribute(attributeName: PlayerAttributeName): void {
    const value = validateValue(attributeName, values[attributeName]);

    if (value === null || value === attributes[attributeName]) {
      return;
    }

    mutation.mutate({ attributeName, value });
  }

  return (
    <section className="admin-panel" aria-label="Attribute editor">
      <h2>Attributes</h2>
      <p className="admin-muted">Blur a field to save that value.</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {PLAYER_ATTRIBUTE_NAMES.map((attributeName) => (
            <tr key={attributeName}>
              <td>{labelForAttribute(attributeName)}</td>
              <td>
                <input
                  aria-label={labelForAttribute(attributeName)}
                  className="attribute-input"
                  max={100}
                  min={0}
                  type="number"
                  value={values[attributeName]}
                  onBlur={() => saveAttribute(attributeName)}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [attributeName]: event.target.value
                    }))
                  }
                />
                {fieldErrors[attributeName] ? (
                  <div className="admin-error">{fieldErrors[attributeName]}</div>
                ) : null}
              </td>
              <td>{saveState}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {saveError ? <p className="admin-error">{saveError}</p> : null}
    </section>
  );
}
