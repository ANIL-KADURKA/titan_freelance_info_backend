import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
