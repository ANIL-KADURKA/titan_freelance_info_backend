import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OtpPurposeDto } from './request-otp.dto.js';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address used during OTP verification',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: OtpPurposeDto,
    example: OtpPurposeDto.PASSWORD_RESET,
    description: 'Purpose for the OTP being verified',
  })
  @IsEnum(OtpPurposeDto)
  @IsNotEmpty()
  purpose: OtpPurposeDto;

  @ApiProperty({
    example: '123456',
    description: 'One-time password received by email',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
