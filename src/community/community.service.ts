import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnnouncementStatus,
  JobStatus,
  type Prisma,
  ReactionType,
} from '@prisma/client';
import {
  type PaginationQueryDto,
  paged,
  pageArgs,
} from '../common/pagination.js';
import { communityPost } from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { expiredWhere, liveWhere } from './announcement-rules.js';
import {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';

const jobSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  location: true,
  workMode: true,
  status: true,
  payAmount: true,
  payCurrency: true,
  payUnit: true,
  category: { select: { name: true } },
} as const;

const announcementInclude = {
  job: { select: jobSelect },
  createdBy: { select: { firstName: true, lastName: true, email: true } },
} as const;

type ReactionSummary = {
  like: number;
  love: number;
  total: number;
  mine: { like: boolean; love: boolean };
};

const emptyReactions = (): ReactionSummary => ({
  like: 0,
  love: 0,
  total: 0,
  mine: { like: false, love: false },
});

type AnnouncementRow = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

/** Decimal pay → number; adds `expired` for the admin list. */
function toView(row: AnnouncementRow, now = new Date()) {
  return {
    ...row,
    job: row.job
      ? {
          ...row.job,
          payAmount: row.job.payAmount ? Number(row.job.payAmount) : null,
        }
      : null,
    expired: Boolean(row.expiresAt && row.expiresAt <= now),
  };
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tells candidates about a post the first time it goes live. */
  private async announce(row: AnnouncementRow) {
    await this.notifications.notifyCandidates(
      communityPost({
        title: row.title,
        body: row.body,
        type: row.type,
        jobSlug: row.job?.slug,
      }),
    );
  }

  /**
   * The community feed: live posts, pinned first, newest first. Project
   * posts only show while their project is still published.
   */
  async feed(query: PaginationQueryDto, userId: string) {
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      AND: [
        liveWhere(now),
        {
          OR: [
            { jobId: null },
            { job: { status: JobStatus.PUBLISHED, deletedAt: null } },
          ],
        },
      ],
    };
    const args = pageArgs(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: announcementInclude,
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    const reactions = await this.reactionSummaries(
      rows.map((row) => row.id),
      userId,
    );
    return paged(
      rows.map((row) => ({
        ...toView(row, now),
        reactions: reactions.get(row.id) ?? emptyReactions(),
      })),
      total,
      args,
    );
  }

  /**
   * Toggles the user's Like or Love on a live post; returns its new counts.
   */
  async toggleReaction(id: string, userId: string, type: ReactionType) {
    const post = await this.prisma.announcement.findFirst({
      where: { id, ...liveWhere() },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('This post is no longer available.');
    const existing = await this.prisma.announcementReaction.findUnique({
      where: {
        announcementId_userId_type: { announcementId: id, userId, type },
      },
    });
    if (existing) {
      await this.prisma.announcementReaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.announcementReaction
        .create({ data: { announcementId: id, userId, type } })
        // A double-click can race; the reaction already exists then.
        .catch(() => null);
    }
    const summaries = await this.reactionSummaries([id], userId);
    return summaries.get(id) ?? emptyReactions();
  }

  /** Like/Love counts per post, plus what this user reacted with. */
  private async reactionSummaries(ids: string[], userId?: string) {
    const summaries = new Map<string, ReactionSummary>();
    if (!ids.length) return summaries;
    const [grouped, mine] = await Promise.all([
      this.prisma.announcementReaction.groupBy({
        by: ['announcementId', 'type'],
        where: { announcementId: { in: ids } },
        orderBy: { announcementId: 'asc' },
        _count: { _all: true },
      }),
      // No viewer (admin list): skip — '' is not a valid UUID to filter on.
      userId
        ? this.prisma.announcementReaction.findMany({
            where: { announcementId: { in: ids }, userId },
            select: { announcementId: true, type: true },
          })
        : Promise.resolve([]),
    ]);
    for (const group of grouped) {
      const summary = summaries.get(group.announcementId) ?? emptyReactions();
      const count = (group._count as { _all: number })._all;
      if (group.type === ReactionType.LIKE) summary.like = count;
      else summary.love = count;
      summary.total += count;
      summaries.set(group.announcementId, summary);
    }
    for (const reaction of mine) {
      const summary =
        summaries.get(reaction.announcementId) ?? emptyReactions();
      if (reaction.type === ReactionType.LIKE) summary.mine.like = true;
      else summary.mine.love = true;
      summaries.set(reaction.announcementId, summary);
    }
    return summaries;
  }

  /** Admin list with Live / Draft / Expired / All tabs and their counts. */
  async listForAdmin(query: ListAnnouncementsQueryDto) {
    const now = new Date();
    const byState: Record<string, Prisma.AnnouncementWhereInput> = {
      live: liveWhere(now),
      draft: { status: AnnouncementStatus.DRAFT },
      expired: expiredWhere(now),
      all: {},
    };
    const where = byState[query.state ?? 'all'];
    const args = pageArgs(query);
    const [rows, total, live, draft, expired, all] =
      await this.prisma.$transaction([
        this.prisma.announcement.findMany({
          where,
          include: announcementInclude,
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          skip: args.skip,
          take: args.take,
        }),
        this.prisma.announcement.count({ where }),
        this.prisma.announcement.count({ where: byState.live }),
        this.prisma.announcement.count({ where: byState.draft }),
        this.prisma.announcement.count({ where: byState.expired }),
        this.prisma.announcement.count(),
      ]);
    const reactions = await this.reactionSummaries(rows.map((row) => row.id));
    return {
      ...paged(
        rows.map((row) => ({
          ...toView(row, now),
          reactions: reactions.get(row.id) ?? emptyReactions(),
        })),
        total,
        args,
      ),
      counts: { live, draft, expired, all },
    };
  }

  async create(adminId: string, dto: CreateAnnouncementDto) {
    const expiresAt = this.parseExpiry(dto.expiresAt);
    const row = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        status: dto.status,
        category: dto.category,
        pinned: dto.pinned ?? false,
        expiresAt,
        publishedAt:
          dto.status === AnnouncementStatus.PUBLISHED ? new Date() : null,
        createdById: adminId,
      },
      include: announcementInclude,
    });
    if (row.status === AnnouncementStatus.PUBLISHED) await this.announce(row);
    return toView(row);
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.findOrThrow(id);
    const data: Prisma.AnnouncementUpdateInput = {
      title: dto.title,
      body: dto.body,
      status: dto.status,
      category: dto.category,
      pinned: dto.pinned,
    };
    if (dto.expiresAt !== undefined) {
      data.expiresAt = this.parseExpiry(dto.expiresAt);
    }
    // First time it goes live, stamp when (keeps feed order stable after)
    // and notify candidates once — re-publishing doesn't notify again.
    const firstPublish =
      dto.status === AnnouncementStatus.PUBLISHED && !existing.publishedAt;
    if (firstPublish) data.publishedAt = new Date();
    const row = await this.prisma.announcement.update({
      where: { id },
      data,
      include: announcementInclude,
    });
    if (firstPublish) await this.announce(row);
    return toView(row);
  }

  async setPinned(id: string, pinned: boolean) {
    await this.findOrThrow(id);
    const row = await this.prisma.announcement.update({
      where: { id },
      data: { pinned },
      include: announcementInclude,
    });
    return toView(row);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.announcement.delete({ where: { id } });
    return { success: true, message: 'Announcement deleted.' };
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found.');
    return row;
  }

  /** null/undefined = never expires; a date must be in the future. */
  private parseExpiry(value?: string | null) {
    if (value === undefined || value === null) return null;
    const date = new Date(value);
    if (date <= new Date()) {
      throw new BadRequestException('The expiry date must be in the future.');
    }
    return date;
  }
}
