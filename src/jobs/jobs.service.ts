import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationFieldType,
  JobStatus,
  Prisma,
  WorkMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateJobApplicationFieldDto } from './dto/create-job-application-field.dto.js';
import { UpdateJobApplicationFieldDto } from './dto/update-job-application-field.dto.js';
import { CreateJobCategoryDto } from './dto/create-job-category.dto.js';
import { UpdateJobCategoryDto } from './dto/update-job-category.dto.js';
import { CreateJobEligibilityRuleDto } from './dto/create-job-eligibility-rule.dto.js';
import { JobSearchSort, SearchJobsDto } from './dto/search-jobs.dto.js';
import { UpdateJobEligibilityRuleDto } from './dto/update-job-eligibility-rule.dto.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';

type JobSearchScope = 'admin' | 'public';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertValidUuid(id: string, label: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      throw new BadRequestException(`Invalid ${label} id format`);
    }
  }

  private normalizeSlug(value: string, label: string): string {
    const slug = (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);

    if (!slug) {
      throw new BadRequestException(`${label} slug is required`);
    }

    return slug;
  }

  private async ensureCategoryExists(categoryId: string) {
    this.assertValidUuid(categoryId, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new BadRequestException('Job category not found');
    }

    return category;
  }

  private async ensureUserExists(userId: string) {
    this.assertValidUuid(userId, 'user');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  private async ensureJobExists(jobId: string) {
    this.assertValidUuid(jobId, 'job');

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      include: {
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async generateUniqueCategorySlug(value: string, excludeId?: string) {
    const baseSlug = this.normalizeSlug(value, 'Job category');
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.jobCategory.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async generateUniqueJobSlug(value: string, excludeId?: string) {
    const baseSlug = this.normalizeSlug(value, 'Job');
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.job.findFirst({
        where: {
          slug,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async ensureUniqueJobFieldKey(
    jobId: string,
    fieldKey: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.jobApplicationField.findFirst({
      where: {
        jobId,
        fieldKey,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException(
        'An application field with this key already exists for this job',
      );
    }
  }

  private async ensureUniqueEligibilityFieldKey(
    jobId: string,
    fieldKey: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.jobEligibilityRule.findFirst({
      where: {
        jobId,
        fieldKey,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException(
        'An eligibility rule with this key already exists for this job',
      );
    }
  }

  async findAllCategories() {
    return this.prisma.jobCategory.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findCategoryById(id: string) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: { jobs: true },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    return category;
  }

  async createCategory(dto: CreateJobCategoryDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Job category name is required');
    }

    const name = dto.name.trim();
    const slug = await this.generateUniqueCategorySlug(dto.slug ?? name);

    this.logger.log(`Creating job category: ${name} (${slug})`);

    return this.prisma.jobCategory.create({
      data: {
        name,
        slug,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateJobCategoryDto) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    const nextName = dto.name?.trim() ?? category.name;
    const nextSlug =
      dto.slug !== undefined || dto.name !== undefined
        ? await this.generateUniqueCategorySlug(dto.slug ?? nextName, id)
        : category.slug;

    this.logger.log(`Updating job category: ${id}`);

    return this.prisma.jobCategory.update({
      where: { id },
      data: {
        name: nextName,
        slug: nextSlug,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : category.description,
        isActive: dto.isActive ?? category.isActive,
      },
    });
  }

  async softDeleteCategory(id: string) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: { jobs: true },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    if (!category.isActive) {
      this.logger.warn(`Job category is already inactive: ${id}`);
      return { message: 'Job category is already inactive' };
    }

    const softDeleteTime = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.job.updateMany({
        where: { categoryId: id, deletedAt: null },
        data: {
          deletedAt: softDeleteTime,
          status: JobStatus.ARCHIVED,
        },
      });

      await tx.jobApplicationField.updateMany({
        where: { job: { categoryId: id }, deletedAt: null },
        data: { deletedAt: softDeleteTime },
      });

      await tx.jobEligibilityRule.updateMany({
        where: { job: { categoryId: id }, deletedAt: null },
        data: { deletedAt: softDeleteTime },
      });

      await tx.jobCategory.update({
        where: { id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Soft deleted job category: ${id}`);

    return { message: 'Job category soft deleted successfully' };
  }

  async hardDeleteCategory(id: string) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: { jobs: true },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const jobIds = category.jobs.map((job) => job.id);

      if (jobIds.length > 0) {
        await tx.jobApplicationField.deleteMany({
          where: { jobId: { in: jobIds } },
        });
        await tx.jobEligibilityRule.deleteMany({
          where: { jobId: { in: jobIds } },
        });
        await tx.job.deleteMany({ where: { id: { in: jobIds } } });
      }

      await tx.jobCategory.delete({ where: { id } });
    });

    this.logger.log(`Hard deleted job category: ${id}`);

    return { message: 'Job category hard deleted successfully' };
  }

  async deleteCategory(id: string) {
    return this.softDeleteCategory(id);
  }

  async findAllJobs() {
    return this.prisma.job.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        applicationFields: {
          orderBy: [{ createdAt: 'asc' }],
        },
        eligibilityRules: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findJobById(id: string) {
    return this.ensureJobExists(id);
  }

  async findJobByIdForUser(id: string, userId?: string) {
    this.assertValidUuid(id, 'job');

    const canViewAllJobs = userId
      ? await this.userHasAnyRole(userId, [UserRole.ADMIN])
      : false;
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(canViewAllJobs
          ? {}
          : {
              status: { in: [JobStatus.PUBLISHED, JobStatus.CLOSED] },
              category: { isActive: true },
            }),
      },
      include: {
        category: true,
        createdBy: canViewAllJobs
          ? {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            }
          : false,
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async userHasAnyRole(userId: string, roles: UserRole[]) {
    const roleCount = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: { in: roles } },
      },
    });

    return roleCount > 0;
  }

  async findPublicJobByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      throw new BadRequestException('Job identifier is required');
    }

    const identifierWhere = this.isUuid(normalizedIdentifier)
      ? { id: normalizedIdentifier }
      : { slug: normalizedIdentifier };

    const job = await this.prisma.job.findFirst({
      where: {
        ...identifierWhere,
        deletedAt: null,
        status: { in: [JobStatus.PUBLISHED, JobStatus.CLOSED] },
        category: { isActive: true },
      },
      include: {
        category: true,
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      await this.logPublicJobLookupMiss(normalizedIdentifier);
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async logPublicJobLookupMiss(identifier: string) {
    const identifierWhere = this.isUuid(identifier)
      ? { id: identifier }
      : { slug: identifier };
    const existing = await this.prisma.job.findFirst({
      where: { ...identifierWhere },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!existing) {
      this.logger.warn(
        `Public job lookup failed: ${identifier} does not exist`,
      );
      return;
    }

    this.logger.warn(
      `Public job lookup failed: ${identifier} exists but is not public | status=${existing.status} | deletedAt=${
        existing.deletedAt?.toISOString() ?? 'null'
      } | category=${existing.category.name} | categoryActive=${existing.category.isActive}`,
    );
  }

  async searchJobs(query: SearchJobsDto, scope: JobSearchScope) {
    const page = this.parsePositiveInt(query.page, 1, 1, 500);
    const pageSize = this.parsePositiveInt(query.pageSize, 12, 1, 100);
    const searchTerm = query.q?.trim();
    const location = query.location?.trim();
    const skills = this.parseCsv(query.skills);

    const where: Prisma.JobWhereInput = {
      deletedAt: null,
    };

    if (scope === 'public') {
      where.status = { in: [JobStatus.PUBLISHED, JobStatus.CLOSED] };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.categorySlug?.trim()) {
      where.category = {
        slug: query.categorySlug.trim(),
        ...(scope === 'public' ? { isActive: true } : {}),
      };
    } else if (scope === 'public') {
      where.category = { isActive: true };
    }

    if (query.workMode) {
      where.workMode = query.workMode;
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (skills.length > 0) {
      where.skills = { hasSome: skills };
    }

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { summary: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
        { skills: { has: searchTerm } },
      ];
    }

    const orderBy = this.getJobSearchOrderBy(query.sort);
    const [total, data, categories] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        include: {
          category: true,
          createdBy:
            scope === 'admin'
              ? {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                }
              : false,
          applicationFields:
            scope === 'admin' ? { orderBy: [{ createdAt: 'asc' }] } : false,
          eligibilityRules:
            scope === 'admin' ? { orderBy: [{ createdAt: 'asc' }] } : false,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.jobCategory.findMany({
        where: scope === 'public' ? { isActive: true } : {},
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      facets: {
        categories,
        workModes: Object.values(WorkMode),
        statuses:
          scope === 'public'
            ? [JobStatus.PUBLISHED, JobStatus.CLOSED]
            : Object.values(JobStatus),
      },
    };
  }

  async createJob(dto: CreateJobDto, currentUserId?: string) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Job title is required');
    }

    if (!dto.description?.trim()) {
      throw new BadRequestException('Job description is required');
    }

    if (!dto.categoryId) {
      throw new BadRequestException('Job category is required');
    }

    await this.ensureCategoryExists(dto.categoryId);

    const createdById = dto.createdById ?? currentUserId;
    if (!createdById) {
      throw new BadRequestException(
        'createdById or authenticated user is required',
      );
    }

    await this.ensureUserExists(createdById);

    const title = dto.title.trim();
    const slug = await this.generateUniqueJobSlug(dto.slug ?? title);

    this.logger.log(`Creating job: ${title} (${slug}) for user ${createdById}`);

    const data: Prisma.JobCreateInput = {
      title,
      slug,
      category: { connect: { id: dto.categoryId } },
      createdBy: { connect: { id: createdById } },
      summary: dto.summary?.trim() || null,
      description: dto.description.trim(),
      skills: dto.skills ?? [],
      requirements: dto.requirements ?? [],
      location: dto.location?.trim() || null,
      workMode: dto.workMode ?? WorkMode.REMOTE,
      duration: dto.duration?.trim() || null,
      openings: dto.openings ?? null,
      applicationInstructions: dto.applicationInstructions ?? [],
      workInstructions: dto.workInstructions ?? [],
      additionalInfo:
        dto.additionalInfo === undefined
          ? Prisma.JsonNull
          : (dto.additionalInfo as Prisma.InputJsonValue),
      coverImageId: dto.coverImageId ?? null,
      status: dto.status ?? JobStatus.DRAFT,
      publishedAt: dto.publishedAt ?? null,
      applicationDeadline: dto.applicationDeadline ?? null,
      closedAt: dto.closedAt ?? null,
    };

    return this.prisma.job.create({
      data,
      include: {
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateJob(id: string, dto: UpdateJobDto) {
    const existing = await this.prisma.job.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Job title is required');
    }

    if (dto.description !== undefined && !dto.description.trim()) {
      throw new BadRequestException('Job description is required');
    }

    const nextTitle = dto.title?.trim() ?? existing.title;
    const nextSlug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.generateUniqueJobSlug(dto.slug ?? nextTitle, id)
        : existing.slug;

    const nextPublishedAt =
      dto.publishedAt !== undefined ? dto.publishedAt : existing.publishedAt;
    const nextClosedAt =
      dto.closedAt !== undefined ? dto.closedAt : existing.closedAt;
    const nextStatus = dto.status ?? existing.status;

    const data: Prisma.JobUpdateInput = {
      title: nextTitle,
      slug: nextSlug,
      category: dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : undefined,
      summary:
        dto.summary !== undefined
          ? dto.summary?.trim() || null
          : existing.summary,
      description:
        dto.description !== undefined
          ? dto.description.trim()
          : existing.description,
      skills: dto.skills ?? existing.skills,
      requirements: dto.requirements ?? existing.requirements,
      location:
        dto.location !== undefined
          ? dto.location?.trim() || null
          : existing.location,
      workMode: dto.workMode ?? existing.workMode,
      duration:
        dto.duration !== undefined
          ? dto.duration?.trim() || null
          : existing.duration,
      openings: dto.openings ?? existing.openings,
      applicationInstructions:
        dto.applicationInstructions ?? existing.applicationInstructions,
      workInstructions: dto.workInstructions ?? existing.workInstructions,
      additionalInfo:
        dto.additionalInfo === undefined
          ? (existing.additionalInfo ?? Prisma.JsonNull)
          : (dto.additionalInfo as Prisma.InputJsonValue),
      coverImageId:
        dto.coverImageId !== undefined
          ? (dto.coverImageId ?? null)
          : existing.coverImageId,
      status: nextStatus,
      publishedAt: nextPublishedAt,
      applicationDeadline:
        dto.applicationDeadline !== undefined
          ? dto.applicationDeadline
          : existing.applicationDeadline,
      closedAt: nextClosedAt,
    };

    this.logger.log(`Updating job: ${id}`);

    return this.prisma.job.update({
      where: { id },
      data,
      include: {
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateJobStatus(id: string, status: JobStatus) {
    return this.updateJob(id, { status });
  }

  async softDeleteJob(id: string) {
    const existing = await this.prisma.job.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    if (existing.deletedAt) {
      this.logger.warn(`Job already deleted: ${id}`);
      return { message: 'Job already deleted' };
    }

    const softDeleteTime = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id },
        data: {
          deletedAt: softDeleteTime,
          status:
            existing.status === JobStatus.CLOSED
              ? existing.status
              : JobStatus.ARCHIVED,
        },
      });

      await tx.jobApplicationField.updateMany({
        where: { jobId: id, deletedAt: null },
        data: { deletedAt: softDeleteTime },
      });

      await tx.jobEligibilityRule.updateMany({
        where: { jobId: id, deletedAt: null },
        data: { deletedAt: softDeleteTime },
      });
    });

    this.logger.log(`Soft deleted job: ${id}`);

    return { message: 'Job soft deleted successfully' };
  }

  async hardDeleteJob(id: string) {
    this.assertValidUuid(id, 'job');

    const existing = await this.prisma.job.findFirst({
      where: { id },
      include: { applicationFields: true, eligibilityRules: true },
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobApplicationField.deleteMany({ where: { jobId: id } });
      await tx.jobEligibilityRule.deleteMany({ where: { jobId: id } });
      await tx.job.delete({ where: { id } });
    });

    this.logger.log(`Hard deleted job: ${id}`);

    return { message: 'Job hard deleted successfully' };
  }

  async deleteJob(id: string) {
    return this.softDeleteJob(id);
  }

  private parseCsv(value?: string) {
    return (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private isUuid(value: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

    return uuidPattern.test(value);
  }

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number.parseInt(value ?? '', 10);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
  }

  private getJobSearchOrderBy(
    sort: JobSearchSort | undefined,
  ): Prisma.JobOrderByWithRelationInput[] {
    switch (sort) {
      case JobSearchSort.OLDEST:
        return [{ createdAt: 'asc' }];
      case JobSearchSort.RECENTLY_PUBLISHED:
        return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
      case JobSearchSort.DEADLINE_SOON:
        return [{ applicationDeadline: 'asc' }, { createdAt: 'desc' }];
      case JobSearchSort.DEADLINE_LATEST:
        return [{ applicationDeadline: 'desc' }, { createdAt: 'desc' }];
      case JobSearchSort.TITLE_ASC:
        return [{ title: 'asc' }];
      case JobSearchSort.TITLE_DESC:
        return [{ title: 'desc' }];
      case JobSearchSort.OPENINGS_HIGH:
        return [{ openings: 'desc' }, { createdAt: 'desc' }];
      case JobSearchSort.NEWEST:
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  async findJobApplicationFields(jobId: string) {
    await this.ensureJobExists(jobId);

    return this.prisma.jobApplicationField.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async upsertApplicationFieldForJob(
    jobId: string,
    dto: CreateJobApplicationFieldDto,
  ) {
    await this.ensureJobExists(jobId);

    const fieldKey = dto.fieldKey.trim();
    if (!fieldKey) {
      throw new BadRequestException('Application field key is required');
    }

    const existing = await this.prisma.jobApplicationField.findFirst({
      where: { jobId, fieldKey },
    });

    if (existing) {
      return this.prisma.jobApplicationField.update({
        where: { id: existing.id },
        data: {
          fieldType: dto.fieldType ?? existing.fieldType,
          label: dto.label?.trim() ?? existing.label,
          description:
            dto.description !== undefined
              ? dto.description?.trim() || null
              : existing.description,
          required: dto.required ?? existing.required,
          options:
            dto.options === undefined
              ? (existing.options ?? Prisma.JsonNull)
              : ((dto.options as Prisma.InputJsonValue) ?? Prisma.JsonNull),
        },
      });
    }

    await this.ensureUniqueJobFieldKey(jobId, fieldKey);

    this.logger.log(`Creating application field ${fieldKey} for job ${jobId}`);

    return this.prisma.jobApplicationField.create({
      data: {
        jobId,
        fieldKey,
        fieldType: dto.fieldType ?? ApplicationFieldType.TEXT,
        label: dto.label.trim(),
        description: dto.description?.trim() || null,
        required: dto.required ?? false,
        options: (dto.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async createApplicationFieldForJob(
    jobId: string,
    dto: CreateJobApplicationFieldDto,
  ) {
    await this.ensureJobExists(jobId);

    const fieldKey = dto.fieldKey.trim();
    if (!fieldKey) {
      throw new BadRequestException('Application field key is required');
    }

    await this.ensureUniqueJobFieldKey(jobId, fieldKey);

    return this.prisma.jobApplicationField.create({
      data: {
        jobId,
        fieldKey,
        fieldType: dto.fieldType,
        label: dto.label.trim(),
        description: dto.description?.trim() || null,
        required: dto.required ?? false,
        options: (dto.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async updateApplicationFieldForJob(
    jobId: string,
    fieldId: string,
    dto: UpdateJobApplicationFieldDto,
  ) {
    this.assertValidUuid(jobId, 'job');
    this.assertValidUuid(fieldId, 'application field');

    const field = await this.prisma.jobApplicationField.findFirst({
      where: { id: fieldId, jobId },
    });

    if (!field) {
      throw new NotFoundException('Application field not found');
    }

    const nextFieldKey = dto.fieldKey?.trim() ?? field.fieldKey;
    if (nextFieldKey !== field.fieldKey) {
      await this.ensureUniqueJobFieldKey(jobId, nextFieldKey, fieldId);
    }

    return this.prisma.jobApplicationField.update({
      where: { id: fieldId },
      data: {
        fieldKey: nextFieldKey,
        fieldType: dto.fieldType ?? field.fieldType,
        label: dto.label?.trim() ?? field.label,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : field.description,
        required: dto.required ?? field.required,
        options:
          dto.options === undefined
            ? (field.options ?? Prisma.JsonNull)
            : ((dto.options as Prisma.InputJsonValue) ?? Prisma.JsonNull),
      },
    });
  }

  async deleteApplicationFieldForJob(jobId: string, fieldId: string) {
    this.assertValidUuid(jobId, 'job');
    this.assertValidUuid(fieldId, 'application field');

    const field = await this.prisma.jobApplicationField.findFirst({
      where: { id: fieldId, jobId },
    });

    if (!field) {
      throw new NotFoundException('Application field not found');
    }

    await this.prisma.jobApplicationField.delete({ where: { id: fieldId } });

    return { message: 'Application field deleted successfully' };
  }

  async findJobEligibilityRules(jobId: string) {
    await this.ensureJobExists(jobId);

    return this.prisma.jobEligibilityRule.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async createEligibilityRuleForJob(
    jobId: string,
    dto: CreateJobEligibilityRuleDto,
  ) {
    await this.ensureJobExists(jobId);

    if (!dto.fieldKey?.trim()) {
      throw new BadRequestException('Eligibility field key is required');
    }

    if (dto.value === undefined || dto.value === null) {
      throw new BadRequestException('Eligibility value is required');
    }

    const fieldKey = dto.fieldKey.trim();
    await this.ensureUniqueEligibilityFieldKey(jobId, fieldKey);

    return this.prisma.jobEligibilityRule.create({
      data: {
        jobId,
        fieldKey,
        fieldType: dto.fieldType,
        operator: dto.operator,
        value: dto.value as Prisma.InputJsonValue,
      },
    });
  }

  async updateEligibilityRuleForJob(
    jobId: string,
    ruleId: string,
    dto: UpdateJobEligibilityRuleDto,
  ) {
    this.assertValidUuid(jobId, 'job');
    this.assertValidUuid(ruleId, 'eligibility rule');

    const rule = await this.prisma.jobEligibilityRule.findFirst({
      where: { id: ruleId, jobId },
    });

    if (!rule) {
      throw new NotFoundException('Eligibility rule not found');
    }

    const nextFieldKey = dto.fieldKey?.trim() ?? rule.fieldKey;
    if (nextFieldKey !== rule.fieldKey) {
      await this.ensureUniqueEligibilityFieldKey(jobId, nextFieldKey, ruleId);
    }

    if (dto.value !== undefined && dto.value === null) {
      throw new BadRequestException('Eligibility value is required');
    }

    return this.prisma.jobEligibilityRule.update({
      where: { id: ruleId },
      data: {
        fieldKey: nextFieldKey,
        fieldType: dto.fieldType ?? rule.fieldType,
        operator: dto.operator ?? rule.operator,
        value: (dto.value ?? rule.value) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteEligibilityRuleForJob(jobId: string, ruleId: string) {
    this.assertValidUuid(jobId, 'job');
    this.assertValidUuid(ruleId, 'eligibility rule');

    const rule = await this.prisma.jobEligibilityRule.findFirst({
      where: { id: ruleId, jobId },
    });

    if (!rule) {
      throw new NotFoundException('Eligibility rule not found');
    }

    await this.prisma.jobEligibilityRule.delete({ where: { id: ruleId } });

    return { message: 'Eligibility rule deleted successfully' };
  }
}
