import { BadRequestException } from '@nestjs/common';
import type { SupportTicketStatus } from '@prisma/client';
import type { UploadedDocument } from '../common/document-validation.service.js';

export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

/** 7 → "TKT-0007". */
export function ticketLabel(number: number) {
  return `TKT-${String(number).padStart(4, '0')}`;
}

/** JPG, PNG or PDF up to 15 MB (file signatures are checked again on upload). */
export function assertAttachment(file: UploadedDocument) {
  if (!ATTACHMENT_TYPES.includes((file.mimetype ?? '').toLowerCase())) {
    throw new BadRequestException('Attach a JPG, PNG or PDF file.');
  }
  if ((file.size ?? file.buffer.length) > ATTACHMENT_MAX_BYTES) {
    throw new BadRequestException('Attachments must be 15 MB or smaller.');
  }
}

/**
 * Status after the requester replies: a ticket waiting on them, or one
 * marked resolved, goes back to the support team. Closed tickets take no
 * replies (the caller rejects those).
 */
export function statusAfterUserReply(
  status: SupportTicketStatus,
): SupportTicketStatus {
  return status === 'WAITING' || status === 'RESOLVED' ? 'OPEN' : status;
}

/** Status after a support reply, unless the admin picked one explicitly. */
export function statusAfterSupportReply(
  status: SupportTicketStatus,
  chosen?: SupportTicketStatus,
): SupportTicketStatus {
  if (chosen) return chosen;
  return status === 'RESOLVED' || status === 'CLOSED' ? status : 'WAITING';
}

/** Whether the latest message is new to this side of the conversation. */
export function hasUnread(
  ticket: {
    lastMessageAt: Date;
    lastMessageByAdmin: boolean;
    userReadAt: Date | null;
    adminReadAt: Date | null;
  },
  viewer: 'user' | 'support',
) {
  const fromOtherSide =
    viewer === 'user' ? ticket.lastMessageByAdmin : !ticket.lastMessageByAdmin;
  const readAt = viewer === 'user' ? ticket.userReadAt : ticket.adminReadAt;
  return fromOtherSide && (!readAt || readAt < ticket.lastMessageAt);
}
