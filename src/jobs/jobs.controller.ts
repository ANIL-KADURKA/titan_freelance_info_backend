import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateJobApplicationFieldDto } from './dto/create-job-application-field.dto.js';
import { CreateJobCategoryDto } from './dto/create-job-category.dto.js';
import { CreateJobEligibilityRuleDto } from './dto/create-job-eligibility-rule.dto.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { SearchJobsDto } from './dto/search-jobs.dto.js';
import { UpdateJobApplicationFieldDto } from './dto/update-job-application-field.dto.js';
import { UpdateJobCategoryDto } from './dto/update-job-category.dto.js';
import { UpdateJobEligibilityRuleDto } from './dto/update-job-eligibility-rule.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsApiExceptionFilter } from './jobs-api-exception.filter.js';
import { JobsService } from './jobs.service.js';

@ApiTags('Jobs')
@Controller('jobs')
@UseFilters(JobsApiExceptionFilter)
@UseGuards(OptionalJwtAuthGuard, RolesGuard)
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
  async createCategory(@Body() dto: CreateJobCategoryDto) {
    const data = await this.jobsService.createCategory(dto);
    return {
      success: true,
      message: 'Job category created successfully.',
      data,
    };
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
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateJobCategoryDto,
  ) {
    const data = await this.jobsService.updateCategory(id, dto);
    return {
      success: true,
      message: 'Job category updated successfully.',
      data,
    };
  }

  @Delete('categories/:id/soft-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft delete a job category and deactivate related jobs',
  })
  async softDeleteCategory(@Param('id') id: string) {
    const result = await this.jobsService.softDeleteCategory(id);
    return { success: true, ...result };
  }

  @Delete('categories/:id/hard-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Hard delete a job category and all associated jobs and fields',
  })
  async hardDeleteCategory(@Param('id') id: string) {
    const result = await this.jobsService.hardDeleteCategory(id);
    return { success: true, ...result };
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a job category (alias)' })
  async deleteCategory(@Param('id') id: string) {
    const result = await this.jobsService.deleteCategory(id);
    return { success: true, ...result };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all jobs' })
  findAllJobs() {
    return this.jobsService.findAllJobs();
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search jobs for admin and recruiter screens' })
  searchJobs(@Query() query: SearchJobsDto) {
    return this.jobsService.searchJobs(query, 'admin');
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Fetch a job by id' })
  findJobById(@Param('id') id: string, @CurrentUser() user: { id?: string }) {
    return this.jobsService.findJobByIdForUser(id, user?.id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job' })
  async createJob(
    @Body() dto: CreateJobDto,
    @CurrentUser() user: { id?: string },
  ) {
    const data = await this.jobsService.createJob(dto, user?.id);
    return { success: true, message: 'Job created successfully.', data };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update only job publishing status' })
  async updateJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    const data = await this.jobsService.updateJobStatus(id, dto.status);
    return { success: true, message: 'Job status updated successfully.', data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job' })
  async updateJob(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    const data = await this.jobsService.updateJob(id, dto);
    return { success: true, message: 'Job updated successfully.', data };
  }

  @Delete(':id/soft-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft delete a job and related application/eligibility rows',
  })
  async softDeleteJob(@Param('id') id: string) {
    const result = await this.jobsService.softDeleteJob(id);
    return { success: true, ...result };
  }

  @Delete(':id/hard-delete')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hard delete a job and all related child rows' })
  async hardDeleteJob(@Param('id') id: string) {
    const result = await this.jobsService.hardDeleteJob(id);
    return { success: true, ...result };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a job (alias)' })
  async deleteJob(@Param('id') id: string) {
    const result = await this.jobsService.deleteJob(id);
    return { success: true, ...result };
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
