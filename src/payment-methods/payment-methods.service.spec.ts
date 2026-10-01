import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PaymentDataCipher } from './payment-data-cipher.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { PaymentMethodsService } from './payment-methods.service.js';

const key = Buffer.alloc(32, 7).toString('base64');
const cipher = new PaymentDataCipher({
  get: (name: string) => (name === 'PAYMENT_DATA_KEY' ? key : undefined),
} as unknown as ConfigService);

function createService(existing: Array<{ fingerprint: string }> = []) {
  const create = vi.fn(({ data }) =>
    Promise.resolve({
      id: 'pm-1',
      status: 'VERIFICATION_PENDING',
      upiId: null,
      accountHolderName: null,
      accountNumberEncrypted: null,
      accountNumberLast4: null,
      ifsc: null,
      rejectionReason: null,
      reviewedAt: null,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      ...data,
    }),
  );
  const update = vi.fn(({ data }) =>
    Promise.resolve({
      id: 'pm-1',
      userId: 'user-1',
      type: 'BANK',
      accountNumberLast4: '9012',
      createdAt: new Date(),
      ...data,
    }),
  );
  const notifications = {
    notifyUser: vi.fn().mockResolvedValue(undefined),
    notifyAdmins: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    userPaymentMethod: {
      findMany: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue({ id: 'pm-1' }),
      create,
      update,
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ email: 'u@test.com', firstName: 'Usha' }),
    },
  } as unknown as PrismaService;
  return {
    service: new PaymentMethodsService(
      prisma,
      cipher,
      notifications as unknown as NotificationsService,
    ),
    create,
    update,
    notifications,
  };
}

describe('PaymentDataCipher', () => {
  it('round-trips encrypted values with a random IV', () => {
    const first = cipher.encrypt('123456789012');
    expect(first).not.toContain('123456789012');
    expect(first).not.toBe(cipher.encrypt('123456789012'));
    expect(cipher.decrypt(first)).toBe('123456789012');
  });
});

describe('PaymentMethodsService', () => {
  it('stores bank accounts encrypted and returns only the last 4 digits', async () => {
    const { service, create } = createService();
    const view = await service.create('user-1', {
      type: 'BANK',
      accountHolderName: 'Usha  Sri',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
    });

    const data = create.mock.calls[0][0].data;
    expect(data.accountNumberEncrypted).not.toContain('123456789012');
    expect(cipher.decrypt(data.accountNumberEncrypted)).toBe('123456789012');
    expect(data.accountHolderName).toBe('Usha Sri');
    expect(view).toMatchObject({
      status: 'VERIFICATION_PENDING',
      accountNumberLast4: '9012',
    });
    expect(JSON.stringify(view)).not.toContain('123456789012');
  });

  it('blocks adding the same method twice', async () => {
    const fingerprint = cipher.fingerprint('UPI:name@okhdfcbank');
    const { service } = createService([{ fingerprint }]);
    await expect(
      service.create('user-1', { type: 'UPI', upiId: 'Name@okhdfcbank' }),
    ).rejects.toThrow(ConflictException);
  });

  it('records the reviewer and rejection reason', async () => {
    const { service, update, notifications } = createService();
    await service.review('admin-1', 'pm-1', {
      decision: 'REJECTED',
      reason: 'Name does not match',
    });
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Name does not match',
      reviewedById: 'admin-1',
    });
    // The candidate is told why.
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        type: 'PAYMENT_METHOD_REVIEWED',
        title: 'Payout method rejected',
        message: expect.stringContaining('Name does not match'),
      }),
    );
  });
});
