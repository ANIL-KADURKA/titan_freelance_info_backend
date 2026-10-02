/** Pure helpers for case studies. */

/** "From Applicant to AI Trainer!" → "from-applicant-to-ai-trainer" */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

/** "3 months", "1 year 2 months", "2 weeks" between two dates. */
export function describeDuration(from: Date, to: Date) {
  const days = Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / 86_400_000),
  );
  if (days < 30) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  const months = Math.round(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(' ') || '1 month';
}

/** "₹1,25,000" */
export function formatInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
