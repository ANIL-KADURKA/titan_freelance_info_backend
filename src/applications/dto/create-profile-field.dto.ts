import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationFieldType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateProfileFieldDto {
  @ApiProperty({ example: 'years_experience' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Years of experience' })
  @IsString()
  label: string;

  @ApiProperty({ enum: ApplicationFieldType })
  @IsEnum(ApplicationFieldType)
  fieldType: ApplicationFieldType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}
