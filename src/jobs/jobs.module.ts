import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import {
  DraftJobResourcesController,
  JobResourcesController,
} from './job-resources.controller.js';
import {
  JobPreApplicationsController,
  PublicUpcomingJobsController,
} from './job-pre-applications.controller.js';
import { JobPreApplicationsService } from './job-pre-applications.service.js';
import { JobResourcesService } from './job-resources.service.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { PublicJobsController } from './public-jobs.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [
    JobsController,
    PublicJobsController,
    JobResourcesController,
    DraftJobResourcesController,
    PublicUpcomingJobsController,
    JobPreApplicationsController,
  ],
  providers: [JobsService, JobResourcesService, JobPreApplicationsService],
  exports: [JobsService],
})
export class JobsModule {}
