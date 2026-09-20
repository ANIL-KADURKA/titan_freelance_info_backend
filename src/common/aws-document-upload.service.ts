import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
    this.documentValidationService.validate(file);

    const bucket =
      options.bucket ?? this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new InternalServerErrorException(
        'AWS_S3_BUCKET is not configured for document upload.',
      );
    }

    const extension = this.getExtension(file.originalname ?? 'document');
    const objectKey = [
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
      ACL: options.visibility === 'PUBLIC' ? 'public-read' : undefined,
    };

    await this.s3.send(new PutObjectCommand(input));

    const storedFile = await this.prisma.fileObject.create({
      data: {
        bucket,
        objectKey,
        originalName: file.originalname ?? 'uploaded-file',
        mimeType: file.mimetype ?? 'application/octet-stream',
        sizeBytes: BigInt(file.size ?? file.buffer.length),
        checksumSha256: this.sha256(file.buffer),
        visibility: options.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
        uploadedById: options.uploadedById ?? null,
      },
    });

    return storedFile;
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
