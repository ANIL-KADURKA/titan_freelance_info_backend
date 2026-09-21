import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, WorkMode } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateJobDto {
  @ApiPropertyOptional({
    example: 'Senior Frontend Engineer',
    description: 'Updated job title',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'senior-frontend-engineer',
    description: 'Updated job slug',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example: '3a1b9c8a-9d43-4ef0-800d-dac4d2a0038d',
    description: 'Updated category id',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Lead product experiences for enterprise clients',
    description: 'Short summary',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    example: 'We are looking for a highly skilled frontend engineer...',
    description: 'Full description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: ['React', 'TypeScript'],
    description: 'Skills required',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: ["Bachelor's degree"],
    description: 'Role requirements',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ example: 'Remote, India', description: 'Location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    enum: WorkMode,
    example: WorkMode.HYBRID,
    description: 'Work mode',
  })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiPropertyOptional({ example: '6 months', description: 'Duration' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 3, description: 'Openings count' })
  @IsOptional()
  @IsInt()
  @Min(1)
  openings?: number;

  @ApiPropertyOptional({
    example: ['Send your resume'],
    description: 'Application instructions',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationInstructions?: string[];

  @ApiPropertyOptional({
    example: ['Use the portal'],
    description: 'Work instructions',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workInstructions?: string[];

  @ApiPropertyOptional({
    example: { priority: 'high' },
    description: 'Additional JSON metadata',
  })
  @IsOptional()
  additionalInfo?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '9f1d37d1-7d7b-4842-b7a8-824db7e49ef6',
    description: 'Cover image file id',
  })
  @IsOptional()
  @IsUUID()
  coverImageId?: string;

  @ApiPropertyOptional({ enum: JobStatus, description: 'Job status' })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Published on',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | Date;

  @ApiPropertyOptional({
    example: '2026-10-15T00:00:00.000Z',
    description: 'Application deadline',
  })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string | Date;

  @ApiPropertyOptional({
    example: '2026-10-30T00:00:00.000Z',
    description: 'Closed at',
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string | Date;
}
