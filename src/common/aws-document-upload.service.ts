import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DocumentValidationService,
  type UploadedDocument,
} from './document-validation.service.js';

export type UploadDocumentOptions = {
  bucket?: string;
  folder?: string;
  visibility?: 'PRIVATE' | 'PUBLIC';
  uploadedById?: string;
};

@Injectable()
export class AwsDocumentUploadService {
  private readonly logger = new Logger(AwsDocumentUploadService.name);
  private readonly s3: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentValidationService: DocumentValidationService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      forcePathStyle:
        this.configService.get<boolean>('AWS_S3_FORCE_PATH_STYLE') ?? false,
    });
  }

  async uploadDocument(
    file: UploadedDocument,
    options: UploadDocumentOptions = {},
  ) {
    const operationId = randomUUID();
    const fileSize = file.size ?? file.buffer.length;
    let bucket: string | undefined;
    let objectKey: string | undefined;

    this.logger.log(
      `Upload started | operationId=${operationId} | name=${file.originalname ?? 'unknown'} | mimeType=${file.mimetype ?? 'unknown'} | sizeBytes=${fileSize} | uploadedById=${options.uploadedById ?? 'unknown'}`,
    );

    try {
      this.documentValidationService.validate(file);

      bucket =
        options.bucket ?? this.configService.get<string>('AWS_S3_BUCKET');
      if (!bucket) {
        throw new InternalServerErrorException(
          'AWS_S3_BUCKET is not configured for document upload.',
        );
      }

      const extension = this.getExtension(file.originalname ?? 'document');
      objectKey = [
        options.folder ?? 'documents',
        `${Date.now()}-${randomUUID()}${extension}`,
      ]
        .filter(Boolean)
        .join('/');

      const input: PutObjectCommandInput = {
        Bucket: bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype ?? 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        ACL: options.visibility === 'PUBLIC' ? 'public-read' : undefined,
      };

      this.logger.log(
        `S3 upload in progress | operationId=${operationId} | bucket=${bucket} | key=${objectKey}`,
      );
      await this.s3.send(new PutObjectCommand(input));
      this.logger.log(
        `S3 upload completed | operationId=${operationId} | bucket=${bucket} | key=${objectKey}`,
      );

      this.logger.log(
        `Saving uploaded file metadata | operationId=${operationId} | bucket=${bucket} | key=${objectKey}`,
      );
      const storedFile = await this.prisma.fileObject.create({
        data: {
          bucket,
          objectKey,
          originalName: file.originalname ?? 'uploaded-file',
          mimeType: file.mimetype ?? 'application/octet-stream',
          sizeBytes: BigInt(fileSize),
          checksumSha256: this.sha256(file.buffer),
          visibility: options.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
          uploadedById: options.uploadedById ?? null,
        },
      });

      this.logger.log(
        `Upload completed | operationId=${operationId} | fileObjectId=${storedFile.id} | bucket=${bucket} | key=${objectKey}`,
      );
      return storedFile;
    } catch (error) {
      this.logger.error(
        `Upload failed | operationId=${operationId} | bucket=${bucket ?? 'unresolved'} | key=${objectKey ?? 'unresolved'} | error=${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async deleteDocument(fileObjectId: string): Promise<void> {
    const operationId = randomUUID();
    this.logger.log(
      `Delete started | operationId=${operationId} | fileObjectId=${fileObjectId}`,
    );

    try {
      const storedFile = await this.prisma.fileObject.findUnique({
        where: { id: fileObjectId },
      });

      if (!storedFile) {
        this.logger.warn(
          `Delete skipped; file metadata not found | operationId=${operationId} | fileObjectId=${fileObjectId}`,
        );
        return;
      }

      this.logger.log(
        `S3 delete in progress | operationId=${operationId} | bucket=${storedFile.bucket} | key=${storedFile.objectKey}`,
      );
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: storedFile.bucket,
          Key: storedFile.objectKey,
        }),
      );
      this.logger.log(
        `S3 delete completed | operationId=${operationId} | bucket=${storedFile.bucket} | key=${storedFile.objectKey}`,
      );

      await this.prisma.fileObject.delete({ where: { id: fileObjectId } });
      this.logger.log(
        `Delete completed | operationId=${operationId} | fileObjectId=${fileObjectId}`,
      );
    } catch (error) {
      this.logger.error(
        `Delete failed | operationId=${operationId} | fileObjectId=${fileObjectId} | error=${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private getExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    if (idx === -1) {
      return '';
    }

    return filename.slice(idx).toLowerCase();
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
