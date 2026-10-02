import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type PayCurrency,
  PaymentMethodStatus,
  RoleName,
  TimesheetStatus,
  type UserPaymentMethod,
} from '@prisma/client';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import {
  payoutSent,
  personName,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaymentDataCipher } from '../payment-methods/payment-data-cipher.js';
import {
  type PaginationQueryDto,
  paged,
  pageArgs,
  pageArray,
} from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { formatDateKey, formatMoney } from './timesheet-rules.js';

const PROOF_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

export type CreatePayoutInput = {
  userId: string;
  currency: PayCurrency;
  reference?: string;
  note?: string;
  paymentMethodId?: string;
};

const personSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
    private readonly cipher: PaymentDataCipher,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Who is owed what: approved, unpaid entries grouped by candidate and
   * currency, with their verified payout methods (full details, for paying).
   */
  async pending(query: PaginationQueryDto = {}) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: { status: TimesheetStatus.APPROVED, payoutId: null },
      select: {
        userId: true,
        currency: true,
        amount: true,
        workDate: true,
        job: { select: { title: true } },
      },
      orderBy: { workDate: 'asc' },
    });
    const groups = new Map<
      string,
      {
        userId: string;
        currency: PayCurrency;
        amount: number;
        entries: number;
        from: string;
        to: string;
        projects: Set<string>;
      }
    >();
    for (const entry of entries) {
      const key = `${entry.userId}:${entry.currency}`;
      const date = formatDateKey(entry.workDate);
      const group = groups.get(key) ?? {
        userId: entry.userId,
        currency: entry.currency,
        amount: 0,
        entries: 0,
        from: date,
        to: date,
        projects: new Set<string>(),
      };
      group.amount =
        Math.round((group.amount + Number(entry.amount)) * 100) / 100;
      group.entries += 1;
      group.to = date;
      group.projects.add(entry.job.title);
      groups.set(key, group);
    }
    if (!groups.size) return { ...pageArray([], query), totals: {} };
    // Total owed across every page, per currency (for the header).
    const totals: Partial<Record<PayCurrency, number>> = {};
    for (const group of groups.values()) {
      totals[group.currency] =
        Math.round(((totals[group.currency] ?? 0) + group.amount) * 100) / 100;
    }
    // Only the current page needs candidate and payout-method lookups.
    const pageGroups = pageArray([...groups.values()], query);

    const userIds = [...new Set(pageGroups.data.map((group) => group.userId))];
    const [users, methods] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: personSelect,
      }),
      this.prisma.userPaymentMethod.findMany({
        where: {
          userId: { in: userIds },
          status: PaymentMethodStatus.VERIFIED,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    const data = pageGroups.data.map((group) => ({
      ...group,
      projects: [...group.projects],
      candidate: usersById.get(group.userId) ?? null,
      paymentMethods: methods
        .filter((method) => method.userId === group.userId)
        .map((method) => this.methodDetails(method)),
    }));
    return { ...pageGroups, data, totals };
  }

  /**
   * Marks a candidate's pending amount (one currency) as paid: uploads the
   * proof, then creates the payout and attaches every approved, unpaid entry
   * in one transaction. The amount is always computed on the server.
   */
  async create(
    adminId: string,
    input: CreatePayoutInput,
    proof?: UploadedDocument,
  ) {
    if (!proof) {
      throw new BadRequestException(
        'Upload the payment screenshot or receipt.',
      );
    }
    if (!PROOF_TYPES.includes((proof.mimetype ?? '').toLowerCase())) {
      throw new BadRequestException(
        'Proof must be a PNG, JPG, WebP image or a PDF.',
      );
    }
    const candidate = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: personSelect,
    });
    if (!candidate) throw new NotFoundException('Candidate not found.');

    const method = input.paymentMethodId
      ? await this.prisma.userPaymentMethod.findFirst({
          where: {
            id: input.paymentMethodId,
            userId: input.userId,
            deletedAt: null,
          },
        })
      : await this.prisma.userPaymentMethod.findFirst({
          where: {
            userId: input.userId,
            status: PaymentMethodStatus.VERIFIED,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });

    const stored = await this.uploads.uploadDocument(proof, {
      folder: `payout-proofs/${input.userId}`,
      uploadedById: adminId,
    });

    try {
      const payout = await this.prisma.$transaction(async (tx) => {
        const entries = await tx.timesheetEntry.findMany({
          where: {
            userId: input.userId,
            currency: input.currency,
            status: TimesheetStatus.APPROVED,
            payoutId: null,
          },
          select: { id: true, amount: true },
        });
        if (!entries.length) {
          throw new BadRequestException(
            'Nothing is pending for this candidate in this currency.',
          );
        }
        const amount =
          Math.round(
            entries.reduce((sum, entry) => sum + Number(entry.amount), 0) * 100,
          ) / 100;
        const created = await tx.payout.create({
          data: {
            userId: input.userId,
            amount,
            currency: input.currency,
            reference: input.reference || null,
            note: input.note || null,
            proofFileId: stored.id,
            paymentMethodId: method?.id ?? null,
            paymentMethodLabel: method ? this.methodLabel(method) : null,
            paidById: adminId,
          },
        });
        // Only entries still unpaid: guards against a concurrent payout.
        const linked = await tx.timesheetEntry.updateMany({
          where: {
            id: { in: entries.map((entry) => entry.id) },
            payoutId: null,
          },
          data: { payoutId: created.id },
        });
        if (linked.count !== entries.length) {
          throw new BadRequestException(
            'These entries were just paid by someone else. Refresh and try again.',
          );
        }
        return { ...created, entryCount: entries.length };
      });

      await this.notifications.notifyUser(
        input.userId,
        payoutSent(
          formatMoney(Number(payout.amount), payout.currency),
          payout.entryCount,
          payout.reference,
        ),
      );
      return this.toView(payout);
    } catch (error) {
      await this.uploads.deleteDocument(stored.id).catch(() => null);
      throw error;
    }
  }

  async listAll(userId?: string, query: PaginationQueryDto = {}) {
    const where = userId ? { userId } : {};
    const args = pageArgs(query);
    const [payouts, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where,
        include: {
          user: { select: personSelect },
          paidBy: { select: personSelect },
          _count: { select: { entries: true } },
        },
        orderBy: { paidAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.payout.count({ where }),
    ]);
    return paged(
      payouts.map((payout) => this.toView(payout)),
      total,
      args,
    );
  }

  async listMine(userId: string, query: PaginationQueryDto = {}) {
    const args = pageArgs(query);
    const [payouts, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where: { userId },
        include: { _count: { select: { entries: true } } },
        orderBy: { paidAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.payout.count({ where: { userId } }),
    ]);
    return paged(
      payouts.map((payout) => this.toView(payout)),
      total,
      args,
    );
  }

  /** Signed link to the payment proof: the candidate paid, or staff. */
  async proofUrl(payoutId: string, requesterId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { proofFile: true },
    });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.userId !== requesterId && !(await this.isStaff(requesterId))) {
      throw new ForbiddenException('You do not have access to this payout.');
    }
    if (!payout.proofFile) return { url: null };
    const file = payout.proofFile;
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

  private methodLabel(method: UserPaymentMethod) {
    return method.type === 'UPI'
      ? `UPI ${method.upiId ?? ''}`.trim()
      : `Bank ••••${method.accountNumberLast4 ?? ''}${method.ifsc ? ` (${method.ifsc})` : ''}`;
  }

  /** Full details so the admin can actually send the money. */
  private methodDetails(method: UserPaymentMethod) {
    return {
      id: method.id,
      type: method.type,
      label: this.methodLabel(method),
      upiId: method.upiId,
      accountHolderName: method.accountHolderName,
      accountNumber: method.accountNumberEncrypted
        ? this.cipher.decrypt(method.accountNumberEncrypted)
        : null,
      ifsc: method.ifsc,
    };
  }

  private toView<
    T extends { amount: unknown; paidAt: Date; proofFileId: string | null },
  >(payout: T) {
    const { proofFileId, ...rest } = payout;
    return {
      ...rest,
      amount: Number(payout.amount),
      hasProof: Boolean(proofFileId),
      candidateName:
        'user' in payout && payout.user
          ? personName(payout.user as Parameters<typeof personName>[0])
          : undefined,
    };
  }
}
