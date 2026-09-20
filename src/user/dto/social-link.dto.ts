import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUrl } from 'class-validator';

export enum SocialMediaTypeDto {
  LINKEDIN = 'LINKEDIN',
  GITHUB = 'GITHUB',
  TWITTER = 'TWITTER',
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  PORTFOLIO = 'PORTFOLIO',
  OTHER = 'OTHER',
}

export class CreateSocialLinkDto {
  @ApiProperty({
    enum: SocialMediaTypeDto,
    example: SocialMediaTypeDto.LINKEDIN,
    description: 'Social media platform type',
  })
  @IsEnum(SocialMediaTypeDto)
  socialMediaType: SocialMediaTypeDto;

  @ApiProperty({
    example: 'https://linkedin.com/in/johndoe',
    description: 'Profile URL',
  })
  @IsUrl({ require_protocol: true })
  url: string;
}

export class UpdateSocialLinkDto extends CreateSocialLinkDto {}
