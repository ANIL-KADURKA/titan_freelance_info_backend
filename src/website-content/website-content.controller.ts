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
import { WebsiteScreen } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto.js';
import { UpdateWebsiteContentDto } from './dto/update-website-content.dto.js';
import { WebsiteContentService } from './website-content.service.js';

@ApiTags('Website Content')
@Controller('website-content')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WebsiteContentController {
  constructor(private readonly websiteContentService: WebsiteContentService) {}

  @Get()
  @ApiOperation({ summary: 'List website content for all screens' })
  findAll() {
    return this.websiteContentService.findAll();
  }

  @Get(':screenKey')
  @ApiOperation({ summary: 'Get website content for a specific screen' })
  findByScreen(@Param('screenKey') screenKey: WebsiteScreen) {
    return this.websiteContentService.findByScreen(screenKey);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create website content for a screen' })
  create(
    @Body() dto: CreateWebsiteContentDto,
    @CurrentUser() user: { id?: string },
  ) {
    return this.websiteContentService.create(dto, user?.id);
  }

  @Patch(':screenKey')
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
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Delete website content for a screen' })
  remove(@Param('screenKey') screenKey: WebsiteScreen) {
    return this.websiteContentService.remove(screenKey);
  }
}
