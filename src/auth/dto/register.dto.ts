import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { GenderEnum } from '@prisma/client';

export class RegisterDto {
  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description:
      'Primary email address. If not available yet, personalEmail will be used as fallback.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'john.doe@company.com',
    description: 'Professional or alternate email address',
  })
  @IsEmail()
  @IsNotEmpty()
  personalEmail: string;

  @ApiProperty({
    example: 'StrongPass123!',
    minLength: 8,
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    enum: GenderEnum,
    example: GenderEnum.NOT_DISCLOSED,
    description: 'User gender',
  })
  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;
}
