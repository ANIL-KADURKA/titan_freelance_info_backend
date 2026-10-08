import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import {
  CreateTicketDto,
  ListTicketsQueryDto,
  ReplyDto,
  UpdateTicketDto,
} from './dto/support.dto.js';
import { SupportService } from './support.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'My support tickets' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Open a ticket (optional JPG/PNG/PDF attachment)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.support.create(user.id, dto, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of my tickets with its conversation' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.support.findMine(user.id, id);
  }

  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Reply on my ticket' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.support.replyAsUser(user.id, id, dto, file);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close my ticket' })
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.support.closeMine(user.id, id);
  }
}

@ApiTags('Support')
@ApiBearerAuth()
@Controller('admin/support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'All tickets, with counts per status' })
  list(@Query() query: ListTicketsQueryDto) {
    return this.support.list(query);
  }

  @Get('assignees')
  @ApiOperation({ summary: 'Admins a ticket can be assigned to' })
  assignees() {
    return this.support.assignees();
  }

  @Get(':id')
  @ApiOperation({ summary: 'A ticket with its conversation' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.findOne(id);
  }

  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Reply as Titan Support (optionally set status)' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.support.replyAsSupport(user.id, id, dto, file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change status, priority or assignee' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.support.update(id, dto);
  }
}
