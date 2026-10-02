import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  ConsentType,
  Prisma,
  TestimonialStatus,
  type FileObject,
} from '@prisma/client';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import {
  personName,
  testimonialReviewed,
  testimonialSubmitted,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import {
  ListTestimonialsQueryDto,
  SubmitTestimonialDto,
} from './dto/my-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';

const withFiles = {
  photo: true,
  pendingPhoto: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.TestimonialInclude;

type TestimonialRow = Prisma.TestimonialGetPayload<{
  include: typeof withFiles;
}>;

/** An approved testimonial whose candidate edits are waiting for review. */
const hasPendingEdit: Prisma.TestimonialWhereInput = {
  status: TestimonialStatus.APPROVED,
  pendingQuote: { not: null },
};

const tabs: Record<string, Prisma.TestimonialWhereInput> = {
  pending: { OR: [{ status: TestimonialStatus.PENDING }, hasPendingEdit] },
  live: { status: TestimonialStatus.APPROVED },
  rejected: { status: TestimonialStatus.REJECTED },
  withdrawn: { status: TestimonialStatus.WITHDRAWN },
  all: {},
};

const CONSENT_VERSION = 'v1';

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private photoUrl(file: FileObject | null) {
    if (!file) return Promise.resolve(null);
    return this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
  }

  private uploadPhoto(file: UploadedDocument, uploadedById: string) {
    assertPhoto(file);
    return this.uploads.uploadDocument(file, {
      folder: 'testimonials',
      uploadedById,
    });
  }

  private async toView(row: TestimonialRow) {
    const [photoUrl, pendingPhotoUrl] = await Promise.all([
      this.photoUrl(row.photo),
      this.photoUrl(row.pendingPhoto),
    ]);
    return {
      id: row.id,
      authorName: row.authorName,
      authorRole: row.authorRole,
      quote: row.quote,
      rating: row.rating,
      joinedAt: row.joinedAt?.toISOString().slice(0, 10) ?? null,
      status: row.status,
      photoUrl,
      pendingEdit:
        row.pendingQuote !== null
          ? {
              quote: row.pendingQuote,
              authorRole: row.pendingRole,
              rating: row.pendingRating,
              photoUrl: pendingPhotoUrl,
            }
          : null,
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedBy: row.reviewedBy,
      consentedAt: row.consentedAt?.toISOString() ?? null,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      /** null = added by an admin. */
      candidate: row.user,
    };
  }

  private async findRow(id: string) {
    const row = await this.prisma.testimonial.findFirst({
      where: { id, deletedAt: null },
      include: withFiles,
    });
    if (!row) throw new NotFoundException('Testimonial not found');
    return row;
  }

  // ── Public ───────────────────────────────────────────────────────────

  /** Approved testimonials for the website. */
  async findPublished() {
    const rows = await this.prisma.testimonial.findMany({
      where: { deletedAt: null, status: TestimonialStatus.APPROVED },
      include: { photo: true },
      orderBy: [{ sortOrder: 'asc' }, { reviewedAt: 'desc' }],
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        authorName: row.authorName,
        authorRole: row.authorRole,
        quote: row.quote,
        rating: row.rating,
        joinedAt: row.joinedAt?.toISOString().slice(0, 10) ?? null,
        photoUrl: await this.photoUrl(row.photo),
        sortOrder: row.sortOrder,
      })),
    );
  }

  // ── Candidate ────────────────────────────────────────────────────────

  /** Real workers only: hired on a project, or paid at least once. */
  async isEligible(userId: string) {
    const [hired, paid] = await Promise.all([
      this.prisma.candidateApplication.count({
        where: {
          userId,
          status: {
            in: [ApplicationStatus.HIRED, ApplicationStatus.COMPLETED],
          },
        },
      }),
      this.prisma.payout.count({ where: { userId } }),
    ]);
    return hired + paid > 0;
  }

  async mine(userId: string) {
    const [eligible, row] = await Promise.all([
      this.isEligible(userId),
      this.prisma.testimonial.findFirst({
        where: { userId, deletedAt: null },
        include: withFiles,
      }),
    ]);
    return { eligible, testimonial: row ? await this.toView(row) : null };
  }

  /**
   * Submit or edit my testimonial. New, rejected and withdrawn ones go to
   * PENDING; edits to a live one wait in the pending fields while the
   * approved version stays public.
   */
  async submit(
    userId: string,
    dto: SubmitTestimonialDto,
    file?: UploadedDocument,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!(await this.isEligible(userId))) {
      throw new ForbiddenException(
        'You can share a testimonial once you have been selected for a project.',
      );
    }
    const [user, existing] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          legalName: true,
          createdAt: true,
        },
      }),
      this.prisma.testimonial.findUnique({ where: { userId } }),
    ]);
    const live = existing && !existing.deletedAt ? existing : null;
    if (!file && !live?.photoId) {
      throw new BadRequestException('Add a photo of yourself.');
    }
    const photo = file ? await this.uploadPhoto(file, userId) : null;
    const now = new Date();
    const isEdit = live?.status === TestimonialStatus.APPROVED;

    const data: Prisma.TestimonialUncheckedUpdateInput = isEdit
      ? {
          pendingQuote: dto.quote,
          pendingRole: dto.authorRole || null,
          pendingRating: dto.rating,
          pendingPhotoId: photo?.id ?? null,
          submittedAt: now,
          consentedAt: now,
        }
      : {
          authorName:
            user.legalName ??
            personName({ ...user, email: user.email.split('@')[0] }),
          authorRole: dto.authorRole || null,
          quote: dto.quote,
          rating: dto.rating,
          joinedAt: user.createdAt,
          photoId: photo?.id ?? live?.photoId ?? null,
          status: TestimonialStatus.PENDING,
          pendingQuote: null,
          pendingRole: null,
          pendingRating: null,
          pendingPhotoId: null,
          rejectionReason: null,
          submittedAt: now,
          consentedAt: now,
          deletedAt: null,
        };

    await this.prisma.$transaction([
      existing
        ? this.prisma.testimonial.update({ where: { userId }, data })
        : this.prisma.testimonial.create({
            data: {
              ...(data as Prisma.TestimonialUncheckedCreateInput),
              userId,
            },
          }),
      this.prisma.consentRecord.create({
        data: {
          userId,
          type: ConsentType.TESTIMONIAL,
          version: CONSENT_VERSION,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      }),
    ]);
    await this.notifications.notifyAdmins(
      testimonialSubmitted(user.legalName ?? personName(user), isEdit),
    );
    return this.mine(userId);
  }

  /** Hide my testimonial from the website (consent withdrawn). */
  async withdraw(userId: string) {
    const row = await this.prisma.testimonial.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('You have no testimonial');
    await this.prisma.$transaction([
      this.prisma.testimonial.update({
        where: { id: row.id },
        data: {
          status: TestimonialStatus.WITHDRAWN,
          pendingQuote: null,
          pendingRole: null,
          pendingRating: null,
          pendingPhotoId: null,
        },
      }),
      this.prisma.consentRecord.updateMany({
        where: { userId, type: ConsentType.TESTIMONIAL, withdrawnAt: null },
        data: { withdrawnAt: new Date() },
      }),
    ]);
    return this.mine(userId);
  }

  // ── Admin ────────────────────────────────────────────────────────────

  async findAll(query: ListTestimonialsQueryDto) {
    const notDeleted = { deletedAt: null };
    const [rows, ...counts] = await this.prisma.$transaction([
      this.prisma.testimonial.findMany({
        where: { ...notDeleted, ...tabs[query.tab ?? 'all'] },
        include: withFiles,
        orderBy: [{ submittedAt: 'desc' }, { sortOrder: 'asc' }],
      }),
      ...Object.values(tabs).map((where) =>
        this.prisma.testimonial.count({ where: { ...notDeleted, ...where } }),
      ),
    ]);
    const keys = Object.keys(tabs);
    return {
      data: await Promise.all(rows.map((row) => this.toView(row))),
      counts: Object.fromEntries(
        keys.map((key, index) => [key, counts[index]]),
      ),
    };
  }

  async findOne(id: string) {
    return this.toView(await this.findRow(id));
  }

  /** Admin-added testimonial; a photo is required. */
  async create(
    adminId: string,
    dto: CreateTestimonialDto,
    file?: UploadedDocument,
  ) {
    if (!file) throw new BadRequestException('Add a photo.');
    const photo = await this.uploadPhoto(file, adminId);
    const status = dto.status ?? TestimonialStatus.APPROVED;
    const row = await this.prisma.testimonial.create({
      data: {
        authorName: dto.authorName,
        authorRole: dto.authorRole || null,
        quote: dto.quote,
        rating: dto.rating ?? null,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : null,
        photoId: photo.id,
        status,
        sortOrder: dto.sortOrder ?? 0,
        submittedAt: new Date(),
        ...(status === TestimonialStatus.APPROVED
          ? { reviewedById: adminId, reviewedAt: new Date() }
          : {}),
      },
      include: withFiles,
    });
    return this.toView(row);
  }

  /** Admin edits apply to the live version directly. */
  async update(
    adminId: string,
    id: string,
    dto: UpdateTestimonialDto,
    file?: UploadedDocument,
  ) {
    const existing = await this.findRow(id);
    const photo = file ? await this.uploadPhoto(file, adminId) : null;
    const row = await this.prisma.testimonial.update({
      where: { id },
      data: {
        authorName: dto.authorName ?? undefined,
        authorRole:
          dto.authorRole !== undefined ? dto.authorRole || null : undefined,
        quote: dto.quote ?? undefined,
        rating: dto.rating ?? undefined,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        sortOrder: dto.sortOrder ?? undefined,
        ...(photo ? { photoId: photo.id } : {}),
      },
      include: withFiles,
    });
    if (existing.userId && dto.quote && dto.quote !== existing.quote) {
      await this.notifications.notifyUser(existing.userId, {
        type: 'TESTIMONIAL_REVIEWED',
        title: 'Your testimonial was edited',
        message: 'The Titan team made small edits to your testimonial.',
        link: '/testimonials/share',
      });
    }
    return this.toView(row);
  }

  /** Approve: goes live, or applies the pending edit to the live version. */
  async approve(adminId: string, id: string) {
    const existing = await this.findRow(id);
    if (existing.status === TestimonialStatus.WITHDRAWN) {
      throw new BadRequestException('The candidate withdrew this testimonial.');
    }
    const pending = existing.pendingQuote !== null;
    if (!pending && existing.status === TestimonialStatus.APPROVED) {
      throw new BadRequestException('Already live.');
    }
    if (!existing.photoId && !existing.pendingPhotoId) {
      throw new BadRequestException('Add a photo before approving.');
    }
    const row = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(pending
          ? {
              quote: existing.pendingQuote ?? existing.quote,
              authorRole: existing.pendingRole,
              rating: existing.pendingRating,
              photoId: existing.pendingPhotoId ?? existing.photoId,
              pendingQuote: null,
              pendingRole: null,
              pendingRating: null,
              pendingPhotoId: null,
            }
          : {}),
        status: TestimonialStatus.APPROVED,
        rejectionReason: null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: withFiles,
    });
    if (existing.userId) {
      await this.notifications.notifyUser(
        existing.userId,
        testimonialReviewed(true),
      );
    }
    return this.toView(row);
  }

  /**
   * Reject: a new submission becomes REJECTED; a pending edit is discarded
   * and the live version stays up.
   */
  async reject(adminId: string, id: string, reason: string) {
    const existing = await this.findRow(id);
    const pending =
      existing.status === TestimonialStatus.APPROVED &&
      existing.pendingQuote !== null;
    if (!pending && existing.status !== TestimonialStatus.PENDING) {
      throw new BadRequestException(
        'Only pending testimonials can be rejected.',
      );
    }
    const row = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(pending
          ? {
              pendingQuote: null,
              pendingRole: null,
              pendingRating: null,
              pendingPhotoId: null,
            }
          : { status: TestimonialStatus.REJECTED }),
        rejectionReason: reason,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: withFiles,
    });
    if (existing.userId) {
      await this.notifications.notifyUser(
        existing.userId,
        testimonialReviewed(false, reason),
      );
    }
    return this.toView(row);
  }

  async delete(id: string) {
    await this.findRow(id);
    await this.prisma.testimonial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Testimonial deleted successfully' };
  }
}
