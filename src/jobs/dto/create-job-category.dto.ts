import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateJobCategoryDto {
  @ApiProperty({ example: 'Design', description: 'Job category name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'design',
    description:
      'Job category slug. If omitted, it will be generated from the name.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example: 'Creative, visual, and UX work',
    description: 'Additional context for this job category',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the category is currently active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    example: 1,
    description: 'Sort order for the category',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
