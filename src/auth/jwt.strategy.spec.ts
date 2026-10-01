import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { JwtStrategy } from './jwt.strategy.js';

function createStrategy(
  user: { tokenVersion: number; deletedAt: Date | null } | null,
) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  } as unknown as PrismaService;
  const config = { get: () => 'test-secret' } as unknown as ConfigService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy.validate', () => {
  const payload = { sub: 'user-1', email: 'a@b.com' };

  it('accepts a token issued for the current token version', async () => {
    const strategy = createStrategy({ tokenVersion: 2, deletedAt: null });
    await expect(
      strategy.validate({ ...payload, ver: 2 }),
    ).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('treats tokens without a version as version 0', async () => {
    const strategy = createStrategy({ tokenVersion: 0, deletedAt: null });
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('rejects tokens issued before a password change', async () => {
    const strategy = createStrategy({ tokenVersion: 3, deletedAt: null });
    await expect(strategy.validate({ ...payload, ver: 2 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects tokens for deleted or missing users', async () => {
    await expect(
      createStrategy({ tokenVersion: 0, deletedAt: new Date() }).validate(
        payload,
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(createStrategy(null).validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
