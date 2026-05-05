export interface Fc25DisplayNameInput {
  id: string;
  sourceName: string;
  sourceShortName?: string | null;
}

const CURATED_DISPLAY_NAMES: Record<string, string> = {
  "231866": "Rodri"
};

export function displayNameForFc25Player(input: Fc25DisplayNameInput): string {
  const curated = CURATED_DISPLAY_NAMES[input.id];
  if (curated) {
    return curated;
  }

  const sourceName = stripNonLatinSuffix(input.sourceName);
  const sourceShortName = input.sourceShortName
    ? stripNonLatinSuffix(input.sourceShortName)
    : null;

  if (!sourceShortName) {
    return sourceName;
  }

  const expandedInitialName = expandInitialisedShortName(sourceShortName, sourceName);
  if (expandedInitialName) {
    return expandedInitialName;
  }

  return sourceShortName;
}

export function stripNonLatinSuffix(value: string): string {
  const firstNonLatinIndex = Array.from(value).findIndex(
    (char) => !/[\p{Script=Latin}\p{Mark}\s.'’-]/u.test(char)
  );
  const latinPrefix =
    firstNonLatinIndex === -1 ? value : Array.from(value).slice(0, firstNonLatinIndex).join("");
  return latinPrefix.replace(/\s+/g, " ").trim();
}

function expandInitialisedShortName(shortName: string, sourceName: string): string | null {
  const match = /^([\p{Script=Latin}])\.\s+(.+)$/u.exec(shortName);
  if (!match) {
    return null;
  }

  const initial = match[1]!.toLocaleLowerCase();
  const surname = match[2]!.trim();
  const sourceTokens = sourceName.split(/\s+/).filter(Boolean);
  const firstName = sourceTokens[0];
  if (!firstName || !firstName.toLocaleLowerCase().startsWith(initial)) {
    return null;
  }

  const surnameTokens = surname.split(/\s+/).filter(Boolean);
  const sourceStartIndex = findTokenSequence(sourceTokens, surnameTokens);
  if (sourceStartIndex === -1) {
    return null;
  }

  return `${firstName} ${sourceTokens.slice(sourceStartIndex, sourceStartIndex + surnameTokens.length).join(" ")}`;
}

function findTokenSequence(sourceTokens: string[], needleTokens: string[]): number {
  if (needleTokens.length === 0 || sourceTokens.length < needleTokens.length) {
    return -1;
  }

  for (let index = 0; index <= sourceTokens.length - needleTokens.length; index += 1) {
    const matches = needleTokens.every(
      (token, offset) => normaliseToken(sourceTokens[index + offset]!) === normaliseToken(token)
    );
    if (matches) {
      return index;
    }
  }

  return -1;
}

function normaliseToken(value: string): string {
  return value.toLocaleLowerCase().replace(/[.'’]/g, "");
}
