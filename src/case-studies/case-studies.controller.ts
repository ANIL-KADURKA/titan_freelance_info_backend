import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { CaseStudiesService } from './case-studies.service.js';
import {
  CaseStudyDto,
  CaseStudyStatsQueryDto,
  UpdateCaseStudyDto,
} from './dto/case-study.dto.js';

type AuthenticatedUser = { id: string };

@ApiTags('Case studies')
@Controller('public/case-studies')
export class PublicCaseStudiesController {
  constructor(private readonly caseStudies: CaseStudiesService) {}

  @Get()
  @ApiOperation({ summary: 'Public: published case studies' })
  list() {
    return this.caseStudies.listPublished();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public: one published case study' })
  findBySlug(@Param('slug') slug: string) {
    return this.caseStudies.findPublishedBySlug(slug);
  }
}

@ApiTags('Case studies')
@ApiBearerAuth()
@Controller('case-studies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CaseStudiesController {
  constructor(private readonly caseStudies: CaseStudiesService) {}

  @Get()
  @ApiOperation({ summary: 'All case studies (drafts too)' })
  list() {
    return this.caseStudies.list();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Suggested name, role, duration and earnings' })
  stats(@Query() query: CaseStudyStatsQueryDto) {
    return this.caseStudies.stats(query.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One case study' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.caseStudies.findOne(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a case study' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CaseStudyDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.caseStudies.create(user.id, dto, file);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Edit, publish or unpublish a case study' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseStudyDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.caseStudies.update(user.id, id, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a case study' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.caseStudies.remove(id);
  }
}
