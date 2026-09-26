import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { ApplicationsApiExceptionFilter } from './applications-api-exception.filter.js';
import { ApplicationsService } from './applications.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto.js';
import { CreateProfileFieldDto } from './dto/create-profile-field.dto.js';
import { ListApplicationsDto } from './dto/list-applications.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';
import { UpdateProfileValuesDto } from './dto/update-profile-values.dto.js';

type AuthenticatedUser = { id: string };

@ApiTags('Applications')
@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(ApplicationsApiExceptionFilter)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('me')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current candidate’s applications' })
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.applicationsService.findMine(user.id);
    return {
      success: true,
      message: 'Applications fetched successfully.',
      data,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List applications for recruitment management' })
  async findAll(@Query() query: ListApplicationsDto) {
    const data = await this.applicationsService.findAll(query);
    return {
      success: true,
      message: 'Applications fetched successfully.',
      data,
    };
  }

  @Get('profile')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current candidate’s reusable profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.applicationsService.findCandidateProfile(user.id);
    return {
      success: true,
      message: 'Candidate application profile fetched successfully.',
      data,
    };
  }

  @Patch('profile/values')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save reusable, non-sensitive profile answers' })
  async updateProfileValues(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileValuesDto,
  ) {
    const data = await this.applicationsService.updateCandidateProfileValues(
      user.id,
      dto.values,
    );
    return {
      success: true,
      message: 'Candidate profile values saved successfully.',
      data,
    };
  }

  @Delete('profile/values/:key')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a saved candidate profile answer' })
  async deleteProfileValue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ) {
    const result = await this.applicationsService.deleteCandidateProfileValue(
      user.id,
      key,
    );
    return { success: true, ...result };
  }

  @Get('profile-fields')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List canonical reusable candidate profile fields' })
  async findProfileFields() {
    const data = await this.applicationsService.findProfileFields();
    return {
      success: true,
      message: 'Candidate profile fields fetched successfully.',
      data,
    };
  }

  @Post('profile-fields')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a canonical candidate profile field' })
  async createProfileField(@Body() dto: CreateProfileFieldDto) {
    const data = await this.applicationsService.createProfileField(dto);
    return {
      success: true,
      message: 'Candidate profile field created successfully.',
      data,
    };
  }

  @Get('document-types')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active application document types' })
  async findDocumentTypes() {
    const data = await this.applicationsService.findDocumentTypes();
    return {
      success: true,
      message: 'Document types fetched successfully.',
      data,
    };
  }

  @Post('document-types')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an application document type' })
  async createDocumentType(@Body() dto: CreateDocumentTypeDto) {
    const data = await this.applicationsService.createDocumentType(dto);
    return {
      success: true,
      message: 'Document type created successfully.',
      data,
    };
  }

  @Get('prefill/:jobId')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get job application fields prefilled with reusable profile data',
  })
  async getPrefill(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.applicationsService.getPrefill(user.id, jobId);
    return {
      success: true,
      message: 'Application form prefill fetched successfully.',
      data,
    };
  }

  @Post('profile/documents/:documentTypeId')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document to the candidate profile library',
  })
  async uploadProfileDocument(
    @Param('documentTypeId') documentTypeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedDocument,
  ) {
    const data = await this.applicationsService.uploadCandidateProfileDocument(
      user.id,
      documentTypeId,
      file,
    );
    return {
      success: true,
      message: 'Candidate profile document uploaded successfully.',
      data,
    };
  }

  @Delete('profile/documents/:id')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove a document from the candidate profile library',
  })
  async deleteProfileDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result =
      await this.applicationsService.deleteCandidateProfileDocument(
        user.id,
        id,
      );
    return { success: true, ...result };
  }

  @Post()
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { files: 20, fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Apply to a job with field values and configured documents',
    description:
      'Send values as a JSON object in the values form field. Upload each file using its configured application fieldKey as the multipart field name.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
    @UploadedFiles() files: UploadedDocument[] = [],
  ) {
    const result = await this.applicationsService.create(user.id, dto, files);
    return {
      success: true,
      message: result.alreadyApplied
        ? 'An application for this job already exists; the existing application was returned.'
        : 'Application submitted successfully.',
      alreadyApplied: result.alreadyApplied,
      data: result.data,
    };
  }

  @Get(':id')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an application by id' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.applicationsService.findOne(id, user.id);
    return {
      success: true,
      message: 'Application fetched successfully.',
      data,
    };
  }

  @Patch(':id')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the cover note or application field values',
  })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDto,
  ) {
    const data = await this.applicationsService.update(id, user.id, dto);
    return {
      success: true,
      message: 'Application updated successfully.',
      data,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change application status and append history' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const data = await this.applicationsService.updateStatus(id, user.id, dto);
    return {
      success: true,
      message: 'Application status updated successfully.',
      data,
    };
  }

  @Post(':id/documents/:fieldKey')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload or replace a configured application document',
  })
  async uploadDocument(
    @Param('id') id: string,
    @Param('fieldKey') fieldKey: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedDocument,
  ) {
    const data = await this.applicationsService.uploadDocument(
      id,
      user.id,
      fieldKey,
      file,
    );
    return {
      success: true,
      message: 'Application document uploaded successfully.',
      data,
    };
  }

  @Post(':id/documents/:fieldKey/save-to-profile')
  @Roles(UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Explicitly save an application document for reuse on future applications',
  })
  async saveApplicationDocumentToProfile(
    @Param('id') id: string,
    @Param('fieldKey') fieldKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data =
      await this.applicationsService.saveApplicationDocumentToProfile(
        id,
        user.id,
        fieldKey,
      );
    return {
      success: true,
      message: 'Application document saved to your profile for future reuse.',
      data,
    };
  }

  @Delete(':id/soft-delete')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete an application' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.applicationsService.softDelete(id, user.id);
    return { success: true, ...result };
  }

  @Delete(':id/hard-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete an application and its uploads',
  })
  async hardDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.applicationsService.hardDelete(id, user.id);
    return { success: true, ...result };
  }
}
