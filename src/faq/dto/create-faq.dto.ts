import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({
    example: 'How do I reset my password?',
    description: 'FAQ question',
  })
  @IsString()
  question: string;

  @ApiProperty({
    example:
      'Use the forgot password option on the login page and follow the reset instructions.',
    description: 'FAQ answer',
  })
  @IsString()
  answer: string;

  @ApiPropertyOptional({
    example: 'Authentication',
    description: 'FAQ category label',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Sort order for the FAQ item',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: PublishStatus,
    example: PublishStatus.DRAFT,
    description: 'Publication status',
    default: PublishStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus = PublishStatus.DRAFT;

  @ApiPropertyOptional({
    example: '4f9a0d5d-74a0-4a71-b92b-bf2c7f8336c8',
    description: 'Related FAQ category id',
  })
  @IsOptional()
  @IsUUID()
  faqCategoryId?: string;
}
