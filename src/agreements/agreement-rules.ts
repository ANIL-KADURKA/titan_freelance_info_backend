/** Pure rules for trainer-agreement versions and signatures. */

export type AgreementVersion = { major: number; minor: number };

/** "v1.0", "v2.3" */
export function versionLabel(version: AgreementVersion) {
  return `v${version.major}.${version.minor}`;
}

/** The version a publish creates: a new major when re-signing is required. */
export function nextVersion(
  current: AgreementVersion | null,
  requireResign: boolean,
): AgreementVersion {
  if (!current) return { major: 1, minor: 0 };
  return requireResign
    ? { major: current.major + 1, minor: 0 }
    : { major: current.major, minor: current.minor + 1 };
}

/**
 * A signature covers the current agreement when it was made on the same
 * major version — minor versions are wording fixes that don't need re-signing.
 */
export function signatureCovers(
  signed: AgreementVersion,
  current: AgreementVersion,
) {
  return signed.major === current.major;
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
