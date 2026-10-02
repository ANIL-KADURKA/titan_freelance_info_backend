import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  Prisma,
  PublishStatus,
  type FileObject,
} from '@prisma/client';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { describeDuration, formatInr, slugify } from './case-study-rules.js';
import { CaseStudyDto, UpdateCaseStudyDto } from './dto/case-study.dto.js';

const adminInclude = {
  photo: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  job: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.CaseStudyInclude;

type CaseStudyRow = Prisma.CaseStudyGetPayload<{
  include: typeof adminInclude;
}>;

const published: Prisma.CaseStudyWhereInput = {
  deletedAt: null,
  status: PublishStatus.PUBLISHED,
};

@Injectable()
export class CaseStudiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
  ) {}

  private photoUrl(file: FileObject | null) {
    if (!file) return Promise.resolve(null);
    return this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
  }

  /** What the website shows (no candidate / project links). */
  private async toPublic(
    row: Prisma.CaseStudyGetPayload<{ include: { photo: true } }>,
  ) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      personName: row.personName,
      personRole: row.personRole,
      photoUrl: await this.photoUrl(row.photo),
      background: row.background,
      howItBegan: row.howItBegan,
      gettingSelected: row.gettingSelected,
      findingFooting: row.findingFooting,
      hardParts: row.hardParts,
      support: row.support,
      outcome: row.outcome,
      durationText: row.durationText,
      earningsText: row.earningsText,
      consentRecordedAt: row.consentRecordedAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  private async toAdmin(row: CaseStudyRow) {
    return {
      ...(await this.toPublic(row)),
      status: row.status,
      sortOrder: row.sortOrder,
      user: row.user,
      job: row.job,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async findRow(id: string) {
    const row = await this.prisma.caseStudy.findFirst({
      where: { id, deletedAt: null },
      include: adminInclude,
    });
    if (!row) throw new NotFoundException('Case study not found');
    return row;
  }

  // ── Public ──

  async listPublished() {
    const rows = await this.prisma.caseStudy.findMany({
      where: published,
      include: { photo: true },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.toPublic(row)));
  }

  async findPublishedBySlug(slug: string) {
    const row = await this.prisma.caseStudy.findFirst({
      where: { ...published, slug },
      include: { photo: true },
    });
    if (!row) throw new NotFoundException('Case study not found');
    return this.toPublic(row);
  }

  // ── Admin ──

  async list() {
    const rows = await this.prisma.caseStudy.findMany({
      where: { deletedAt: null },
      include: adminInclude,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.toAdmin(row)));
  }

  async findOne(id: string) {
    return this.toAdmin(await this.findRow(id));
  }

  /** A slug that isn't taken (adds -2, -3, … when needed). */
  private async uniqueSlug(base: string, excludeId?: string) {
    const root = slugify(base) || 'story';
    for (let attempt = 1; attempt < 50; attempt += 1) {
      const slug = attempt === 1 ? root : `${root}-${attempt}`;
      const taken = await this.prisma.caseStudy.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      if (!taken) return slug;
    }
    throw new ConflictException('Choose a different slug.');
  }

  private async uploadPhoto(file: UploadedDocument, adminId: string) {
    assertPhoto(file);
    return this.uploads.uploadDocument(file, {
      folder: 'case-studies',
      uploadedById: adminId,
    });
  }

  async create(adminId: string, dto: CaseStudyDto, file?: UploadedDocument) {
    const photo = file ? await this.uploadPhoto(file, adminId) : null;
    const isPublished = dto.status === PublishStatus.PUBLISHED;
    const row = await this.prisma.caseStudy.create({
      data: {
        slug: await this.uniqueSlug(dto.slug || dto.title),
        title: dto.title,
        summary: dto.summary,
        personName: dto.personName,
        personRole: dto.personRole ?? null,
        photoId: photo?.id ?? null,
        userId: dto.userId ?? null,
        jobId: dto.jobId ?? null,
        background: dto.background,
        howItBegan: dto.howItBegan,
        gettingSelected: dto.gettingSelected,
        findingFooting: dto.findingFooting,
        hardParts: dto.hardParts,
        support: dto.support,
        outcome: dto.outcome,
        durationText: dto.durationText ?? null,
        earningsText: dto.earningsText ?? null,
        consentRecordedAt: dto.consentRecorded ? new Date() : null,
        status: dto.status,
        publishedAt: isPublished ? new Date() : null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: adminId,
      },
      include: adminInclude,
    });
    return this.toAdmin(row);
  }

  async update(
    adminId: string,
    id: string,
    dto: UpdateCaseStudyDto,
    file?: UploadedDocument,
  ) {
    const existing = await this.findRow(id);
    const photo = file ? await this.uploadPhoto(file, adminId) : null;
    const slug =
      dto.slug && dto.slug !== existing.slug
        ? await this.uniqueSlug(dto.slug, id)
        : undefined;
    const publishing =
      dto.status === PublishStatus.PUBLISHED &&
      existing.status !== PublishStatus.PUBLISHED;
    const consentRecordedAt =
      dto.consentRecorded === undefined
        ? undefined
        : dto.consentRecorded
          ? (existing.consentRecordedAt ?? new Date())
          : null;

    const row = await this.prisma.caseStudy.update({
      where: { id },
      data: {
        slug,
        title: dto.title,
        summary: dto.summary,
        personName: dto.personName,
        personRole:
          dto.personRole === undefined ? undefined : dto.personRole || null,
        // undefined = not sent (unchanged); null = cleared in the form.
        userId: dto.userId,
        jobId: dto.jobId,
        background: dto.background,
        howItBegan: dto.howItBegan,
        gettingSelected: dto.gettingSelected,
        findingFooting: dto.findingFooting,
        hardParts: dto.hardParts,
        support: dto.support,
        outcome: dto.outcome,
        durationText:
          'durationText' in dto ? (dto.durationText ?? null) : undefined,
        earningsText:
          'earningsText' in dto ? (dto.earningsText ?? null) : undefined,
        consentRecordedAt,
        status: dto.status,
        publishedAt: publishing ? new Date() : undefined,
        sortOrder: dto.sortOrder,
        ...(photo
          ? { photoId: photo.id }
          : dto.removePhoto
            ? { photoId: null }
            : {}),
      },
      include: adminInclude,
    });
    return this.toAdmin(row);
  }

  async remove(id: string) {
    await this.findRow(id);
    await this.prisma.caseStudy.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Case study deleted.' };
  }

  /**
   * Suggested facts from a linked candidate: name, role (project), how long
   * they've worked with Titan and what they've been paid.
   */
  async stats(userId: string) {
    const [user, application, payouts] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { legalName: true, firstName: true, lastName: true },
      }),
      this.prisma.candidateApplication.findFirst({
        where: {
          userId,
          status: {
            in: [ApplicationStatus.HIRED, ApplicationStatus.COMPLETED],
          },
        },
        orderBy: { statusChangedAt: 'asc' },
        select: {
          statusChangedAt: true,
          job: { select: { id: true, title: true } },
        },
      }),
      this.prisma.payout.aggregate({
        where: { userId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    if (!user) throw new BadRequestException('Candidate not found');
    const total = Number(payouts._sum.amount ?? 0);
    const count = payouts._count._all;
    return {
      personName:
        user.legalName ??
        [user.firstName, user.lastName].filter(Boolean).join(' '),
      personRole: application?.job.title ?? null,
      jobId: application?.job.id ?? null,
      durationText: application
        ? describeDuration(application.statusChangedAt, new Date())
        : null,
      earningsText: count
        ? `${formatInr(total)} earned across ${count} payout${count === 1 ? '' : 's'}`
        : null,
    };
  }
}
