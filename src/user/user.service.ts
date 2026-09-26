import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto.js';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto.js';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
} from './dto/social-link.dto.js';
import {
  CreateProfessionalInfoDto,
  UpdateProfessionalInfoDto,
} from './dto/professional-info.dto.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for userId=${userId}`);
    const [user, addresses, educations, socialLinks, professionalInfo] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            personalEmail: true,
            firstName: true,
            lastName: true,
            phone: true,
            gender: true,
            whatsappNumber: true,
            dateOfBirth: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.userAddress.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userEducation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userSocialMediaLink.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userProfessionalInfo.findUnique({
          where: { userId },
        }),
      ]);

    if (!user) {
      this.logger.warn(
        `Profile fetch failed: user not found for userId=${userId}`,
      );
      throw new NotFoundException('User not found');
    }

    this.logger.log(
      `Profile fetched for userId=${userId} | addresses=${addresses.length} | educations=${educations.length} | socialLinks=${socialLinks.length}`,
    );

    return {
      user,
      addresses,
      educations,
      socialLinks,
      professionalInfo,
    };
  }

  async createOrUpdateAddress(
    userId: string,
    dto: CreateAddressDto | UpdateAddressDto,
  ) {
    this.logger.log(`Create/update address request for userId=${userId}`);
    const existing = await this.prisma.userAddress.findFirst({
      where: { userId, addressType: dto.addressType ?? 'CURRENT' },
    });

    if (existing && 'id' in dto && dto.id) {
      const { id: _id, ...rest } = dto;
      this.logger.log(
        `Updating existing address id=${dto.id} for userId=${userId}`,
      );
      const result = await this.prisma.userAddress.update({
        where: { id: dto.id },
        data: {
          ...rest,
          addressType: rest.addressType ?? 'CURRENT',
        },
      });
      this.logger.log(`Address updated successfully id=${result.id}`);
      return result;
    }

    if (existing && !('id' in dto)) {
      this.logger.log(
        `Updating existing address type=${dto.addressType ?? 'CURRENT'} for userId=${userId}`,
      );
      const result = await this.prisma.userAddress.update({
        where: { id: existing.id },
        data: {
          addressType: dto.addressType ?? 'CURRENT',
          addressLine: dto.addressLine,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          postalCode: dto.postalCode,
          isPrimary: dto.isPrimary,
        },
      });
      this.logger.log(`Address updated successfully id=${result.id}`);
      return result;
    }

    const result = await this.prisma.userAddress.create({
      data: {
        userId,
        addressType: dto.addressType ?? 'CURRENT',
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'India',
        postalCode: dto.postalCode,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    this.logger.log(
      `Address created successfully id=${result.id} for userId=${userId}`,
    );
    return result;
  }

  async listAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const item = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!item) throw new NotFoundException('Address not found');
    return this.prisma.userAddress.delete({ where: { id: addressId } });
  }

  async createEducation(userId: string, dto: CreateEducationDto) {
    return this.prisma.userEducation.create({
      data: {
        userId,
        institution: dto.institution,
        degree: dto.degree,
        fieldOfStudy: dto.fieldOfStudy,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        grade: dto.grade,
      },
    });
  }

  async listEducation(userId: string) {
    return this.prisma.userEducation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateEducation(
    userId: string,
    educationId: string,
    dto: UpdateEducationDto,
  ) {
    const record = await this.prisma.userEducation.findFirst({
      where: { id: educationId, userId },
    });
    if (!record) throw new NotFoundException('Education record not found');

    const data = {
      institution: dto.institution,
      degree: dto.degree,
      fieldOfStudy: dto.fieldOfStudy,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      grade: dto.grade,
    };

    return this.prisma.userEducation.update({
      where: { id: educationId },
      data,
    });
  }

  async deleteEducation(userId: string, educationId: string) {
    const record = await this.prisma.userEducation.findFirst({
      where: { id: educationId, userId },
    });
    if (!record) throw new NotFoundException('Education record not found');
    return this.prisma.userEducation.delete({ where: { id: educationId } });
  }

  async createSocialLink(userId: string, dto: CreateSocialLinkDto) {
    return this.prisma.userSocialMediaLink.create({
      data: {
        userId,
        socialMediaType: dto.socialMediaType,
        url: dto.url,
      },
    });
  }

  async listSocialLinks(userId: string) {
    return this.prisma.userSocialMediaLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSocialLink(
    userId: string,
    linkId: string,
    dto: UpdateSocialLinkDto,
  ) {
    const record = await this.prisma.userSocialMediaLink.findFirst({
      where: { id: linkId, userId },
    });
    if (!record) throw new NotFoundException('Social link not found');
    return this.prisma.userSocialMediaLink.update({
      where: { id: linkId },
      data: dto,
    });
  }

  async deleteSocialLink(userId: string, linkId: string) {
    const record = await this.prisma.userSocialMediaLink.findFirst({
      where: { id: linkId, userId },
    });
    if (!record) throw new NotFoundException('Social link not found');
    return this.prisma.userSocialMediaLink.delete({ where: { id: linkId } });
  }

  async upsertProfessionalInfo(
    userId: string,
    dto: CreateProfessionalInfoDto | UpdateProfessionalInfoDto,
  ) {
    const existing = await this.prisma.userProfessionalInfo.findUnique({
      where: { userId },
    });

    if (existing) {
      return this.prisma.userProfessionalInfo.update({
        where: { userId },
        data: dto,
      });
    }

    return this.prisma.userProfessionalInfo.create({
      data: {
        userId,
        languages: dto.languages,
        hardSkills: dto.hardSkills,
        softSkills: dto.softSkills,
        currentOccupation: dto.currentOccupation,
      },
    });
  }

  async getProfessionalInfo(userId: string) {
    const info = await this.prisma.userProfessionalInfo.findUnique({
      where: { userId },
    });
    if (!info) throw new NotFoundException('Professional info not found');
    return info;
  }

  async listUsersForAdmin(
    filters: {
      status?: string;
      role?: string;
      search?: string;
      includeSummary?: boolean;
    } = {},
  ) {
    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status as AccountStatus;
    }

    if (filters.role) {
      where.roles = {
        some: {
          role: {
            name: filters.role,
          },
        },
      };
    }

    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { personalEmail: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        personalEmail: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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

    const mappedUsers = users.map((user) => {
      const roles = user.roles.map((entry) => entry.role.name);
      const primaryRole =
        [
          RoleName.ADMIN,
          RoleName.RECRUITER,
          RoleName.EMPLOYEE,
          RoleName.CANDIDATE,
        ].find((role) => roles.includes(role)) ??
        roles[0] ??
        RoleName.CANDIDATE;

      return {
        id: user.id,
        email: user.email,
        personalEmail: user.personalEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles,
        primaryRole,
      };
    });

    if (!filters.includeSummary) {
      return mappedUsers;
    }

    const summaryRows = await this.prisma.user.groupBy({
      by: ['status'],
      where: Object.keys(where).length > 0 ? where : undefined,
      _count: {
        status: true,
      },
    });

    const summary = {
      total: mappedUsers.length,
      active:
        summaryRows.find((row) => row.status === AccountStatus.ACTIVE)?._count
          .status ?? 0,
      inactive:
        summaryRows.find((row) => row.status === AccountStatus.INACTIVE)?._count
          .status ?? 0,
      pending:
        summaryRows.find(
          (row) => row.status === AccountStatus.PENDING_VERIFICATION,
        )?._count.status ?? 0,
      blocked:
        summaryRows.find((row) => row.status === AccountStatus.NOT_ELIGIBLE)
          ?._count.status ?? 0,
    };

    return {
      users: mappedUsers,
      summary,
    };
  }

  async updateUserStatus(userId: string, status: string) {
    const normalizedStatus = status?.trim().toUpperCase();

    if (
      !normalizedStatus ||
      !Object.values(AccountStatus).includes(normalizedStatus as AccountStatus)
    ) {
      throw new BadRequestException(
        'Status must be one of ACTIVE, INACTIVE, PENDING_VERIFICATION, NOT_ELIGIBLE',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: normalizedStatus as AccountStatus },
    });

    return {
      message: `User status updated to ${updated.status}`,
      user: {
        id: updated.id,
        status: updated.status,
      },
    };
  }

  async resetUserPassword(userId: string, newPassword: string) {
    const password = newPassword?.trim();

    if (!password || password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: 'Password reset successfully',
      userId: user.id,
      email: user.email,
    };
  }

  async updateUserProfessionalEmail(
    userId: string,
    email: string,
    password?: string,
  ) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Professional email is required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const duplicate = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: userId },
      },
    });

    if (duplicate) {
      throw new BadRequestException('Another user already uses this email');
    }

    const data: Record<string, unknown> = {
      email: normalizedEmail,
    };

    if (password && password.trim()) {
      data.passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      message: 'Professional email updated successfully',
      user: {
        id: updated.id,
        email: updated.email,
      },
    };
  }
}
