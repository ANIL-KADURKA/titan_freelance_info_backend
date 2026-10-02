import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller.js';
import { AgreementsService } from './agreements.service.js';

@Module({
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
