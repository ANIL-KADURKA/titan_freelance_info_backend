import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertAttachment,
  hasUnread,
  statusAfterSupportReply,
  statusAfterUserReply,
  ticketLabel,
} from './support-rules.js';

describe('support rules', () => {
  it('labels tickets', () => {
    expect(ticketLabel(7)).toBe('TKT-0007');
    expect(ticketLabel(12345)).toBe('TKT-12345');
  });

  it('accepts JPG, PNG and PDF up to 15 MB', () => {
    const file = (mimetype: string, size: number) => ({
      mimetype,
      size,
      buffer: Buffer.alloc(1),
    });
    expect(() => assertAttachment(file('application/pdf', 1000))).not.toThrow();
    expect(() => assertAttachment(file('image/gif', 1000))).toThrow(
      BadRequestException,
    );
    expect(() => assertAttachment(file('image/png', 16 * 1024 * 1024))).toThrow(
      BadRequestException,
    );
  });

  it('reopens waiting or resolved tickets when the user replies', () => {
    expect(statusAfterUserReply('WAITING')).toBe('OPEN');
    expect(statusAfterUserReply('RESOLVED')).toBe('OPEN');
    expect(statusAfterUserReply('IN_PROGRESS')).toBe('IN_PROGRESS');
  });

  it('waits on the user after a support reply unless a status is chosen', () => {
    expect(statusAfterSupportReply('OPEN')).toBe('WAITING');
    expect(statusAfterSupportReply('IN_PROGRESS', 'RESOLVED')).toBe('RESOLVED');
    expect(statusAfterSupportReply('RESOLVED')).toBe('RESOLVED');
  });

  it('flags replies the viewer has not read', () => {
    const at = new Date('2026-10-03T10:00:00Z');
    const ticket = {
      lastMessageAt: at,
      lastMessageByAdmin: true,
      userReadAt: new Date('2026-10-03T09:00:00Z'),
      adminReadAt: null,
    };
    expect(hasUnread(ticket, 'user')).toBe(true);
    expect(hasUnread(ticket, 'support')).toBe(false);
    expect(hasUnread({ ...ticket, userReadAt: at }, 'user')).toBe(false);
  });
});
