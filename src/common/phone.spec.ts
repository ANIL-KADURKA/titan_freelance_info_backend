import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { getOnboardingStep } from '../auth/auth.service.js';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['91-98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+14155552671', '+14155552671'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['12345', '98765 4321', 'abc'])('rejects %s', (input) => {
    expect(() => normalizePhone(input)).toThrow(BadRequestException);
  });
});

describe('getOnboardingStep', () => {
  const now = new Date();

  it('walks the steps in order', () => {
    const base = {
      phoneVerifiedAt: null,
      legalName: null,
      onboardingCompletedAt: null,
    };
    expect(getOnboardingStep(base)).toBe('phone');
    expect(getOnboardingStep({ ...base, phoneVerifiedAt: now })).toBe(
      'profile',
    );
    expect(
      getOnboardingStep({ ...base, phoneVerifiedAt: now, legalName: 'A B' }),
    ).toBe('agreement');
    expect(
      getOnboardingStep({
        phoneVerifiedAt: now,
        legalName: 'A B',
        onboardingCompletedAt: now,
      }),
    ).toBe('done');
  });
});
