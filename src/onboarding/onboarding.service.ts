import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgreementsService } from '../agreements/agreements.service.js';
import { AuthService, getOnboardingStep } from '../auth/auth.service.js';
import { FirebaseAuthService } from '../common/firebase-auth.service.js';
import { normalizePhone } from '../common/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaveOnboardingProfileDto } from './dto/onboarding.dto.js';
import {
  candidateJoined,
  personName,
  welcome,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly agreements: AgreementsService,
    private readonly firebase: FirebaseAuthService,
  ) {}

  async getState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerifiedAt: true,
        legalName: true,
        onboardingCompletedAt: true,
        professionalInfo: { select: { languages: true } },
        addresses: {
          select: { state: true, country: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
        consentRecords: {
          where: { type: 'TRAINER_AGREEMENT', withdrawnAt: null },
          select: { grantedAt: true, version: true },
          orderBy: { grantedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const address = user.addresses[0];
    const agreement = user.consentRecords[0];

    return {
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      phoneVerified: Boolean(user.phoneVerifiedAt),
      profile: user.legalName
        ? {
            fullName: user.legalName,
            country: address?.country ?? 'India',
            state: address?.state ?? '',
            languages: user.professionalInfo?.languages ?? [],
          }
        : null,
      agreementSignedAt: agreement?.grantedAt.toISOString() ?? null,
      agreementVersion: (await this.agreements.current()).version,
      step: getOnboardingStep(user),
    };
  }

  async sendPhoneOtp(userId: string, rawPhone: string) {
    this.assertMockOtpAllowed();
    const phone = normalizePhone(rawPhone);
    const user = await this.findUser(userId);

    if (user.phone !== phone) {
      const taken = await this.prisma.user.findFirst({
        where: { phone, deletedAt: null, NOT: { id: userId } },
      });
      if (taken) {
        throw new ConflictException(
          'This mobile number is already registered with another account.',
        );
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone, phoneVerifiedAt: null },
      });
    } else if (user.phoneVerifiedAt) {
      throw new BadRequestException('This mobile number is already verified');
    }

    await this.authService.issueOtp({
      userId,
      purpose: 'PHONE_VERIFICATION',
      target: phone,
      deliver: (otp) => this.sendSms(phone, otp),
      fixedOtp: this.mockPhoneOtp(),
    });

    return this.getState(userId);
  }

  async verifyPhoneOtp(userId: string, otp: string) {
    this.assertMockOtpAllowed();
    const user = await this.findUser(userId);
    if (!user.phone) {
      throw new BadRequestException('Add a mobile number first');
    }

    await this.authService.consumeOtp({
      userId,
      purpose: 'PHONE_VERIFICATION',
      otp,
      target: user.phone,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });

    return this.getState(userId);
  }

  /**
   * Firebase sent and checked the SMS code in the browser; the number saved
   * is the one inside the signed token, not one the browser sends.
   */
  async verifyFirebasePhone(userId: string, idToken: string) {
    const phone = normalizePhone(await this.firebase.verifiedPhone(idToken));
    const user = await this.findUser(userId);

    if (user.phone === phone && user.phoneVerifiedAt) {
      return this.getState(userId);
    }
    const taken = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(
        'This mobile number is already registered with another account.',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date() },
    });

    return this.getState(userId);
  }

  async saveProfile(userId: string, dto: SaveOnboardingProfileDto) {
    const user = await this.findUser(userId);
    if (!user.phoneVerifiedAt) {
      throw new BadRequestException('Verify your mobile number first');
    }

    const languages = [...new Set(dto.languages.map((item) => item.trim()))];
    const address = await this.prisma.userAddress.findFirst({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { legalName: dto.fullName.trim().replace(/\s+/g, ' ') },
      }),
      address
        ? this.prisma.userAddress.update({
            where: { id: address.id },
            data: { state: dto.state.trim(), country: dto.country.trim() },
          })
        : this.prisma.userAddress.create({
            data: {
              userId,
              addressType: 'CURRENT',
              isPrimary: true,
              state: dto.state.trim(),
              country: dto.country.trim(),
            },
          }),
      this.prisma.userProfessionalInfo.upsert({
        where: { userId },
        update: { languages },
        create: { userId, languages, hardSkills: [], softSkills: [] },
      }),
    ]);

    return this.getState(userId);
  }

  async signAgreement(
    userId: string,
    signature: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.findUser(userId);
    if (!user.phoneVerifiedAt || !user.legalName) {
      throw new BadRequestException('Complete the previous steps first');
    }

    await this.agreements.sign(userId, signature, userAgent, ipAddress);

    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: user.onboardingCompletedAt ?? new Date() },
    });

    // First completion only: welcome the candidate and tell the admins.
    if (!user.onboardingCompletedAt) {
      await Promise.all([
        this.notifications.notifyUser(userId, welcome(user.firstName)),
        this.notifications.notifyAdmins(
          candidateJoined(
            personName({
              firstName: user.legalName ?? user.firstName,
              email: user.email,
            }),
          ),
        ),
      ]);
    }

    return this.getState(userId);
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Without Firebase (local dev), phone OTP is mocked: every code is
  // PHONE_OTP_MOCK_CODE. Once FIREBASE_PROJECT_ID is set the mock is refused,
  // so nobody can verify a number they don't own.
  private assertMockOtpAllowed() {
    if (this.firebase.isConfigured) {
      throw new BadRequestException(
        'Verify your mobile number with the SMS code we send you.',
      );
    }
  }

  private mockPhoneOtp() {
    return this.configService.get<string>('PHONE_OTP_MOCK_CODE') ?? '12345';
  }

  // Mock only: real SMS is sent by Firebase from the browser.
  private async sendSms(phone: string, otp: string) {
    this.logger.log(`Mock SMS OTP issued for ${phone} (code ${otp})`);
  }
}
