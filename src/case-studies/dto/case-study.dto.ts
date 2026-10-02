import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Multipart sends "" for empty fields. */
const blank = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? undefined : value;
/** "" means "clear it" (null); a missing field means "leave it". */
const clearable = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? null : value;
const bool = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

const section = (example: string) =>
  function SectionField(target: object, key: string) {
    ApiProperty({ example })(target, key);
    Transform(trim)(target, key);
    IsString()(target, key);
    MinLength(10)(target, key);
    MaxLength(4000)(target, key);
  };

/** Case study form (multipart; optional `photo`). */
export class CaseStudyDto {
  @ApiProperty({ example: 'From applicant to Telugu AI trainer' })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Generated from the title when empty' })
  @IsOptional()
  @Transform(blank)
  @Transform(trim)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug can use lowercase letters, numbers and dashes only.',
  })
  @MaxLength(150)
  slug?: string;

  @ApiProperty({ description: 'One or two lines shown on the story card' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary: string;

  @ApiProperty({ example: 'Asha Rao' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  personName: string;

  @ApiPropertyOptional({ example: 'AI Trainer · Telugu' })
  @IsOptional()
  @Transform(clearable)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  personRole?: string | null;

  @ApiPropertyOptional({ description: 'Linked candidate (admin only)' })
  @IsOptional()
  @Transform(clearable)
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ description: 'Linked project (admin only)' })
  @IsOptional()
  @Transform(clearable)
  @IsUUID()
  jobId?: string | null;

  @section('Asha was teaching part-time and looking for remote work.')
  background: string;

  @section('She found Titan through a friend and applied in one evening.')
  howItBegan: string;

  @section('After a short call she was selected for the Telugu project.')
  gettingSelected: string;

  @section('The first week was about learning the guidelines.')
  findingFooting: string;

  @section('Some tasks were rejected early on for quality reasons.')
  hardParts: string;

  @section('Her reviewer shared examples and she improved quickly.')
  support: string;

  @section('Six months later she leads a small review group.')
  outcome: string;

  @ApiPropertyOptional({ example: '6 months' })
  @IsOptional()
  @Transform(clearable)
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  durationText?: string | null;

  @ApiPropertyOptional({ example: '₹1,20,000 earned across 24 payouts' })
  @IsOptional()
  @Transform(clearable)
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  earningsText?: string | null;

  @ApiPropertyOptional({
    description: 'Candidate agreed (offline) to have this story shared',
  })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  consentRecorded?: boolean;

  @ApiProperty({ enum: [PublishStatus.DRAFT, PublishStatus.PUBLISHED] })
  @IsIn([PublishStatus.DRAFT, PublishStatus.PUBLISHED])
  status: PublishStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(blank)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '"true" removes the current photo' })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  removePhoto?: boolean;
}

export class UpdateCaseStudyDto extends PartialType(CaseStudyDto) {}

export class CaseStudyStatsQueryDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}
