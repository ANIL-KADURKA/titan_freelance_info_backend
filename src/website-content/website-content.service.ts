import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WebsiteScreen } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto.js';
import { UpdateWebsiteContentDto } from './dto/update-website-content.dto.js';

@Injectable()
export class WebsiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.websiteContent.findMany({
      orderBy: { screenKey: 'asc' },
    });
  }

  async findByScreen(screenKey: WebsiteScreen) {
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

    return this.prisma.websiteContent.create({
      data: {
        screenKey: dto.screenKey,
        content: dto.content as Prisma.InputJsonValue,
        updatedBy: updatedBy ?? null,
      },
    });
  }

  async update(
    screenKey: WebsiteScreen,
    dto: UpdateWebsiteContentDto,
    updatedBy?: string,
  ) {
    await this.findByScreen(screenKey);

    return this.prisma.websiteContent.update({
      where: { screenKey },
      data: {
        ...(dto.screenKey !== undefined ? { screenKey: dto.screenKey } : {}),
        ...(dto.content !== undefined
          ? {
              content: dto.content as Prisma.InputJsonValue,
              version: { increment: 1 },
            }
          : {}),
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
    });
  }

  async remove(screenKey: WebsiteScreen) {
    await this.findByScreen(screenKey);

    await this.prisma.websiteContent.delete({
      where: { screenKey },
    });

    return { message: 'Website content deleted successfully' };
  }
}
