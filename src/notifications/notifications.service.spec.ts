import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { applicationStatusChanged } from './notification-messages.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  it('never throws when saving a notification fails', async () => {
    const prisma = {
      notification: { create: vi.fn().mockRejectedValue(new Error('db')) },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma);
    await expect(
      service.notifyUser('u1', {
        type: 'WELCOME',
        title: 'Hi',
        message: 'Welcome',
      }),
    ).resolves.toBeUndefined();
  });

  it('notifies every admin and recruiter in one insert', async () => {
    const createManyAndReturn = vi.fn(({ data }) => Promise.resolve(data));
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]),
      },
      notification: { createManyAndReturn },
    } as unknown as PrismaService;
    await new NotificationsService(prisma).notifyAdmins({
      type: 'APPLICATION_RECEIVED',
      title: 'New application',
      message: 'Ravi applied',
      link: '/admin/applications/1',
    });
    expect(createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'a1',
          link: '/admin/applications/1',
        }),
        expect.objectContaining({ userId: 'a2' }),
      ],
    });
  });

  it('streams new notifications only to their owner', async () => {
    const prisma = {
      notification: {
        create: vi.fn(({ data }) =>
          Promise.resolve({ id: `n-${data.userId}`, ...data }),
        ),
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma);
    const received: string[] = [];
    const subscription = service
      .streamFor('u1')
      .subscribe((notification) => received.push(notification.id));
    const input = { type: 'WELCOME' as const, title: 'Hi', message: 'Hello' };
    await service.notifyUser('u1', input);
    await service.notifyUser('u2', input);
    subscription.unsubscribe();
    expect(received).toEqual(['n-u1']);
  });

  it('skips statuses candidates do not need to hear about', () => {
    expect(applicationStatusChanged('APPLIED', 'X')).toBeNull();
    expect(applicationStatusChanged('INTERVIEW', 'Evaluator')).toMatchObject({
      title: 'Call scheduled',
      message: expect.stringContaining('Evaluator'),
    });
  });
});
