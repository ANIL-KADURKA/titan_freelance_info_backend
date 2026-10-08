import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import type { UploadedDocument } from '../common/document-validation.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ListMyTimesheetsQueryDto,
  ListTimesheetsQueryDto,
  ReviewTimesheetsDto,
  SaveTimesheetEntryDto,
} from './dto/timesheet.dto.js';
import { TimesheetsService } from './timesheets.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Timesheets')
@ApiBearerAuth()
@Controller('timesheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Get('me/projects')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Projects I can log work on, with the start date' })
  myProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.timesheets.myProjects(user.id);
  }

  @Get('me/summary')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({
    summary: 'Awaiting approval, pending payment and paid — per currency',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.timesheets.summary(user.id);
  }

  @Get('me')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'My timesheet entries' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyTimesheetsQueryDto,
  ) {
    return this.timesheets.listMine(user.id, query);
  }

  @Post()
  @Roles(UserRole.CANDIDATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Log (or update) work for one day, with a proof-of-work image',
  })
  @UseInterceptors(
    FileInterceptor('proof', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveTimesheetEntryDto,
    @UploadedFile() proof?: UploadedDocument,
  ) {
    const data = await this.timesheets.saveEntry(user.id, dto, proof);
    return {
      success: true,
      message: 'Timesheet submitted for approval.',
      data,
    };
  }

  @Delete(':id')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Delete an entry that is not approved yet' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timesheets.deleteEntry(user.id, id);
  }

  @Get(':id/proof-url')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Signed link to the proof-of-work image' })
  proofUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timesheets.proofUrl(id, user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'All timesheet entries (filters)' })
  listAll(@Query() query: ListTimesheetsQueryDto) {
    return this.timesheets.listAll(query);
  }

  @Post('review')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Approve or reject submitted entries' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewTimesheetsDto,
  ) {
    return this.timesheets.review(user.id, dto);
  }
}
