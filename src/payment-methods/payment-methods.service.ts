import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, UserPaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePaymentMethodDto,
  ListPaymentMethodsQueryDto,
  ReviewPaymentMethodDto,
} from './dto/payment-method.dto.js';
import { PaymentDataCipher } from './payment-data-cipher.js';

const MAX_ACTIVE_METHODS = 10;

const reviewerSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PaymentDataCipher,
  ) {}

  async listMine(userId: string) {
    const methods = await this.prisma.userPaymentMethod.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return methods.map((method) => this.toCandidateView(method));
  }

  async create(userId: string, dto: CreatePaymentMethodDto) {
    const details =
      dto.type === 'UPI'
        ? { upiId: dto.upiId!.toLowerCase() }
        : {
            accountHolderName: dto.accountHolderName!.replace(/\s+/g, ' '),
            accountNumber: dto.accountNumber!,
            ifsc: dto.ifsc!,
          };
    const fingerprint = this.cipher.fingerprint(
      'upiId' in details
        ? `UPI:${details.upiId}`
        : `BANK:${details.accountNumber}:${details.ifsc}`,
    );

    const active = await this.prisma.userPaymentMethod.findMany({
      where: { userId, deletedAt: null, status: { not: 'REJECTED' } },
      select: { fingerprint: true },
    });
    if (active.some((method) => method.fingerprint === fingerprint)) {
      throw new ConflictException('You have already added this payment method');
    }
    if (active.length >= MAX_ACTIVE_METHODS) {
      throw new BadRequestException(
        `You can add up to ${MAX_ACTIVE_METHODS} payment methods`,
      );
    }

    const method = await this.prisma.userPaymentMethod.create({
      data:
        'upiId' in details
          ? { userId, type: 'UPI', upiId: details.upiId, fingerprint }
          : {
              userId,
              type: 'BANK',
              accountHolderName: details.accountHolderName,
              accountNumberEncrypted: this.cipher.encrypt(
                details.accountNumber,
              ),
              accountNumberLast4: details.accountNumber.slice(-4),
              ifsc: details.ifsc,
              fingerprint,
            },
    });

    this.logger.log(`Payment method ${method.id} added by user ${userId}`);
    return this.toCandidateView(method);
  }

  async remove(userId: string, id: string) {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }
    await this.prisma.userPaymentMethod.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Payment method removed' };
  }

  async listForAdmin(query: ListPaymentMethodsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.UserPaymentMethodWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [methods, total, grouped] = await Promise.all([
      this.prisma.userPaymentMethod.findMany({
        where,
        // Oldest pending first, so the review queue is first-in, first-out.
        orderBy: {
          createdAt: query.status === 'VERIFICATION_PENDING' ? 'asc' : 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { ...reviewerSelect, phone: true, legalName: true } },
          reviewedBy: { select: reviewerSelect },
        },
      }),
      this.prisma.userPaymentMethod.count({ where }),
      this.prisma.userPaymentMethod.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const counts = { VERIFICATION_PENDING: 0, VERIFIED: 0, REJECTED: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;

    return {
      data: methods.map((method) => ({
        ...this.toCandidateView(method),
        // Admins need the full number to verify it against bank records.
        accountNumber: method.accountNumberEncrypted
          ? this.cipher.decrypt(method.accountNumberEncrypted)
          : null,
        user: method.user,
        reviewedBy: method.reviewedBy,
      })),
      meta: { page, pageSize, total },
      counts,
    };
  }

  async review(reviewerId: string, id: string, dto: ReviewPaymentMethodDto) {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { id, deletedAt: null },
    });
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    const updated = await this.prisma.userPaymentMethod.update({
      where: { id },
      data: {
        status: dto.decision,
        rejectionReason: dto.decision === 'REJECTED' ? dto.reason : null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(
      `Payment method ${id} marked ${dto.decision} by reviewer ${reviewerId}`,
    );
    return {
      message:
        dto.decision === 'VERIFIED'
          ? 'Payment method approved'
          : 'Payment method rejected',
      method: this.toCandidateView(updated),
    };
  }

  /** Safe shape for candidates: never includes the full account number. */
  private toCandidateView(method: UserPaymentMethod) {
    return {
      id: method.id,
      type: method.type,
      status: method.status,
      upiId: method.upiId,
      accountHolderName: method.accountHolderName,
      accountNumberLast4: method.accountNumberLast4,
      ifsc: method.ifsc,
      rejectionReason: method.rejectionReason,
      reviewedAt: method.reviewedAt?.toISOString() ?? null,
      createdAt: method.createdAt.toISOString(),
    };
  }
}
