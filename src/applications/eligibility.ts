import type { EligibilityFieldType, EligibilityOperator } from '@prisma/client';

export type EligibilityRuleLike = {
  fieldKey: string;
  fieldType: EligibilityFieldType;
  operator: EligibilityOperator;
  value: unknown;
};

/** Stored on the application so admins see exactly what was checked. */
export type EligibilityResult = {
  fieldKey: string;
  fieldType: EligibilityFieldType;
  operator: EligibilityOperator;
  expected: unknown;
  answer: string;
  passed: boolean;
};

const toArray = (value: unknown) => (Array.isArray(value) ? value : [value]);

/** Answers and rule values are scalars; objects are serialised, not "[object Object]". */
const asText = (value: unknown) =>
  value === undefined || value === null
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value as string | number | boolean);

const toBoolean = (value: unknown) =>
  typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';

function normalize(value: string, fieldType: EligibilityFieldType) {
  if (fieldType === 'NUMBER') return Number(value);
  if (fieldType === 'BOOLEAN') return value === 'true';
  if (fieldType === 'DATE') return new Date(value).getTime();
  return value.trim();
}

function compare(
  first: unknown,
  second: unknown,
  fieldType: EligibilityFieldType,
) {
  if (fieldType === 'NUMBER') return Number(first) - Number(second);
  if (fieldType === 'BOOLEAN') {
    return Number(toBoolean(first)) - Number(toBoolean(second));
  }
  if (fieldType === 'DATE') {
    return Number(first) - new Date(String(second)).getTime();
  }
  return String(first).localeCompare(String(second), undefined, {
    sensitivity: 'accent',
  });
}

/** Same semantics as the apply page, so the server can't be bypassed. */
export function answerPassesRule(answer: string, rule: EligibilityRuleLike) {
  const expected = rule.value;
  const value = normalize(answer, rule.fieldType);
  switch (rule.operator) {
    case 'EQ':
      return compare(value, expected, rule.fieldType) === 0;
    case 'NE':
      return compare(value, expected, rule.fieldType) !== 0;
    case 'GT':
      return compare(value, expected, rule.fieldType) > 0;
    case 'GTE':
      return compare(value, expected, rule.fieldType) >= 0;
    case 'LT':
      return compare(value, expected, rule.fieldType) < 0;
    case 'LTE':
      return compare(value, expected, rule.fieldType) <= 0;
    case 'IN':
      return toArray(expected).some(
        (item) => compare(value, item, rule.fieldType) === 0,
      );
    case 'NOT_IN':
      return toArray(expected).every(
        (item) => compare(value, item, rule.fieldType) !== 0,
      );
    case 'EXISTS':
      return answer.trim().length > 0;
    case 'CONTAINS':
      return answer.toLowerCase().includes(asText(expected).toLowerCase());
    default:
      return false;
  }
}

/** Checks every rule; a missing answer fails its rule. */
export function checkEligibility(
  rules: EligibilityRuleLike[],
  answers: Record<string, unknown> = {},
) {
  const results: EligibilityResult[] = rules.map((rule) => {
    const raw = answers[rule.fieldKey];
    const answer = asText(raw).trim();
    return {
      fieldKey: rule.fieldKey,
      fieldType: rule.fieldType,
      operator: rule.operator,
      expected: rule.value,
      answer,
      passed: answer.length > 0 && answerPassesRule(answer, rule),
    };
  });
  return { results, eligible: results.every((result) => result.passed) };
}
