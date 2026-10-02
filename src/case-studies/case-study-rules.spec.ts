import { describe, expect, it } from 'vitest';
import { describeDuration, formatInr, slugify } from './case-study-rules.js';

describe('case study rules', () => {
  it('slugifies titles', () => {
    expect(slugify('From Applicant to AI Trainer!')).toBe(
      'from-applicant-to-ai-trainer',
    );
    expect(slugify('  Café — Résumé  ')).toBe('cafe-resume');
  });

  it('describes durations', () => {
    const from = new Date('2026-01-01');
    expect(describeDuration(from, new Date('2026-01-15'))).toBe('2 weeks');
    expect(describeDuration(from, new Date('2026-07-01'))).toBe('6 months');
    expect(describeDuration(from, new Date('2027-03-01'))).toBe(
      '1 year 2 months',
    );
  });

  it('formats rupees the Indian way', () => {
    expect(formatInr(125000)).toBe('₹1,25,000');
  });
});
