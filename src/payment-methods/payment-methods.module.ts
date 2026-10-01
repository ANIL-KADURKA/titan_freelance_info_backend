import { Module } from '@nestjs/common';
import { PaymentDataCipher } from './payment-data-cipher.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@Module({
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService, PaymentDataCipher],
})
export class PaymentMethodsModule {}
