import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({ example: '+91 98765 43210' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  otp: string;
}

export class SaveOnboardingProfileDto {
  @ApiProperty({ example: 'UshaSri Gudikandula' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  country: string;

  @ApiProperty({ example: 'Telangana' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  state: string;

  @ApiProperty({ example: ['Telugu', 'English'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  languages: string[];
}

export class SignAgreementDto {
  @ApiProperty({
    example: 'UshaSri Gudikandula',
    description: 'Typed legal name used as the digital signature',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  signature: string;
}
