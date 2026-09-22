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
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateJobApplicationFieldDto } from './dto/create-job-application-field.dto.js';
import { CreateJobCategoryDto } from './dto/create-job-category.dto.js';
import { CreateJobEligibilityRuleDto } from './dto/create-job-eligibility-rule.dto.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobApplicationFieldDto } from './dto/update-job-application-field.dto.js';
import { UpdateJobCategoryDto } from './dto/update-job-category.dto.js';
import { UpdateJobEligibilityRuleDto } from './dto/update-job-eligibility-rule.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all job categories' })
  findAllCategories() {
    return this.jobsService.findAllCategories();
  }

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job category' })
  createCategory(@Body() dto: CreateJobCategoryDto) {
    return this.jobsService.createCategory(dto);
  }

  @Get('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch a job category by id' })
  findCategoryById(@Param('id') id: string) {
    return this.jobsService.findCategoryById(id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job category' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateJobCategoryDto) {
    return this.jobsService.updateCategory(id, dto);
  }

  @Delete('categories/:id/soft-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft delete a job category and deactivate related jobs',
  })
  softDeleteCategory(@Param('id') id: string) {
    return this.jobsService.softDeleteCategory(id);
  }

  @Delete('categories/:id/hard-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Hard delete a job category and all associated jobs and fields',
  })
  hardDeleteCategory(@Param('id') id: string) {
    return this.jobsService.hardDeleteCategory(id);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a job category (alias)' })
  deleteCategory(@Param('id') id: string) {
    return this.jobsService.deleteCategory(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all jobs' })
  findAllJobs() {
    return this.jobsService.findAllJobs();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch a job by id' })
  findJobById(@Param('id') id: string) {
    return this.jobsService.findJobById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job' })
  createJob(@Body() dto: CreateJobDto, @CurrentUser() user: { id?: string }) {
    return this.jobsService.createJob(dto, user?.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update only job publishing status' })
  updateJobStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.jobsService.updateJobStatus(id, dto.status);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job' })
  updateJob(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.updateJob(id, dto);
  }

  @Delete(':id/soft-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft delete a job and related application/eligibility rows',
  })
  softDeleteJob(@Param('id') id: string) {
    return this.jobsService.softDeleteJob(id);
  }

  @Delete(':id/hard-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hard delete a job and all related child rows' })
  hardDeleteJob(@Param('id') id: string) {
    return this.jobsService.hardDeleteJob(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a job (alias)' })
  deleteJob(@Param('id') id: string) {
    return this.jobsService.deleteJob(id);
  }

  @Get(':jobId/application-fields')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List application fields for a job' })
  findApplicationFields(@Param('jobId') jobId: string) {
    return this.jobsService.findJobApplicationFields(jobId);
  }

  @Post(':jobId/application-fields')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create application field for a job' })
  createApplicationField(
    @Param('jobId') jobId: string,
    @Body() dto: CreateJobApplicationFieldDto,
  ) {
    return this.jobsService.createApplicationFieldForJob(jobId, dto);
  }

  @Patch(':jobId/application-fields/:fieldId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an application field for a job' })
  updateApplicationField(
    @Param('jobId') jobId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateJobApplicationFieldDto,
  ) {
    return this.jobsService.updateApplicationFieldForJob(jobId, fieldId, dto);
  }

  @Delete(':jobId/application-fields/:fieldId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an application field for a job' })
  deleteApplicationField(
    @Param('jobId') jobId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.jobsService.deleteApplicationFieldForJob(jobId, fieldId);
  }

  @Get(':jobId/eligibility-rules')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List eligibility rules for a job' })
  findEligibilityRules(@Param('jobId') jobId: string) {
    return this.jobsService.findJobEligibilityRules(jobId);
  }

  @Post(':jobId/eligibility-rules')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an eligibility rule for a job' })
  createEligibilityRule(
    @Param('jobId') jobId: string,
    @Body() dto: CreateJobEligibilityRuleDto,
  ) {
    return this.jobsService.createEligibilityRuleForJob(jobId, dto);
  }

  @Patch(':jobId/eligibility-rules/:ruleId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an eligibility rule for a job' })
  updateEligibilityRule(
    @Param('jobId') jobId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateJobEligibilityRuleDto,
  ) {
    return this.jobsService.updateEligibilityRuleForJob(jobId, ruleId, dto);
  }

  @Delete(':jobId/eligibility-rules/:ruleId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an eligibility rule for a job' })
  deleteEligibilityRule(
    @Param('jobId') jobId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.jobsService.deleteEligibilityRuleForJob(jobId, ruleId);
  }
}
