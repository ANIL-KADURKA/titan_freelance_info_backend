import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublishStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFaqCategoryDto } from './dto/create-faq-category.dto.js';
import { UpdateFaqCategoryDto } from './dto/update-faq-category.dto.js';
import { CreateFaqDto } from './dto/create-faq.dto.js';
import { UpdateFaqDto } from './dto/update-faq.dto.js';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}
  private assertValidUuid(id: string, label: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      throw new BadRequestException(`Invalid ${label} id format`);
    }
  }

  async findAllCategories() {
    return this.prisma.faqCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findCategoryById(id: string) {
    this.assertValidUuid(id, 'FAQ category');

    const category = await this.prisma.faqCategory.findFirst({
      where: { id, deletedAt: null },
      include: { faqs: true },
    });

    if (!category) {
      throw new NotFoundException('FAQ category not found');
    }

    return category;
  }

  async createCategory(dto: CreateFaqCategoryDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const normalizedDescription = dto.description?.trim() || null;
    const existingCategory = await this.prisma.faqCategory.findFirst({
      where: {
        deletedAt: null,
        AND: [
          { name: { equals: name, mode: 'insensitive' } },
          {
            description: normalizedDescription
              ? { equals: normalizedDescription, mode: 'insensitive' }
              : null,
          },
        ],
      },
    });

    if (existingCategory) {
      throw new BadRequestException('FAQ category already exists');
    }

    return this.prisma.faqCategory.create({
      data: {
        name,
        description: normalizedDescription,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? PublishStatus.DRAFT,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateFaqCategoryDto) {
    this.assertValidUuid(id, 'FAQ category');

    const existingCategory = await this.prisma.faqCategory.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingCategory) {
      throw new NotFoundException('FAQ category not found');
    }

    const nextName = dto.name?.trim() ?? existingCategory.name;
    const nextDescription =
      dto.description !== undefined
        ? dto.description?.trim() || null
        : existingCategory.description;

    const duplicateCategory = await this.prisma.faqCategory.findFirst({
      where: {
        deletedAt: null,
        id: { not: id },
        AND: [
          { name: { equals: nextName, mode: 'insensitive' } },
          {
            description: nextDescription
              ? { equals: nextDescription, mode: 'insensitive' }
              : null,
          },
        ],
      },
    });

    if (duplicateCategory) {
      throw new BadRequestException('FAQ category already exists');
    }

    return this.prisma.faqCategory.update({
      where: { id },
      data: {
        name: nextName,
        description: nextDescription,
        sortOrder: dto.sortOrder ?? existingCategory.sortOrder,
        status: dto.status ?? existingCategory.status,
      },
    });
  }

  async deleteCategory(id: string) {
    this.assertValidUuid(id, 'FAQ category');

    const category = await this.prisma.faqCategory.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('FAQ category not found');
    }

    await this.prisma.faqCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'FAQ category deleted successfully' };
  }

  async findAllFaqs() {
    return this.prisma.faq.findMany({
      where: { deletedAt: null },
      include: { faqCategory: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findFaqById(id: string) {
    this.assertValidUuid(id, 'FAQ');

    const faq = await this.prisma.faq.findFirst({
      where: { id, deletedAt: null },
      include: { faqCategory: true },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return faq;
  }

  async createFaq(dto: CreateFaqDto) {
    if (!dto.question?.trim()) {
      throw new BadRequestException('Question is required');
    }

    if (!dto.answer?.trim()) {
      throw new BadRequestException('Answer is required');
    }

    const question = dto.question.trim();
    const answer = dto.answer.trim();
    const category = dto.category?.trim() || null;

    if (dto.faqCategoryId) {
      this.assertValidUuid(dto.faqCategoryId, 'FAQ category');

      const categoryRecord = await this.prisma.faqCategory.findFirst({
        where: { id: dto.faqCategoryId, deletedAt: null },
      });

      if (!categoryRecord) {
        throw new BadRequestException('FAQ category not found');
      }
    }

    const existingFaq = await this.prisma.faq.findFirst({
      where: {
        deletedAt: null,
        AND: [
          { question: { equals: question, mode: 'insensitive' } },
          { answer: { equals: answer, mode: 'insensitive' } },
          {
            category: category
              ? { equals: category, mode: 'insensitive' }
              : null,
          },
        ],
      },
    });

    if (existingFaq) {
      throw new BadRequestException('FAQ already exists');
    }

    const data: Prisma.FaqCreateInput = {
      question,
      answer,
      category,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status ?? PublishStatus.DRAFT,
      faqCategory: dto.faqCategoryId
        ? { connect: { id: dto.faqCategoryId } }
        : undefined,
    };

    return this.prisma.faq.create({
      data,
      include: { faqCategory: true },
    });
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    this.assertValidUuid(id, 'FAQ');

    const faq = await this.prisma.faq.findFirst({
      where: { id, deletedAt: null },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    if (dto.faqCategoryId) {
      this.assertValidUuid(dto.faqCategoryId, 'FAQ category');

      const category = await this.prisma.faqCategory.findFirst({
        where: { id: dto.faqCategoryId, deletedAt: null },
      });

      if (!category) {
        throw new BadRequestException('FAQ category not found');
      }
    }

    const nextQuestion =
      dto.question !== undefined ? dto.question.trim() : faq.question;
    const nextAnswer =
      dto.answer !== undefined ? dto.answer.trim() : faq.answer;
    const nextCategory =
      dto.category !== undefined ? dto.category?.trim() || null : faq.category;

    const duplicateFaq = await this.prisma.faq.findFirst({
      where: {
        deletedAt: null,
        id: { not: id },
        AND: [
          { question: { equals: nextQuestion, mode: 'insensitive' } },
          { answer: { equals: nextAnswer, mode: 'insensitive' } },
          {
            category: nextCategory
              ? { equals: nextCategory, mode: 'insensitive' }
              : null,
          },
        ],
      },
    });

    if (duplicateFaq) {
      throw new BadRequestException('FAQ already exists');
    }

    const data: Prisma.FaqUpdateInput = {
      question: dto.question !== undefined ? dto.question.trim() : undefined,
      answer: dto.answer !== undefined ? dto.answer.trim() : undefined,
      category:
        dto.category !== undefined ? dto.category?.trim() || null : undefined,
      sortOrder: dto.sortOrder ?? undefined,
      status: dto.status ?? undefined,
      faqCategory: dto.faqCategoryId
        ? { connect: { id: dto.faqCategoryId } }
        : undefined,
    };

    return this.prisma.faq.update({
      where: { id },
      data,
      include: { faqCategory: true },
    });
  }

  async deleteFaq(id: string) {
    this.assertValidUuid(id, 'FAQ');

    const faq = await this.prisma.faq.findFirst({
      where: { id, deletedAt: null },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    await this.prisma.faq.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'FAQ deleted successfully' };
  }
}
