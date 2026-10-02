import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { assertPhoto } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  async getPhoto(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileImageId: true },
    });
    if (!user?.profileImageId) return { url: null };
    const file = await this.prisma.fileObject.findUnique({
      where: { id: user.profileImageId },
    });
    if (!file) return { url: null };
    const url = await this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
    return { url };
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
    return { url: null };
  }
}
