/** Pure helpers for case studies. */

export type CaseStudyStat = { value: string; label: string };
export type CaseStudyBreakdownRow = {
  code: string;
  text: string;
  value: string;
};
export type CaseStudyResult = { value: string; label: string; note?: string };
export type CaseStudyProject = {
  name: string;
  problem: string;
  approach: string;
};

/** "Hindi RLHF at Scale!" → "hindi-rlhf-at-scale" */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

type PublishCheck = {
  isUpcoming: boolean;
  problemTitle?: string | null;
  problemBody?: string | null;
  approachTitle?: string | null;
  approachBody?: string | null;
  projects: unknown[];
  results: unknown[];
};

/**
 * What a full case study still needs before it can go live: the story (a
 * problem and an approach, or project cards) and at least one result.
 * Upcoming ones are only a placeholder card, so title and summary are enough.
 */
export function missingForPublish(study: PublishCheck): string[] {
  if (study.isUpcoming) return [];
  const missing: string[] = [];
  const hasProblem = Boolean(study.problemTitle || study.problemBody);
  const hasApproach = Boolean(study.approachTitle || study.approachBody);
  if (study.projects.length === 0) {
    if (!hasProblem) missing.push('the problem');
    if (!hasApproach) missing.push('the approach');
  }
  if (study.results.length === 0) missing.push('at least one result');
  return missing;
}
