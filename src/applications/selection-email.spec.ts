import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { MailService } from '../common/mail.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PaymentDataCipher } from '../payment-methods/payment-data-cipher.js';
import type { S3StorageService } from '../common/s3-storage.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationsService } from './applications.service.js';
import { selectionEmail } from './selection-email.js';

const applicationId = '44444444-4444-4444-8444-444444444444';

describe('selectionEmail', () => {
  it('includes credentials and numbered instructions, escaped', () => {
    const email = selectionEmail({
      name: 'Usha Sri',
      projectTitle: 'AI <Evaluator>',
      applicationNo: 'APP-1',
      workEmail: 'w@client.com',
      workPassword: 'p@ss<1>',
      workInstructions: '- Log in daily\n2. Track hours',
      projectsUrl: 'https://app.test/projects/current',
    });
    expect(email.subject).toContain('AI <Evaluator>');
    expect(email.html).toContain('AI &lt;Evaluator&gt;');
    expect(email.html).toContain('p@ss&lt;1&gt;');
    expect(email.html).toContain(
      '<li style="margin:0 0 6px;">Log in daily</li>',
    );
    expect(email.html).toContain('Open My Projects');
    expect(email.text).toContain('Password: p@ss<1>');
    expect(email.text).toContain('Hi Usha,');
  });
});

describe('ApplicationsService.selectCandidate', () => {
  function createService(sendFails = false) {
    const update = vi.fn();
    const historyCreate = vi.fn();
    const workAccountUpsert = vi.fn();
    const notifications = { notifyUser: vi.fn().mockResolvedValue(undefined) };
    const application = {
      id: applicationId,
      applicationNo: 'APP-1',
      userId: 'candidate-1',
      status: 'SHORTLISTED',
      candidate: { email: 'c@test.com', firstName: 'Ravi', lastName: null },
      job: { title: 'Evaluator' },
    };
    const prisma = {
      userRole: { count: vi.fn().mockResolvedValue(1) },
      candidateApplication: {
        findFirst: vi.fn().mockResolvedValue(application),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) =>
        run({
          candidateApplication: { update },
          applicationStatusHistory: { create: historyCreate },
          applicationWorkAccount: { upsert: workAccountUpsert },
        }),
      ),
    } as unknown as PrismaService;
    const send = sendFails
      ? vi.fn().mockRejectedValue(new Error('smtp down'))
      : vi.fn().mockResolvedValue(undefined);
    const service = new ApplicationsService(
      prisma,
      {} as AwsDocumentUploadService,
      {} as S3StorageService,
      { send } as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
      {
        encrypt: (value: string) => `enc(${value})`,
      } as unknown as PaymentDataCipher,
      notifications as unknown as NotificationsService,
    );
    return {
      service,
      send,
      update,
      historyCreate,
      workAccountUpsert,
      notifications,
    };
  }

  it('leaves the status unchanged when the email fails', async () => {
    const { service, update } = createService(true);
    await expect(
      service.selectCandidate(applicationId, 'admin-1', {
        workEmail: 'w@client.com',
        workPassword: 'secret',
      }),
    ).rejects.toThrow('smtp down');
    expect(update).not.toHaveBeenCalled();
  });

  it('emails first, then marks HIRED without storing the password', async () => {
    const {
      service,
      send,
      update,
      historyCreate,
      workAccountUpsert,
      notifications,
    } = createService();
    // The final re-read goes through assertCanAccess; stub it.
    vi.spyOn(
      service as unknown as { assertCanAccess: () => Promise<unknown> },
      'assertCanAccess',
    ).mockResolvedValue({ id: applicationId });

    await service.selectCandidate(applicationId, 'admin-1', {
      workEmail: 'w@client.com',
      workPassword: 'secret',
      workInstructions: 'Log in daily',
    });

    expect(send).toHaveBeenCalledWith(
      'c@test.com',
      expect.objectContaining({
        subject: expect.stringContaining('Evaluator'),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'HIRED' }),
      }),
    );
    const note = historyCreate.mock.calls[0][0].data.comment as string;
    expect(note).toContain('w@client.com');
    expect(note).not.toContain('secret');
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'candidate-1',
      expect.objectContaining({ type: 'APPLICATION_SELECTED' }),
    );
    // Stored for later viewing, but only encrypted.
    expect(workAccountUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workEmail: 'w@client.com',
          passwordEncrypted: 'enc(secret)',
        }),
      }),
    );
  });
});
