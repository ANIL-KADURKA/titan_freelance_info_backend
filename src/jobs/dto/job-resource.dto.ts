import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { JobResourceType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const fileTypes = ['PDF', 'VIDEO', 'IMAGE', 'AUDIO', 'DOCUMENT'] as const;
const isUrlType = (type: JobResourceType) =>
  type === 'YOUTUBE' || type === 'LINK';

export class CreateResourceUploadDto {
  @ApiProperty({ enum: fileTypes, example: 'PDF' })
  @IsIn(fileTypes)
  type: (typeof fileTypes)[number];

  @ApiProperty({ example: 'guidelines.pdf' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  mimeType: string;

  @ApiProperty({ example: 1048576 })
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

export class CreateJobResourceDto {
  @ApiProperty({ enum: JobResourceType })
  @IsEnum(JobResourceType)
  type: JobResourceType;

  @ApiProperty({ example: 'Project guidelines' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Returned by the upload-url call.' })
  @ValidateIf((dto: CreateJobResourceDto) => !isUrlType(dto.type))
  @IsString()
  @MaxLength(500)
  objectKey?: string;

  @ApiPropertyOptional({ example: 'guidelines.pdf' })
  @ValidateIf((dto: CreateJobResourceDto) => !isUrlType(dto.type))
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: 'https://youtu.be/dQw4w9WgXcQ' })
  @ValidateIf((dto: CreateJobResourceDto) => isUrlType(dto.type))
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url?: string;
}

export class UpdateJobResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Only for YouTube and link resources.' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url?: string;
}

export class ReorderJobResourcesDto {
  @ApiProperty({
    type: [String],
    description: 'Resource ids in display order.',
  })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  ids: string[];
}

export class DiscardDraftUploadsDto {
  @ApiProperty({ type: [String], description: 'Staged object keys to delete.' })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  objectKeys: string[];
}
