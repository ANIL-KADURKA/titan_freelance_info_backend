import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublishStatus, type FileObject } from '@prisma/client';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type CaseStudyBreakdownRow,
  type CaseStudyProject,
  type CaseStudyResult,
  type CaseStudyStat,
  missingForPublish,
  slugify,
} from './case-study-rules.js';
import {
  CaseStudyBreakdownRowDto,
  CaseStudyDto,
  CaseStudyProjectDto,
  CaseStudyResultDto,
  CaseStudyStatDto,
  UpdateCaseStudyDto,
} from './dto/case-study.dto.js';

type CaseStudyRow = Prisma.CaseStudyGetPayload<{ include: { cover: true } }>;

const published: Prisma.CaseStudyWhereInput = {
  deletedAt: null,
  status: PublishStatus.PUBLISHED,
};

const listOrder: Prisma.CaseStudyOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

/** JSON columns are written by this service only, so the shape is known. */
const asList = <T>(value: Prisma.JsonValue): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

// Plain JSON for the list columns (validated DTO rows are class instances).
const statsJson = (rows?: CaseStudyStatDto[]) =>
  rows?.map(({ value, label }) => ({ value, label }));
const projectsJson = (rows?: CaseStudyProjectDto[]) =>
  rows?.map(({ name, problem, approach }) => ({ name, problem, approach }));
const breakdownJson = (rows?: CaseStudyBreakdownRowDto[]) =>
  rows?.map(({ code, text, value }) => ({ code, text, value }));
const resultsJson = (rows?: CaseStudyResultDto[]) =>
  rows?.map(({ value, label, note }) => ({
    value,
    label,
    ...(note ? { note } : {}),
  }));

/** undefined = not sent (unchanged); "" / null = cleared in the form. */
const optional = (value: string | null | undefined) =>
  value === undefined ? undefined : value || null;

@Injectable()
export class CaseStudiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
  ) {}

  private coverUrl(file: FileObject | null) {
    if (!file) return Promise.resolve(null);
    return this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
  }

  private async toPublic(row: CaseStudyRow) {
    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      focusTag: row.focusTag,
      period: row.period,
      clientLabel: row.clientLabel,
      title: row.title,
      summary: row.summary,
      // An uploaded cover wins; otherwise the image link, if any.
      coverUrl: (await this.coverUrl(row.cover)) ?? row.imageUrl,
      stats: asList<CaseStudyStat>(row.stats),
      projects: asList<CaseStudyProject>(row.projects),
      problemTitle: row.problemTitle,
      problemBody: row.problemBody,
      approachTitle: row.approachTitle,
      approachBody: row.approachBody,
      breakdownTitle: row.breakdownTitle,
      breakdown: asList<CaseStudyBreakdownRow>(row.breakdown),
      resultsTitle: row.resultsTitle,
      results: asList<CaseStudyResult>(row.results),
      quote: row.quote,
      quoteAuthor: row.quoteAuthor,
      isUpcoming: row.isUpcoming,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }

  private async toAdmin(row: CaseStudyRow) {
    return {
      ...(await this.toPublic(row)),
      imageUrl: row.imageUrl,
      hasUploadedCover: Boolean(row.cover),
      status: row.status,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async findRow(id: string) {
    const row = await this.prisma.caseStudy.findFirst({
      where: { id, deletedAt: null },
      include: { cover: true },
    });
    if (!row) throw new NotFoundException('Case study not found');
    return row;
  }

  // ── Public ──

  async listPublished() {
    const rows = await this.prisma.caseStudy.findMany({
      where: published,
      include: { cover: true },
      orderBy: listOrder,
    });
    return Promise.all(rows.map((row) => this.toPublic(row)));
  }

  async findPublishedBySlug(slug: string) {
    const row = await this.prisma.caseStudy.findFirst({
      where: { ...published, slug, isUpcoming: false },
      include: { cover: true },
    });
    if (!row) throw new NotFoundException('Case study not found');
    return this.toPublic(row);
  }

  // ── Admin ──

  async list() {
    const rows = await this.prisma.caseStudy.findMany({
      where: { deletedAt: null },
      include: { cover: true },
      orderBy: listOrder,
    });
    return Promise.all(rows.map((row) => this.toAdmin(row)));
  }

  async findOne(id: string) {
    return this.toAdmin(await this.findRow(id));
  }

  /** A slug that isn't taken (adds -2, -3, … when needed). */
  private async uniqueSlug(base: string, excludeId?: string) {
    const root = slugify(base) || 'case-study';
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

  private uploadCover(file: UploadedDocument, adminId: string) {
    assertPhoto(file);
    return this.uploads.uploadDocument(file, {
      folder: 'case-studies',
      uploadedById: adminId,
    });
  }

  private assertPublishable(study: Parameters<typeof missingForPublish>[0]) {
    const missing = missingForPublish(study);
    if (missing.length) {
      throw new BadRequestException(
        `Add ${missing.join(', ')} before publishing.`,
      );
    }
  }

  async create(adminId: string, dto: CaseStudyDto, file?: UploadedDocument) {
    const isPublished = dto.status === PublishStatus.PUBLISHED;
    const stats = statsJson(dto.stats) ?? [];
    const projects = projectsJson(dto.projects) ?? [];
    const results = resultsJson(dto.results) ?? [];
    const isUpcoming = dto.isUpcoming ?? false;
    if (isPublished) {
      this.assertPublishable({
        isUpcoming,
        problemTitle: dto.problemTitle,
        problemBody: dto.problemBody,
        approachTitle: dto.approachTitle,
        approachBody: dto.approachBody,
        projects,
        results,
      });
    }
    const cover = file ? await this.uploadCover(file, adminId) : null;

    const row = await this.prisma.caseStudy.create({
      data: {
        slug: await this.uniqueSlug(dto.slug || dto.title),
        category: dto.category,
        focusTag: dto.focusTag || null,
        period: dto.period || null,
        imageUrl: dto.imageUrl || null,
        clientLabel: dto.clientLabel || null,
        title: dto.title,
        summary: dto.summary,
        coverId: cover?.id ?? null,
        stats,
        projects,
        problemTitle: dto.problemTitle || null,
        problemBody: dto.problemBody || null,
        approachTitle: dto.approachTitle || null,
        approachBody: dto.approachBody || null,
        breakdownTitle: dto.breakdownTitle || null,
        breakdown: breakdownJson(dto.breakdown) ?? [],
        resultsTitle: dto.resultsTitle || null,
        results,
        quote: dto.quote || null,
        quoteAuthor: dto.quoteAuthor || null,
        isUpcoming,
        status: dto.status,
        publishedAt: isPublished ? new Date() : null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: adminId,
      },
      include: { cover: true },
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
    const status = dto.status ?? existing.status;
    if (status === PublishStatus.PUBLISHED) {
      // Check the case study as it will be after this edit.
      const pick = <K extends keyof UpdateCaseStudyDto & keyof CaseStudyRow>(
        key: K,
      ) => (dto[key] === undefined ? existing[key] : dto[key]) as string | null;
      this.assertPublishable({
        isUpcoming: dto.isUpcoming ?? existing.isUpcoming,
        problemTitle: pick('problemTitle'),
        problemBody: pick('problemBody'),
        approachTitle: pick('approachTitle'),
        approachBody: pick('approachBody'),
        projects: dto.projects ?? asList(existing.projects),
        results: dto.results ?? asList(existing.results),
      });
    }
    const cover = file ? await this.uploadCover(file, adminId) : null;
    const slug =
      dto.slug && dto.slug !== existing.slug
        ? await this.uniqueSlug(dto.slug, id)
        : undefined;
    const publishing =
      status === PublishStatus.PUBLISHED &&
      existing.status !== PublishStatus.PUBLISHED;

    const row = await this.prisma.caseStudy.update({
      where: { id },
      data: {
        slug,
        category: dto.category,
        focusTag: optional(dto.focusTag),
        period: optional(dto.period),
        imageUrl: optional(dto.imageUrl),
        clientLabel: optional(dto.clientLabel),
        title: dto.title,
        summary: dto.summary,
        stats: statsJson(dto.stats),
        projects: projectsJson(dto.projects),
        problemTitle: optional(dto.problemTitle),
        problemBody: optional(dto.problemBody),
        approachTitle: optional(dto.approachTitle),
        approachBody: optional(dto.approachBody),
        breakdownTitle: optional(dto.breakdownTitle),
        breakdown: breakdownJson(dto.breakdown),
        resultsTitle: optional(dto.resultsTitle),
        results: resultsJson(dto.results),
        quote: optional(dto.quote),
        quoteAuthor: optional(dto.quoteAuthor),
        isUpcoming: dto.isUpcoming,
        status: dto.status,
        publishedAt: publishing ? new Date() : undefined,
        sortOrder: dto.sortOrder,
        ...(cover
          ? { coverId: cover.id }
          : dto.removeCover
            ? { coverId: null }
            : {}),
      },
      include: { cover: true },
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
}
