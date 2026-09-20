import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum OtpPurposeDto {
  LOGIN = 'LOGIN',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export class RequestOtpDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to receive the OTP',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: OtpPurposeDto,
    example: OtpPurposeDto.LOGIN,
    description: 'OTP purpose',
  })
  @IsEnum(OtpPurposeDto)
  @IsNotEmpty()
  purpose: OtpPurposeDto;
}
