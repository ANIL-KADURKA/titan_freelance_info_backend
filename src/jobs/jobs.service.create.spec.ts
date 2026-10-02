import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import type { JobResourcesService } from './job-resources.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { JobsService } from './jobs.service.js';

const categoryId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

function createService({ failInTransaction = false } = {}) {
  const jobCreate = vi.fn(({ data }) =>
    Promise.resolve({ id: 'job-1', ...data }),
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
  return {
    service: new JobsService(
      prisma,
      resources,
      notifications as unknown as NotificationsService,
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
