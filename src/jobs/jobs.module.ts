import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { PublicJobsController } from './public-jobs.controller.js';

@Module({
  controllers: [JobsController, PublicJobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
