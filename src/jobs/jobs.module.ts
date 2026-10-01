import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import {
  DraftJobResourcesController,
  JobResourcesController,
} from './job-resources.controller.js';
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
  ],
  providers: [JobsService, JobResourcesService],
  exports: [JobsService],
})
export class JobsModule {}
