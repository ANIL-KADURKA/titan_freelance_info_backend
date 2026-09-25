import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteContentDto } from './create-website-content.dto.js';

export class UpdateWebsiteContentDto extends PartialType(
  CreateWebsiteContentDto,
) {}
