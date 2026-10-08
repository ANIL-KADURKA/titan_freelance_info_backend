import { describe, expect, it, vi } from 'vitest';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  nextVersion,
  signatureCovers,
  versionLabel,
} from './agreement-rules.js';
import { AgreementsService } from './agreements.service.js';

const v1 = {
  id: 'ag-1',
  major: 1,
  minor: 0,
  title: 'Titan Trainer Agreement',
  body: '## 1. Work\n- Be honest.',
  changeNote: null,
  createdById: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

describe('agreement rules', () => {
  it('labels and bumps versions', () => {
    expect(versionLabel({ major: 2, minor: 3 })).toBe('v2.3');
    expect(nextVersion(null, false)).toEqual({ major: 1, minor: 0 });
    expect(nextVersion(v1, false)).toEqual({ major: 1, minor: 1 });
    expect(nextVersion({ major: 1, minor: 4 }, true)).toEqual({
      major: 2,
      minor: 0,
    });
  });

  it('a signature covers later minor versions only', () => {
    expect(
      signatureCovers({ major: 1, minor: 0 }, { major: 1, minor: 2 }),
    ).toBe(true);
    expect(
      signatureCovers({ major: 1, minor: 2 }, { major: 2, minor: 0 }),
    ).toBe(false);
  });
});

describe('AgreementsService', () => {
  function createService(records: unknown[] = []) {
    const prisma = {
      agreement: {
        findFirst: vi.fn().mockResolvedValue(v1),
        create: vi.fn(({ data }) =>
          Promise.resolve({ ...v1, id: 'ag-2', ...data }),
        ),
      },
      consentRecord: {
        findMany: vi.fn().mockResolvedValue(records),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ legalName: 'Asha Rao' }),
      },
    };
    const notifications = { notifyCandidates: vi.fn() };
    const service = new AgreementsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    return { service, prisma, notifications };
  }

  it('signs the current version with the typed legal name', async () => {
    const { service, prisma } = createService();
    await service.sign('u1', '  asha   rao ', 'UA', '1.2.3.4');
    expect(prisma.consentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agreementId: 'ag-1',
        version: 'v1.0',
        signatureName: 'asha   rao',
        ipAddress: '1.2.3.4',
      }),
    });
  });

  it('rejects a signature that does not match the legal name', async () => {
    const { service } = createService();
    await expect(service.sign('u1', 'Someone Else')).rejects.toThrow(
      'Asha Rao',
    );
  });

  it('asks for a re-sign after a major update', async () => {
    const { service, prisma } = createService([
      {
        id: 'c0',
        grantedAt: new Date(),
        agreement: { major: 1, minor: 0 },
        version: 'v1.0',
      },
    ]);
    prisma.agreement.findFirst.mockResolvedValue({ ...v1, major: 2 });
    expect((await service.mine('u1')).status).toBe('RESIGN_REQUIRED');

    prisma.agreement.findFirst.mockResolvedValue({ ...v1, minor: 3 });
    expect((await service.mine('u1')).status).toBe('SIGNED');
  });

  it('publishes a major version and notifies candidates', async () => {
    const { service, prisma, notifications } = createService();
    const created = await service.publish('admin-1', {
      title: v1.title,
      body: '## 1. Work\n- Be honest and on time.',
      changeNote: 'Added timeliness',
      requireResign: true,
    });
    expect(created.version).toBe('v2.0');
    expect(prisma.agreement.create).toHaveBeenCalled();
    expect(notifications.notifyCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AGREEMENT_UPDATED',
        link: '/agreements',
      }),
    );
  });

  it('a minor update does not notify, and an unchanged one is refused', async () => {
    const { service, notifications } = createService();
    const created = await service.publish('admin-1', {
      title: v1.title,
      body: '## 1. Work\n- Be honest!',
      requireResign: false,
    });
    expect(created.version).toBe('v1.1');
    expect(notifications.notifyCandidates).not.toHaveBeenCalled();
    await expect(
      service.publish('admin-1', {
        title: v1.title,
        body: v1.body,
        requireResign: false,
      }),
    ).rejects.toThrow('Nothing changed');
  });
});
