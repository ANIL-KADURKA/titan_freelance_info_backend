import { Module } from '@nestjs/common';
import { TimesheetsModule } from '../timesheets/timesheets.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [TimesheetsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
