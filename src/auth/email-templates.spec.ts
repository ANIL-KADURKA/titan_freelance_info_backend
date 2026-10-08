import { describe, expect, it } from 'vitest';
import {
  passwordResetEmail,
  signupVerificationEmail,
} from './email-templates.js';

describe('OTP email templates', () => {
  const input = { name: 'Usha Sri', code: '482913', expiresInMinutes: 10 };

  it('builds a signup verification email', () => {
    const email = signupVerificationEmail(input);
    expect(email.subject).toBe('482913 is your Titan verification code');
    expect(email.html).toContain('482913');
    expect(email.html).toContain('Confirm your email address');
    expect(email.text).toContain('Hi Usha,');
    expect(email.text).toContain('10 minutes');
  });

  it('builds a different password reset email', () => {
    const email = passwordResetEmail(input);
    expect(email.subject).toBe('482913 is your Titan password reset code');
    expect(email.html).toContain('Reset your password');
    expect(email.html).not.toContain('Confirm your email address');
  });

  it('escapes user-provided names and falls back without one', () => {
    expect(
      signupVerificationEmail({ ...input, name: '<script>x</script>' }).html,
    ).not.toContain('<script>x');
    expect(passwordResetEmail({ ...input, name: null }).text).toContain(
      'Hi there,',
    );
  });
});
