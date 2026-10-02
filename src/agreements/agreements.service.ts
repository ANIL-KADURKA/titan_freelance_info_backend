import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentType, type Agreement } from '@prisma/client';
import { agreementUpdated } from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  nextVersion,
  normalizeName,
  signatureCovers,
  versionLabel,
} from './agreement-rules.js';
import { PublishAgreementDto } from './dto/agreement.dto.js';

const latestFirst = [{ major: 'desc' as const }, { minor: 'desc' as const }];

function toView(agreement: Agreement) {
  return {
    id: agreement.id,
    version: versionLabel(agreement),
    major: agreement.major,
    minor: agreement.minor,
    title: agreement.title,
    body: agreement.body,
    changeNote: agreement.changeNote,
    publishedAt: agreement.createdAt.toISOString(),
  };
}

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async findCurrent() {
    const agreement = await this.prisma.agreement.findFirst({
      orderBy: latestFirst,
    });
    if (!agreement) {
      throw new NotFoundException('No trainer agreement has been published');
    }
    return agreement;
  }

  async current() {
    return toView(await this.findCurrent());
  }

  /** The current agreement, whether I've signed it, and my signing history. */
  async mine(userId: string) {
    const [current, records, user] = await Promise.all([
      this.findCurrent(),
      this.prisma.consentRecord.findMany({
        where: {
          userId,
          type: ConsentType.TRAINER_AGREEMENT,
          withdrawnAt: null,
        },
        orderBy: { grantedAt: 'desc' },
        include: { agreement: { select: { major: true, minor: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { legalName: true },
      }),
    ]);
    const covering = records.find(
      (record) =>
        record.agreement && signatureCovers(record.agreement, current),
    );
    return {
      agreement: toView(current),
      status: covering
        ? 'SIGNED'
        : records.length
          ? 'RESIGN_REQUIRED'
          : 'UNSIGNED',
      signedAt: covering?.grantedAt.toISOString() ?? null,
      signedSignatureId: covering?.id ?? null,
      legalName: user?.legalName ?? null,
      signatures: records.map((record) => ({
        id: record.id,
        version: record.agreement
          ? versionLabel(record.agreement)
          : record.version,
        signatureName: record.signatureName,
        signedAt: record.grantedAt.toISOString(),
        ipAddress: record.ipAddress,
      })),
    };
  }

  /** Sign the current version with the typed legal name. Idempotent. */
  async sign(
    userId: string,
    signature: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { legalName: true },
    });
    if (!user?.legalName) {
      throw new BadRequestException(
        'Add your legal name in onboarding before signing.',
      );
    }
    if (normalizeName(signature) !== normalizeName(user.legalName)) {
      throw new BadRequestException(
        `Type your full name exactly as "${user.legalName}" to sign.`,
      );
    }
    const current = await this.findCurrent();
    const existing = await this.prisma.consentRecord.findFirst({
      where: {
        userId,
        type: ConsentType.TRAINER_AGREEMENT,
        agreementId: current.id,
        withdrawnAt: null,
      },
    });
    if (existing) return existing;
    return this.prisma.consentRecord.create({
      data: {
        userId,
        type: ConsentType.TRAINER_AGREEMENT,
        agreementId: current.id,
        version: versionLabel(current),
        signatureName: signature.trim(),
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
      },
    });
  }

  /**
   * Everything needed to print a signed copy: the exact text signed plus
   * who signed, when and from where. `userId` limits it to my own signatures.
   */
  async signedCopy(signatureId: string, userId?: string) {
    const record = await this.prisma.consentRecord.findFirst({
      where: {
        id: signatureId,
        type: ConsentType.TRAINER_AGREEMENT,
        ...(userId ? { userId } : {}),
      },
      include: {
        agreement: true,
        user: { select: { legalName: true, email: true, phone: true } },
      },
    });
    if (!record?.agreement) {
      throw new NotFoundException('Signed agreement not found');
    }
    return {
      id: record.id,
      agreement: toView(record.agreement),
      signer: {
        name: record.user.legalName ?? record.signatureName ?? '',
        email: record.user.email,
        phone: record.user.phone,
      },
      signatureName: record.signatureName,
      signedAt: record.grantedAt.toISOString(),
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
    };
  }

  /** Admin: every version with how many candidates signed it. */
  async versions() {
    const rows = await this.prisma.agreement.findMany({
      orderBy: latestFirst,
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        _count: { select: { signatures: true } },
      },
    });
    return rows.map((row) => ({
      ...toView(row),
      signatureCount: row._count.signatures,
      createdBy: row.createdBy,
    }));
  }

  /** Admin: publish an edited agreement as a new version. */
  async publish(adminId: string, dto: PublishAgreementDto) {
    const current = await this.prisma.agreement.findFirst({
      orderBy: latestFirst,
    });
    if (current && current.title === dto.title && current.body === dto.body) {
      throw new BadRequestException('Nothing changed in the agreement.');
    }
    const version = nextVersion(current, dto.requireResign);
    let created: Agreement;
    try {
      created = await this.prisma.agreement.create({
        data: {
          ...version,
          title: dto.title,
          body: dto.body,
          changeNote: dto.changeNote || null,
          createdById: adminId,
        },
      });
    } catch (error) {
      if ((error as { code?: unknown }).code === 'P2002') {
        throw new ConflictException(
          'Someone just published another version. Reload and try again.',
        );
      }
      throw error;
    }
    if (dto.requireResign && current) {
      await this.notifications.notifyCandidates(
        agreementUpdated(versionLabel(created), created.changeNote),
      );
    }
    return toView(created);
  }
}
