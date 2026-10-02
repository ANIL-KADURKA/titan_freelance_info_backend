import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { normalizePhone } from '../common/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';

/** Account extras for the profile page: login history and profile photo. */
@Injectable()
export class UserAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
  ) {}

  /** Recent sign-ins (sessions), newest first. */
  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        ipAddress: true,
        userAgent: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
    const now = new Date();
    return sessions.map(({ revokedAt, expiresAt, ...session }) => ({
      ...session,
      active: !revokedAt && expiresAt > now,
    }));
  }

  /**
   * My photo: the one I uploaded, else my Google photo (if I signed in with
   * Google). `source` tells the UI whether "Remove" applies.
   */
  async getPhoto(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileImageId: true, googlePictureUrl: true },
    });
    const file = user?.profileImageId
      ? await this.prisma.fileObject.findUnique({
          where: { id: user.profileImageId },
        })
      : null;
    if (file) {
      const url = await this.storage.createViewUrl(
        file.bucket,
        file.objectKey,
        {
          fileName: file.originalName,
          contentType: file.mimeType,
        },
      );
      return { url, source: 'upload' as const };
    }
    if (user?.googlePictureUrl) {
      return { url: user.googlePictureUrl, source: 'google' as const };
    }
    return { url: null, source: null };
  }

  /** Edit my personal details (email, legal name and phone stay locked). */
  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const address =
      dto.state !== undefined || dto.country !== undefined
        ? await this.prisma.userAddress.findFirst({
            where: { userId },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        : null;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName:
            dto.lastName === undefined ? undefined : dto.lastName || null,
          gender: dto.gender,
          dateOfBirth:
            dto.dateOfBirth === undefined
              ? undefined
              : dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : null,
          whatsappNumber:
            dto.whatsappNumber === undefined
              ? undefined
              : dto.whatsappNumber
                ? normalizePhone(dto.whatsappNumber)
                : null,
        },
      }),
      ...(dto.state !== undefined || dto.country !== undefined
        ? [
            address
              ? this.prisma.userAddress.update({
                  where: { id: address.id },
                  data: { state: dto.state, country: dto.country },
                })
              : this.prisma.userAddress.create({
                  data: {
                    userId,
                    addressType: 'CURRENT',
                    isPrimary: true,
                    state: dto.state ?? null,
                    country: dto.country ?? 'India',
                  },
                }),
          ]
        : []),
    ]);
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        gender: true,
        dateOfBirth: true,
        whatsappNumber: true,
      },
    });
  }

  async setPhoto(userId: string, file?: UploadedDocument) {
    if (!file) throw new BadRequestException('Choose an image to upload.');
    assertPhoto(file);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileImageId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Validates the real file type (magic bytes) before storing it.
    const stored = await this.uploads.uploadDocument(file, {
      folder: `profile-images/${userId}`,
      uploadedById: userId,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImageId: stored.id },
    });
    if (user.profileImageId) {
      await this.uploads.deleteDocument(user.profileImageId).catch(() => null);
    }
    return this.getPhoto(userId);
  }

  async removePhoto(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileImageId: true },
    });
    if (user?.profileImageId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { profileImageId: null },
      });
      await this.uploads.deleteDocument(user.profileImageId).catch(() => null);
    }
    return this.getPhoto(userId);
  }
}
