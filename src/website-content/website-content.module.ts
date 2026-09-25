import { Module } from '@nestjs/common';
import { WebsiteContentController } from './website-content.controller.js';
import { WebsiteContentService } from './website-content.service.js';

@Module({
  controllers: [WebsiteContentController],
  providers: [WebsiteContentService],
  exports: [WebsiteContentService],
})
export class WebsiteContentModule {}
