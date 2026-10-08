import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationFieldType,
  type FileObject,
  JobStatus,
  PayCurrency,
  PayUnit,
  Prisma,
  WorkMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto, PHOTO_TYPES } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { newProjectAnnouncement } from '../community/announcement-rules.js';
import { communityPost } from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { JobPreApplicationsService } from './job-pre-applications.service.js';
import { JobResourcesService } from './job-resources.service.js';
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

/** Cover image and logo files, loaded with every job response. */
const jobImages = { coverImage: true, logo: true } as const;

type WithJobImages = {
  coverImage?: FileObject | null;
  logo?: FileObject | null;
};

/** Public jobs show on the landing page and job board, so they need both. */
const statusesNeedingImages: JobStatus[] = [
  JobStatus.PUBLISHED,
  JobStatus.UPCOMING,
];

/** A new application deadline must be a valid moment in the future. */
export function assertFutureDeadline(
  value: string | Date | null | undefined,
  now = new Date(),
) {
  if (!value) return;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    throw new BadRequestException('Enter a valid application deadline.');
  }
  if (deadline <= now) {
    throw new BadRequestException(
      'The application deadline must be in the future.',
    );
  }
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobResourcesService: JobResourcesService,
    private readonly notifications: NotificationsService,
    private readonly preApplications: JobPreApplicationsService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
  ) {}

  /** Uploads a job cover image or logo; the job form sends back its id. */
  async uploadImage(file: UploadedDocument | undefined, userId: string) {
    if (!file) {
      throw new BadRequestException('Choose an image to upload.');
    }
    assertPhoto(file);
    const stored = await this.uploads.uploadDocument(file, {
      folder: 'job-images',
      uploadedById: userId,
    });
    return { id: stored.id, url: await this.imageUrl(stored) };
  }

  private imageUrl(file: FileObject | null | undefined) {
    if (!file || file.deletedAt) return Promise.resolve(null);
    return this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
  }

  /** Swaps the file rows (BigInt sizes don't serialise) for view URLs. */
  private async withImageUrls<T extends WithJobImages>(job: T) {
    const { coverImage, logo, ...rest } = job;
    const [coverImageUrl, logoUrl] = await Promise.all([
      this.imageUrl(coverImage),
      this.imageUrl(logo),
    ]);
    return { ...rest, coverImageUrl, logoUrl };
  }

  /** Both ids must point at uploaded, live image files. */
  private async assertJobImages(
    coverImageId: string | null | undefined,
    logoId: string | null | undefined,
  ) {
    if (!coverImageId || !logoId) {
      throw new BadRequestException('Add a cover image and a logo.');
    }
    const files = await this.prisma.fileObject.findMany({
      where: {
        id: { in: [coverImageId, logoId] },
        deletedAt: null,
        mimeType: { in: PHOTO_TYPES },
      },
      select: { id: true },
    });
    const found = new Set(files.map((file) => file.id));
    if (!found.has(coverImageId) || !found.has(logoId)) {
      throw new BadRequestException(
        'Upload the cover image and logo again, then save.',
      );
    }
  }

  /**
   * Validates new application fields up front (keys unique in the payload
   * and against `existingKeys`, references valid) and maps them to rows.
   */
  private async prepareApplicationFields(
    fields: CreateJobApplicationFieldDto[],
    existingKeys: string[] = [],
  ): Promise<Prisma.JobApplicationFieldUncheckedCreateWithoutJobInput[]> {
    const seen = new Set(existingKeys);
    const rows: Prisma.JobApplicationFieldUncheckedCreateWithoutJobInput[] = [];
    for (const [index, field] of fields.entries()) {
      const fieldKey = field.fieldKey.trim();
      if (!fieldKey) {
        throw new BadRequestException('Application field key is required');
      }
      if (seen.has(fieldKey)) {
        throw new BadRequestException(
          `Application field key "${fieldKey}" is used more than once.`,
        );
      }
      seen.add(fieldKey);
      await this.validateApplicationFieldReferences(
        field.fieldType,
        field.profileFieldId,
        field.documentTypeId,
      );
      rows.push({
        fieldKey,
        fieldType: field.fieldType,
        label: field.label.trim(),
        description: field.description?.trim() || null,
        required: field.required ?? false,
        displayOrder: field.displayOrder ?? existingKeys.length + index,
        profileFieldId: field.profileFieldId,
        documentTypeId: field.documentTypeId,
        options: (field.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      });
    }
    return rows;
  }

  private prepareEligibilityRules(
    rules: CreateJobEligibilityRuleDto[],
    existingKeys: string[] = [],
  ): Prisma.JobEligibilityRuleUncheckedCreateWithoutJobInput[] {
    const seen = new Set(existingKeys);
    return rules.map((rule, index) => {
      const fieldKey = rule.fieldKey?.trim();
      if (!fieldKey) {
        throw new BadRequestException('Eligibility field key is required');
      }
      if (rule.value === undefined || rule.value === null) {
        throw new BadRequestException('Eligibility value is required');
      }
      if (seen.has(fieldKey)) {
        throw new BadRequestException(
          `Eligibility rule key "${fieldKey}" is used more than once.`,
        );
      }
      seen.add(fieldKey);
      return {
        fieldKey,
        fieldType: rule.fieldType,
        operator: rule.operator,
        value: rule.value as Prisma.InputJsonValue,
        displayOrder: rule.displayOrder ?? existingKeys.length + index,
      };
    });
  }

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

  private normalizeCategoryName(value: string): string {
    return this.normalizeSlug(value, 'Job category');
  }

  private async assertCategoryNameAvailable(
    normalizedName: string,
    excludeId?: string,
  ) {
    const categories = await this.prisma.jobCategory.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: { id: true, name: true },
    });
    const existing = categories.find(
      (category) =>
        this.normalizeCategoryName(category.name) === normalizedName,
    );

    if (existing) {
      throw new ConflictException({
        code: 'JOB_CATEGORY_NAME_EXISTS',
        message: 'A job category with this name already exists.',
      });
    }
  }

  private async assertCategorySlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.jobCategory.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'JOB_CATEGORY_SLUG_EXISTS',
        message: 'A job category with this slug already exists.',
      });
    }
  }

  private async assertJobSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.job.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'JOB_SLUG_EXISTS',
        message: 'A job with this slug already exists.',
      });
    }
  }

  private rethrowUniqueConstraint(
    error: unknown,
    message: string,
    code: string,
  ): never {
    const prismaError =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown; meta?: { target?: unknown } })
        : undefined;

    if (prismaError?.code === 'P2002') {
      throw new ConflictException({ code, message });
    }

    throw error;
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
        ...jobImages,
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          // File fields: the apply page shows the allowed types and size.
          include: {
            documentType: {
              select: {
                id: true,
                key: true,
                name: true,
                allowedMimeTypes: true,
                maxSizeBytes: true,
              },
            },
          },
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async assertJobExists(jobId: string) {
    this.assertValidUuid(jobId, 'job');

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { id: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }
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

  private async validateApplicationFieldReferences(
    fieldType: ApplicationFieldType,
    profileFieldId?: string | null,
    documentTypeId?: string | null,
  ) {
    if (profileFieldId) {
      this.assertValidUuid(profileFieldId, 'candidate profile field');
      const profileField = await this.prisma.candidateProfileField.findFirst({
        where: { id: profileFieldId, isActive: true },
      });

      if (!profileField) {
        throw new BadRequestException(
          'Candidate profile field not found or inactive',
        );
      }

      if (profileField.isSensitive) {
        throw new BadRequestException(
          'Sensitive profile fields cannot be configured for automatic application reuse.',
        );
      }

      if (
        profileField.fieldType !== fieldType ||
        fieldType === ApplicationFieldType.FILE
      ) {
        throw new BadRequestException(
          'The candidate profile field type must match a non-file application field.',
        );
      }
    }

    if (documentTypeId) {
      this.assertValidUuid(documentTypeId, 'document type');
      const documentType = await this.prisma.documentType.findFirst({
        where: { id: documentTypeId, isActive: true },
      });

      if (!documentType) {
        throw new BadRequestException('Document type not found or inactive');
      }

      if (fieldType !== ApplicationFieldType.FILE) {
        throw new BadRequestException(
          'A document type can only be assigned to a FILE application field.',
        );
      }
    } else if (fieldType === ApplicationFieldType.FILE) {
      throw new BadRequestException(
        'A document type is required for FILE application fields.',
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

    const name = dto.name.trim().replace(/\s+/g, ' ');
    const normalizedName = this.normalizeCategoryName(name);
    await this.assertCategoryNameAvailable(normalizedName);

    const slug = normalizedName;
    if (dto.slug && this.normalizeSlug(dto.slug, 'Job category') !== slug) {
      throw new BadRequestException(
        'Job category slug is generated from its name; omit the slug or make it match the name.',
      );
    }
    await this.assertCategorySlugAvailable(slug);

    this.logger.log(`Creating job category: ${name} (${slug})`);

    try {
      return await this.prisma.jobCategory.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      this.rethrowUniqueConstraint(
        error,
        'A job category with this name or slug already exists.',
        'JOB_CATEGORY_ALREADY_EXISTS',
      );
    }
  }

  async updateCategory(id: string, dto: UpdateJobCategoryDto) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Job category name is required');
    }

    const nextName = dto.name?.trim().replace(/\s+/g, ' ') ?? category.name;
    const normalizedName = this.normalizeCategoryName(nextName);
    await this.assertCategoryNameAvailable(normalizedName, id);
    const nextSlug = normalizedName;
    if (dto.slug && this.normalizeSlug(dto.slug, 'Job category') !== nextSlug) {
      throw new BadRequestException(
        'Job category slug is generated from its name; omit the slug or make it match the name.',
      );
    }
    await this.assertCategorySlugAvailable(nextSlug, id);

    this.logger.log(`Updating job category: ${id}`);

    try {
      return await this.prisma.jobCategory.update({
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
    } catch (error) {
      this.rethrowUniqueConstraint(
        error,
        'A job category with this name or slug already exists.',
        'JOB_CATEGORY_ALREADY_EXISTS',
      );
    }
  }

  async softDeleteCategory(id: string) {
    this.assertValidUuid(id, 'job category');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
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
      include: { jobs: { select: { id: true } } },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const jobIds = category.jobs.map((job) => job.id);

      if (jobIds.length > 0) {
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
    const jobs = await this.prisma.job.findMany({
      where: { deletedAt: null },
      include: {
        ...jobImages,
        category: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          // File fields: the apply page shows the allowed types and size.
          include: {
            documentType: {
              select: {
                id: true,
                key: true,
                name: true,
                allowedMimeTypes: true,
                maxSizeBytes: true,
              },
            },
          },
        },
        eligibilityRules: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return Promise.all(jobs.map((job) => this.withImageUrls(job)));
  }

  async findJobById(id: string) {
    return this.withImageUrls(await this.ensureJobExists(id));
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
        ...jobImages,
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
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          // File fields: the apply page shows the allowed types and size.
          include: {
            documentType: {
              select: {
                id: true,
                key: true,
                name: true,
                allowedMimeTypes: true,
                maxSizeBytes: true,
              },
            },
          },
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.withImageUrls(job);
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
        ...jobImages,
        category: true,
        applicationFields: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          // File fields: the apply page shows the allowed types and size.
          include: {
            documentType: {
              select: {
                id: true,
                key: true,
                name: true,
                allowedMimeTypes: true,
                maxSizeBytes: true,
              },
            },
          },
        },
        eligibilityRules: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!job) {
      await this.logPublicJobLookupMiss(normalizedIdentifier);
      throw new NotFoundException('Job not found');
    }

    return this.withImageUrls(job);
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
          ...jobImages,
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
            scope === 'admin'
              ? {
                  where: { deletedAt: null },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                }
              : false,
          eligibilityRules:
            scope === 'admin'
              ? {
                  where: { deletedAt: null },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                }
              : false,
          // Admin jobs table shows how many people applied.
          _count:
            scope === 'admin'
              ? {
                  select: {
                    applications: { where: { deletedAt: null } },
                  },
                }
              : false,
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
      data: await Promise.all(data.map((job) => this.withImageUrls(job))),
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

  /**
   * Creates the job with its application fields, eligibility rules and
   * resources in one transaction. If anything fails nothing is saved, and the
   * files staged in S3 for it are deleted.
   */
  async createJob(dto: CreateJobDto, currentUserId?: string) {
    const ownerId = dto.createdById ?? currentUserId;
    try {
      return await this.createJobWithChildren(dto, currentUserId);
    } catch (error) {
      if (ownerId && dto.resources?.length) {
        await this.jobResourcesService.discardDraftUploads(
          ownerId,
          dto.resources,
        );
      }
      throw error;
    }
  }

  private async createJobWithChildren(
    dto: CreateJobDto,
    currentUserId?: string,
  ) {
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

    assertFutureDeadline(dto.applicationDeadline);
    await this.assertJobImages(dto.coverImageId, dto.logoId);
    const title = dto.title.trim();
    const slug = this.normalizeSlug(dto.slug ?? title, 'Job');
    await this.assertJobSlugAvailable(slug);

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
      ...this.toPayFields(dto.payAmount, dto.payCurrency, dto.payUnit),
      applicationInstructions: dto.applicationInstructions ?? [],
      workInstructions: dto.workInstructions ?? [],
      additionalInfo:
        dto.additionalInfo === undefined
          ? Prisma.JsonNull
          : (dto.additionalInfo as Prisma.InputJsonValue),
      coverImage: { connect: { id: dto.coverImageId } },
      logo: { connect: { id: dto.logoId } },
      status: dto.status ?? JobStatus.DRAFT,
      publishedAt: dto.publishedAt ?? null,
      applicationDeadline: dto.applicationDeadline ?? null,
      preApplyDeadline: dto.preApplyDeadline ?? null,
      preApplyBonus: dto.preApplyBonus ?? null,
      closedAt: dto.closedAt ?? null,
    };

    // Validate everything before writing anything.
    const applicationFields = await this.prepareApplicationFields(
      dto.applicationFields ?? [],
    );
    const eligibilityRules = this.prepareEligibilityRules(
      dto.eligibilityRules ?? [],
    );
    const resources = await this.jobResourcesService.prepareDraftResources(
      createdById,
      dto.resources ?? [],
    );

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const job = await tx.job.create({
            data: {
              ...data,
              applicationFields: { create: applicationFields },
              eligibilityRules: { create: eligibilityRules },
            },
            include: {
              ...jobImages,
              category: true,
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });
          await this.jobResourcesService.persistPreparedResources(
            tx,
            job.id,
            createdById,
            resources,
          );
          if (dto.postToCommunity) {
            await tx.announcement.create({
              data: newProjectAnnouncement(job, createdById),
            });
          }
          return job;
        },
        { timeout: 60_000 },
      );
      // After commit: tell candidates about the new project if it's live.
      if (dto.postToCommunity && created.status === JobStatus.PUBLISHED) {
        const post = newProjectAnnouncement(created, createdById);
        await this.notifications.notifyCandidates(
          communityPost({
            title: post.title,
            body: post.body,
            type: 'NEW_PROJECT',
            jobSlug: created.slug,
          }),
        );
      }
      return await this.withImageUrls(created);
    } catch (error) {
      this.rethrowUniqueConstraint(
        error,
        'A job with this slug already exists.',
        'JOB_SLUG_EXISTS',
      );
    }
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

    // Only a changed deadline must be in the future, so jobs whose deadline
    // has passed can still be edited.
    if (
      dto.applicationDeadline &&
      new Date(dto.applicationDeadline).getTime() !==
        existing.applicationDeadline?.getTime()
    ) {
      assertFutureDeadline(dto.applicationDeadline);
    }

    const nextTitle = dto.title?.trim() ?? existing.title;
    const nextSlug =
      dto.slug !== undefined || dto.title !== undefined
        ? this.normalizeSlug(dto.slug ?? nextTitle, 'Job')
        : existing.slug;
    await this.assertJobSlugAvailable(nextSlug, id);

    const nextPublishedAt =
      dto.publishedAt !== undefined ? dto.publishedAt : existing.publishedAt;
    const nextClosedAt =
      dto.closedAt !== undefined ? dto.closedAt : existing.closedAt;
    const nextStatus = dto.status ?? existing.status;

    // Images can be replaced but not removed. Older jobs without them can
    // still be closed or drafted, but need both to be live.
    if (dto.coverImageId === null || dto.logoId === null) {
      throw new BadRequestException('A job needs a cover image and a logo.');
    }
    const nextCoverImageId = dto.coverImageId ?? existing.coverImageId;
    const nextLogoId = dto.logoId ?? existing.logoId;
    if (
      dto.coverImageId !== undefined ||
      dto.logoId !== undefined ||
      statusesNeedingImages.includes(nextStatus)
    ) {
      await this.assertJobImages(nextCoverImageId, nextLogoId);
    }

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
      // Pay is set as a unit: an amount always comes with currency and unit,
      // and sending payAmount: null clears all three.
      ...(dto.payAmount !== undefined
        ? this.toPayFields(dto.payAmount, dto.payCurrency, dto.payUnit)
        : {}),
      applicationInstructions:
        dto.applicationInstructions ?? existing.applicationInstructions,
      workInstructions: dto.workInstructions ?? existing.workInstructions,
      additionalInfo:
        dto.additionalInfo === undefined
          ? (existing.additionalInfo ?? Prisma.JsonNull)
          : (dto.additionalInfo as Prisma.InputJsonValue),
      ...(dto.coverImageId
        ? { coverImage: { connect: { id: dto.coverImageId } } }
        : {}),
      ...(dto.logoId ? { logo: { connect: { id: dto.logoId } } } : {}),
      status: nextStatus,
      publishedAt: nextPublishedAt,
      applicationDeadline:
        dto.applicationDeadline !== undefined
          ? dto.applicationDeadline
          : existing.applicationDeadline,
      // undefined keeps the value; null clears it.
      preApplyDeadline: dto.preApplyDeadline,
      preApplyBonus: dto.preApplyBonus,
      closedAt: nextClosedAt,
    };

    // New fields/rules are added in the same write, so it's all or nothing.
    const [existingFields, existingRules] = await Promise.all([
      dto.applicationFields?.length
        ? this.prisma.jobApplicationField.findMany({
            where: { jobId: id },
            select: { fieldKey: true },
          })
        : [],
      dto.eligibilityRules?.length
        ? this.prisma.jobEligibilityRule.findMany({
            where: { jobId: id },
            select: { fieldKey: true },
          })
        : [],
    ]);
    const newFields = await this.prepareApplicationFields(
      dto.applicationFields ?? [],
      existingFields.map((field) => field.fieldKey),
    );
    const newRules = this.prepareEligibilityRules(
      dto.eligibilityRules ?? [],
      existingRules.map((rule) => rule.fieldKey),
    );

    this.logger.log(`Updating job: ${id}`);

    try {
      const updated = await this.prisma.job.update({
        where: { id },
        data: {
          ...data,
          ...(newFields.length
            ? { applicationFields: { create: newFields } }
            : {}),
          ...(newRules.length
            ? { eligibilityRules: { create: newRules } }
            : {}),
        },
        include: {
          ...jobImages,
          category: true,
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      // Upcoming → published: tell everyone who pre-applied.
      if (
        existing.status === JobStatus.UPCOMING &&
        updated.status === JobStatus.PUBLISHED
      ) {
        await this.preApplications.notifyOpened(updated);
      }
      return await this.withImageUrls(updated);
    } catch (error) {
      this.rethrowUniqueConstraint(
        error,
        'A job with this slug already exists.',
        'JOB_SLUG_EXISTS',
      );
    }
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
    });

    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    await this.prisma.job.delete({ where: { id } });

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

  private toPayFields(
    payAmount: number | null | undefined,
    payCurrency: PayCurrency | undefined,
    payUnit: PayUnit | undefined,
  ) {
    if (payAmount == null) {
      return { payAmount: null, payCurrency: null, payUnit: null };
    }
    if (!payCurrency || !payUnit) {
      throw new BadRequestException(
        'Pay currency and unit are required when a pay amount is set',
      );
    }
    return { payAmount: new Prisma.Decimal(payAmount), payCurrency, payUnit };
  }

  private isUuid(value: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      // Jobs without a pay amount go last either way.
      case JobSearchSort.PAY_HIGH:
        return [
          { payAmount: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ];
      case JobSearchSort.PAY_LOW:
        return [
          { payAmount: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ];
      case JobSearchSort.NEWEST:
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  async findJobApplicationFields(jobId: string) {
    await this.assertJobExists(jobId);

    return this.prisma.jobApplicationField.findMany({
      where: { jobId, deletedAt: null },
      include: {
        profileField: {
          select: { id: true, key: true, label: true, fieldType: true },
        },
        documentType: {
          select: {
            id: true,
            key: true,
            name: true,
            sensitive: true,
            allowCandidateReuse: true,
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createApplicationFieldForJob(
    jobId: string,
    dto: CreateJobApplicationFieldDto,
  ) {
    await this.assertJobExists(jobId);

    const fieldKey = dto.fieldKey.trim();
    if (!fieldKey) {
      throw new BadRequestException('Application field key is required');
    }

    await this.ensureUniqueJobFieldKey(jobId, fieldKey);

    await this.validateApplicationFieldReferences(
      dto.fieldType,
      dto.profileFieldId,
      dto.documentTypeId,
    );

    return this.prisma.jobApplicationField.create({
      data: {
        jobId,
        fieldKey,
        fieldType: dto.fieldType,
        label: dto.label.trim(),
        description: dto.description?.trim() || null,
        required: dto.required ?? false,
        displayOrder: dto.displayOrder ?? 0,
        profileFieldId: dto.profileFieldId,
        documentTypeId: dto.documentTypeId,
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
      where: { id: fieldId, jobId, deletedAt: null },
    });

    if (!field) {
      throw new NotFoundException('Application field not found');
    }

    const nextFieldKey = dto.fieldKey?.trim() ?? field.fieldKey;
    if (nextFieldKey !== field.fieldKey) {
      await this.ensureUniqueJobFieldKey(jobId, nextFieldKey, fieldId);
    }

    const nextFieldType = dto.fieldType ?? field.fieldType;
    const nextProfileFieldId =
      dto.profileFieldId !== undefined
        ? dto.profileFieldId
        : field.profileFieldId;
    const nextDocumentTypeId =
      dto.documentTypeId !== undefined
        ? dto.documentTypeId
        : field.documentTypeId;
    await this.validateApplicationFieldReferences(
      nextFieldType,
      nextProfileFieldId,
      nextDocumentTypeId,
    );

    return this.prisma.jobApplicationField.update({
      where: { id: fieldId },
      data: {
        fieldKey: nextFieldKey,
        fieldType: nextFieldType,
        label: dto.label?.trim() ?? field.label,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : field.description,
        required: dto.required ?? field.required,
        displayOrder: dto.displayOrder ?? field.displayOrder,
        profileFieldId: nextProfileFieldId,
        documentTypeId: nextDocumentTypeId,
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
      where: { id: fieldId, jobId, deletedAt: null },
    });

    if (!field) {
      throw new NotFoundException('Application field not found');
    }

    await this.prisma.jobApplicationField.update({
      where: { id: fieldId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Application field removed successfully' };
  }

  async findJobEligibilityRules(jobId: string) {
    await this.assertJobExists(jobId);

    return this.prisma.jobEligibilityRule.findMany({
      where: { jobId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createEligibilityRuleForJob(
    jobId: string,
    dto: CreateJobEligibilityRuleDto,
  ) {
    await this.assertJobExists(jobId);

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
        displayOrder: dto.displayOrder ?? 0,
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
        displayOrder: dto.displayOrder ?? rule.displayOrder,
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
