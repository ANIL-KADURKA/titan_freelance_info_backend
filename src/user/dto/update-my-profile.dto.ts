import { ApiPropertyOptional } from '@nestjs/swagger';
import { GenderEnum } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/** Personal details a candidate can change themselves. */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Asha' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/^[^@]*$/, { message: 'First name cannot be an email address' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rao', description: '"" clears it' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ enum: GenderEnum })
  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;

  @ApiPropertyOptional({ example: '1998-04-21', description: '"" clears it' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== '')
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '9876543210', description: '"" clears it' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_dto, value) => value !== '')
  @Matches(/^(\+?91)?[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  })
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: 'Telangana' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  country?: string;
}
