import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Notification, NotificationType, RoleName } from '@prisma/client';
import { filter, type Observable, Subject } from 'rxjs';
import { paged, pageArgs } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationsQueryDto } from './dto/notifications-query.dto.js';

export type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  /** In-app path, e.g. /projects/applied */
  link?: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * In-process feed of new notifications, for the SSE stream. With several
   * backend instances each one only sees its own; clients also poll as a
   * fallback, so nothing is missed.
   */
  private readonly created = new Subject<Notification>();

  constructor(private readonly prisma: PrismaService) {}

  /** New notifications for one user, as they are created. */
  streamFor(userId: string): Observable<Notification> {
    return this.created.pipe(
      filter((notification) => notification.userId === userId),
    );
  }

  /**
   * Fire-and-forget: a failed notification is logged, never thrown, so it
   * can't break the action that triggered it.
   */
  async notifyUser(userId: string, input: NotificationInput) {
    try {
      const notification = await this.prisma.notification.create({
        data: { userId, ...input, link: input.link ?? null },
      });
      this.created.next(notification);
    } catch (error) {
      this.logger.warn(
        `Notification failed | userId=${userId} | type=${input.type} | error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Notifies every active admin (and recruiter) account. */
  async notifyAdmins(input: NotificationInput) {
    try {
      const staff = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          roles: {
            some: {
              role: { name: { in: [RoleName.ADMIN, RoleName.RECRUITER] } },
            },
          },
        },
        select: { id: true },
      });
      if (!staff.length) return;
      const notifications = await this.prisma.notification.createManyAndReturn({
        data: staff.map((user) => ({
          userId: user.id,
          ...input,
          link: input.link ?? null,
        })),
      });
      for (const notification of notifications) this.created.next(notification);
    } catch (error) {
      this.logger.warn(
        `Admin notification failed | type=${input.type} | error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** A page of my notifications (newest first) plus the unread count. */
  /**
   * Notifies every active candidate (e.g. a new community post). Inserts in
   * batches so a large audience doesn't become one huge query.
   */
  async notifyCandidates(input: NotificationInput) {
    try {
      const candidates = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          roles: { some: { role: { name: RoleName.CANDIDATE } } },
        },
        select: { id: true },
      });
      for (let start = 0; start < candidates.length; start += 500) {
        const batch = candidates.slice(start, start + 500);
        const notifications =
          await this.prisma.notification.createManyAndReturn({
            data: batch.map((user) => ({
              userId: user.id,
              ...input,
              link: input.link ?? null,
            })),
          });
        for (const notification of notifications) {
          this.created.next(notification);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Candidate notification failed | type=${input.type} | error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listMine(userId: string, query: NotificationsQueryDto = {}) {
    const where = {
      userId,
      ...(query.unread === 'true' ? { readAt: null } : {}),
    };
    const args = pageArgs(query);
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    // `items` (not `data`): the bell's cache and live updates use this name.
    return { items, unreadCount, meta: paged([], total, args).meta };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!result.count) {
      const exists = await this.prisma.notification.count({
        where: { id, userId },
      });
      if (!exists) throw new NotFoundException('Notification not found.');
    }
    return { success: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: result.count };
  }
}
