import { describe, expect, it, vi } from 'vitest';
import type { AgreementsService } from '../agreements/agreements.service.js';
import type { AuthService } from '../auth/auth.service.js';
import type { FirebaseAuthService } from '../common/firebase-auth.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import { OnboardingService } from './onboarding.service.js';

const userId = '11111111-1111-4111-8111-111111111111';

function createService({
  user = { id: userId, phone: null, phoneVerifiedAt: null } as {
    id: string;
    phone: string | null;
    phoneVerifiedAt: Date | null;
  },
  takenBy = null as { id: string } | null,
  firebaseConfigured = true,
} = {}) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findFirst: vi.fn().mockResolvedValue(takenBy),
      update,
    },
  } as unknown as PrismaService;
  const firebase = {
    isConfigured: firebaseConfigured,
    verifiedPhone: vi.fn().mockResolvedValue('+919876543210'),
  } as unknown as FirebaseAuthService;
  const service = new OnboardingService(
    prisma,
    {} as AuthService,
    { get: () => undefined } as unknown as ConfigService,
    {} as NotificationsService,
    {} as AgreementsService,
    firebase,
  );
  vi.spyOn(service, 'getState').mockResolvedValue({} as never);
  return { service, update };
}

describe('OnboardingService phone verification', () => {
  it('saves the number from the Firebase token as verified', async () => {
    const { service, update } = createService();
    await service.verifyFirebasePhone(userId, 'token');
    expect(update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phone: '+919876543210', phoneVerifiedAt: expect.any(Date) },
    });
  });

  it('rejects a number registered to another account', async () => {
    const { service, update } = createService({ takenBy: { id: 'other' } });
    await expect(service.verifyFirebasePhone(userId, 'token')).rejects.toThrow(
      'already registered',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('is a no-op when that number is already verified', async () => {
    const { service, update } = createService({
      user: { id: userId, phone: '+919876543210', phoneVerifiedAt: new Date() },
    });
    await service.verifyFirebasePhone(userId, 'token');
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses the mock OTP once Firebase is configured', async () => {
    const { service } = createService();
    await expect(
      service.sendPhoneOtp(userId, '+91 98765 43210'),
    ).rejects.toThrow('SMS code');
    await expect(service.verifyPhoneOtp(userId, '12345')).rejects.toThrow(
      'SMS code',
    );
  });
});
