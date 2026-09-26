import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationFieldType,
  ApplicationStatus,
  JobStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { UserRole } from '../auth/roles.enum.js';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto.js';
import { CreateProfileFieldDto } from './dto/create-profile-field.dto.js';
import { ListApplicationsDto } from './dto/list-applications.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

const applicationInclude = {
  candidate: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  job: { select: { id: true, slug: true, title: true, status: true } },
  fieldValues: {
    include: {
      field: {
        select: {
          id: true,
          fieldKey: true,
          fieldType: true,
          label: true,
        },
      },
    },
  },
  documents: {
    where: { isCurrent: true },
    include: {
      documentType: {
        select: { id: true, key: true, name: true, sensitive: true },
      },
      fileObject: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          createdAt: true,
        },
      },
      candidateDocument: {
        select: { id: true, expiresAt: true, verificationStatus: true },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: {
      changedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  },
} satisfies Prisma.CandidateApplicationInclude;

type ApplicationResult = {
  data: Prisma.CandidateApplicationGetPayload<{
    include: typeof applicationInclude;
  }>;
  alreadyApplied: boolean;
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsDocumentUploadService: AwsDocumentUploadService,
  ) {}

  private assertValidUuid(id: string, label: string): void {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      throw new BadRequestException(`Invalid ${label} id format.`);
    }
  }

  private async hasStaffAccess(userId: string): Promise<boolean> {
    const roleCount = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: { in: [UserRole.ADMIN, UserRole.RECRUITER] } },
      },
    });

    return roleCount > 0;
  }

  private async assertCanAccess(
    applicationId: string,
    userId: string,
    includeDeleted = false,
  ) {
    this.assertValidUuid(applicationId, 'application');

    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: applicationInclude,
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    if (application.userId !== userId && !(await this.hasStaffAccess(userId))) {
      throw new ForbiddenException(
        'You do not have permission to access this application.',
      );
    }

    return application;
  }

  private isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private applicationNumber(): string {
    return `APP-${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`;
  }

  private async validateValues(
    jobId: string,
    values: Record<string, unknown> | undefined,
    requireRequiredFields: boolean,
  ) {
    const fields = await this.prisma.jobApplicationField.findMany({
      where: { jobId, deletedAt: null },
      include: { documentType: true, profileField: true },
      orderBy: [{ displayOrder: 'asc' }],
    });
    const fieldsByKey = new Map(fields.map((field) => [field.fieldKey, field]));
    const submittedValues = values ?? {};

    for (const [fieldKey, value] of Object.entries(submittedValues)) {
      const field = fieldsByKey.get(fieldKey);
      if (!field) {
        throw new BadRequestException(
          `Unknown application field: ${fieldKey}.`,
        );
      }

      if (field.fieldType === ApplicationFieldType.FILE) {
        throw new BadRequestException(
          `Upload a file for ${fieldKey} instead of including it in values.`,
        );
      }

      if (value === null || !this.isValueValid(field.fieldType, value)) {
        throw new BadRequestException(
          `The value for ${fieldKey} does not match its configured field type.`,
        );
      }
    }

    if (requireRequiredFields) {
      for (const field of fields) {
        if (field.fieldType === ApplicationFieldType.FILE || !field.required) {
          continue;
        }

        const value = submittedValues[field.fieldKey];
        if (
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          throw new BadRequestException(
            `The ${field.label} application field is required.`,
          );
        }
      }
    }

    return fieldsByKey;
  }

  private isValueValid(fieldType: ApplicationFieldType, value: unknown) {
    switch (fieldType) {
      case ApplicationFieldType.TEXT:
      case ApplicationFieldType.SHORT_TEXT:
      case ApplicationFieldType.EMAIL:
      case ApplicationFieldType.URL:
      case ApplicationFieldType.SELECT:
      case ApplicationFieldType.DATE:
        return typeof value === 'string';
      case ApplicationFieldType.NUMBER:
        return typeof value === 'number' && Number.isFinite(value);
      case ApplicationFieldType.MULTI_SELECT:
        return Array.isArray(value);
      case ApplicationFieldType.CHECKBOX:
        return typeof value === 'boolean';
      case ApplicationFieldType.FILE:
        return false;
      default:
        return false;
    }
  }

  private validateDocumentForType(
    file: UploadedDocument,
    documentType: {
      allowedMimeTypes: string[];
      maxSizeBytes: number | null;
    },
  ): void {
    const mimeType = file.mimetype?.toLowerCase();
    if (
      documentType.allowedMimeTypes.length > 0 &&
      (!mimeType ||
        !documentType.allowedMimeTypes.some(
          (allowedType) => allowedType.toLowerCase() === mimeType,
        ))
    ) {
      throw new BadRequestException(
        `This document type does not allow ${file.mimetype ?? 'the uploaded file type'}.`,
      );
    }

    const size = file.size ?? file.buffer.length;
    if (documentType.maxSizeBytes && size > documentType.maxSizeBytes) {
      throw new BadRequestException(
        'The uploaded document exceeds the maximum size for this document type.',
      );
    }
  }

  private async nextCandidateDocumentVersion(
    tx: Prisma.TransactionClient,
    userId: string,
    documentTypeId: string,
  ): Promise<number> {
    const latest = await tx.candidateProfileDocument.findFirst({
      where: { userId, documentTypeId },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });
    await tx.candidateProfileDocument.updateMany({
      where: { userId, documentTypeId, isCurrent: true },
      data: { isCurrent: false },
    });

    return (latest?.version ?? 0) + 1;
  }

  private async cleanupUploadedFiles(fileObjectIds: string[]): Promise<void> {
    const cleanupResults = await Promise.allSettled(
      fileObjectIds.map((id) =>
        this.awsDocumentUploadService.deleteDocument(id),
      ),
    );

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        this.logger.error(
          'Failed to clean up an application upload after a database operation failed.',
          result.reason instanceof Error ? result.reason.stack : undefined,
        );
      }
    }
  }

  async findProfileFields() {
    return this.prisma.candidateProfileField.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
        fieldType: true,
        isSensitive: true,
      },
      orderBy: [{ label: 'asc' }],
    });
  }

  async createProfileField(dto: CreateProfileFieldDto) {
    const key = dto.key.trim();
    if (!key || !dto.label.trim()) {
      throw new BadRequestException(
        'Profile field key and label are required.',
      );
    }
    if (dto.fieldType === ApplicationFieldType.FILE) {
      throw new BadRequestException(
        'Use a document type for reusable candidate documents, not a profile answer field.',
      );
    }

    try {
      return await this.prisma.candidateProfileField.create({
        data: {
          key,
          label: dto.label.trim(),
          description: dto.description?.trim() || null,
          fieldType: dto.fieldType,
          isSensitive: dto.isSensitive ?? false,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'PROFILE_FIELD_KEY_EXISTS',
          message: 'A candidate profile field with this key already exists.',
        });
      }
      throw error;
    }
  }

  async findDocumentTypes() {
    return this.prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createDocumentType(dto: CreateDocumentTypeDto) {
    const key = dto.key.trim();
    if (!key || !dto.name.trim()) {
      throw new BadRequestException('Document type key and name are required.');
    }

    try {
      return await this.prisma.documentType.create({
        data: {
          key,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          allowedMimeTypes: dto.allowedMimeTypes ?? [],
          maxSizeBytes: dto.maxSizeBytes ?? null,
          sensitive: dto.sensitive ?? false,
          allowCandidateReuse: dto.allowCandidateReuse ?? false,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'DOCUMENT_TYPE_KEY_EXISTS',
          message: 'A document type with this key already exists.',
        });
      }
      throw error;
    }
  }

  async findCandidateProfile(userId: string) {
    const [values, documents] = await Promise.all([
      this.prisma.candidateProfileValue.findMany({
        where: { userId, field: { isSensitive: false, isActive: true } },
        include: {
          field: {
            select: { key: true, label: true, fieldType: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.prisma.candidateProfileDocument.findMany({
        where: { userId },
        include: {
          documentType: {
            select: {
              id: true,
              key: true,
              name: true,
              sensitive: true,
              allowCandidateReuse: true,
            },
          },
          fileObject: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    return {
      values: values.map(({ field, value, updatedAt }) => ({
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        value,
        updatedAt,
      })),
      documents: documents.map(({ fileObject, ...document }) => ({
        ...document,
        file: {
          ...fileObject,
          sizeBytes: fileObject.sizeBytes.toString(),
        },
      })),
    };
  }

  async updateCandidateProfileValues(
    userId: string,
    values: Record<string, unknown>,
  ) {
    if (Object.keys(values).length === 0) {
      throw new BadRequestException('At least one profile value is required.');
    }

    const fields = await this.prisma.candidateProfileField.findMany({
      where: { key: { in: Object.keys(values) }, isActive: true },
    });
    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

    for (const [key, value] of Object.entries(values)) {
      const field = fieldsByKey.get(key);
      if (!field) {
        throw new BadRequestException(
          `Unknown candidate profile field: ${key}.`,
        );
      }
      if (field.isSensitive) {
        throw new BadRequestException(
          `Sensitive profile field ${key} cannot be stored for automatic reuse.`,
        );
      }
      if (!this.isValueValid(field.fieldType, value)) {
        throw new BadRequestException(
          `The value for ${key} does not match its profile field type.`,
        );
      }
    }

    await this.prisma.$transaction(
      Object.entries(values).map(([key, value]) => {
        const field = fieldsByKey.get(key)!;
        return this.prisma.candidateProfileValue.upsert({
          where: { userId_fieldId: { userId, fieldId: field.id } },
          create: {
            userId,
            fieldId: field.id,
            value: value as Prisma.InputJsonValue,
          },
          update: { value: value as Prisma.InputJsonValue },
        });
      }),
    );

    return this.findCandidateProfile(userId);
  }

  async deleteCandidateProfileValue(userId: string, key: string) {
    const value = await this.prisma.candidateProfileValue.findFirst({
      where: { userId, field: { key } },
      select: { id: true },
    });
    if (!value) {
      throw new NotFoundException('Candidate profile value not found.');
    }
    await this.prisma.candidateProfileValue.delete({ where: { id: value.id } });
    return { message: 'Candidate profile value deleted successfully.' };
  }

  async getPrefill(userId: string, jobId: string) {
    this.assertValidUuid(jobId, 'job');
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null, status: JobStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        applicationFields: {
          where: { deletedAt: null },
          include: { documentType: true, profileField: true },
          orderBy: [{ displayOrder: 'asc' }],
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Published job not found.');
    }

    const profileValues = await this.prisma.candidateProfileValue.findMany({
      where: {
        userId,
        field: { isSensitive: false, isActive: true },
      },
      include: { field: { select: { id: true } } },
    });
    const profileByFieldId = new Map(
      profileValues.map((profileValue) => [
        profileValue.fieldId,
        profileValue.value,
      ]),
    );
    const values: Record<string, unknown> = {};
    const savedDocuments: Record<string, Array<Record<string, unknown>>> = {};
    const reusableDocumentTypeIds = [
      ...new Set(
        job.applicationFields
          .filter(
            (field) =>
              field.fieldType === ApplicationFieldType.FILE &&
              field.documentType?.allowCandidateReuse,
          )
          .map((field) => field.documentTypeId!)
          .filter(Boolean),
      ),
    ];
    const reusableDocuments = reusableDocumentTypeIds.length
      ? await this.prisma.candidateProfileDocument.findMany({
          where: {
            userId,
            documentTypeId: { in: reusableDocumentTypeIds },
            isCurrent: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            documentType: { isActive: true, allowCandidateReuse: true },
          },
          include: {
            documentType: { select: { sensitive: true } },
            fileObject: {
              select: {
                originalName: true,
                mimeType: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        })
      : [];

    for (const field of job.applicationFields) {
      if (
        field.profileFieldId &&
        field.profileField &&
        !field.profileField.isSensitive &&
        profileByFieldId.has(field.profileFieldId)
      ) {
        values[field.fieldKey] = profileByFieldId.get(field.profileFieldId);
      }

      if (
        field.fieldType === ApplicationFieldType.FILE &&
        field.documentType?.allowCandidateReuse
      ) {
        savedDocuments[field.fieldKey] = reusableDocuments
          .filter((doc) => doc.documentTypeId === field.documentTypeId)
          .filter((doc) => !doc.documentType.sensitive)
          .map((doc) => ({
            id: doc.id,
            documentTypeId: doc.documentTypeId,
            fileName: doc.fileObject.originalName,
            mimeType: doc.fileObject.mimeType,
            sizeBytes: doc.fileObject.sizeBytes.toString(),
            expiresAt: doc.expiresAt,
          }));
      }
    }

    return {
      job: { id: job.id, title: job.title },
      fields: job.applicationFields.map((field) => ({
        id: field.id,
        fieldKey: field.fieldKey,
        fieldType: field.fieldType,
        label: field.label,
        description: field.description,
        required: field.required,
        displayOrder: field.displayOrder,
        options: field.options,
        documentType: field.documentType
          ? {
              id: field.documentType.id,
              key: field.documentType.key,
              name: field.documentType.name,
              sensitive: field.documentType.sensitive,
            }
          : null,
      })),
      values,
      savedDocuments,
      requiresCandidateConfirmation: true,
    };
  }

  async uploadCandidateProfileDocument(
    userId: string,
    documentTypeId: string,
    file?: UploadedDocument,
  ) {
    if (!file) {
      throw new BadRequestException('A document file is required.');
    }
    this.assertValidUuid(documentTypeId, 'document type');
    const documentType = await this.prisma.documentType.findFirst({
      where: { id: documentTypeId, isActive: true },
    });
    if (!documentType) {
      throw new NotFoundException('Active document type not found.');
    }
    this.validateDocumentForType(file, documentType);

    const storedFile = await this.awsDocumentUploadService.uploadDocument(
      file,
      {
        folder: `candidate-profile/${userId}/${documentType.key}`,
        visibility: 'PRIVATE',
        uploadedById: userId,
      },
    );

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        return tx.candidateProfileDocument.create({
          data: {
            userId,
            documentTypeId,
            fileObjectId: storedFile.id,
            version: await this.nextCandidateDocumentVersion(
              tx,
              userId,
              documentTypeId,
            ),
          },
          include: {
            documentType: {
              select: { id: true, key: true, name: true, sensitive: true },
            },
            fileObject: {
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
                createdAt: true,
              },
            },
          },
        });
      });

      return {
        ...document,
        fileObject: {
          ...document.fileObject,
          sizeBytes: document.fileObject.sizeBytes.toString(),
        },
      };
    } catch (error) {
      await this.cleanupUploadedFiles([storedFile.id]);
      throw error;
    }
  }

  async deleteCandidateProfileDocument(userId: string, documentId: string) {
    this.assertValidUuid(documentId, 'candidate document');
    const document = await this.prisma.candidateProfileDocument.findFirst({
      where: { id: documentId, userId },
      select: { id: true, fileObjectId: true },
    });
    if (!document) {
      throw new NotFoundException('Candidate profile document not found.');
    }

    const applicationReferenceCount =
      await this.prisma.jobApplicationDocument.count({
        where: { fileObjectId: document.fileObjectId },
      });
    await this.prisma.candidateProfileDocument.delete({
      where: { id: documentId },
    });

    if (applicationReferenceCount === 0) {
      await this.awsDocumentUploadService.deleteDocument(document.fileObjectId);
    }

    return {
      message: 'Candidate profile document removed from your profile.',
      retainedForSubmittedApplications: applicationReferenceCount > 0,
    };
  }

  async findAll(query: ListApplicationsDto) {
    const where: Prisma.CandidateApplicationWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
    };

    return this.prisma.candidateApplication.findMany({
      where,
      include: applicationInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findMine(userId: string) {
    return this.prisma.candidateApplication.findMany({
      where: { userId, deletedAt: null },
      include: applicationInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOne(applicationId: string, userId: string) {
    return this.assertCanAccess(applicationId, userId);
  }

  async create(
    userId: string,
    dto: CreateApplicationDto,
    files: UploadedDocument[] = [],
  ): Promise<ApplicationResult> {
    this.assertValidUuid(userId, 'user');
    this.assertValidUuid(dto.jobId, 'job');

    const existing = await this.prisma.candidateApplication.findUnique({
      where: { userId_jobId: { userId, jobId: dto.jobId } },
      include: applicationInclude,
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new ConflictException({
          code: 'APPLICATION_ALREADY_EXISTS',
          message:
            'An application for this job already exists and was soft deleted. A second application is not allowed.',
        });
      }

      return { data: existing, alreadyApplied: true };
    }

    const job = await this.prisma.job.findFirst({
      where: { id: dto.jobId, deletedAt: null },
      select: {
        id: true,
        status: true,
        applicationDeadline: true,
        applicationFields: {
          where: { deletedAt: null },
          include: { documentType: true },
          orderBy: [{ displayOrder: 'asc' }],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    if (job.status !== JobStatus.PUBLISHED) {
      throw new ConflictException({
        code: 'JOB_NOT_ACCEPTING_APPLICATIONS',
        message: 'This job is not currently accepting applications.',
      });
    }

    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      throw new ConflictException({
        code: 'APPLICATION_DEADLINE_PASSED',
        message: 'The application deadline for this job has passed.',
      });
    }

    const fieldsByKey = await this.validateValues(dto.jobId, dto.values, true);
    const filesByField = new Map<string, UploadedDocument>();
    const savedDocumentIds = new Map<string, string>();

    for (const [fieldKey, documentId] of Object.entries(
      dto.savedDocuments ?? {},
    )) {
      const field = fieldsByKey.get(fieldKey);
      if (!field || field.fieldType !== ApplicationFieldType.FILE) {
        throw new BadRequestException(
          `Saved document selection does not match a FILE field: ${fieldKey}.`,
        );
      }
      this.assertValidUuid(documentId, 'candidate profile document');
      savedDocumentIds.set(fieldKey, documentId);
    }

    for (const file of files) {
      const fieldKey = file.fieldname?.trim() ?? '';
      const field = fieldsByKey.get(fieldKey);

      if (!field || field.fieldType !== ApplicationFieldType.FILE) {
        throw new BadRequestException(
          `The uploaded file does not match a file field for this job${fieldKey ? `: ${fieldKey}` : ''}.`,
        );
      }

      if (filesByField.has(fieldKey)) {
        throw new BadRequestException(
          `Only one file may be submitted for the ${field.label} field.`,
        );
      }
      if (savedDocumentIds.has(fieldKey)) {
        throw new BadRequestException(
          `Choose either a saved document or a new upload for the ${field.label} field, not both.`,
        );
      }

      if (!field.documentType?.isActive) {
        throw new BadRequestException(
          `A valid document type is not configured for the ${field.label} field.`,
        );
      }

      this.validateDocumentForType(file, field.documentType);
      filesByField.set(fieldKey, file);
    }

    const savedDocuments = savedDocumentIds.size
      ? await this.prisma.candidateProfileDocument.findMany({
          where: {
            id: { in: [...savedDocumentIds.values()] },
            userId,
            isCurrent: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            documentType: { isActive: true, allowCandidateReuse: true },
          },
          include: { documentType: true },
        })
      : [];
    const savedDocumentsById = new Map(
      savedDocuments.map((document) => [document.id, document]),
    );

    for (const [fieldKey, documentId] of savedDocumentIds) {
      const field = fieldsByKey.get(fieldKey)!;
      const savedDocument = savedDocumentsById.get(documentId);
      if (
        !savedDocument ||
        savedDocument.documentTypeId !== field.documentTypeId
      ) {
        throw new BadRequestException(
          `The saved document is unavailable or does not match the ${field.label} document type.`,
        );
      }
    }

    for (const field of job.applicationFields) {
      if (field.required && field.fieldType === ApplicationFieldType.FILE) {
        if (!field.documentType?.isActive) {
          throw new BadRequestException(
            `A valid document type is not configured for the ${field.label} field.`,
          );
        }

        if (
          !filesByField.has(field.fieldKey) &&
          !savedDocumentIds.has(field.fieldKey)
        ) {
          throw new BadRequestException(
            `A document is required for the ${field.label} field.`,
          );
        }
      }
    }

    const uploadedFiles: Array<{
      fieldKey: string;
      documentTypeId: string;
      fileObjectId: string;
    }> = [];

    try {
      for (const [fieldKey, file] of filesByField) {
        const field = fieldsByKey.get(fieldKey)!;
        const storedFile = await this.awsDocumentUploadService.uploadDocument(
          file,
          {
            folder: `applications/${userId}/${dto.jobId}`,
            visibility: 'PRIVATE',
            uploadedById: userId,
          },
        );

        uploadedFiles.push({
          fieldKey,
          documentTypeId: field.documentType!.id,
          fileObjectId: storedFile.id,
        });
      }

      const application = await this.prisma.$transaction(async (tx) => {
        const candidateDocumentIdsByField = new Map<string, string>();

        if (dto.rememberInProfile) {
          for (const fieldKey of filesByField.keys()) {
            const field = fieldsByKey.get(fieldKey)!;
            const documentType = field.documentType;
            const uploadedFile = uploadedFiles.find(
              (uploaded) => uploaded.fieldKey === fieldKey,
            );
            if (
              !documentType?.allowCandidateReuse ||
              documentType.sensitive ||
              !uploadedFile
            ) {
              continue;
            }

            const profileDocument = await tx.candidateProfileDocument.create({
              data: {
                userId,
                documentTypeId: documentType.id,
                fileObjectId: uploadedFile.fileObjectId,
                version: await this.nextCandidateDocumentVersion(
                  tx,
                  userId,
                  documentType.id,
                ),
              },
              select: { id: true },
            });
            candidateDocumentIdsByField.set(fieldKey, profileDocument.id);
          }
        }

        if (dto.rememberInProfile) {
          for (const [fieldKey, value] of Object.entries(dto.values ?? {})) {
            const field = fieldsByKey.get(fieldKey)!;
            const profileField = field.profileField;
            if (!profileField || profileField.isSensitive) {
              continue;
            }
            await tx.candidateProfileValue.upsert({
              where: {
                userId_fieldId: { userId, fieldId: profileField.id },
              },
              create: {
                userId,
                fieldId: profileField.id,
                value: value as Prisma.InputJsonValue,
              },
              update: { value: value as Prisma.InputJsonValue },
            });
          }
        }

        const created = await tx.candidateApplication.create({
          data: {
            applicationNo: this.applicationNumber(),
            candidate: { connect: { id: userId } },
            job: { connect: { id: dto.jobId } },
            coverNote: dto.coverNote?.trim() || null,
            fieldValues: {
              create: Object.entries(dto.values ?? {}).map(
                ([fieldKey, value]) => ({
                  field: {
                    connect: { id: fieldsByKey.get(fieldKey)!.id },
                  },
                  value: value as Prisma.InputJsonValue,
                }),
              ),
            },
            documents: {
              create: [
                ...uploadedFiles.map((uploaded) => ({
                  fieldKey: uploaded.fieldKey,
                  documentType: { connect: { id: uploaded.documentTypeId } },
                  fileObject: { connect: { id: uploaded.fileObjectId } },
                  ...(candidateDocumentIdsByField.has(uploaded.fieldKey)
                    ? {
                        candidateDocument: {
                          connect: {
                            id: candidateDocumentIdsByField.get(
                              uploaded.fieldKey,
                            )!,
                          },
                        },
                      }
                    : {}),
                })),
                ...[...savedDocumentIds].map(([fieldKey, documentId]) => {
                  const savedDocument = savedDocumentsById.get(documentId)!;
                  return {
                    fieldKey,
                    documentType: {
                      connect: { id: savedDocument.documentTypeId },
                    },
                    fileObject: { connect: { id: savedDocument.fileObjectId } },
                    candidateDocument: { connect: { id: savedDocument.id } },
                  };
                }),
              ],
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: ApplicationStatus.APPLIED,
                comment: 'Application submitted.',
                changedBy: { connect: { id: userId } },
              },
            },
          },
          include: applicationInclude,
        });

        return created;
      });

      this.logger.log(
        `Created application ${application.id} for job ${dto.jobId}`,
      );
      return { data: application, alreadyApplied: false };
    } catch (error) {
      await this.cleanupUploadedFiles(
        uploadedFiles.map((file) => file.fileObjectId),
      );

      if (this.isPrismaUniqueConstraintError(error)) {
        const duplicate = await this.prisma.candidateApplication.findUnique({
          where: { userId_jobId: { userId, jobId: dto.jobId } },
          include: applicationInclude,
        });

        if (duplicate && !duplicate.deletedAt) {
          return { data: duplicate, alreadyApplied: true };
        }

        if (duplicate?.deletedAt) {
          throw new ConflictException({
            code: 'APPLICATION_ALREADY_EXISTS',
            message:
              'An application for this job already exists and was soft deleted. A second application is not allowed.',
          });
        }

        throw new ConflictException({
          code: 'APPLICATION_CREATE_CONFLICT',
          message: 'The application could not be created due to a conflict.',
        });
      }

      throw error;
    }
  }

  async update(
    applicationId: string,
    userId: string,
    dto: UpdateApplicationDto,
  ) {
    const application = await this.assertCanAccess(applicationId, userId);
    if (dto.coverNote === undefined && dto.values === undefined) {
      throw new BadRequestException(
        'Provide a cover note or application field values to update.',
      );
    }

    let fieldsByKey:
      Map<string, { id: string; fieldType: ApplicationFieldType }> | undefined;
    if (dto.values !== undefined) {
      fieldsByKey = await this.validateValues(
        application.jobId,
        dto.values,
        false,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: {
          coverNote:
            dto.coverNote !== undefined
              ? dto.coverNote.trim() || null
              : undefined,
        },
      });

      for (const [fieldKey, value] of Object.entries(dto.values ?? {})) {
        const field = fieldsByKey!.get(fieldKey)!;
        await tx.jobApplicationFieldValue.upsert({
          where: {
            applicationId_fieldId: { applicationId, fieldId: field.id },
          },
          create: {
            applicationId,
            fieldId: field.id,
            value: value as Prisma.InputJsonValue,
          },
          update: { value: value as Prisma.InputJsonValue },
        });
      }
    });

    return this.assertCanAccess(applicationId, userId);
  }

  async updateStatus(
    applicationId: string,
    userId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    this.assertValidUuid(applicationId, 'application');
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    if (!(await this.hasStaffAccess(userId))) {
      throw new ForbiddenException(
        'Only an administrator or recruiter can update application status.',
      );
    }

    if (application.status === dto.status) {
      return this.assertCanAccess(applicationId, userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: {
          status: dto.status,
          statusChangedAt: new Date(),
          ...(dto.rejectionReason !== undefined
            ? { rejectionReason: dto.rejectionReason.trim() || null }
            : {}),
          ...(dto.withdrawnReason !== undefined
            ? { withdrawnReason: dto.withdrawnReason.trim() || null }
            : {}),
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: dto.status,
          changedById: userId,
          comment: dto.comment?.trim() || null,
        },
      });
    });

    return this.assertCanAccess(applicationId, userId);
  }

  async uploadDocument(
    applicationId: string,
    userId: string,
    fieldKey: string,
    file?: UploadedDocument,
  ) {
    if (!file) {
      throw new BadRequestException('A document file is required.');
    }

    const application = await this.assertCanAccess(applicationId, userId);
    const field = await this.prisma.jobApplicationField.findFirst({
      where: { jobId: application.jobId, fieldKey, deletedAt: null },
      include: { documentType: true },
    });

    if (!field || field.fieldType !== ApplicationFieldType.FILE) {
      throw new NotFoundException('File application field not found.');
    }

    if (!field.documentType?.isActive) {
      throw new BadRequestException(
        'A valid document type is not configured for this application field.',
      );
    }

    this.validateDocumentForType(file, field.documentType);

    const storedFile = await this.awsDocumentUploadService.uploadDocument(
      file,
      {
        folder: `applications/${application.userId}/${application.jobId}`,
        visibility: 'PRIVATE',
        uploadedById: application.userId,
      },
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const latestDocument = await tx.jobApplicationDocument.findFirst({
          where: { applicationId, fieldKey },
          orderBy: [{ version: 'desc' }],
          select: { version: true },
        });
        const version = (latestDocument?.version ?? 0) + 1;

        await tx.jobApplicationDocument.updateMany({
          where: { applicationId, fieldKey, isCurrent: true },
          data: { isCurrent: false },
        });

        const document = await tx.jobApplicationDocument.create({
          data: {
            applicationId,
            documentTypeId: field.documentType!.id,
            fileObjectId: storedFile.id,
            fieldKey,
            version,
          },
          include: {
            documentType: {
              select: {
                id: true,
                key: true,
                name: true,
                sensitive: true,
                allowCandidateReuse: true,
                allowedMimeTypes: true,
                maxSizeBytes: true,
              },
            },
            fileObject: {
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
        });
        return {
          ...document,
          documentType: {
            ...document.documentType,
            maxSizeBytes: document.documentType.maxSizeBytes,
          },
        };
      });
    } catch (error) {
      await this.cleanupUploadedFiles([storedFile.id]);
      throw error;
    }
  }

  async saveApplicationDocumentToProfile(
    applicationId: string,
    userId: string,
    fieldKey: string,
  ) {
    const application = await this.assertCanAccess(applicationId, userId);
    if (application.userId !== userId) {
      throw new ForbiddenException(
        'Only the candidate who owns the application can save its document to their profile.',
      );
    }

    const applicationDocument =
      await this.prisma.jobApplicationDocument.findFirst({
        where: { applicationId, fieldKey, isCurrent: true },
        include: { documentType: true },
      });
    if (!applicationDocument) {
      throw new NotFoundException('Current application document not found.');
    }
    if (
      !applicationDocument.documentType.allowCandidateReuse ||
      applicationDocument.documentType.sensitive
    ) {
      throw new BadRequestException(
        'This document type is not eligible for reusable profile storage.',
      );
    }

    const existing = await this.prisma.candidateProfileDocument.findUnique({
      where: { fileObjectId: applicationDocument.fileObjectId },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          'This file cannot be added to the candidate profile.',
        );
      }
      await this.prisma.jobApplicationDocument.update({
        where: { id: applicationDocument.id },
        data: { candidateDocumentId: existing.id },
      });
      return this.findCandidateProfile(userId);
    }

    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.candidateProfileDocument.create({
        data: {
          userId,
          documentTypeId: applicationDocument.documentTypeId,
          fileObjectId: applicationDocument.fileObjectId,
          version: await this.nextCandidateDocumentVersion(
            tx,
            userId,
            applicationDocument.documentTypeId,
          ),
        },
        select: { id: true },
      });
      await tx.jobApplicationDocument.update({
        where: { id: applicationDocument.id },
        data: { candidateDocumentId: saved.id },
      });
    });

    return this.findCandidateProfile(userId);
  }

  async softDelete(applicationId: string, userId: string) {
    const application = await this.assertCanAccess(applicationId, userId, true);

    if (application.deletedAt) {
      return { message: 'Application was already soft deleted.' };
    }

    await this.prisma.candidateApplication.update({
      where: { id: applicationId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft deleted application ${applicationId}`);
    return { message: 'Application soft deleted successfully.' };
  }

  async hardDelete(applicationId: string, userId: string) {
    this.assertValidUuid(applicationId, 'application');
    if (!(await this.hasStaffAccess(userId))) {
      throw new ForbiddenException(
        'Only an administrator or recruiter can permanently delete applications.',
      );
    }

    const application = await this.prisma.candidateApplication.findUnique({
      where: { id: applicationId },
      include: { documents: { select: { fileObjectId: true } } },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    await this.prisma.candidateApplication.delete({
      where: { id: applicationId },
    });

    const fileObjectIds = [
      ...new Set(
        application.documents.map((document) => document.fileObjectId),
      ),
    ];
    const retainedFiles = await this.prisma.candidateProfileDocument.findMany({
      where: { fileObjectId: { in: fileObjectIds } },
      select: { fileObjectId: true },
    });
    const retainedFileIds = new Set(
      retainedFiles.map((document) => document.fileObjectId),
    );
    const cleanupResults = await Promise.allSettled(
      fileObjectIds
        .filter((fileObjectId) => !retainedFileIds.has(fileObjectId))
        .map((fileObjectId) =>
          this.awsDocumentUploadService.deleteDocument(fileObjectId),
        ),
    );
    const fileCleanupPending = cleanupResults.some(
      (result) => result.status === 'rejected',
    );

    if (fileCleanupPending) {
      this.logger.error(
        `Application ${applicationId} was deleted but one or more AWS files could not be removed.`,
      );
    }

    this.logger.log(`Hard deleted application ${applicationId}`);
    return {
      message: fileCleanupPending
        ? 'Application hard deleted, but some uploaded files could not be removed.'
        : 'Application hard deleted successfully.',
      fileCleanupPending,
    };
  }
}
