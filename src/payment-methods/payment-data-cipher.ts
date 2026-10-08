import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

/**
 * Encrypts payout account numbers at rest (AES-256-GCM) and fingerprints
 * payment details (HMAC-SHA256) so duplicates can be found without decrypting.
 * Key: PAYMENT_DATA_KEY, 32 bytes base64 (`openssl rand -base64 32`).
 */
@Injectable()
export class PaymentDataCipher {
  private readonly logger = new Logger(PaymentDataCipher.name);
  private cachedKey: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString('base64'))
      .join('.');
  }

  decrypt(payload: string) {
    const [iv, tag, encrypted] = payload
      .split('.')
      .map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  fingerprint(value: string) {
    return createHmac('sha256', this.key()).update(value).digest('hex');
  }

  private key() {
    if (this.cachedKey) return this.cachedKey;

    const configured = this.configService.get<string>('PAYMENT_DATA_KEY');
    if (configured) {
      const key = Buffer.from(configured, 'base64');
      if (key.length !== 32) {
        throw new ServiceUnavailableException(
          'PAYMENT_DATA_KEY must be 32 bytes, base64-encoded',
        );
      }
      this.cachedKey = key;
      return key;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Payment data encryption is not configured',
      );
    }

    // Local development fallback so the feature works without extra setup.
    this.logger.warn(
      'PAYMENT_DATA_KEY is not set; deriving a development key from JWT_SECRET',
    );
    this.cachedKey = createHash('sha256')
      .update(this.configService.get<string>('JWT_SECRET') ?? 'dev-secret')
      .digest();
    return this.cachedKey;
  }
}
