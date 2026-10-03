import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PreApplyDto } from './dto/pre-apply.dto.js';
import { JobPreApplicationsService } from './job-pre-applications.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Jobs')
@Controller('public/upcoming-jobs')
export class PublicUpcomingJobsController {
  constructor(private readonly preApplications: JobPreApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Public: upcoming projects open for pre-applying' })
  list() {
    return this.preApplications.listUpcoming();
  }
}

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('job-pre-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobPreApplicationsController {
  constructor(private readonly preApplications: JobPreApplicationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Upcoming projects I pre-applied to' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.preApplications.mine(user.id);
  }

  @Post(':jobId')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Pre-apply to an upcoming project' })
  preApply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: PreApplyDto,
  ) {
    return this.preApplications.preApply(user.id, jobId, dto.location);
  }

  @Delete(':jobId')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Withdraw a pre-application' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.preApplications.withdraw(user.id, jobId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Admin: all pre-applications (optional ?jobId=)' })
  listAll(
    @Query('jobId', new ParseUUIDPipe({ optional: true })) jobId?: string,
  ) {
    return this.preApplications.listAll(jobId);
  }

  @Get('job/:jobId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Admin: who pre-applied to a project' })
  listForJob(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.preApplications.listForJob(jobId);
  }
}
