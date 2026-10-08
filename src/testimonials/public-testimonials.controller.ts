import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestimonialsService } from './testimonials.service.js';

@ApiTags('Testimonials')
@Controller('public/testimonials')
export class PublicTestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'Public: list published testimonials' })
  findPublished() {
    return this.testimonialsService.findPublished();
  }
}
