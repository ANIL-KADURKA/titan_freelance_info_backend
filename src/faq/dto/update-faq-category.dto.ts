import { PartialType } from '@nestjs/swagger';
import { CreateFaqCategoryDto } from './create-faq-category.dto.js';

export class UpdateFaqCategoryDto extends PartialType(CreateFaqCategoryDto) {}
