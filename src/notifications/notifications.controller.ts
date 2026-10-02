import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import { interval, map, merge, type Observable, of } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'My latest notifications and unread count' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listMine(user.id);
  }

  /**
   * Server-sent events: pushes the user's new notifications as they happen.
   * A heartbeat every 25 s keeps proxies from closing an idle connection.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'Live stream of my new notifications (SSE)' })
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return merge(
      of({ type: 'ready', data: { connectedAt: new Date().toISOString() } }),
      this.notifications
        .streamFor(user.id)
        .pipe(
          map((notification) => ({ type: 'notification', data: notification })),
        ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: {} }))),
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }
}
