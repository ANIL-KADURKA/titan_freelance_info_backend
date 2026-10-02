import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, PayCurrency, PayUnit, WorkMode } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateJobApplicationFieldDto } from './create-job-application-field.dto.js';
import { CreateJobEligibilityRuleDto } from './create-job-eligibility-rule.dto.js';

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
    description: 'Application deadline; null removes it',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string | Date | null;

  @ApiPropertyOptional({
    example: '2026-10-30T00:00:00.000Z',
    description: 'Closed at',
  })
  @IsOptional()
  @IsDateString()
  closedAt?: string | Date;

  @ApiPropertyOptional({
    type: [CreateJobApplicationFieldDto],
    description: 'Application fields to add, saved in the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateJobApplicationFieldDto)
  applicationFields?: CreateJobApplicationFieldDto[];

  @ApiPropertyOptional({
    type: [CreateJobEligibilityRuleDto],
    description: 'Eligibility rules to add, saved in the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateJobEligibilityRuleDto)
  eligibilityRules?: CreateJobEligibilityRuleDto[];
}
