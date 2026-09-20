import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { OtpPurposeDto } from './request-otp.dto.js';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the account',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'OTP that was verified before password reset',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    example: 'NewStrongPass123!',
    minLength: 8,
    description: 'New password to set',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({
    enum: OtpPurposeDto,
    example: OtpPurposeDto.PASSWORD_RESET,
    description: 'OTP purpose for reset flow',
    default: OtpPurposeDto.PASSWORD_RESET,
  })
  @IsNotEmpty()
  purpose: OtpPurposeDto = OtpPurposeDto.PASSWORD_RESET;
}
