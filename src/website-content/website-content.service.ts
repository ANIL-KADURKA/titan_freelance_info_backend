import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type FileObject,
  Prisma,
  type WebsiteContent,
  WebsiteScreen,
} from '@prisma/client';
import { CloudinaryService } from '../common/cloudinary.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { PHOTO_TYPES } from '../common/photo-rules.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto.js';
import { UpdateWebsiteContentDto } from './dto/update-website-content.dto.js';

/**
 * Content keys that hold images as { slot: image }. An image is a Cloudinary
 * URL (new uploads) or, for older uploads, an S3 file id. Reads add a
 * matching `<key>Urls` map with a ready-to-use URL for every slot.
 * HOME.pipelineImages: landing "Inside one application" stage photos,
 * keyed by stage number ("01"–"05").
 */
const IMAGE_MAP_KEYS = ['pipelineImages'] as const;

type ImageMap = Record<string, string>;

const isUrl = (value: string) => value.startsWith('https://');

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function imageMap(value: unknown): ImageMap {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

@Injectable()
export class WebsiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly storage: S3StorageService,
  ) {}

  /** Uploads a website image to Cloudinary; the admin saves the URL. */
  async uploadImage(file: UploadedDocument | undefined) {
    if (!file) {
      throw new BadRequestException('Choose an image to upload.');
    }
    return { url: await this.cloudinary.uploadImage(file, 'website') };
  }

  private viewUrl(file: FileObject) {
    return this.storage.createViewUrl(file.bucket, file.objectKey, {
      fileName: file.originalName,
      contentType: file.mimeType,
    });
  }

  /** Adds `<key>Urls` next to every image map in the content. */
  private async withImageUrls(record: WebsiteContent) {
    const content = asRecord(record.content);
    if (!content) return record;
    const maps = IMAGE_MAP_KEYS.map(
      (key) => [key, imageMap(content[key])] as const,
    );
    // Older uploads are S3 file ids: resolve them to view URLs.
    const ids = maps.flatMap(([, map]) =>
      Object.values(map).filter((value) => !isUrl(value)),
    );
    const files = ids.length
      ? await this.prisma.fileObject.findMany({
          where: { id: { in: ids }, deletedAt: null },
        })
      : [];
    const urlById = new Map(
      await Promise.all(
        files.map(async (file) => [file.id, await this.viewUrl(file)] as const),
      ),
    );
    const resolve = (value: string) =>
      isUrl(value) ? value : urlById.get(value);
    const extra = Object.fromEntries(
      maps.map(([key, map]) => [
        `${key}Urls`,
        Object.fromEntries(
          Object.entries(map)
            .map(([slot, value]) => [slot, resolve(value)] as const)
            .filter((entry): entry is readonly [string, string] =>
              Boolean(entry[1]),
            ),
        ),
      ]),
    );
    return { ...record, content: { ...content, ...extra } };
  }

  /** Images must be our Cloudinary uploads (or older live S3 image files). */
  private async assertImages(content: unknown) {
    const record = asRecord(content);
    if (!record) return;
    const values = IMAGE_MAP_KEYS.flatMap((key) =>
      Object.values(imageMap(record[key])),
    );
    const urls = values.filter(isUrl);
    if (urls.some((url) => !this.cloudinary.isOwnImageUrl(url))) {
      throw new BadRequestException('Upload the image again, then save.');
    }
    const ids = [...new Set(values.filter((value) => !isUrl(value)))];
    if (!ids.length) return;
    const count = await this.prisma.fileObject.count({
      where: {
        id: { in: ids },
        deletedAt: null,
        mimeType: { in: PHOTO_TYPES },
      },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Upload the image again, then save.');
    }
  }

  /** Drops the derived `<key>Urls` maps so they're never stored. */
  private stripDerived(content: unknown) {
    const record = asRecord(content);
    if (!record) return content;
    const copy = { ...record };
    for (const key of IMAGE_MAP_KEYS) delete copy[`${key}Urls`];
    return copy;
  }

  async findAll() {
    return this.prisma.websiteContent.findMany({
      orderBy: { screenKey: 'asc' },
    });
  }

  async findByScreen(screenKey: WebsiteScreen) {
    return this.withImageUrls(await this.findRecord(screenKey));
  }

  private async findRecord(screenKey: WebsiteScreen) {
    const websiteContent = await this.prisma.websiteContent.findUnique({
      where: { screenKey },
    });

    if (!websiteContent) {
      throw new NotFoundException(`Website content for ${screenKey} not found`);
    }

    return websiteContent;
  }

  async create(dto: CreateWebsiteContentDto, updatedBy?: string) {
    const existing = await this.prisma.websiteContent.findUnique({
      where: { screenKey: dto.screenKey },
    });

    if (existing) {
      throw new BadRequestException(
        `Website content for ${dto.screenKey} already exists`,
      );
    }

    await this.assertImages(dto.content);
    const created = await this.prisma.websiteContent.create({
      data: {
        screenKey: dto.screenKey,
        content: this.stripDerived(dto.content) as Prisma.InputJsonValue,
        updatedBy: updatedBy ?? null,
      },
    });
    return this.withImageUrls(created);
  }

  async update(
    screenKey: WebsiteScreen,
    dto: UpdateWebsiteContentDto,
    updatedBy?: string,
  ) {
    await this.findRecord(screenKey);
    if (dto.content !== undefined) await this.assertImages(dto.content);

    const updated = await this.prisma.websiteContent.update({
      where: { screenKey },
      data: {
        ...(dto.screenKey !== undefined ? { screenKey: dto.screenKey } : {}),
        ...(dto.content !== undefined
          ? {
              content: this.stripDerived(dto.content) as Prisma.InputJsonValue,
              version: { increment: 1 },
            }
          : {}),
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
    });
    return this.withImageUrls(updated);
  }

  async remove(screenKey: WebsiteScreen) {
    await this.findRecord(screenKey);

    await this.prisma.websiteContent.delete({
      where: { screenKey },
    });

    return { message: 'Website content deleted successfully' };
  }
}
