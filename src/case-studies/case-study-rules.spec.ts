import { describe, expect, it } from 'vitest';
import { missingForPublish, slugify } from './case-study-rules.js';

describe('case study rules', () => {
  it('slugifies titles', () => {
    expect(slugify('Hindi RLHF at Scale!')).toBe('hindi-rlhf-at-scale');
    expect(slugify('  Café — Résumé  ')).toBe('cafe-resume');
  });

  const complete = {
    isUpcoming: false,
    problemTitle: 'Problem',
    problemBody: null,
    approachTitle: 'Approach',
    approachBody: null,
    projects: [],
    results: [{ value: '96%', label: 'Accuracy' }],
  };

  it('accepts a problem/approach case study with a result', () => {
    expect(missingForPublish(complete)).toEqual([]);
  });

  it('accepts project cards instead of a problem and approach', () => {
    expect(
      missingForPublish({
        ...complete,
        problemTitle: null,
        approachTitle: null,
        projects: [{ name: 'Outlier', problem: 'p', approach: 'a' }],
      }),
    ).toEqual([]);
  });

  it('lists what a full case study is missing', () => {
    expect(
      missingForPublish({
        ...complete,
        problemTitle: '',
        results: [],
      }),
    ).toEqual(['the problem', 'at least one result']);
  });

  it('lets an upcoming placeholder publish with just the basics', () => {
    expect(
      missingForPublish({ isUpcoming: true, projects: [], results: [] }),
    ).toEqual([]);
  });
});
