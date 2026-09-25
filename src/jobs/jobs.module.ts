import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { PublicJobsController } from './public-jobs.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [JobsController, PublicJobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
