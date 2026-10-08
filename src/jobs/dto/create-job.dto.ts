import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, PayCurrency, PayUnit, WorkMode } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateJobApplicationFieldDto } from './create-job-application-field.dto.js';
import { CreateJobEligibilityRuleDto } from './create-job-eligibility-rule.dto.js';
import { CreateJobResourceDto } from './job-resource.dto.js';

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

  @ApiPropertyOptional({ example: 300, description: 'Pay amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  payAmount?: number | null;

  @ApiPropertyOptional({
    enum: PayCurrency,
    description: 'Required when payAmount is set',
  })
  @ValidateIf((dto: { payAmount?: number | null }) => dto.payAmount != null)
  @IsEnum(PayCurrency)
  payCurrency?: PayCurrency;

  @ApiPropertyOptional({
    enum: PayUnit,
    description: 'Pay period (per hour, day, week...). Required with payAmount',
  })
  @ValidateIf((dto: { payAmount?: number | null }) => dto.payAmount != null)
  @IsEnum(PayUnit)
  payUnit?: PayUnit;

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

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/titan/jobs/cover.jpg',
    description: 'Cover image URL, from POST /jobs/images',
  })
  @IsString({ message: 'Add a cover image.' })
  @MaxLength(1000)
  coverImageUrl!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/titan/jobs/logo.png',
    description: 'Company logo URL, from POST /jobs/images',
  })
  @IsString({ message: 'Add a logo.' })
  @MaxLength(1000)
  logoUrl!: string;

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
    example: '2026-08-10T00:00:00.000Z',
    description: 'Upcoming jobs: pre-apply by this date for the bonus',
  })
  @IsOptional()
  @IsDateString()
  preApplyDeadline?: string | Date | null;

  @ApiPropertyOptional({
    example: 50,
    description: 'Upcoming jobs: extra INR for pre-applying in time',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preApplyBonus?: number | null;

  @ApiPropertyOptional({
    example: '2026-10-30T00:00:00.000Z',
    description: 'Closed at date',
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string | Date;

  @ApiPropertyOptional({
    type: [CreateJobApplicationFieldDto],
    description: 'Application fields created in the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateJobApplicationFieldDto)
  applicationFields?: CreateJobApplicationFieldDto[];

  @ApiPropertyOptional({
    type: [CreateJobEligibilityRuleDto],
    description: 'Eligibility rules created in the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateJobEligibilityRuleDto)
  eligibilityRules?: CreateJobEligibilityRuleDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Also post the project to the Community feed for 2 days (live when the job is published).',
  })
  @IsOptional()
  @IsBoolean()
  postToCommunity?: boolean;

  @ApiPropertyOptional({
    type: [CreateJobResourceDto],
    description:
      'Resources created in the same transaction. Files must be uploaded first via POST /job-resources/upload-url.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateJobResourceDto)
  resources?: CreateJobResourceDto[];
}
