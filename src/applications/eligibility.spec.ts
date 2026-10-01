import { describe, expect, it } from 'vitest';
import { answerPassesRule, checkEligibility } from './eligibility.js';

describe('eligibility', () => {
  it('compares numbers, booleans and lists', () => {
    expect(
      answerPassesRule('21', {
        fieldKey: 'age',
        fieldType: 'NUMBER',
        operator: 'GTE',
        value: '18',
      }),
    ).toBe(true);
    expect(
      answerPassesRule('false', {
        fieldKey: 'has_laptop',
        fieldType: 'BOOLEAN',
        operator: 'EQ',
        value: 'true',
      }),
    ).toBe(false);
    expect(
      answerPassesRule('M.Sc', {
        fieldKey: 'degree',
        fieldType: 'SELECT',
        operator: 'IN',
        value: ['M.Sc', 'PhD'],
      }),
    ).toBe(true);
  });

  it('fails missing answers and records every result', () => {
    const { eligible, results } = checkEligibility(
      [
        { fieldKey: 'age', fieldType: 'NUMBER', operator: 'GTE', value: 18 },
        {
          fieldKey: 'languages',
          fieldType: 'TEXT',
          operator: 'CONTAINS',
          value: 'Hindi',
        },
      ],
      { age: 30 },
    );
    expect(eligible).toBe(false);
    expect(results).toEqual([
      expect.objectContaining({ fieldKey: 'age', answer: '30', passed: true }),
      expect.objectContaining({
        fieldKey: 'languages',
        answer: '',
        passed: false,
      }),
    ]);
  });
});
