import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { newProjectAnnouncement } from './announcement-rules.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { CommunityService } from './community.service.js';

const now = new Date('2026-10-02T10:00:00Z');
const job = {
  id: 'job-1',
  title: 'AI Evaluator',
  summary: null,
  description: 'Rate   AI\n responses for quality.',
  status: 'PUBLISHED' as const,
};

describe('newProjectAnnouncement', () => {
  it('goes live with a published job and expires after 2 days', () => {
    const post = newProjectAnnouncement(job, 'admin-1', now);
    expect(post).toMatchObject({
      type: 'NEW_PROJECT',
      title: 'New project: AI Evaluator',
      body: 'Rate AI responses for quality.',
      status: 'PUBLISHED',
      jobId: 'job-1',
    });
    expect(post.expiresAt).toEqual(new Date('2026-10-04T10:00:00Z'));
  });

  it('is a draft when the job is a draft', () => {
    const post = newProjectAnnouncement(
      { ...job, status: 'DRAFT' },
      'admin-1',
      now,
    );
    expect(post).toMatchObject({ status: 'DRAFT', publishedAt: null });
  });
});

describe('CommunityService', () => {
  function createService() {
    const create = vi.fn(({ data }) =>
      Promise.resolve({ id: 'a1', job: null, createdBy: null, ...data }),
    );
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const reactionCreate = vi.fn().mockResolvedValue({ id: 'r1' });
    const reactionDelete = vi.fn().mockResolvedValue({ id: 'r1' });
    const reactionFindUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      announcementReaction: {
        findUnique: reactionFindUnique,
        create: reactionCreate,
        delete: reactionDelete,
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { announcementId: 'a1', type: 'LIKE', _count: { _all: 3 } },
          ]),
        findMany: vi
          .fn()
          .mockResolvedValue([{ announcementId: 'a1', type: 'LIKE' }]),
      },
      announcement: {
        create,
        findMany,
        count,
        findFirst: vi.fn().mockResolvedValue({ id: 'a1' }),
      },
      $transaction: vi.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    } as unknown as PrismaService;
    const notifyCandidates = vi.fn().mockResolvedValue(undefined);
    return {
      service: new CommunityService(prisma, {
        notifyCandidates,
      } as unknown as NotificationsService),
      create,
      findMany,
      notifyCandidates,
      reactionCreate,
      reactionDelete,
      reactionFindUnique,
    };
  }

  it('stamps publishedAt only when published; null expiry = never', async () => {
    const { service, create, notifyCandidates } = createService();
    await service.create('admin-1', {
      title: 'Hello',
      body: 'World',
      status: 'PUBLISHED',
      expiresAt: null,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: null,
          publishedAt: expect.any(Date),
          pinned: false,
        }),
      }),
    );
    // Published → every candidate is notified.
    expect(notifyCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMMUNITY_POST', link: '/community' }),
    );
  });

  it('does not notify for drafts', async () => {
    const { service, notifyCandidates } = createService();
    await service.create('admin-1', {
      title: 'Later',
      body: 'Not yet',
      status: 'DRAFT',
    });
    expect(notifyCandidates).not.toHaveBeenCalled();
  });

  it('rejects an expiry in the past', async () => {
    const { service } = createService();
    await expect(
      service.create('admin-1', {
        title: 'Hello',
        body: 'World',
        status: 'DRAFT',
        expiresAt: '2000-01-01T00:00:00Z',
      }),
    ).rejects.toThrow('in the future');
  });

  it('shows pinned posts first in the feed, live and unexpired only', async () => {
    const { service, findMany } = createService();
    await service.feed({}, 'user-1');
    const args = findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ pinned: 'desc' }, { publishedAt: 'desc' }]);
    expect(JSON.stringify(args.where)).toContain('PUBLISHED');
    expect(JSON.stringify(args.where)).toContain('expiresAt');
  });

  it('toggles a reaction on and off and returns the counts', async () => {
    const { service, reactionCreate, reactionDelete, reactionFindUnique } =
      createService();
    const summary = await service.toggleReaction('a1', 'user-1', 'LIKE');
    expect(reactionCreate).toHaveBeenCalledWith({
      data: { announcementId: 'a1', userId: 'user-1', type: 'LIKE' },
    });
    expect(summary).toEqual({
      like: 3,
      love: 0,
      total: 3,
      mine: { like: true, love: false },
    });

    reactionFindUnique.mockResolvedValueOnce({ id: 'r1' });
    await service.toggleReaction('a1', 'user-1', 'LIKE');
    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});
