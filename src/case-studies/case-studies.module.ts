import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import {
  CaseStudiesController,
  PublicCaseStudiesController,
} from './case-studies.controller.js';
import { CaseStudiesService } from './case-studies.service.js';

@Module({
  imports: [CommonModule],
  controllers: [PublicCaseStudiesController, CaseStudiesController],
  providers: [CaseStudiesService],
})
export class CaseStudiesModule {}
