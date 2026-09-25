import { ApiProperty } from '@nestjs/swagger';
import { WebsiteScreen } from '@prisma/client';
import { IsEnum, IsObject } from 'class-validator';

export class CreateWebsiteContentDto {
  @ApiProperty({ enum: WebsiteScreen, example: WebsiteScreen.HOME })
  @IsEnum(WebsiteScreen)
  screenKey: WebsiteScreen;

  @ApiProperty({
    example: { title: 'Titan Freelance', sections: [] },
    description: 'JSON object that represents the screen content',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  content: Record<string, unknown>;
}
