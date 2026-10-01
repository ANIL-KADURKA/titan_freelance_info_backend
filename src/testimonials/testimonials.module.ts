import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';
import { PublicTestimonialsController } from './public-testimonials.controller.js';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [TestimonialsController, PublicTestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
