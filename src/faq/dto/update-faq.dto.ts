import { PartialType } from '@nestjs/swagger';
import { CreateFaqDto } from './create-faq.dto.js';

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}
