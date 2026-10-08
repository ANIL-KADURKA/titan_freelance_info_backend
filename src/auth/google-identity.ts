import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export type GoogleProfile = {
  googleId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
};

type TokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type UserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

const failed = () =>
  new UnauthorizedException('Google sign-in failed. Please try again.');

async function getJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new ServiceUnavailableException(
      'Could not reach Google. Please try again.',
    );
  }
  if (!response.ok) throw failed();
  return (await response.json()) as T;
}

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * Verifies a Google Identity Services ID token (the "credential" from the
 * Sign in with Google button) with Google's tokeninfo endpoint, which checks
 * the signature and expiry; we then check it was issued for our client and
 * the email is verified.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile> {
  let response: Response;
  try {
    response = await fetchImpl(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
  } catch {
    throw new ServiceUnavailableException(
      'Could not reach Google. Please try again.',
    );
  }
  if (!response.ok) {
    throw new UnauthorizedException('Google sign-in failed. Please try again.');
  }
  const info = (await response.json()) as TokenInfo;
  const verified =
    info.email_verified === true || info.email_verified === 'true';
  if (
    info.aud !== clientId ||
    !info.iss ||
    !ISSUERS.has(info.iss) ||
    !info.sub ||
    !info.email ||
    Number(info.exp ?? 0) * 1000 < Date.now()
  ) {
    throw new UnauthorizedException('Google sign-in failed. Please try again.');
  }
  if (!verified) {
    throw new UnauthorizedException(
      'Your Google email is not verified. Verify it with Google or sign up with email.',
    );
  }
  return {
    googleId: info.sub,
    email: info.email.trim().toLowerCase(),
    firstName: info.given_name?.trim() || null,
    lastName: info.family_name?.trim() || null,
    picture: info.picture ?? null,
  };
}

/**
 * Verifies an OAuth access token from our own "Sign in with Google" button
 * (Google's token client): it must be issued to our client, then the
 * profile comes from Google's userinfo endpoint.
 */
export async function verifyGoogleAccessToken(
  accessToken: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile> {
  const info = await getJson<TokenInfo & { azp?: string }>(
    fetchImpl,
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (
    (info.aud !== clientId && info.azp !== clientId) ||
    Number(info.exp ?? 0) * 1000 < Date.now()
  ) {
    throw failed();
  }
  const user = await getJson<UserInfo>(
    fetchImpl,
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!user.sub || !user.email || (info.sub && info.sub !== user.sub)) {
    throw failed();
  }
  if (!user.email_verified) {
    throw new UnauthorizedException(
      'Your Google email is not verified. Verify it with Google or sign up with email.',
    );
  }
  return {
    googleId: user.sub,
    email: user.email.trim().toLowerCase(),
    firstName: user.given_name?.trim() || null,
    lastName: user.family_name?.trim() || null,
    picture: user.picture ?? null,
  };
}
