import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  RoleName,
  type PayCurrency,
  type Prisma,
  TimesheetStatus,
} from '@prisma/client';
import {
  personName,
  timesheetSubmitted,
  timesheetsReviewed,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ListMyTimesheetsQueryDto,
  ListTimesheetsQueryDto,
  ReviewTimesheetsDto,
  SaveTimesheetEntryDto,
} from './dto/timesheet.dto.js';
import {
  addTo,
  checkQuantity,
  checkWorkDate,
  computeAmount,
  dateKey,
  earliestLogDate,
  formatDateKey,
  formatMoney,
  type MoneyTotals,
  parseDateKey,
  quantityRules,
} from './timesheet-rules.js';

const PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

const entryInclude = {
  job: { select: { id: true, title: true, slug: true } },
} as const;

const adminEntryInclude = {
  ...entryInclude,
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  reviewedBy: { select: { firstName: true, lastName: true, email: true } },
} as const;

type EntryRow = Prisma.TimesheetEntryGetPayload<{
  include: typeof entryInclude;
}>;

/** Decimal columns → numbers and dates → YYYY-MM-DD for the API. */
function toView<T extends EntryRow>(entry: T) {
  return {
    ...entry,
    workDate: formatDateKey(entry.workDate),
    quantity: Number(entry.quantity),
    rate: Number(entry.rate),
    amount: Number(entry.amount),
    paid: Boolean(entry.payoutId),
    hasProof: Boolean(entry.proofFileId),
  };
}

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
  ) {}

  /**
   * Projects the candidate can log work on (selected) or look back at
   * (completed), with the earliest date they may log: the day selected.
   */
  async myProjects(userId: string) {
    const applications = await this.prisma.candidateApplication.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: [ApplicationStatus.HIRED, ApplicationStatus.COMPLETED] },
      },
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
        statusHistory: {
          where: { toStatus: ApplicationStatus.HIRED },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { statusChangedAt: 'desc' },
    });

    return applications.map((application) => {
      const selectedAt =
        application.statusHistory[0]?.createdAt ?? application.statusChangedAt;
      const { job } = application;
      const hasPay = Boolean(job.payAmount && job.payCurrency && job.payUnit);
      return {
        applicationId: application.id,
        jobId: job.id,
        title: job.title,
        slug: job.slug,
        status: application.status,
        payAmount: job.payAmount ? Number(job.payAmount) : null,
        payCurrency: job.payCurrency,
        payUnit: job.payUnit,
        unitLabel: job.payUnit ? quantityRules[job.payUnit].label : null,
        step: job.payUnit ? quantityRules[job.payUnit].step : null,
        maxPerDay: job.payUnit ? quantityRules[job.payUnit].max : null,
        startDate: earliestLogDate(dateKey(selectedAt)),
        today: dateKey(),
        canLog: application.status === ApplicationStatus.HIRED && hasPay,
      };
    });
  }

  async listMine(userId: string, query: ListMyTimesheetsQueryDto) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: { userId, ...this.dateAndProjectFilter(query) },
      include: entryInclude,
      orderBy: [{ workDate: 'desc' }],
      take: 400,
    });
    return entries.map(toView);
  }

  /**
   * Money per currency: submitted (awaiting approval), approved and unpaid
   * (pending payment), and paid. Always derived from entries.
   */
  async summary(userId: string) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: { userId, status: { not: TimesheetStatus.REJECTED } },
      select: { amount: true, currency: true, status: true, payoutId: true },
    });
    const awaitingApproval: MoneyTotals = {};
    const pendingPayment: MoneyTotals = {};
    const paid: MoneyTotals = {};
    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.payoutId) addTo(paid, entry.currency, amount);
      else if (entry.status === TimesheetStatus.APPROVED) {
        addTo(pendingPayment, entry.currency, amount);
      } else addTo(awaitingApproval, entry.currency, amount);
    }
    return { awaitingApproval, pendingPayment, paid };
  }

  /**
   * Creates the day's entry, or replaces it while it isn't approved yet. A
   * proof-of-work image is required, except when resubmitting an entry that
   * already has one.
   */
  async saveEntry(
    userId: string,
    dto: SaveTimesheetEntryDto,
    proof?: UploadedDocument,
  ) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: dto.applicationId, userId, deletedAt: null },
      include: {
        candidate: {
          select: { email: true, firstName: true, lastName: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            payAmount: true,
            payCurrency: true,
            payUnit: true,
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Project not found.');
    if (application.status !== ApplicationStatus.HIRED) {
      throw new BadRequestException(
        'You can only log work on projects you are active on.',
      );
    }
    const { job } = application;
    if (!job.payAmount || !job.payCurrency || !job.payUnit) {
      throw new BadRequestException(
        "This project doesn't have a pay rate yet. Please contact support.",
      );
    }

    const [project] = (await this.myProjects(userId)).filter(
      (item) => item.applicationId === application.id,
    );
    const problem =
      checkWorkDate(dto.workDate, project.startDate) ??
      checkQuantity(job.payUnit, dto.quantity);
    if (problem) throw new BadRequestException(problem);

    const workDate = parseDateKey(dto.workDate)!;
    const rate = Number(job.payAmount);
    const data = {
      quantity: dto.quantity,
      note: dto.note,
      rate,
      currency: job.payCurrency,
      unit: job.payUnit,
      amount: computeAmount(dto.quantity, rate),
      status: TimesheetStatus.SUBMITTED,
      rejectionReason: null,
      reviewedById: null,
      reviewedAt: null,
    };

    const existing = await this.prisma.timesheetEntry.findUnique({
      where: {
        applicationId_workDate: { applicationId: application.id, workDate },
      },
    });
    if (existing?.status === TimesheetStatus.APPROVED) {
      throw new ConflictException(
        "This day is already approved and can't be changed.",
      );
    }
    if (!proof && !existing?.proofFileId) {
      throw new BadRequestException(
        'Attach a screenshot as proof of your work.',
      );
    }
    if (proof) {
      if (!PROOF_TYPES.includes((proof.mimetype ?? '').toLowerCase())) {
        throw new BadRequestException(
          'Proof must be a PNG, JPG or WebP image.',
        );
      }
      if ((proof.size ?? proof.buffer.length) > PROOF_MAX_BYTES) {
        throw new BadRequestException('Proof image must be 5 MB or smaller.');
      }
    }

    // Validates the real file type (magic bytes) and stores it privately.
    const stored = proof
      ? await this.uploads.uploadDocument(proof, {
          folder: `timesheet-proofs/${userId}`,
          uploadedById: userId,
        })
      : null;
    const proofFileId = stored?.id ?? existing?.proofFileId ?? null;

    let entry;
    try {
      entry = existing
        ? await this.prisma.timesheetEntry.update({
            where: { id: existing.id },
            data: { ...data, proofFileId },
            include: entryInclude,
          })
        : await this.prisma.timesheetEntry.create({
            data: {
              ...data,
              proofFileId,
              applicationId: application.id,
              userId,
              jobId: job.id,
              workDate,
            },
            include: entryInclude,
          });
    } catch (error) {
      if (stored)
        await this.uploads.deleteDocument(stored.id).catch(() => null);
      throw error;
    }
    // A new screenshot replaces the old one.
    if (stored && existing?.proofFileId) {
      await this.uploads.deleteDocument(existing.proofFileId).catch(() => null);
    }

    await this.notifications.notifyAdmins(
      timesheetSubmitted(
        personName(application.candidate),
        job.title,
        dto.workDate,
        `${dto.quantity} ${quantityRules[job.payUnit].label}`,
        Boolean(existing),
      ),
    );
    return toView(entry);
  }

  async deleteEntry(userId: string, id: string) {
    const entry = await this.prisma.timesheetEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Entry not found.');
    if (entry.status === TimesheetStatus.APPROVED) {
      throw new ConflictException("Approved entries can't be deleted.");
    }
    await this.prisma.timesheetEntry.delete({ where: { id } });
    if (entry.proofFileId) {
      await this.uploads.deleteDocument(entry.proofFileId).catch(() => null);
    }
    return { success: true, message: 'Entry deleted.' };
  }

  /** Signed link to the proof image: the candidate who logged it, or staff. */
  async proofUrl(id: string, requesterId: string) {
    const entry = await this.prisma.timesheetEntry.findUnique({
      where: { id },
      include: { proofFile: true },
    });
    if (!entry) throw new NotFoundException('Entry not found.');
    if (entry.userId !== requesterId && !(await this.isStaff(requesterId))) {
      throw new ForbiddenException('You do not have access to this entry.');
    }
    if (!entry.proofFile) return { url: null };
    const file = entry.proofFile;
    return {
      url: await this.storage.createViewUrl(file.bucket, file.objectKey, {
        fileName: file.originalName,
        contentType: file.mimeType,
      }),
      mimeType: file.mimeType,
    };
  }

  private async isStaff(userId: string) {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: { in: [RoleName.ADMIN, RoleName.RECRUITER] } },
      },
    });
    return count > 0;
  }

  /** Admin list with candidate and project, newest work first. */
  async listAll(query: ListTimesheetsQueryDto) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        ...this.dateAndProjectFilter(query),
        ...(query.status ? { status: query.status } : {}),
        ...(query.jobId ? { jobId: query.jobId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
      },
      include: adminEntryInclude,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return entries.map(toView);
  }

  /** Approves or rejects submitted entries; tells each candidate once. */
  async review(reviewerId: string, dto: ReviewTimesheetsDto) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: { id: { in: dto.ids }, status: TimesheetStatus.SUBMITTED },
      include: { job: { select: { title: true } } },
    });
    if (!entries.length) {
      throw new BadRequestException(
        'None of these entries are waiting for review.',
      );
    }
    const approved = dto.decision === 'APPROVED';
    await this.prisma.timesheetEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) } },
      data: {
        status: approved ? TimesheetStatus.APPROVED : TimesheetStatus.REJECTED,
        rejectionReason: approved ? null : dto.reason,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    const byUser = new Map<string, typeof entries>();
    for (const entry of entries) {
      byUser.set(entry.userId, [...(byUser.get(entry.userId) ?? []), entry]);
    }
    await Promise.all(
      [...byUser].map(([userId, userEntries]) => {
        const totals: MoneyTotals = {};
        for (const entry of userEntries) {
          addTo(totals, entry.currency, Number(entry.amount));
        }
        const amountText = Object.entries(totals)
          .map(([currency, amount]) =>
            formatMoney(amount, currency as PayCurrency),
          )
          .join(' + ');
        return this.notifications.notifyUser(
          userId,
          timesheetsReviewed(
            userEntries.length,
            approved,
            amountText,
            [...new Set(userEntries.map((entry) => entry.job.title))].join(
              ', ',
            ),
            dto.reason,
          ),
        );
      }),
    );

    return {
      success: true,
      message: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} ${approved ? 'approved' : 'rejected'}.`,
      updated: entries.length,
      skipped: dto.ids.length - entries.length,
    };
  }

  private dateAndProjectFilter(
    query: ListMyTimesheetsQueryDto,
  ): Prisma.TimesheetEntryWhereInput {
    const from = query.from ? parseDateKey(query.from) : null;
    const to = query.to ? parseDateKey(query.to) : null;
    return {
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
  }
}
