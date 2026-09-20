import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class TestEmailDto {
  @ApiProperty({
    example: 'you@example.com',
    description: 'Email address to receive the SMTP test email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
