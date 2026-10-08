import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { CloudinaryService } from '../common/cloudinary.service.js';
import type { S3StorageService } from '../common/s3-storage.service.js';
import type { JobPreApplicationsService } from './job-pre-applications.service.js';
import type { JobResourcesService } from './job-resources.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { assertFutureDeadline, JobsService } from './jobs.service.js';

const categoryId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const cloud = 'https://res.cloudinary.com/titan/image/upload/f_auto,q_auto';
const coverImageUrl = `${cloud}/titan/jobs/cover.jpg`;
const logoUrl = `${cloud}/titan/jobs/logo.png`;

function createService({ failInTransaction = false } = {}) {
  // Echo the row back; image relations come back as file rows (none here).
  const jobCreate = vi.fn(({ data }) =>
    Promise.resolve({ id: 'job-1', ...data, coverImage: null, logo: null }),
  );
  const announcementCreate = vi.fn().mockResolvedValue({ id: 'a1' });
  const tx = {
    job: { create: jobCreate },
    announcement: { create: announcementCreate },
  };
  const $transaction = vi.fn(async (run: (client: typeof tx) => unknown) => {
    const result = await run(tx);
    if (failInTransaction) throw new Error('db down');
    return result;
  });
  const prisma = {
    job: { findFirst: vi.fn().mockResolvedValue(null) },
    jobCategory: {
      findUnique: vi.fn().mockResolvedValue({ id: categoryId, isActive: true }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: userId }) },
    $transaction,
  } as unknown as PrismaService;
  const prepareDraftResources = vi.fn().mockResolvedValue([
    {
      type: 'PDF',
      title: 'Guide',
      description: null,
      required: true,
      url: null,
      file: null,
    },
  ]);
  const persistPreparedResources = vi.fn().mockResolvedValue(undefined);
  const discardDraftUploads = vi.fn().mockResolvedValue(undefined);
  const notifyCandidates = vi.fn().mockResolvedValue(undefined);
  const notifications = { notifyCandidates };
  const resources = {
    prepareDraftResources,
    persistPreparedResources,
    discardDraftUploads,
  } as unknown as JobResourcesService;
  // Our Cloudinary account is "titan" in these tests.
  const cloudinary = {
    isOwnImageUrl: (url: string) =>
      url.startsWith('https://res.cloudinary.com/titan/image/upload/'),
  } as unknown as CloudinaryService;
  return {
    service: new JobsService(
      prisma,
      resources,
      notifications as unknown as NotificationsService,
      {} as JobPreApplicationsService,
      cloudinary,
      {} as S3StorageService,
    ),
    notifyCandidates,
    jobCreate,
    $transaction,
    persistPreparedResources,
    discardDraftUploads,
    announcementCreate,
  };
}

const dto = (overrides: Partial<CreateJobDto> = {}): CreateJobDto => ({
  title: 'Hindi AI Trainer',
  description: 'Train an assistant in Hindi.',
  categoryId,
  coverImageUrl,
  logoUrl,
  eligibilityRules: [
    { fieldKey: 'age', fieldType: 'NUMBER', operator: 'GTE', value: 18 },
  ],
  applicationFields: [
    { fieldKey: 'weekly_hours', fieldType: 'NUMBER', label: 'Weekly hours' },
  ],
  resources: [
    {
      type: 'PDF',
      title: 'Guide',
      objectKey: `job-resources/drafts/${userId}/1-guide.pdf`,
      fileName: 'guide.pdf',
    },
  ],
  ...overrides,
});

describe('JobsService.createJob (transactional)', () => {
  it('creates the job, fields, rules and resources in one transaction', async () => {
    const { service, jobCreate, $transaction, persistPreparedResources } =
      createService();
    await service.createJob(dto(), userId);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(jobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationFields: {
            create: [expect.objectContaining({ fieldKey: 'weekly_hours' })],
          },
          eligibilityRules: {
            create: [expect.objectContaining({ fieldKey: 'age' })],
          },
          coverImageUrl,
          logoUrl,
        }),
      }),
    );
    expect(persistPreparedResources).toHaveBeenCalledWith(
      expect.anything(),
      'job-1',
      userId,
      expect.any(Array),
    );
  });

  it('posts the project to the community in the same transaction', async () => {
    const { service, announcementCreate, notifyCandidates } = createService();
    await service.createJob(
      dto({ status: 'PUBLISHED', postToCommunity: true }),
      userId,
    );
    expect(announcementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'NEW_PROJECT',
        jobId: 'job-1',
        status: 'PUBLISHED',
      }),
    });
    expect(notifyCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMMUNITY_POST',
        link: expect.stringMatching(/^\/jobs\//),
      }),
    );
  });

  it('does not post to the community unless asked', async () => {
    const { service, announcementCreate, notifyCandidates } = createService();
    await service.createJob(dto(), userId);
    expect(announcementCreate).not.toHaveBeenCalled();
    expect(notifyCandidates).not.toHaveBeenCalled();
  });

  it('deletes staged uploads when the transaction fails', async () => {
    const { service, discardDraftUploads } = createService({
      failInTransaction: true,
    });
    await expect(service.createJob(dto(), userId)).rejects.toThrow('db down');
    expect(discardDraftUploads).toHaveBeenCalledWith(userId, dto().resources);
  });

  it('requires a cover image and a logo', async () => {
    const { service, $transaction } = createService();
    await expect(
      service.createJob(
        dto({ logoUrl: undefined as unknown as string }),
        userId,
      ),
    ).rejects.toThrow('Add a cover image and a logo.');
    expect($transaction).not.toHaveBeenCalled();
  });

  it('rejects image URLs that are not our Cloudinary uploads', async () => {
    const { service, $transaction } = createService();
    await expect(
      service.createJob(
        dto({ logoUrl: 'https://example.com/logo.png' }),
        userId,
      ),
    ).rejects.toThrow('Upload the cover image and logo again');
    expect($transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate field keys before writing anything', async () => {
    const { service, $transaction, discardDraftUploads } = createService();
    await expect(
      service.createJob(
        dto({
          applicationFields: [
            { fieldKey: 'hours', fieldType: 'NUMBER', label: 'Hours' },
            { fieldKey: 'hours', fieldType: 'NUMBER', label: 'Hours again' },
          ],
        }),
        userId,
      ),
    ).rejects.toThrow('used more than once');
    expect($transaction).not.toHaveBeenCalled();
    expect(discardDraftUploads).toHaveBeenCalled();
  });
});

describe('assertFutureDeadline', () => {
  const now = new Date('2026-10-02T10:00:00Z');

  it('accepts no deadline or a future one', () => {
    expect(() => assertFutureDeadline(undefined, now)).not.toThrow();
    expect(() => assertFutureDeadline(null, now)).not.toThrow();
    expect(() =>
      assertFutureDeadline('2026-10-15T18:30:00.000Z', now),
    ).not.toThrow();
  });

  it('rejects a past or invalid deadline', () => {
    expect(() => assertFutureDeadline('2026-10-01T00:00:00.000Z', now)).toThrow(
      'must be in the future',
    );
    expect(() => assertFutureDeadline('not-a-date', now)).toThrow(
      'valid application deadline',
    );
  });
});
