import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  CreateJobResourceDto,
  CreateResourceUploadDto,
  DiscardDraftUploadsDto,
  ReorderJobResourcesDto,
  UpdateJobResourceDto,
} from './dto/job-resource.dto.js';
import { JobResourcesService } from './job-resources.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Job resources')
@ApiBearerAuth()
@Controller('jobs/:jobId/resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobResourcesController {
  constructor(private readonly resourcesService: JobResourcesService) {}

  @Get()
  @ApiOperation({
    summary: 'Resources of a live job, with short-lived view URLs (any user)',
  })
  list(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.resourcesService.listForCandidate(jobId);
  }

  @Get('manage')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'All resources of a job, for admins (any status)' })
  listForAdmin(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.resourcesService.listForAdmin(jobId);
  }

  @Post('upload-url')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Get a presigned URL to upload a file to S3' })
  createUploadUrl(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateResourceUploadDto,
  ) {
    return this.resourcesService.createUploadUrl(jobId, dto);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Save an uploaded file or a URL as a resource' })
  async create(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateJobResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.resourcesService.create(jobId, dto, user.id);
    return { success: true, message: 'Resource added.', data };
  }

  @Patch('reorder')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Set the display order of all resources' })
  reorder(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: ReorderJobResourcesDto,
  ) {
    return this.resourcesService.reorder(jobId, dto);
  }

  @Patch(':resourceId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update title, description, required or URL' })
  async update(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpdateJobResourceDto,
  ) {
    const data = await this.resourcesService.update(jobId, resourceId, dto);
    return { success: true, message: 'Resource updated.', data };
  }

  @Delete(':resourceId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Delete a resource and its stored file' })
  remove(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.resourcesService.remove(jobId, resourceId);
  }
}

/** Uploads made before the job exists (create-job wizard). */
@ApiTags('Job resources')
@ApiBearerAuth()
@Controller('job-resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DraftJobResourcesController {
  constructor(private readonly resourcesService: JobResourcesService) {}

  @Post('upload-url')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({
    summary:
      'Presigned upload URL for a resource of a job that is about to be created',
  })
  createUploadUrl(
    @Body() dto: CreateResourceUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resourcesService.createDraftUploadUrl(user.id, dto);
  }

  @Post('discard')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({
    summary:
      'Delete staged uploads of a job that was not created (only your own drafts)',
  })
  async discard(
    @Body() dto: DiscardDraftUploadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.resourcesService.discardDraftUploads(
      user.id,
      dto.objectKeys.map((objectKey) => ({ objectKey })),
    );
    return { success: true };
  }
}
