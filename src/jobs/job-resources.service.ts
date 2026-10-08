import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  type FileObject,
  type JobResource,
  type Prisma,
} from '@prisma/client';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateJobResourceDto,
  CreateResourceUploadDto,
  ReorderJobResourcesDto,
  UpdateJobResourceDto,
} from './dto/job-resource.dto.js';
import {
  checkResourceFile,
  getYoutubeVideoId,
  isUploadableType,
  resourceFileRules,
} from './job-resource-files.js';

const MAX_RESOURCES_PER_JOB = 50;

type ResourceWithFile = JobResource & { file: FileObject | null };

const resourceFolder = (jobId: string) => `job-resources/${jobId}`;
/** Staging folder for files uploaded before their job exists (job creation). */
const draftFolder = (userId: string) => `job-resources/drafts/${userId}`;

type VerifiedFile = {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};

/** A resource checked and ready to insert inside a job transaction. */
export type PreparedResource = {
  type: JobResource['type'];
  title: string;
  description: string | null;
  required: boolean;
  url: string | null;
  file: VerifiedFile | null;
};

@Injectable()
export class JobResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  /** Step 1 of an upload: validate the file and hand out a presigned PUT. */
  async createUploadUrl(jobId: string, dto: CreateResourceUploadDto) {
    await this.findJob(jobId);
    const problem = checkResourceFile(dto.type, dto);
    if (problem) throw new BadRequestException(problem);

    const objectKey = this.storage.buildObjectKey(
      resourceFolder(jobId),
      dto.fileName,
    );
    const { url, expiresIn } = await this.storage.createUploadUrl(
      objectKey,
      dto.mimeType,
    );
    return {
      uploadUrl: url,
      objectKey,
      expiresIn,
      headers: { 'Content-Type': dto.mimeType },
    };
  }

  /** Upload URL for a job that doesn't exist yet (create-job wizard). */
  async createDraftUploadUrl(userId: string, dto: CreateResourceUploadDto) {
    const problem = checkResourceFile(dto.type, dto);
    if (problem) throw new BadRequestException(problem);
    const objectKey = this.storage.buildObjectKey(
      draftFolder(userId),
      dto.fileName,
    );
    const { url, expiresIn } = await this.storage.createUploadUrl(
      objectKey,
      dto.mimeType,
    );
    return {
      uploadUrl: url,
      objectKey,
      expiresIn,
      headers: { 'Content-Type': dto.mimeType },
    };
  }

  /**
   * Checks every resource of a new job (uploads exist, types match, links
   * are valid) before anything is written. Throws on the first problem.
   */
  async prepareDraftResources(
    userId: string,
    dtos: CreateJobResourceDto[],
  ): Promise<PreparedResource[]> {
    if (dtos.length > MAX_RESOURCES_PER_JOB) {
      throw new BadRequestException(
        `A job can have at most ${MAX_RESOURCES_PER_JOB} resources.`,
      );
    }
    const keys = dtos.map((dto) => dto.objectKey).filter(Boolean);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('The same upload was attached twice.');
    }
    const prepared: PreparedResource[] = [];
    for (const dto of dtos) {
      const base = {
        type: dto.type,
        title: dto.title,
        description: dto.description || null,
        required: dto.required ?? false,
      };
      prepared.push(
        isUploadableType(dto.type)
          ? {
              ...base,
              url: null,
              file: await this.verifyUploadedFile(draftFolder(userId), dto),
            }
          : {
              ...base,
              url: this.normalizeUrl(dto.type, dto.url ?? ''),
              file: null,
            },
      );
    }
    return prepared;
  }

  /** Inserts prepared resources inside the caller's transaction. */
  async persistPreparedResources(
    tx: Prisma.TransactionClient,
    jobId: string,
    userId: string,
    prepared: PreparedResource[],
  ) {
    for (const [index, resource] of prepared.entries()) {
      const stored = resource.file
        ? await tx.fileObject.create({
            data: {
              bucket: this.storage.bucket,
              objectKey: resource.file.objectKey,
              originalName: resource.file.fileName,
              mimeType: resource.file.mimeType,
              sizeBytes: BigInt(resource.file.sizeBytes),
              uploadedById: userId,
            },
          })
        : null;
      await tx.jobResource.create({
        data: {
          jobId,
          type: resource.type,
          title: resource.title,
          description: resource.description,
          required: resource.required,
          url: resource.url,
          fileId: stored?.id ?? null,
          displayOrder: index,
        },
      });
    }
  }

  /**
   * Rollback for S3 (which has no transactions): deletes the staged uploads
   * of a job that failed to save. Only touches this user's draft folder.
   */
  async discardDraftUploads(
    userId: string,
    dtos: Array<{ objectKey?: string }>,
  ) {
    const folder = `${draftFolder(userId)}/`;
    await Promise.all(
      dtos
        .map((dto) => dto.objectKey ?? '')
        .filter((key) => key.startsWith(folder) && !key.includes('..'))
        .map((key) => this.storage.deleteObject(this.storage.bucket, key)),
    );
  }

  /** Step 2: confirm an uploaded file (or save a URL) as a resource. */
  async create(jobId: string, dto: CreateJobResourceDto, userId: string) {
    await this.findJob(jobId);
    const count = await this.prisma.jobResource.count({ where: { jobId } });
    if (count >= MAX_RESOURCES_PER_JOB) {
      throw new BadRequestException(
        `A job can have at most ${MAX_RESOURCES_PER_JOB} resources.`,
      );
    }
    const last = await this.prisma.jobResource.findFirst({
      where: { jobId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const base = {
      jobId,
      type: dto.type,
      title: dto.title,
      description: dto.description || null,
      required: dto.required ?? false,
      displayOrder: (last?.displayOrder ?? -1) + 1,
    };

    if (!isUploadableType(dto.type)) {
      const url = this.normalizeUrl(dto.type, dto.url ?? '');
      const resource = await this.prisma.jobResource.create({
        data: { ...base, url },
        include: { file: true },
      });
      return this.toAdminView(resource);
    }

    const file = await this.verifyUploadedFile(resourceFolder(jobId), dto);
    const resource = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.fileObject.create({
        data: {
          bucket: this.storage.bucket,
          objectKey: file.objectKey,
          originalName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: BigInt(file.sizeBytes),
          uploadedById: userId,
        },
      });
      return tx.jobResource.create({
        data: { ...base, fileId: stored.id },
        include: { file: true },
      });
    });
    return this.toAdminView(resource);
  }

  async listForAdmin(jobId: string) {
    await this.findJob(jobId);
    const resources = await this.findResources(jobId);
    return Promise.all(resources.map((resource) => this.toAdminView(resource)));
  }

  /** Signed-in candidates can see resources of live (published/closed) jobs. */
  async listForCandidate(jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        deletedAt: null,
        status: { in: [JobStatus.PUBLISHED, JobStatus.CLOSED] },
      },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Job not found.');
    const resources = await this.findResources(jobId);
    return Promise.all(resources.map((resource) => this.toView(resource)));
  }

  async update(jobId: string, resourceId: string, dto: UpdateJobResourceDto) {
    const existing = await this.findResource(jobId, resourceId);
    const data: Prisma.JobResourceUpdateInput = {
      title: dto.title,
      required: dto.required,
    };
    if (dto.description !== undefined)
      data.description = dto.description || null;
    if (dto.url !== undefined) {
      if (isUploadableType(existing.type)) {
        throw new BadRequestException('Uploaded files have no URL to change.');
      }
      data.url = this.normalizeUrl(existing.type, dto.url);
    }
    const resource = await this.prisma.jobResource.update({
      where: { id: resourceId },
      data,
      include: { file: true },
    });
    return this.toAdminView(resource);
  }

  async reorder(jobId: string, dto: ReorderJobResourcesDto) {
    const resources = await this.prisma.jobResource.findMany({
      where: { jobId },
      select: { id: true },
    });
    const known = new Set(resources.map((resource) => resource.id));
    if (
      dto.ids.length !== known.size ||
      new Set(dto.ids).size !== dto.ids.length ||
      !dto.ids.every((id) => known.has(id))
    ) {
      throw new BadRequestException('Send every resource of this job once.');
    }
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.jobResource.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
    return this.listForAdmin(jobId);
  }

  async remove(jobId: string, resourceId: string) {
    const resource = await this.findResource(jobId, resourceId);
    await this.prisma.jobResource.delete({ where: { id: resourceId } });
    if (resource.file) {
      await this.prisma.fileObject.delete({ where: { id: resource.file.id } });
      await this.storage.deleteObject(
        resource.file.bucket,
        resource.file.objectKey,
      );
    }
    return { success: true, message: 'Resource deleted.' };
  }

  private async verifyUploadedFile(
    folder: string,
    dto: CreateJobResourceDto,
  ): Promise<VerifiedFile> {
    const type = dto.type;
    const objectKey = dto.objectKey ?? '';
    if (!isUploadableType(type)) {
      throw new BadRequestException('This resource type has no file.');
    }
    // Only keys we handed out for this folder — never someone else's object.
    if (!objectKey.startsWith(`${folder}/`) || objectKey.includes('..')) {
      throw new BadRequestException('Invalid upload reference.');
    }
    const alreadyUsed = await this.prisma.fileObject.findFirst({
      where: { bucket: this.storage.bucket, objectKey },
      select: { id: true },
    });
    if (alreadyUsed) {
      throw new BadRequestException('This upload was already saved.');
    }

    const info = await this.storage.headObject(objectKey);
    if (!info) {
      throw new BadRequestException(
        'Upload not found. Please upload the file again.',
      );
    }
    const mimeType = info.contentType ?? '';
    const problem =
      checkResourceFile(type, { mimeType, sizeBytes: info.sizeBytes }) ??
      (resourceFileRules[type].matches(await this.storage.readHead(objectKey))
        ? null
        : "The file's contents don't match its type.");
    if (problem) {
      await this.storage.deleteObject(this.storage.bucket, objectKey);
      throw new BadRequestException(problem);
    }
    return {
      objectKey,
      mimeType,
      sizeBytes: info.sizeBytes,
      fileName: dto.fileName ?? 'file',
    };
  }

  private normalizeUrl(type: JobResource['type'], url: string) {
    if (type === 'YOUTUBE') {
      const id = getYoutubeVideoId(url);
      if (!id) throw new BadRequestException('Enter a valid YouTube link.');
      return `https://www.youtube.com/watch?v=${id}`;
    }
    return url;
  }

  private async findJob(jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }

  private findResources(jobId: string) {
    return this.prisma.jobResource.findMany({
      where: { jobId },
      include: { file: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async findResource(jobId: string, resourceId: string) {
    const resource = await this.prisma.jobResource.findFirst({
      where: { id: resourceId, jobId },
      include: { file: true },
    });
    if (!resource) throw new NotFoundException('Resource not found.');
    return resource;
  }

  private async toView(resource: ResourceWithFile) {
    const file = resource.file;
    const urls = file
      ? await Promise.all([
          this.storage.createViewUrl(file.bucket, file.objectKey, {
            fileName: file.originalName,
            contentType: file.mimeType,
          }),
          this.storage.createViewUrl(file.bucket, file.objectKey, {
            fileName: file.originalName,
            contentType: file.mimeType,
            download: true,
          }),
        ])
      : null;
    return {
      id: resource.id,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      required: resource.required,
      displayOrder: resource.displayOrder,
      url: resource.url,
      youtubeId:
        resource.type === 'YOUTUBE' && resource.url
          ? getYoutubeVideoId(resource.url)
          : null,
      file: file
        ? {
            name: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: Number(file.sizeBytes),
          }
        : null,
      viewUrl: urls?.[0] ?? null,
      downloadUrl: urls?.[1] ?? null,
      updatedAt: resource.updatedAt,
    };
  }

  private async toAdminView(resource: ResourceWithFile) {
    return { ...(await this.toView(resource)), createdAt: resource.createdAt };
  }
}
