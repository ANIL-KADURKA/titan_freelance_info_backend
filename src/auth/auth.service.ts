import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { OtpPurpose } from '@prisma/client';
import { normalizePhone } from '../common/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { OtpPurposeDto, RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateCredentialsDto } from './dto/update-credentials.dto.js';
import { TestEmailDto } from './dto/test-email.dto.js';
import { SeedDefaultUsersDto } from './dto/seed-default-users.dto.js';
import { UserRole } from './roles.enum.js';
import {
  passwordResetEmail,
  signupVerificationEmail,
} from './email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { passwordChanged } from '../notifications/notification-messages.js';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type OnboardingStep = 'phone' | 'profile' | 'agreement' | 'done';

type AuthUserResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: string[];
  primaryRole: string;
  onboardingStep: OnboardingStep;
};

const OTP_TTL_MS = 1000 * 60 * 10;
const OTP_RESEND_COOLDOWN_MS = 1000 * 30;

export function getOnboardingStep(user: {
  phoneVerifiedAt: Date | null;
  legalName: string | null;
  onboardingCompletedAt: Date | null;
}): OnboardingStep {
  if (!user.phoneVerifiedAt) return 'phone';
  if (!user.legalName) return 'profile';
  if (!user.onboardingCompletedAt) return 'agreement';
  return 'done';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const personalEmail = dto.personalEmail.trim().toLowerCase();
    const email = (dto.email ?? personalEmail).trim().toLowerCase();
    const phone = normalizePhone(dto.phone);
    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();

    if (firstName?.includes('@')) {
      throw new BadRequestException('First name cannot be an email address');
    }

    this.logger.log(`Register attempt for email: ${email}`);

    const existingByEmail = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { personalEmail }] },
    });

    if (existingByEmail && existingByEmail.status !== 'PENDING_VERIFICATION') {
      throw new ConflictException(
        'An account with this email already exists. Please sign in.',
      );
    }

    const existingByPhone = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null, NOT: { id: existingByEmail?.id } },
    });

    if (existingByPhone) {
      throw new ConflictException(
        'This mobile number is already registered with another account.',
      );
    }

    const details = {
      passwordHash: await bcrypt.hash(dto.password, 12),
      firstName,
      lastName,
      gender: dto.gender,
      phone,
      referralSource: dto.referralSource?.trim() || null,
    };

    // An unverified sign-up can be retried (e.g. after "change email"):
    // refresh the details and send a new code instead of rejecting it.
    const user = existingByEmail
      ? await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: details,
        })
      : await this.prisma.user.create({
          data: {
            ...details,
            email,
            personalEmail,
            status: 'PENDING_VERIFICATION',
          },
        });

    // Always (re)assert the default role, including when a pending sign-up is
    // retried: an earlier attempt may have failed before the role was saved,
    // and a role-less account is rejected by every candidate endpoint.
    const defaultRole = await this.prisma.role.upsert({
      where: { name: UserRole.CANDIDATE },
      update: {},
      create: {
        name: UserRole.CANDIDATE,
        description: 'Candidate role',
        isSystem: true,
      },
    });
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: defaultRole.id } },
      update: {},
      create: { userId: user.id, roleId: defaultRole.id },
    });

    await this.issueOtp({
      userId: user.id,
      purpose: OtpPurposeDto.EMAIL_VERIFICATION,
      target: email,
      deliver: (otp) =>
        this.sendOtpEmail(
          email,
          OtpPurposeDto.EMAIL_VERIFICATION,
          otp,
          firstName,
        ),
      skipCooldown: true,
    });
    this.logger.log(`User registered (pending verification): ${user.id}`);

    return {
      email,
      message:
        'Registration successful. Please verify your email using the OTP sent to your mailbox.',
    };
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { personalEmail: email }],
      },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found for ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.otp) {
      await this.verifyOtp({
        email,
        purpose: OtpPurposeDto.LOGIN,
        otp: dto.otp,
      });
    } else {
      if (!dto.password) {
        throw new BadRequestException('Password or OTP is required');
      }

      const passwordMatches = await bcrypt.compare(
        dto.password,
        user.passwordHash,
      );
      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (user.status === 'PENDING_VERIFICATION') {
      // Send a fresh code so the frontend can resume at the email OTP step.
      await this.issueOtp({
        userId: user.id,
        purpose: OtpPurposeDto.EMAIL_VERIFICATION,
        target: user.email,
        deliver: (otp) =>
          this.sendOtpEmail(
            user.email,
            OtpPurposeDto.EMAIL_VERIFICATION,
            otp,
            user.firstName,
          ),
      }).catch(() => undefined);
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        message: 'Please verify your email to continue.',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active yet');
    }

    this.logger.log(`User logged in successfully: ${user.id}`);

    return this.createSession(user.id, user.email, userAgent, ipAddress);
  }

  async getCurrentUser(userId: string): Promise<AuthUserResponse> {
    return this.toAuthUserResponse(userId);
  }

  async requestOtp(dto: RequestOtpDto) {
    const requestedEmail = dto.email?.trim().toLowerCase();
    if (!requestedEmail) {
      throw new BadRequestException('Email is required');
    }

    this.logger.log(
      `OTP requested for ${requestedEmail}, purpose: ${dto.purpose}`,
    );

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: requestedEmail }, { personalEmail: requestedEmail }],
      },
    });

    const isPasswordReset = dto.purpose === OtpPurposeDto.PASSWORD_RESET;

    // Product decision: tell users when no account matches so they can fix a
    // typo. Note this lets anyone check whether an email is registered.
    if (!user) {
      throw new NotFoundException(
        isPasswordReset
          ? 'No account found with this email. Please check it and try again.'
          : 'User not found',
      );
    }

    if (
      dto.purpose === OtpPurposeDto.EMAIL_VERIFICATION &&
      user.status !== 'PENDING_VERIFICATION'
    ) {
      throw new BadRequestException('This email is already verified');
    }

    const deliveryEmail = this.getPreferredEmail(user, requestedEmail);
    await this.issueOtp({
      userId: user.id,
      purpose: dto.purpose,
      target: deliveryEmail,
      deliver: (otp) =>
        this.sendOtpEmail(deliveryEmail, dto.purpose, otp, user.firstName),
    });

    return {
      message: isPasswordReset
        ? 'A reset code has been sent to your email.'
        : 'OTP sent to your email',
    };
  }

  async verifyOtp(dto: VerifyOtpDto, userAgent?: string, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { personalEmail: email }],
      },
    });

    if (!user) {
      this.logger.warn(`OTP verification failed: user not found for ${email}`);
      throw new NotFoundException('User not found');
    }

    await this.consumeOtp({
      userId: user.id,
      purpose: dto.purpose,
      otp: dto.otp,
    });

    this.logger.log(
      `OTP verified successfully for user ${user.id}, purpose: ${dto.purpose}`,
    );

    if (dto.purpose !== OtpPurposeDto.EMAIL_VERIFICATION) {
      return { message: 'OTP verified successfully' };
    }

    // Verifying the sign-up email logs the user straight into onboarding.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });

    return {
      message: 'Email verified successfully',
      ...(await this.createSession(user.id, user.email, userAgent, ipAddress)),
    };
  }

  /**
   * Creates and delivers a one-time code. Older codes for the same purpose are
   * discarded, and a new code can only be requested after a short cooldown.
   */
  async issueOtp({
    userId,
    purpose,
    target,
    deliver,
    skipCooldown = false,
    fixedOtp,
  }: {
    userId: string;
    purpose: OtpPurpose;
    target: string;
    deliver: (otp: string) => Promise<void>;
    skipCooldown?: boolean;
    /** Use this code instead of a random one (mock phone OTP only). */
    fixedOtp?: string;
  }) {
    const latest = await this.prisma.authOtp.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    const waitMs = latest
      ? latest.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()
      : 0;

    if (!skipCooldown && waitMs > 0) {
      throw new HttpException(
        `Please wait ${Math.ceil(waitMs / 1000)}s before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = fixedOtp ?? this.generateOtp();
    await this.prisma.authOtp.deleteMany({ where: { userId, purpose } });
    await this.prisma.authOtp.create({
      data: {
        userId,
        purpose,
        target,
        otpHash: await bcrypt.hash(otp, 10),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await deliver(otp);
    this.logger.log(`OTP issued for user ${userId}, purpose: ${purpose}`);
  }

  /** Checks a code, counting failed attempts, and marks it used on success. */
  async consumeOtp({
    userId,
    purpose,
    otp,
    target,
  }: {
    userId: string;
    purpose: OtpPurpose;
    otp: string;
    target?: string;
  }) {
    const record = await this.prisma.authOtp.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.verifiedAt || (target && record.target !== target)) {
      throw new BadRequestException(
        'No active code. Please request a new one.',
      );
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(
        'This code has expired. Please request a new one.',
      );
    }

    if (record.attempts >= record.maxAttempts) {
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    const matches = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!matches) {
      await this.prisma.authOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      // 400, not 401: the frontend treats 401 on protected routes as "logged out".
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    await this.prisma.authOtp.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    });
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { personalEmail: email }],
      },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.consumeOtp({
      userId: user.id,
      purpose: OtpPurposeDto.PASSWORD_RESET,
      otp: dto.otp,
    });
    await this.setPasswordAndSignOutEverywhere(user.id, dto.newPassword);

    this.logger.log(`Password reset successful for user ${user.id}`);
    await this.notifications.notifyUser(user.id, passwordChanged(true));
    return { message: 'Password reset successful. Please sign in.' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      // 400, not 401: the frontend treats 401 on protected routes as "logged out".
      throw new BadRequestException('Current password is incorrect');
    }

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    await this.setPasswordAndSignOutEverywhere(userId, dto.newPassword);
    this.logger.log(`Password changed for user ${userId}`);
    await this.notifications.notifyUser(userId, passwordChanged(false));

    // Every other device is now signed out; keep this one signed in.
    return {
      message: 'Password updated. Other devices have been signed out.',
      ...(await this.createSession(userId, user.email, userAgent, ipAddress)),
    };
  }

  private async setPasswordAndSignOutEverywhere(
    userId: string,
    newPassword: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async updateProfessionalCredentials(
    userId: string,
    dto: UpdateCredentialsDto,
  ) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        passwordHash,
      },
    });

    return {
      message: 'Professional email and password updated successfully',
    };
  }

  async sendTestEmail(dto: TestEmailDto) {
    const email = dto.email.trim().toLowerCase();

    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new BadRequestException(
        'SMTP configuration is incomplete. Check .env values.',
      );
    }

    await this.sendMail(email, {
      subject: 'Titan Freelance SMTP Test',
      text: 'This is a test email from the Titan Freelance backend. SMTP is configured correctly.',
    });

    this.logger.log(`SMTP test email sent successfully to ${email}`);

    return {
      message: 'Test email sent successfully',
      to: email,
    };
  }

  async seedDefaultUsers(dto: SeedDefaultUsersDto = {}) {
    await this.seedRoles();

    const adminEmail =
      dto.adminEmail?.trim().toLowerCase() ?? 'admin@titan.local';
    const adminPassword = dto.adminPassword ?? 'Admin@123';
    const recruiterEmail =
      dto.recruiterEmail?.trim().toLowerCase() ?? 'recruiter@titan.local';
    const recruiterPassword = dto.recruiterPassword ?? 'Recruiter@123';

    const adminRole = await this.prisma.role.findUnique({
      where: { name: UserRole.ADMIN },
    });
    const recruiterRole = await this.prisma.role.findUnique({
      where: { name: UserRole.RECRUITER },
    });

    if (!adminRole || !recruiterRole) {
      throw new BadRequestException('Required roles are not available yet');
    }

    const defaultUsers = [
      { email: adminEmail, password: adminPassword, roleId: adminRole.id },
      {
        email: recruiterEmail,
        password: recruiterPassword,
        roleId: recruiterRole.id,
      },
    ];

    const createdUsers = [] as Array<{
      email: string;
      role: string;
      created: boolean;
    }>;

    for (const target of defaultUsers) {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: target.email }, { personalEmail: target.email }],
        },
      });

      if (existing && !dto.force) {
        createdUsers.push({
          email: target.email,
          role:
            target.roleId === adminRole.id
              ? UserRole.ADMIN
              : UserRole.RECRUITER,
          created: false,
        });
        continue;
      }

      const user = await this.prisma.user.upsert({
        where: { email: target.email },
        update: {
          passwordHash: await bcrypt.hash(target.password, 12),
          status: 'ACTIVE',
          personalEmail: target.email,
          firstName: target.roleId === adminRole.id ? 'System' : 'Recruitment',
          lastName: target.roleId === adminRole.id ? 'Admin' : 'Team',
        },
        create: {
          email: target.email,
          personalEmail: target.email,
          phone:
            target.roleId === adminRole.id ? '+10000000001' : '+10000000002',
          passwordHash: await bcrypt.hash(target.password, 12),
          firstName: target.roleId === adminRole.id ? 'System' : 'Recruitment',
          lastName: target.roleId === adminRole.id ? 'Admin' : 'Team',
          status: 'ACTIVE',
        },
      });

      await this.prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: target.roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: target.roleId,
        },
      });

      createdUsers.push({
        email: target.email,
        role:
          target.roleId === adminRole.id ? UserRole.ADMIN : UserRole.RECRUITER,
        created: true,
      });
    }

    return {
      message: 'Default seeded users ensured successfully',
      users: createdUsers,
    };
  }

  private async seedRoles() {
    const roles = [
      {
        name: UserRole.ADMIN,
        description: 'Platform administrator',
        isSystem: true,
      },
      {
        name: UserRole.RECRUITER,
        description: 'Recruiter role',
        isSystem: true,
      },
      { name: UserRole.EMPLOYEE, description: 'Employee role', isSystem: true },
      {
        name: UserRole.CANDIDATE,
        description: 'Candidate role',
        isSystem: true,
      },
    ];

    for (const role of roles) {
      await this.prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description, isSystem: role.isSystem },
        create: role,
      });
    }
  }

  private generateOtp() {
    return randomInt(100000, 999999).toString();
  }

  private async createSession(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const { tokenVersion } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    const tokens = await this.issueTokens(userId, email, tokenVersion);
    await this.prisma.session.create({
      data: {
        id: cryptoRandomId(),
        userId,
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
        userAgent,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress ?? null,
        failedLoginCount: 0,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.toAuthUserResponse(userId),
    };
  }

  private getPreferredEmail(
    user: { email: string | null; personalEmail: string | null } | null,
    fallback?: string,
  ) {
    const value =
      user?.email?.trim() || user?.personalEmail?.trim() || fallback?.trim();
    return value ?? '';
  }

  private async issueTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
      type: 'access',
      ver: tokenVersion,
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        type: 'refresh',
        ver: tokenVersion,
      },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          'development-refresh-secret',
        expiresIn: '30d',
      },
    );

    return { accessToken, refreshToken };
  }

  private async toAuthUserResponse(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        phoneVerifiedAt: true,
        legalName: true,
        onboardingCompletedAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.roles.map((entry) => entry.role.name);
    const primaryRole =
      [
        UserRole.ADMIN,
        UserRole.RECRUITER,
        UserRole.EMPLOYEE,
        UserRole.CANDIDATE,
      ].find((role) => roles.includes(role)) ??
      roles[0] ??
      UserRole.CANDIDATE;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      primaryRole,
      onboardingStep: getOnboardingStep(user),
    };
  }

  private sendOtpEmail(
    to: string,
    purpose: OtpPurposeDto,
    code: string,
    name?: string | null,
  ) {
    const expiresInMinutes = OTP_TTL_MS / 60_000;
    if (purpose === OtpPurposeDto.EMAIL_VERIFICATION) {
      return this.sendMail(
        to,
        signupVerificationEmail({ name, code, expiresInMinutes }),
      );
    }
    if (purpose === OtpPurposeDto.PASSWORD_RESET) {
      return this.sendMail(
        to,
        passwordResetEmail({ name, code, expiresInMinutes }),
      );
    }
    return this.sendMail(to, {
      subject: 'Your Titan sign-in code',
      text: `Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    });
  }

  private async sendMail(
    to: string,
    { subject, text, html }: { subject: string; text: string; html?: string },
  ) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (!smtpHost) {
      // Fail loudly: silently skipping would leave users waiting for a code.
      this.logger.error(`SMTP is not configured; cannot email ${to}`);
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Please contact support.',
      );
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<number>('SMTP_PORT') ?? 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
    this.logger.log(`Sending email to ${to} | subject: ${subject}`);

    await transporter.sendMail({
      from:
        this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com',
      to,
      subject,
      text,
      html,
    });
  }
}

function cryptoRandomId() {
  return randomUUID();
}
