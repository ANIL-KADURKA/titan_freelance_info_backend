import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublishStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';

type UploadedFileLike = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsDocumentUploadService: AwsDocumentUploadService,
  ) {}

  private assertValidUuid(id: string, label: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      throw new BadRequestException(`Invalid ${label} id format`);
    }
  }

  async findAll() {
    return this.prisma.testimonial.findMany({
      where: { deletedAt: null },
      include: { photo: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    this.assertValidUuid(id, 'testimonial');

    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id, deletedAt: null },
      include: { photo: true },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return testimonial;
  }

  async create(dto: CreateTestimonialDto, file?: UploadedFileLike) {
    if (!dto.authorName?.trim()) {
      throw new BadRequestException('Author name is required');
    }

    if (!dto.quote?.trim()) {
      throw new BadRequestException('Quote is required');
    }

    const payload: Prisma.TestimonialCreateInput = {
      authorName: dto.authorName.trim(),
      authorRole: dto.authorRole?.trim() || null,
      quote: dto.quote.trim(),
      joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : null,
      status: dto.status ?? PublishStatus.DRAFT,
      sortOrder: dto.sortOrder ?? 0,
    };

    if (file) {
      const uploadedFile = await this.awsDocumentUploadService.uploadDocument(
        file,
        {
          folder: 'testimonials',
          visibility: 'PRIVATE',
        },
      );

      payload.photo = {
        connect: { id: uploadedFile.id },
      };
    }

    return this.prisma.testimonial.create({
      data: payload,
      include: { photo: true },
    });
  }

  async update(id: string, dto: UpdateTestimonialDto, file?: UploadedFileLike) {
    this.assertValidUuid(id, 'testimonial');

    const existing = await this.prisma.testimonial.findFirst({
      where: { id, deletedAt: null },
      include: { photo: true },
    });

    if (!existing) {
      throw new NotFoundException('Testimonial not found');
    }

    const nextData: Prisma.TestimonialUpdateInput = {
      authorName: dto.authorName?.trim() ?? existing.authorName,
      authorRole:
        dto.authorRole !== undefined
          ? dto.authorRole?.trim() || null
          : existing.authorRole,
      quote: dto.quote?.trim() ?? existing.quote,
      joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : existing.joinedAt,
      status: dto.status ?? existing.status,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
    };

    if (file) {
      const uploadedFile = await this.awsDocumentUploadService.uploadDocument(
        file,
        {
          folder: 'testimonials',
          visibility: 'PRIVATE',
        },
      );

      nextData.photo = {
        connect: { id: uploadedFile.id },
      };
    }

    return this.prisma.testimonial.update({
      where: { id },
      data: nextData,
      include: { photo: true },
    });
  }

  async delete(id: string) {
    this.assertValidUuid(id, 'testimonial');

    const existing = await this.prisma.testimonial.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Testimonial not found');
    }

    await this.prisma.testimonial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Testimonial deleted successfully' };
  }
}
