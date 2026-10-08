import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadedDocument } from './document-validation.service.js';
import { assertPhoto } from './photo-rules.js';

type Credentials = { cloudName: string; apiKey: string; apiSecret: string };

/** Everything we upload lives under this folder in the Cloudinary account. */
const ROOT_FOLDER = 'titan';

/**
 * Website images (job covers/logos, landing photos) go to Cloudinary, which
 * returns a permanent public URL served from its CDN. Uploads are signed here
 * with the API secret, so the browser never sees it.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {}

  /** CLOUDINARY_URL (cloudinary://key:secret@cloud) or the three variables. */
  private credentials(): Credentials | null {
    const url = this.config.get<string>('CLOUDINARY_URL')?.trim();
    const match = url
      ? /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url)
      : null;
    if (match) {
      return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
    }
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    return cloudName && apiKey && apiSecret
      ? { cloudName, apiKey, apiSecret }
      : null;
  }

  /** True for image URLs from our own Cloudinary account. */
  isOwnImageUrl(url: string) {
    const cloudName = this.credentials()?.cloudName;
    return Boolean(
      cloudName &&
      url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`),
    );
  }

  /**
   * Uploads a PNG/JPG/WebP (max 5 MB) into `titan/<folder>` and returns its
   * public URL, delivered in the best format and quality for each browser.
   */
  async uploadImage(file: UploadedDocument, folder: string): Promise<string> {
    assertPhoto(file);
    const credentials = this.credentials();
    if (!credentials) {
      throw new ServiceUnavailableException(
        'Image uploads are not set up yet (Cloudinary).',
      );
    }

    const params: Record<string, string> = {
      folder: `${ROOT_FOLDER}/${folder}`,
      timestamp: Math.floor(Date.now() / 1000).toString(),
    };
    // Cloudinary signature: sorted "key=value" pairs joined by "&", + secret.
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    const signature = createHash('sha1')
      .update(toSign + credentials.apiSecret)
      .digest('hex');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname ?? 'image',
    );
    for (const [key, value] of Object.entries(params)) form.append(key, value);
    form.append('api_key', credentials.apiKey);
    form.append('signature', signature);

    let body: { secure_url?: string; error?: { message?: string } } = {};
    let status = 0;
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`,
        { method: 'POST', body: form },
      );
      status = response.status;
      body = (await response.json()) as typeof body;
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!body.secure_url) {
      this.logger.error(
        `Cloudinary upload rejected | status=${status} | ${body.error?.message ?? 'no response'}`,
      );
      throw new BadGatewayException("Couldn't upload the image. Try again.");
    }
    return body.secure_url.replace(
      '/image/upload/',
      '/image/upload/f_auto,q_auto/',
    );
  }
}
