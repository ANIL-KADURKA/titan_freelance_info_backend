import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Multipart sends "" for empty fields. */
const blank = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? undefined : value;
/** "" means "clear it" (null); a missing field means "leave it". */
const clearable = ({ value }: { value: unknown }) => {
  if (value === '' || value === 'null') return null;
  return typeof value === 'string' ? value.trim() : value;
};
const bool = ({ value }: { value: unknown }) =>
  value === true || value === 'true';
/**
 * Lists arrive as JSON strings in multipart forms. Rows become instances of
 * `rowClass` so the whitelist and nested validation know their fields.
 */
const jsonListOf =
  <T>(rowClass: new () => T) =>
  ({ value }: { value: unknown }) => {
    let rows = value;
    if (typeof rows === 'string') {
      try {
        rows = JSON.parse(rows) as unknown;
      } catch {
        return value; // IsArray reports it.
      }
    }
    return Array.isArray(rows)
      ? rows.map((row: unknown) =>
          row && typeof row === 'object' ? plainToInstance(rowClass, row) : row,
        )
      : rows;
  };

/** Optional short text that can be cleared. */
function OptionalText(max: number, example: string) {
  return function OptionalTextField(target: object, key: string) {
    ApiPropertyOptional({ example })(target, key);
    IsOptional()(target, key);
    Transform(clearable)(target, key);
    IsString()(target, key);
    MaxLength(max)(target, key);
  };
}

export class CaseStudyStatDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  value: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label: string;
}

export class CaseStudyBreakdownRowDto {
  @Transform(trim)
  @IsString()
  @MaxLength(8)
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text: string;

  @Transform(trim)
  @IsString()
  @MaxLength(20)
  value: string;
}

export class CaseStudyResultDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  value: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  note?: string;
}

export class CaseStudyProjectDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  problem: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  approach: string;
}

/** Case study form (multipart; optional `cover` image). */
export class CaseStudyDto {
  @ApiProperty({ example: 'Hindi RLHF at Scale' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
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

  @ApiProperty({ example: 'RLHF', description: 'Shown as "CASE 01 · RLHF"' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category: string;

  @ApiProperty({ description: 'One or two lines under the title' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary: string;

  @OptionalText(60, 'Hindi')
  focusTag?: string | null;

  @OptionalText(40, '2025 · Q4')
  period?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/cover.webp',
    description: 'Image link used when no cover is uploaded',
  })
  @IsOptional()
  @Transform(clearable)
  @IsString()
  @MaxLength(500)
  @Matches(/^(https:\/\/|\/)\S+$/, {
    message: 'Use an https:// link or a site path starting with /.',
  })
  imageUrl?: string | null;

  @OptionalText(80, 'Foundation lab')
  clientLabel?: string | null;

  @ApiPropertyOptional({ type: [CaseStudyStatDto], description: 'Up to 4' })
  @IsOptional()
  @Transform(jsonListOf(CaseStudyStatDto))
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  stats?: CaseStudyStatDto[];

  @ApiPropertyOptional({
    type: [CaseStudyProjectDto],
    description: 'Sub-project cards, up to 4',
  })
  @IsOptional()
  @Transform(jsonListOf(CaseStudyProjectDto))
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  projects?: CaseStudyProjectDto[];

  @OptionalText(200, 'Off-the-shelf RLHF data was failing Hindi users.')
  problemTitle?: string | null;

  @OptionalText(4000, 'What was going wrong for the client…')
  problemBody?: string | null;

  @OptionalText(200, 'Native-paired reviewers + cultural-context rubric.')
  approachTitle?: string | null;

  @OptionalText(4000, 'What we did…')
  approachBody?: string | null;

  @OptionalText(80, '4-layer QA breakdown')
  breakdownTitle?: string | null;

  @ApiPropertyOptional({
    type: [CaseStudyBreakdownRowDto],
    description: 'Up to 8 rows',
  })
  @IsOptional()
  @Transform(jsonListOf(CaseStudyBreakdownRowDto))
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  breakdown?: CaseStudyBreakdownRowDto[];

  @OptionalText(80, 'Results per language')
  resultsTitle?: string | null;

  @ApiPropertyOptional({ type: [CaseStudyResultDto], description: 'Up to 4' })
  @IsOptional()
  @Transform(jsonListOf(CaseStudyResultDto))
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  results?: CaseStudyResultDto[];

  @OptionalText(1000, 'What the client said…')
  quote?: string | null;

  @OptionalText(160, 'ML Lead, Foundation Model Lab (anonymized)')
  quoteAuthor?: string | null;

  @ApiPropertyOptional({
    description: 'Show as a "next case study loading…" placeholder',
  })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  isUpcoming?: boolean;

  @ApiProperty({ enum: [PublishStatus.DRAFT, PublishStatus.PUBLISHED] })
  @IsIn([PublishStatus.DRAFT, PublishStatus.PUBLISHED])
  status: PublishStatus;

  @ApiPropertyOptional({ description: 'Lower numbers show first' })
  @IsOptional()
  @Transform(blank)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Remove the current cover image' })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  removeCover?: boolean;
}

export class UpdateCaseStudyDto extends PartialType(CaseStudyDto) {}
