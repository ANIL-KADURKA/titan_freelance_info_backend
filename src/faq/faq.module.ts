import { Module } from '@nestjs/common';
import { FaqController } from './faq.controller.js';
import { FaqService } from './faq.service.js';
import { PublicFaqController } from './public-faq.controller.js';

@Module({
  controllers: [FaqController, PublicFaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
