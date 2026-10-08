import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { CommunityService } from './community.service.js';
import {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  PinAnnouncementDto,
  ReactToAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';

type AuthenticatedUser = { id: string };

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Community feed: live posts, pinned first' })
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.community.feed(query, user.id);
  }

  @Post('announcements/:id/reactions')
  @ApiOperation({ summary: 'Toggle my Like or Love on a live post' })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReactToAnnouncementDto,
  ) {
    return this.community.toggleReaction(id, user.id, dto.type);
  }

  @Get('announcements')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'All announcements for admins (with state tabs)' })
  list(@Query() query: ListAnnouncementsQueryDto) {
    return this.community.listForAdmin(query);
  }

  @Post('announcements')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create an announcement' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const data = await this.community.create(user.id, dto);
    return {
      success: true,
      message:
        dto.status === 'PUBLISHED' ? 'Announcement published.' : 'Draft saved.',
      data,
    };
  }

  @Patch('announcements/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Edit an announcement' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    const data = await this.community.update(id, dto);
    return { success: true, message: 'Announcement updated.', data };
  }

  @Patch('announcements/:id/pin')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Pin to / unpin from the top of the feed' })
  async pin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PinAnnouncementDto,
  ) {
    const data = await this.community.setPinned(id, dto.pinned);
    return {
      success: true,
      message: dto.pinned ? 'Pinned to top.' : 'Unpinned.',
      data,
    };
  }

  @Delete('announcements/:id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Delete an announcement' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.community.remove(id);
  }
}
