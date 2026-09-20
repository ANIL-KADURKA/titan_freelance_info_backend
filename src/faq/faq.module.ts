import { Module } from '@nestjs/common';
import { FaqController } from './faq.controller.js';
import { FaqService } from './faq.service.js';

@Module({
  controllers: [FaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
