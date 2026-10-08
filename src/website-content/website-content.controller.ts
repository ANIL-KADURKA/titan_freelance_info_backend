import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WebsiteScreen } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto.js';
import { UpdateWebsiteContentDto } from './dto/update-website-content.dto.js';
import { WebsiteContentService } from './website-content.service.js';

// Guards are per route: reading a single screen is public so the marketing
// pages (e.g. About Us) can load it for logged-out visitors.
@ApiTags('Website Content')
@Controller('website-content')
export class WebsiteContentController {
  constructor(private readonly websiteContentService: WebsiteContentService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List website content for all screens' })
  findAll() {
    return this.websiteContentService.findAll();
  }

  @Get(':screenKey')
  @ApiOperation({ summary: 'Public: get website content for a screen' })
  findByScreen(
    @Param('screenKey', new ParseEnumPipe(WebsiteScreen))
    screenKey: WebsiteScreen,
  ) {
    return this.websiteContentService.findByScreen(screenKey);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a website image; save its id in the screen content',
  })
  uploadImage(
    @UploadedFile() file: UploadedDocument | undefined,
    @CurrentUser() user: { id?: string },
  ) {
    return this.websiteContentService.uploadImage(file, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create website content for a screen' })
  create(
    @Body() dto: CreateWebsiteContentDto,
    @CurrentUser() user: { id?: string },
  ) {
    return this.websiteContentService.create(dto, user?.id);
  }

  @Patch(':screenKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update website content for a screen' })
  update(
    @Param('screenKey') screenKey: WebsiteScreen,
    @Body() dto: UpdateWebsiteContentDto,
    @CurrentUser() user: { id?: string },
  ) {
    return this.websiteContentService.update(screenKey, dto, user?.id);
  }

  @Delete(':screenKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Delete website content for a screen' })
  remove(@Param('screenKey') screenKey: WebsiteScreen) {
    return this.websiteContentService.remove(screenKey);
  }
}
