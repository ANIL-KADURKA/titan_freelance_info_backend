import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { WebsiteContentController } from './website-content.controller.js';
import { WebsiteContentService } from './website-content.service.js';

@Module({
  imports: [CommonModule],
  controllers: [WebsiteContentController],
  providers: [WebsiteContentService],
  exports: [WebsiteContentService],
})
export class WebsiteContentModule {}
