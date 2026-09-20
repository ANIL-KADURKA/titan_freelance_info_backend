import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateFaqCategoryDto } from './dto/create-faq-category.dto.js';
import { UpdateFaqCategoryDto } from './dto/update-faq-category.dto.js';
import { CreateFaqDto } from './dto/create-faq.dto.js';
import { UpdateFaqDto } from './dto/update-faq.dto.js';
import { FaqService } from './faq.service.js';

@ApiTags('FAQs')
@Controller('faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all FAQ categories' })
  getCategories() {
    return this.faqService.findAllCategories();
  }

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a FAQ category' })
  createCategory(@Body() dto: CreateFaqCategoryDto) {
    return this.faqService.createCategory(dto);
  }

  @Get('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a FAQ category by id' })
  getCategory(@Param('id') id: string) {
    return this.faqService.findCategoryById(id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a FAQ category' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateFaqCategoryDto) {
    return this.faqService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a FAQ category' })
  deleteCategory(@Param('id') id: string) {
    return this.faqService.deleteCategory(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all FAQs' })
  findAllFaqs() {
    return this.faqService.findAllFaqs();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a FAQ by id' })
  findFaqById(@Param('id') id: string) {
    return this.faqService.findFaqById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new FAQ' })
  createFaq(@Body() dto: CreateFaqDto) {
    return this.faqService.createFaq(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a FAQ' })
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.updateFaq(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a FAQ' })
  deleteFaq(@Param('id') id: string) {
    return this.faqService.deleteFaq(id);
  }
}
