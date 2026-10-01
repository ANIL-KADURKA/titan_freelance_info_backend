import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  type OnModuleInit,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const VIEW_URL_TTL_SECONDS = 60 * 60;

export type StoredObjectInfo = {
  sizeBytes: number;
  contentType?: string;
};

/**
 * Direct-to-S3 helpers: the browser uploads with a presigned PUT and views
 * with a presigned GET, so large files never pass through the API.
 */
@Injectable()
export class S3StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.s3 = this.createClient(
      this.configService.get<string>('AWS_S3_REGION') ?? 'us-east-1',
    );
  }

  /**
   * Signed URLs only work for the bucket's real region. If AWS_S3_REGION is
   * wrong, S3 answers "PermanentRedirect", so detect the region once at
   * startup and use it (with a warning to fix the env).
   */
  async onModuleInit() {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) return;
    const configured = await this.s3.config.region();
    try {
      const head = await this.createClient(configured, true).send(
        new HeadBucketCommand({ Bucket: bucket }),
      );
      const actual = head.BucketRegion;
      if (actual && actual !== configured) {
        this.logger.warn(
          `AWS_S3_REGION is "${configured}" but bucket "${bucket}" is in "${actual}". Using "${actual}" — please update AWS_S3_REGION.`,
        );
        this.s3 = this.createClient(actual);
      }
    } catch (error) {
      this.logger.warn(
        `Couldn't check the S3 bucket region | error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private createClient(region: string, followRegionRedirects = false) {
    return new S3Client({
      region,
      followRegionRedirects,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      forcePathStyle:
        this.configService.get<boolean>('AWS_S3_FORCE_PATH_STYLE') ?? false,
      // Newer SDKs add a CRC32 checksum to every request by default. On a
      // presigned PUT that's the checksum of an empty body, so S3 rejects the
      // browser's real upload. Only send checksums when an API requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  get bucket(): string {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new InternalServerErrorException(
        'AWS_S3_BUCKET is not configured.',
      );
    }
    return bucket;
  }

  /** `${folder}/${timestamp}-${uuid}${ext}` — unique, never overwrites. */
  buildObjectKey(folder: string, fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    const extension =
      dot === -1
        ? ''
        : fileName
            .slice(dot)
            .toLowerCase()
            .replace(/[^.a-z0-9]/g, '');
    return `${folder}/${Date.now()}-${randomUUID()}${extension}`;
  }

  async createUploadUrl(objectKey: string, contentType: string) {
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return { url, expiresIn: UPLOAD_URL_TTL_SECONDS };
  }

  async createViewUrl(
    bucket: string,
    objectKey: string,
    options: { fileName: string; contentType: string; download?: boolean },
  ) {
    const disposition = options.download ? 'attachment' : 'inline';
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentType: options.contentType,
        ResponseContentDisposition: `${disposition}; filename="${options.fileName.replace(/["\\\r\n]/g, '_')}"`,
      }),
      { expiresIn: VIEW_URL_TTL_SECONDS },
    );
  }

  /** Returns null when the object doesn't exist (upload never finished). */
  async headObject(objectKey: string): Promise<StoredObjectInfo | null> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        sizeBytes: Number(head.ContentLength ?? 0),
        contentType: head.ContentType,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return null;
      throw error;
    }
  }

  /** Reads the first bytes of an object, used to check its real file type. */
  async readHead(objectKey: string, length = 16): Promise<Buffer> {
    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: `bytes=0-${length - 1}`,
      }),
    );
    const bytes = await object.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
    } catch (error) {
      // A leftover object is harmless; don't fail the user's action over it.
      this.logger.warn(
        `S3 delete failed | key=${objectKey} | error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
