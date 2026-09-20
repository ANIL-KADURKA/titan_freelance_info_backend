import { PartialType } from '@nestjs/swagger';
import { CreateTestimonialDto } from './create-testimonial.dto.js';

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}
