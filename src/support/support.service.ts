import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  RoleName,
  type FileObject,
  type SupportTicketStatus,
} from '@prisma/client';
import { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { MailService } from '../common/mail.service.js';
import { S3StorageService } from '../common/s3-storage.service.js';
import {
  personName,
  supportTicketAnswered,
  supportTicketCreated,
  supportTicketFollowUp,
  supportTicketStatusChanged,
} from '../notifications/notification-messages.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateTicketDto,
  ListTicketsQueryDto,
  ReplyDto,
  UpdateTicketDto,
} from './dto/support.dto.js';
import {
  assertAttachment,
  hasUnread,
  statusAfterSupportReply,
  statusAfterUserReply,
  ticketLabel,
} from './support-rules.js';

const person = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

const ticketInclude = {
  user: person,
  assignedTo: person,
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

type TicketRow = Prisma.SupportTicketGetPayload<{
  include: typeof ticketInclude;
}>;

type Viewer = 'user' | 'support';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: AwsDocumentUploadService,
    private readonly storage: S3StorageService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // ── Shapes ──

  private toSummary(row: TicketRow, viewer: Viewer) {
    return {
      id: row.id,
      label: ticketLabel(row.number),
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      messageCount: row._count.messages,
      lastMessageAt: row.lastMessageAt.toISOString(),
      unread: hasUnread(row, viewer),
      createdAt: row.createdAt.toISOString(),
      // Requester and assignee details are for the support team only.
      ...(viewer === 'support'
        ? {
            requester: { ...row.user, name: personName(row.user) },
            assignedTo: row.assignedTo
              ? { ...row.assignedTo, name: personName(row.assignedTo) }
              : null,
          }
        : {}),
    };
  }

  private attachmentView(file: FileObject | null) {
    if (!file) return Promise.resolve(null);
    return this.storage
      .createViewUrl(file.bucket, file.objectKey, {
        fileName: file.originalName,
        contentType: file.mimeType,
      })
      .then((url) => ({
        name: file.originalName,
        contentType: file.mimeType,
        url,
      }));
  }

  private async toDetail(row: TicketRow, viewer: Viewer) {
    const messages = await this.prisma.supportTicketMessage.findMany({
      where: { ticketId: row.id },
      include: { author: person, attachment: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.toSummary(row, viewer),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      messages: await Promise.all(
        messages.map(async (message) => ({
          id: message.id,
          body: message.body,
          fromSupport: message.fromSupport,
          // Users see "Titan Support", not which admin wrote.
          authorName:
            message.fromSupport && viewer === 'user'
              ? 'Titan Support'
              : message.author
                ? personName(message.author)
                : 'Deleted user',
          attachment: await this.attachmentView(message.attachment),
          createdAt: message.createdAt.toISOString(),
        })),
      ),
    };
  }

  private async findTicket(id: string, userId?: string) {
    const row = await this.prisma.supportTicket.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: ticketInclude,
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return row;
  }

  private async uploadAttachment(file: UploadedDocument, uploaderId: string) {
    assertAttachment(file);
    return this.uploads.uploadDocument(file, {
      folder: 'support',
      uploadedById: uploaderId,
    });
  }

  private async addMessage(
    ticketId: string,
    authorId: string,
    fromSupport: boolean,
    body: string,
    file?: UploadedDocument,
  ) {
    const attachment = file
      ? await this.uploadAttachment(file, authorId)
      : null;
    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId,
        fromSupport,
        body,
        attachmentId: attachment?.id ?? null,
      },
    });
  }

  /** Emails the requester about a support reply; never blocks the reply. */
  private async emailRequester(row: TicketRow, reply: string) {
    const link = `${this.config.get<string>('FRONTEND_URL') ?? ''}/support/${row.id}`;
    const label = ticketLabel(row.number);
    try {
      await this.mail.send(row.user.email, {
        subject: `Re: ${label} — ${row.subject}`,
        text: `Hi ${row.user.firstName ?? 'there'},\n\nTitan Support replied to your ticket ${label}:\n\n${reply}\n\nReply or follow up here: ${link}\n\n— Titan Support`,
      });
    } catch (error) {
      this.logger.warn(
        `Could not email ${row.user.email} about ${label}: ${String(error)}`,
      );
    }
  }

  // ── Requester ──

  async listMine(userId: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      include: ticketInclude,
      orderBy: { lastMessageAt: 'desc' },
    });
    return rows.map((row) => this.toSummary(row, 'user'));
  }

  async create(userId: string, dto: CreateTicketDto, file?: UploadedDocument) {
    if (file) assertAttachment(file);
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        subject: dto.subject,
        userReadAt: new Date(),
      },
    });
    await this.addMessage(ticket.id, userId, false, dto.description, file);
    const row = await this.findTicket(ticket.id);
    await this.notifications.notifyAdmins(
      supportTicketCreated(
        ticketLabel(row.number),
        personName(row.user),
        row.subject,
      ),
    );
    return this.toDetail(row, 'user');
  }

  async findMine(userId: string, id: string) {
    const row = await this.findTicket(id, userId);
    await this.prisma.supportTicket.update({
      where: { id },
      data: { userReadAt: new Date() },
    });
    return this.toDetail({ ...row, userReadAt: new Date() }, 'user');
  }

  async replyAsUser(
    userId: string,
    id: string,
    dto: ReplyDto,
    file?: UploadedDocument,
  ) {
    const row = await this.findTicket(id, userId);
    if (row.status === 'CLOSED') {
      throw new BadRequestException(
        'This ticket is closed. Open a new ticket if you still need help.',
      );
    }
    const message = await this.addMessage(id, userId, false, dto.body, file);
    const status = statusAfterUserReply(row.status);
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        lastMessageAt: message.createdAt,
        lastMessageByAdmin: false,
        userReadAt: message.createdAt,
        resolvedAt: status === 'OPEN' ? null : undefined,
      },
    });
    const notice = supportTicketFollowUp(
      ticketLabel(row.number),
      personName(row.user),
      id,
    );
    if (row.assignedToId) {
      await this.notifications.notifyUser(row.assignedToId, notice);
    } else {
      await this.notifications.notifyAdmins(notice);
    }
    return this.findMine(userId, id);
  }

  async closeMine(userId: string, id: string) {
    const row = await this.findTicket(id, userId);
    if (row.status !== 'CLOSED') {
      await this.prisma.supportTicket.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }
    return this.findMine(userId, id);
  }

  // ── Support team ──

  async list(query: ListTicketsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const number = search?.replace(/^tkt-?/i, '');
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              ...(number && /^\d+$/.test(number)
                ? [{ number: Number(number) }]
                : []),
              { subject: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              {
                user: { firstName: { contains: search, mode: 'insensitive' } },
              },
              {
                user: { lastName: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const [rows, total, grouped] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: ticketInclude,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(
      grouped.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<SupportTicketStatus, number>>;
    return {
      items: rows.map((row) => this.toSummary(row, 'support')),
      total,
      page,
      pageSize,
      counts,
    };
  }

  async findOne(id: string) {
    const row = await this.findTicket(id);
    await this.prisma.supportTicket.update({
      where: { id },
      data: { adminReadAt: new Date() },
    });
    return this.toDetail({ ...row, adminReadAt: new Date() }, 'support');
  }

  /** Admins who can be assigned tickets. */
  async assignees() {
    const admins = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        roles: { some: { role: { name: RoleName.ADMIN } } },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    });
    return admins.map((admin) => ({ ...admin, name: personName(admin) }));
  }

  async replyAsSupport(
    adminId: string,
    id: string,
    dto: ReplyDto,
    file?: UploadedDocument,
  ) {
    const row = await this.findTicket(id);
    const message = await this.addMessage(id, adminId, true, dto.body, file);
    const status = statusAfterSupportReply(row.status, dto.status);
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        lastMessageAt: message.createdAt,
        lastMessageByAdmin: true,
        adminReadAt: message.createdAt,
        // The first admin to reply picks the ticket up.
        assignedToId: row.assignedToId ?? adminId,
        ...this.statusTimestamps(row.status, status),
      },
    });
    const label = ticketLabel(row.number);
    await this.notifications.notifyUser(
      row.userId,
      status !== row.status && (status === 'RESOLVED' || status === 'CLOSED')
        ? supportTicketStatusChanged(label, id, status)
        : supportTicketAnswered(label, id),
    );
    await this.emailRequester(row, dto.body);
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateTicketDto) {
    const row = await this.findTicket(id);
    const status = dto.status ?? row.status;
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedToId: dto.assignedToId,
        ...this.statusTimestamps(row.status, status),
      },
    });
    if (status !== row.status) {
      await this.notifications.notifyUser(
        row.userId,
        supportTicketStatusChanged(ticketLabel(row.number), id, status),
      );
    }
    return this.findOne(id);
  }

  private statusTimestamps(from: SupportTicketStatus, to: SupportTicketStatus) {
    if (from === to) return {};
    const now = new Date();
    return {
      resolvedAt: to === 'RESOLVED' ? now : to === 'CLOSED' ? undefined : null,
      closedAt: to === 'CLOSED' ? now : null,
    };
  }
}
