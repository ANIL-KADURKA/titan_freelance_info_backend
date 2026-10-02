import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import {
  verifyGoogleAccessToken,
  verifyGoogleIdToken,
} from './google-identity.js';

const future = String(Math.floor(Date.now() / 1000) + 3600);
const goodInfo = {
  aud: 'client-1',
  iss: 'https://accounts.google.com',
  sub: 'g-123',
  email: 'Asha@Example.com',
  email_verified: 'true',
  exp: future,
  given_name: 'Asha',
  family_name: 'Rao',
};

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('verifyGoogleIdToken', () => {
  it('returns the profile for a valid token', async () => {
    await expect(
      verifyGoogleIdToken('token', 'client-1', fakeFetch(goodInfo)),
    ).resolves.toEqual({
      googleId: 'g-123',
      email: 'asha@example.com',
      firstName: 'Asha',
      lastName: 'Rao',
      picture: null,
    });
  });

  it('rejects a token issued for another app', async () => {
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-1',
        fakeFetch({ ...goodInfo, aud: 'other' }),
      ),
    ).rejects.toThrow('Google sign-in failed');
  });

  it('rejects an unverified email', async () => {
    await expect(
      verifyGoogleIdToken(
        'token',
        'client-1',
        fakeFetch({ ...goodInfo, email_verified: 'false' }),
      ),
    ).rejects.toThrow('not verified');
  });

  it('rejects when Google says the token is invalid', async () => {
    await expect(
      verifyGoogleIdToken('token', 'client-1', fakeFetch({}, false)),
    ).rejects.toThrow('Google sign-in failed');
  });
});

describe('verifyGoogleAccessToken', () => {
  it('checks the token is ours, then reads the profile', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ aud: 'client-1', sub: 'g-1', exp: future }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'g-1',
            email: 'A@x.com',
            email_verified: true,
            given_name: 'A',
            picture: 'https://pic',
          }),
      }) as unknown as typeof fetch;
    await expect(
      verifyGoogleAccessToken('token', 'client-1', fetchImpl),
    ).resolves.toMatchObject({
      googleId: 'g-1',
      email: 'a@x.com',
      picture: 'https://pic',
    });
  });

  it('rejects a token issued to another app', async () => {
    await expect(
      verifyGoogleAccessToken(
        'token',
        'client-1',
        fakeFetch({ aud: 'other', exp: future }),
      ),
    ).rejects.toThrow('Google sign-in failed');
  });
});

describe('AuthService.googleLogin', () => {
  function createService(existing: Record<string, unknown> | null) {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'new-1', ...data })),
      },
      role: { upsert: vi.fn().mockResolvedValue({ id: 'role-c' }) },
      userRole: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const config = {
      get: vi.fn((key: string) =>
        key === 'GOOGLE_CLIENT_ID' ? 'client-1' : undefined,
      ),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      config as unknown as ConfigService,
      {} as NotificationsService,
    );
    const session = { accessToken: 'a', refreshToken: 'r', user: { id: 'x' } };
    vi.spyOn(
      service as unknown as { createSession: () => Promise<unknown> },
      'createSession',
    ).mockResolvedValue(session);
    vi.stubGlobal('fetch', fakeFetch(goodInfo));
    return { service, prisma };
  }

  it('creates a verified candidate for a new email', async () => {
    const { service, prisma } = createService(null);
    const result = await service.googleLogin({ credential: 'token' });
    expect(result.isNewUser).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'asha@example.com',
        googleId: 'g-123',
        status: 'ACTIVE',
      }),
    });
    expect(prisma.userRole.upsert).toHaveBeenCalled();
  });

  it('links Google to an existing account and verifies a pending one', async () => {
    const { service, prisma } = createService({
      id: 'u1',
      email: 'asha@example.com',
      googleId: null,
      status: 'PENDING_VERIFICATION',
      emailVerifiedAt: null,
      firstName: null,
      lastName: null,
      deletedAt: null,
    });
    const result = await service.googleLogin({ credential: 'token' });
    expect(result.isNewUser).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        googleId: 'g-123',
        status: 'ACTIVE',
        firstName: 'Asha',
      }),
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a blocked account', async () => {
    const { service } = createService({
      id: 'u1',
      email: 'asha@example.com',
      googleId: null,
      status: 'INACTIVE',
      deletedAt: null,
    });
    await expect(service.googleLogin({ credential: 'token' })).rejects.toThrow(
      'not active',
    );
  });
});
