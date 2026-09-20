import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import { TestimonialsService } from './testimonials.service.js';

type UploadedFileLike = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

@ApiTags('Testimonials')
@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List testimonials' })
  findAll() {
    return this.testimonialsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get testimonial by id' })
  findOne(@Param('id') id: string) {
    return this.testimonialsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a testimonial and upload the photo' })
  create(
    @Body() dto: CreateTestimonialDto,
    @UploadedFile() file?: UploadedFileLike,
  ) {
    return this.testimonialsService.create(dto, file);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a testimonial and optionally replace photo',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
    @UploadedFile() file?: UploadedFileLike,
  ) {
    return this.testimonialsService.update(id, dto, file);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a testimonial' })
  delete(@Param('id') id: string) {
    return this.testimonialsService.delete(id);
  }
}
