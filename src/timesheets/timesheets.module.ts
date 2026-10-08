import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { PaymentDataCipher } from '../payment-methods/payment-data-cipher.js';
import { PayoutsController } from './payouts.controller.js';
import { PayoutsService } from './payouts.service.js';
import { TimesheetsController } from './timesheets.controller.js';
import { TimesheetsService } from './timesheets.service.js';

@Module({
  imports: [CommonModule],
  controllers: [TimesheetsController, PayoutsController],
  providers: [TimesheetsService, PayoutsService, PaymentDataCipher],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
