import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import {
  jobOpened,
  personName,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Upcoming jobs and candidates' pre-applications to them. */
@Injectable()
export class JobPreApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Public: jobs that are announced but not open yet. */
  async listUpcoming() {
    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.UPCOMING, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        workMode: true,
        location: true,
        payAmount: true,
        payCurrency: true,
        payUnit: true,
        preApplyDeadline: true,
        preApplyBonus: true,
        category: { select: { name: true, slug: true } },
        _count: { select: { preApplications: true } },
      },
      orderBy: [
        { preApplyDeadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    const now = Date.now();
    return jobs.map(({ _count, ...job }) => ({
      ...job,
      payAmount: job.payAmount === null ? null : Number(job.payAmount),
      preApplyBonus:
        job.preApplyBonus === null ? null : Number(job.preApplyBonus),
      // The bonus offer only shows until its deadline.
      bonusOpen:
        job.preApplyBonus !== null &&
        (!job.preApplyDeadline || job.preApplyDeadline.getTime() > now),
      preApplicationCount: _count.preApplications,
    }));
  }

  async mine(userId: string) {
    return this.prisma.jobPreApplication.findMany({
      where: { userId },
      select: { jobId: true, location: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async preApply(userId: string, jobId: string, location?: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { status: true },
    });
    if (!job) throw new NotFoundException('Project not found');
    if (job.status !== JobStatus.UPCOMING) {
      throw new BadRequestException(
        'This project is no longer upcoming. Apply from the project page instead.',
      );
    }
    await this.prisma.jobPreApplication.upsert({
      where: { jobId_userId: { jobId, userId } },
      update: { location: location ?? null },
      create: { jobId, userId, location: location ?? null },
    });
    return this.mine(userId);
  }

  async withdraw(userId: string, jobId: string) {
    await this.prisma.jobPreApplication.deleteMany({
      where: { jobId, userId },
    });
    return this.mine(userId);
  }

  /** Admin: who pre-applied to a job. */
  async listForJob(jobId: string) {
    return this.listAll(jobId);
  }

  /** Admin: pre-applications across jobs (optionally one job), newest first. */
  async listAll(jobId?: string) {
    const rows = await this.prisma.jobPreApplication.findMany({
      where: { ...(jobId ? { jobId } : {}), job: { deletedAt: null } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        job: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      location: row.location,
      createdAt: row.createdAt.toISOString(),
      user: { ...row.user, name: personName(row.user) },
      job: row.job,
    }));
  }

  /** Tells everyone who pre-applied that the job is now open. */
  async notifyOpened(job: { id: string; title: string }) {
    const rows = await this.prisma.jobPreApplication.findMany({
      where: { jobId: job.id },
      select: { userId: true },
    });
    const notice = jobOpened(job.title, job.id);
    await Promise.all(
      rows.map((row) => this.notifications.notifyUser(row.userId, notice)),
    );
  }
}
