import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  JobStatus,
  PaymentMethodStatus,
  RoleName,
  TimesheetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  addTo,
  dateKey,
  formatDateKey,
  type MoneyTotals,
  parseDateKey,
} from '../timesheets/timesheet-rules.js';
import { TimesheetsService } from '../timesheets/timesheets.service.js';

const IN_PROGRESS: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.IN_REVIEW,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFERED,
];

/** First day of the current month (IST) as a @db.Date value. */
function monthStart() {
  return parseDateKey(`${dateKey().slice(0, 7)}-01`)!;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheets: TimesheetsService,
  ) {}

  /** Everything on the candidate home page, in one call. */
  async candidate(userId: string) {
    const [money, applications, monthEntries, notifications, projects] =
      await Promise.all([
        this.timesheets.summary(userId),
        this.prisma.candidateApplication.findMany({
          where: { userId, deletedAt: null },
          select: { status: true },
        }),
        this.prisma.timesheetEntry.findMany({
          where: {
            userId,
            workDate: { gte: monthStart() },
            status: { not: TimesheetStatus.REJECTED },
          },
          select: { quantity: true, unit: true },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            title: true,
            message: true,
            link: true,
            createdAt: true,
          },
        }),
        this.activeProjects(userId),
      ]);

    const count = (statuses: ApplicationStatus[]) =>
      applications.filter((item) => statuses.includes(item.status)).length;
    const hoursThisMonth = monthEntries
      .filter((entry) => entry.unit === 'HOUR')
      .reduce((sum, entry) => sum + Number(entry.quantity), 0);

    return {
      memberId: `TTN${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      money,
      counts: {
        applied: applications.length,
        inProgress: count(IN_PROGRESS),
        active: count([ApplicationStatus.HIRED]),
        completed: count([ApplicationStatus.COMPLETED]),
        daysLoggedThisMonth: monthEntries.length,
        hoursThisMonth: Math.round(hoursThisMonth * 100) / 100,
      },
      activeProjects: projects,
      recentActivity: notifications,
    };
  }

  /** Active projects with what was logged, approved and earned so far. */
  private async activeProjects(userId: string) {
    const applications = await this.prisma.candidateApplication.findMany({
      where: { userId, deletedAt: null, status: ApplicationStatus.HIRED },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            payAmount: true,
            payCurrency: true,
            payUnit: true,
          },
        },
        timesheetEntries: {
          select: {
            status: true,
            amount: true,
            currency: true,
            quantity: true,
            workDate: true,
          },
        },
      },
      orderBy: { statusChangedAt: 'desc' },
    });
    return applications.map(({ job, timesheetEntries, ...application }) => {
      const approved = timesheetEntries.filter(
        (entry) => entry.status === TimesheetStatus.APPROVED,
      );
      const earned: MoneyTotals = {};
      for (const entry of approved) {
        addTo(earned, entry.currency, Number(entry.amount));
      }
      const lastLogged = timesheetEntries
        .map((entry) => formatDateKey(entry.workDate))
        .sort()
        .at(-1);
      return {
        applicationId: application.id,
        jobId: job.id,
        title: job.title,
        slug: job.slug,
        payAmount: job.payAmount ? Number(job.payAmount) : null,
        payCurrency: job.payCurrency,
        payUnit: job.payUnit,
        daysLogged: timesheetEntries.length,
        daysApproved: approved.length,
        awaitingApproval: timesheetEntries.filter(
          (entry) => entry.status === TimesheetStatus.SUBMITTED,
        ).length,
        earned,
        lastLogged: lastLogged ?? null,
      };
    });
  }

  /** Everything on the admin dashboard, in one call. */
  async admin() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      openJobs,
      candidates,
      newApplications,
      pipeline,
      jobStatuses,
      paymentMethodsToVerify,
      timesheetsToReview,
      unpaid,
      paidThisMonth,
      recentApplications,
    ] = await Promise.all([
      this.prisma.job.count({
        where: { status: JobStatus.PUBLISHED, deletedAt: null },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          roles: { some: { role: { name: RoleName.CANDIDATE } } },
        },
      }),
      this.prisma.candidateApplication.count({
        where: { deletedAt: null, createdAt: { gte: weekAgo } },
      }),
      this.prisma.candidateApplication.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.userPaymentMethod.count({
        where: {
          status: PaymentMethodStatus.VERIFICATION_PENDING,
          deletedAt: null,
        },
      }),
      this.prisma.timesheetEntry.count({
        where: { status: TimesheetStatus.SUBMITTED },
      }),
      this.prisma.timesheetEntry.findMany({
        where: { status: TimesheetStatus.APPROVED, payoutId: null },
        select: { amount: true, currency: true, userId: true },
      }),
      this.prisma.payout.findMany({
        where: { paidAt: { gte: monthStart() } },
        select: { amount: true, currency: true },
      }),
      this.prisma.candidateApplication.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          status: true,
          createdAt: true,
          candidate: {
            select: { firstName: true, lastName: true, email: true },
          },
          job: { select: { id: true, title: true } },
        },
      }),
    ]);

    const pendingPayouts: MoneyTotals = {};
    for (const entry of unpaid) {
      addTo(pendingPayouts, entry.currency, Number(entry.amount));
    }
    const paid: MoneyTotals = {};
    for (const payout of paidThisMonth) {
      addTo(paid, payout.currency, Number(payout.amount));
    }
    const statusCounts = Object.fromEntries(
      pipeline.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<ApplicationStatus, number>>;

    return {
      metrics: {
        openJobs,
        candidates,
        newApplications,
        applicationsToReview:
          (statusCounts.APPLIED ?? 0) + (statusCounts.IN_REVIEW ?? 0),
        paymentMethodsToVerify,
        timesheetsToReview,
        candidatesToPay: new Set(unpaid.map((entry) => entry.userId)).size,
      },
      money: { pendingPayouts, paidThisMonth: paid },
      pipeline: statusCounts,
      jobStatuses: Object.fromEntries(
        jobStatuses.map((group) => [group.status, group._count._all]),
      ) as Partial<Record<JobStatus, number>>,
      recentApplications,
    };
  }
}
