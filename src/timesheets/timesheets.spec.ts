import { describe, expect, it, vi } from 'vitest';
import type { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { S3StorageService } from '../common/s3-storage.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PaymentDataCipher } from '../payment-methods/payment-data-cipher.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PayoutsService } from './payouts.service.js';
import {
  checkQuantity,
  earliestLogDate,
  checkWorkDate,
  computeAmount,
} from './timesheet-rules.js';
import { TimesheetsService } from './timesheets.service.js';

const notifications = () => ({
  notifyUser: vi.fn().mockResolvedValue(undefined),
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
});

describe('timesheet rules', () => {
  it('allows logging from the selection day up to today only', () => {
    expect(checkWorkDate('2026-09-30', '2026-09-28', '2026-10-01')).toBeNull();
    expect(checkWorkDate('2026-10-02', '2026-09-28', '2026-10-01')).toMatch(
      /future/,
    );
    expect(checkWorkDate('2026-09-27', '2026-09-28', '2026-10-01')).toMatch(
      /from 2026-09-28/,
    );
    expect(checkWorkDate('2026-02-30', '2026-01-01', '2026-10-01')).toMatch(
      /valid date/,
    );
  });

  it('allows one extra earlier day outside production', () => {
    expect(earliestLogDate('2026-10-01', true)).toBe('2026-10-01');
    expect(earliestLogDate('2026-10-01', false)).toBe('2026-09-30');
    expect(earliestLogDate('2026-03-01', false)).toBe('2026-02-28');
  });

  it('enforces per-unit quantity limits and steps', () => {
    expect(checkQuantity('HOUR', 6.25)).toBeNull();
    expect(checkQuantity('HOUR', 25)).toMatch(/at most 24/);
    expect(checkQuantity('HOUR', 6.1)).toMatch(/steps of 0.25/);
    expect(checkQuantity('DAY', 1.5)).toMatch(/at most 1/);
    expect(checkQuantity('TASK', 0)).toMatch(/Enter how much/);
  });

  it('rounds money to two decimals', () => {
    expect(computeAmount(6.25, 450)).toBe(2812.5);
    expect(computeAmount(1, 12.345)).toBe(12.35);
  });
});

describe('TimesheetsService', () => {
  const proofImage = {
    originalname: 'work.png',
    mimetype: 'image/png',
    buffer: Buffer.from('x'),
    size: 1,
  };

  function createService(
    existingStatus?: 'APPROVED' | 'SUBMITTED',
    existingProof: string | null = null,
  ) {
    const today = new Date();
    const application = {
      id: 'app-1',
      userId: 'u1',
      status: 'HIRED',
      statusChangedAt: new Date(today.getTime() - 5 * 86400000),
      candidate: { email: 'u@test.com', firstName: 'Ravi', lastName: null },
      job: {
        id: 'job-1',
        title: 'Evaluator',
        slug: 'evaluator',
        payAmount: 450,
        payCurrency: 'INR',
        payUnit: 'HOUR',
      },
      statusHistory: [],
    };
    const create = vi.fn(({ data }) =>
      Promise.resolve({
        id: 'e1',
        payoutId: null,
        job: application.job,
        ...data,
      }),
    );
    const prisma = {
      candidateApplication: {
        findFirst: vi.fn().mockResolvedValue(application),
        findMany: vi.fn().mockResolvedValue([application]),
      },
      timesheetEntry: {
        findUnique: vi.fn().mockResolvedValue(
          existingStatus
            ? {
                id: 'e0',
                status: existingStatus,
                proofFileId: existingProof,
              }
            : null,
        ),
        create,
        update: vi.fn(({ data }) =>
          Promise.resolve({
            id: 'e0',
            payoutId: null,
            workDate: new Date(),
            job: application.job,
            ...data,
          }),
        ),
      },
    } as unknown as PrismaService;
    const uploadDocument = vi.fn().mockResolvedValue({ id: 'proof-1' });
    const notify = notifications();
    return {
      service: new TimesheetsService(
        prisma,
        notify as unknown as NotificationsService,
        {
          uploadDocument,
          deleteDocument: vi.fn().mockResolvedValue(undefined),
        } as unknown as AwsDocumentUploadService,
        {} as S3StorageService,
      ),
      create,
      notify,
      uploadDocument,
    };
  }

  it('snapshots the rate and computes the amount', async () => {
    const { service, create, notify } = createService();
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    const entry = await service.saveEntry(
      'u1',
      {
        applicationId: 'app-1',
        workDate: yesterday,
        quantity: 4,
        note: 'Ranked conversations',
      },
      proofImage,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rate: 450,
          currency: 'INR',
          unit: 'HOUR',
          amount: 1800,
          status: 'SUBMITTED',
          proofFileId: 'proof-1',
        }),
      }),
    );
    expect(entry.amount).toBe(1800);
    expect(entry.hasProof).toBe(true);
    expect(notify.notifyAdmins).toHaveBeenCalled();
  });

  it('requires a proof image for a new entry', async () => {
    const { service, uploadDocument } = createService();
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    await expect(
      service.saveEntry('u1', {
        applicationId: 'app-1',
        workDate: yesterday,
        quantity: 2,
        note: 'Did some work',
      }),
    ).rejects.toThrow('proof of your work');
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('keeps the existing proof when resubmitting without a new one', async () => {
    const { service, uploadDocument } = createService('SUBMITTED', 'old-proof');
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    const entry = await service.saveEntry('u1', {
      applicationId: 'app-1',
      workDate: yesterday,
      quantity: 3,
      note: 'Corrected hours',
    });
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(entry.hasProof).toBe(true);
  });

  it('refuses to change an approved day', async () => {
    const { service } = createService('APPROVED');
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    await expect(
      service.saveEntry('u1', {
        applicationId: 'app-1',
        workDate: yesterday,
        quantity: 2,
        note: 'More work',
      }),
    ).rejects.toThrow('already approved');
  });
});

describe('PayoutsService.create', () => {
  function createService({ entries = 2, linked = 2 } = {}) {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);
    const payoutCreate = vi.fn(({ data }) =>
      Promise.resolve({ id: 'p1', paidAt: new Date(), ...data }),
    );
    const tx = {
      timesheetEntry: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: entries }, (_, index) => ({
            id: `e${index}`,
            amount: 1000.5,
          })),
        ),
        updateMany: vi.fn().mockResolvedValue({ count: linked }),
      },
      payout: { create: payoutCreate },
    };
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'u@test.com' }),
      },
      userPaymentMethod: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const notify = notifications();
    const service = new PayoutsService(
      prisma,
      {
        uploadDocument: vi.fn().mockResolvedValue({ id: 'file-1' }),
        deleteDocument,
      } as unknown as AwsDocumentUploadService,
      {} as S3StorageService,
      {} as PaymentDataCipher,
      notify as unknown as NotificationsService,
    );
    return { service, payoutCreate, deleteDocument, notify };
  }

  const proof = {
    originalname: 'paid.png',
    mimetype: 'image/png',
    buffer: Buffer.from('x'),
    size: 1,
  };

  it('requires a proof file', async () => {
    const { service } = createService();
    await expect(
      service.create('admin', { userId: 'u1', currency: 'INR' }),
    ).rejects.toThrow('Upload the payment screenshot');
  });

  it('sums approved unpaid entries on the server and notifies', async () => {
    const { service, payoutCreate, notify } = createService();
    const payout = await service.create(
      'admin',
      { userId: 'u1', currency: 'INR', reference: 'UTR1' },
      proof,
    );
    expect(payoutCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 2001, proofFileId: 'file-1' }),
    });
    expect(payout.amount).toBe(2001);
    expect(notify.notifyUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'PAYOUT_SENT' }),
    );
  });

  it('deletes the uploaded proof if entries were paid concurrently', async () => {
    const { service, deleteDocument } = createService({ linked: 1 });
    await expect(
      service.create('admin', { userId: 'u1', currency: 'INR' }, proof),
    ).rejects.toThrow('just paid');
    expect(deleteDocument).toHaveBeenCalledWith('file-1');
  });
});
