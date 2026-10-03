import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import {
  AdminSupportController,
  SupportController,
} from './support.controller.js';
import { SupportService } from './support.service.js';

@Module({
  imports: [CommonModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
