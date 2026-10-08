/**
 * Branded OTP emails. Inline styles and tables only: most email clients strip
 * <style> blocks and modern CSS. Colours mirror the frontend dark theme
 * (navy background, signal-orange primary).
 */

export type EmailContent = { subject: string; text: string; html: string };

export const colors = {
  page: '#0b0d24',
  card: '#151735',
  border: '#2a2d57',
  text: '#f5f1ea',
  muted: '#b4aea6',
  primary: '#f26a36',
  codeBg: '#1d2046',
};

export const fontStack =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({
  preheader,
  eyebrow,
  title,
  greeting,
  intro,
  code,
  expiresInMinutes,
  footnote,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  code: string;
  expiresInMinutes: number;
  footnote: string;
}) {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${colors.page};font-family:${fontStack};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.page};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 4px 24px;">
                <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${colors.text};">Titan<span style="color:${colors.primary};">.</span></span>
                <span style="display:block;margin-top:2px;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${colors.primary};">Freelance</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${colors.card};border:1px solid ${colors.border};border-radius:16px;padding:36px 32px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${colors.primary};">&#9679;&nbsp; ${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:800;color:${colors.text};">${escapeHtml(title)}</h1>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${colors.text};">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${colors.muted};">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="background-color:${colors.codeBg};border:1px solid ${colors.primary};border-radius:12px;padding:22px 12px;">
                      <span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.35em;color:${colors.text};">${escapeHtml(code)}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;text-align:center;font-size:13px;color:${colors.muted};">This code expires in <strong style="color:${colors.text};">${expiresInMinutes} minutes</strong>.</p>
                <hr style="margin:28px 0 20px;border:none;border-top:1px solid ${colors.border};" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:${colors.muted};">${escapeHtml(footnote)}</p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${colors.muted};">Never share this code with anyone — the Titan team will never ask for it.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 4px 0;font-size:12px;line-height:1.6;color:${colors.muted};">
                &copy; ${year} Titan Freelance · The human layer behind AI
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function greetingFor(name?: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : 'Hi there,';
}

export function signupVerificationEmail({
  name,
  code,
  expiresInMinutes,
}: {
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}): EmailContent {
  const greeting = greetingFor(name);
  const intro =
    'Welcome to Titan! Use the code below to verify your email and finish creating your account.';
  const footnote =
    "Didn't sign up for Titan? You can safely ignore this email — no account will be created.";

  return {
    subject: `${code} is your Titan verification code`,
    text: `${greeting}\n\n${intro}\n\nVerification code: ${code}\nThis code expires in ${expiresInMinutes} minutes.\n\n${footnote}\n\n— Titan Freelance`,
    html: layout({
      preheader: `Your verification code is ${code}`,
      eyebrow: 'Verify your email',
      title: 'Confirm your email address',
      greeting,
      intro,
      code,
      expiresInMinutes,
      footnote,
    }),
  };
}

export function passwordResetEmail({
  name,
  code,
  expiresInMinutes,
}: {
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}): EmailContent {
  const greeting = greetingFor(name);
  const intro =
    'We received a request to reset the password for your Titan account. Enter this code to choose a new password.';
  const footnote =
    "Didn't request a password reset? Ignore this email — your password won't change. If this keeps happening, contact support.";

  return {
    subject: `${code} is your Titan password reset code`,
    text: `${greeting}\n\n${intro}\n\nReset code: ${code}\nThis code expires in ${expiresInMinutes} minutes.\n\n${footnote}\n\n— Titan Freelance`,
    html: layout({
      preheader: `Your password reset code is ${code}`,
      eyebrow: 'Reset password',
      title: 'Reset your password',
      greeting,
      intro,
      code,
      expiresInMinutes,
      footnote,
    }),
  };
}
