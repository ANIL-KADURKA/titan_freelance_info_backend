import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Notification, NotificationType, RoleName } from '@prisma/client';
import { filter, type Observable, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';

export type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  /** In-app path, e.g. /projects/applied */
  link?: string | null;
};

const LIST_LIMIT = 50;

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

  async listMine(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unreadCount };
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
