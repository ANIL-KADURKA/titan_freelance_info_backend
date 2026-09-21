import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, WorkMode } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @ApiProperty({
    example: 'Senior Frontend Engineer',
    description: 'Job title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'senior-frontend-engineer',
    description:
      'Unique slug for the job. If omitted, it will be generated from the title.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    example: '3a1b9c8a-9d43-4ef0-800d-dac4d2a0038d',
    description: 'Job category id',
  })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    example: '3a1b9c8a-9d43-4ef0-800d-dac4d2a0038d',
    description:
      'Created by user id. Optional when provided via authenticated user.',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    example: 'Lead product experiences for enterprise clients',
    description: 'Short job summary',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({
    example: 'We are looking for a highly skilled frontend engineer...',
    description: 'Full job description',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: ['React', 'TypeScript', 'Node.js'],
    description: 'Skills required for this role',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: ["Bachelor's degree", '2+ years of experience'],
    description: 'Role requirements',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({
    example: 'Remote, India',
    description: 'Job location',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    enum: WorkMode,
    example: WorkMode.REMOTE,
    description: 'Work mode for the role',
    default: WorkMode.REMOTE,
  })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode = WorkMode.REMOTE;

  @ApiPropertyOptional({ example: '6 months', description: 'Job duration' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 2, description: 'Number of openings' })
  @IsOptional()
  @IsInt()
  @Min(1)
  openings?: number;

  @ApiPropertyOptional({
    example: ['Send your resume', 'Share your portfolio'],
    description: 'Instructions shown to applicants',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationInstructions?: string[];

  @ApiPropertyOptional({
    example: ['Use the portal', 'Follow the checklist'],
    description: 'Internal operational instructions',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workInstructions?: string[];

  @ApiPropertyOptional({
    example: { team: 'Platform' },
    description: 'Additional metadata as JSON',
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

  @ApiPropertyOptional({
    enum: JobStatus,
    example: JobStatus.DRAFT,
    description: 'Current publishing status',
    default: JobStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus = JobStatus.DRAFT;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'When the job becomes published',
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
    description: 'Closed at date',
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string | Date;
}
