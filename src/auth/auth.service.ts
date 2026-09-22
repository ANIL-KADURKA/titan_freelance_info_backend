import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { OtpPurposeDto, RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateCredentialsDto } from './dto/update-credentials.dto.js';
import { TestEmailDto } from './dto/test-email.dto.js';
import { SeedDefaultUsersDto } from './dto/seed-default-users.dto.js';
import { UserRole } from './roles.enum.js';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthUserResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: string[];
  primaryRole: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const personalEmail = dto.personalEmail.trim().toLowerCase();
    const email = (dto.email ?? personalEmail).trim().toLowerCase();
    const phone = dto.phone.trim();
    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();

    if (firstName?.includes('@')) {
      throw new BadRequestException('First name cannot be an email address');
    }

    this.logger.log(`Register attempt for email: ${email}`);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { personalEmail }, { phone }],
      },
    });

    if (existingUser) {
      this.logger.warn(
        `Registration blocked for ${email}: duplicate user found`,
      );
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        personalEmail,
        passwordHash,
        firstName,
        lastName,
        gender: dto.gender,
        phone: dto.phone,
        status: 'PENDING_VERIFICATION',
      },
      select: {
        id: true,
        email: true,
        personalEmail: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
      },
    });

    const defaultRole = await this.prisma.role.findUnique({
      where: { name: UserRole.CANDIDATE },
    });

    if (defaultRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      });
    }

    await this.sendOtp({ email, purpose: OtpPurposeDto.EMAIL_VERIFICATION });
    this.logger.log(`User registered successfully: ${user.id}`);

    return {
      user,
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

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active yet');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    await this.prisma.session.create({
      data: {
        id: cryptoRandomId(),
        userId: user.id,
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
        userAgent,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress ?? null,
        failedLoginCount: 0,
      },
    });

    this.logger.log(`User logged in successfully: ${user.id}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.toAuthUserResponse(user.id),
    };
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

    if (!user && dto.purpose !== OtpPurposeDto.EMAIL_VERIFICATION) {
      throw new NotFoundException('User not found');
    }

    if (dto.purpose === OtpPurposeDto.EMAIL_VERIFICATION && user) {
      await this.prisma.authOtp.deleteMany({
        where: { userId: user.id, purpose: OtpPurposeDto.EMAIL_VERIFICATION },
      });
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);
    const deliveryEmail = this.getPreferredEmail(user, requestedEmail);

    if (dto.purpose === OtpPurposeDto.EMAIL_VERIFICATION) {
      if (!user) {
        const created = await this.prisma.user.create({
          data: {
            email: requestedEmail,
            personalEmail: requestedEmail,
            passwordHash: await bcrypt.hash('temp-password', 12),
            status: 'PENDING_VERIFICATION',
          },
        });
        await this.prisma.authOtp.create({
          data: {
            id: cryptoRandomId(),
            userId: created.id,
            purpose: 'EMAIL_VERIFICATION',
            otpHash,
            expiresAt,
          },
        });
        await this.sendMail(
          requestedEmail,
          'Email verification OTP',
          `Your OTP is ${otp}`,
        );
        return { message: 'Verification OTP sent to your email' };
      }
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.authOtp.create({
      data: {
        id: cryptoRandomId(),
        userId: user.id,
        purpose: dto.purpose,
        otpHash,
        expiresAt,
      },
    });

    await this.sendMail(deliveryEmail, 'Your OTP', `Your OTP is ${otp}`);
    this.logger.log(
      `OTP sent successfully for ${deliveryEmail}, purpose: ${dto.purpose}`,
    );
    return { message: 'OTP sent to your email' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
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

    const otpRecord = await this.prisma.authOtp.findFirst({
      where: {
        userId: user.id,
        purpose: dto.purpose,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No OTP found for this purpose');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    const matches = await bcrypt.compare(dto.otp, otpRecord.otpHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.authOtp.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    if (dto.purpose === OtpPurposeDto.EMAIL_VERIFICATION) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
    }

    this.logger.log(
      `OTP verified successfully for user ${user.id}, purpose: ${dto.purpose}`,
    );
    return { message: 'OTP verified successfully' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    await this.verifyOtp({
      email,
      purpose: OtpPurposeDto.PASSWORD_RESET,
      otp: dto.otp,
    });

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { personalEmail: email }],
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    this.logger.log(`Password reset successful for user ${user.id}`);
    return { message: 'Password reset successful' };
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

    await this.sendMail(
      email,
      'Titan Freelance SMTP Test',
      'This is a test email from the Titan Freelance backend. SMTP is configured correctly.',
    );

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

  private async sendOtp(dto: RequestOtpDto) {
    return this.requestOtp(dto);
  }

  private generateOtp() {
    return randomInt(100000, 999999).toString();
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
  ): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
      type: 'access',
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        type: 'refresh',
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
    };
  }

  private async sendMail(to: string, subject: string, body: string) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (!smtpHost) {
      return;
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
      text: body,
    });
  }
}

function cryptoRandomId() {
  return randomUUID();
}
