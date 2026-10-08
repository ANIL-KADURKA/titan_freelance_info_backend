import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FaqService } from './faq.service.js';

@ApiTags('FAQs')
@Controller('public/faqs')
export class PublicFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Public: list published FAQs' })
  findPublished() {
    return this.faqService.findPublishedFaqs();
  }
}
