import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
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
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../auth/roles.enum.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import {
  ListTestimonialsQueryDto,
  RejectTestimonialDto,
  SubmitTestimonialDto,
} from './dto/my-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import { TestimonialsService } from './testimonials.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Testimonials')
@ApiBearerAuth()
@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  // ── Candidate ──

  @Get('me')
  @ApiOperation({ summary: 'My testimonial and whether I can submit one' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.testimonialsService.mine(user.id);
  }

  @Put('me')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit or edit my testimonial (goes to review)' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitTestimonialDto,
    @Req() req: Request,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.testimonialsService.submit(
      user.id,
      dto,
      file,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('me')
  @ApiOperation({ summary: 'Withdraw my testimonial from the website' })
  withdraw(@CurrentUser() user: AuthenticatedUser) {
    return this.testimonialsService.withdraw(user.id);
  }

  // ── Admin ──

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List testimonials by review tab, with counts' })
  findAll(@Query() query: ListTestimonialsQueryDto) {
    return this.testimonialsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get testimonial by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonialsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a testimonial by hand (photo required)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestimonialDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.testimonialsService.create(user.id, dto, file);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Edit a testimonial (and optionally its photo)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestimonialDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.testimonialsService.update(user.id, id, dto, file);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve: publish it, or apply the pending edit' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testimonialsService.approve(user.id, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject with a reason the candidate will see' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTestimonialDto,
  ) {
    return this.testimonialsService.reject(user.id, id, dto.reason);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a testimonial' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonialsService.delete(id);
  }
}
