import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type App, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';

const APP_NAME = 'titan-phone-otp';

/**
 * Checks Firebase phone sign-in results. Firebase sends and checks the SMS
 * code in the browser; we only trust the signed ID token it hands back.
 * Verifying ID tokens needs just the project id (no service-account key).
 */
@Injectable()
export class FirebaseAuthService {
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  private projectId() {
    return this.config.get<string>('FIREBASE_PROJECT_ID')?.trim() || undefined;
  }

  /** Phone OTP goes through Firebase once FIREBASE_PROJECT_ID is set. */
  get isConfigured() {
    return Boolean(this.projectId());
  }

  /** Returns the verified phone number (E.164) from a Firebase ID token. */
  async verifiedPhone(idToken: string): Promise<string> {
    const projectId = this.projectId();
    if (!projectId) {
      throw new ServiceUnavailableException(
        'Phone verification is not set up yet.',
      );
    }
    this.app ??=
      getApps().find((app) => app.name === APP_NAME) ??
      initializeApp({ projectId }, APP_NAME);

    let decoded: DecodedIdToken;
    try {
      // Checks signature, expiry, audience (our project) and issuer.
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch {
      throw new BadRequestException(
        'The verification has expired. Request a new code and try again.',
      );
    }

    if (
      decoded.firebase.sign_in_provider !== 'phone' ||
      !decoded.phone_number
    ) {
      throw new BadRequestException(
        'Verify your mobile number with the SMS code.',
      );
    }
    return decoded.phone_number;
  }
}
