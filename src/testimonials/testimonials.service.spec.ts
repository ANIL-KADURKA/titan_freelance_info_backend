import { describe, expect, it, vi } from 'vitest';
import type { AwsDocumentUploadService } from '../common/aws-document-upload.service.js';
import type { S3StorageService } from '../common/s3-storage.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TestimonialsService } from './testimonials.service.js';

const photo = {
  originalname: 'me.png',
  mimetype: 'image/png',
  size: 1000,
  buffer: Buffer.from('x'),
};

const baseRow = {
  id: 't1',
  userId: 'u1',
  authorName: 'Asha Rao',
  authorRole: 'AI Trainer',
  quote: 'Great platform, paid on time.',
  rating: 5,
  joinedAt: null,
  photoId: 'f1',
  status: 'PENDING',
  pendingQuote: null,
  pendingRole: null,
  pendingRating: null,
  pendingPhotoId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedById: null,
  reviewedAt: null,
  consentedAt: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  photo: null,
  pendingPhoto: null,
  user: null,
  reviewedBy: null,
};

function createService({
  hired = 1,
  existing = null as Record<string, unknown> | null,
} = {}) {
  const update = vi.fn(({ data }) =>
    Promise.resolve({ ...baseRow, ...existing, ...data }),
  );
  const prisma = {
    candidateApplication: { count: vi.fn().mockResolvedValue(hired) },
    payout: { count: vi.fn().mockResolvedValue(0) },
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        email: 'asha@example.com',
        firstName: 'Asha',
        lastName: 'Rao',
        legalName: 'Asha Rao',
        createdAt: new Date('2026-01-01'),
      }),
    },
    testimonial: {
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi
        .fn()
        .mockResolvedValue(existing ? { ...baseRow, ...existing } : null),
      create: vi.fn(({ data }) => Promise.resolve({ ...baseRow, ...data })),
      update,
    },
    consentRecord: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const uploads = { uploadDocument: vi.fn().mockResolvedValue({ id: 'f9' }) };
  const storage = { createViewUrl: vi.fn().mockResolvedValue('https://s3/x') };
  const notifications = {
    notifyAdmins: vi.fn(),
    notifyUser: vi.fn(),
  };
  const service = new TestimonialsService(
    prisma as unknown as PrismaService,
    uploads as unknown as AwsDocumentUploadService,
    storage as unknown as S3StorageService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, notifications };
}

const dto = {
  quote: 'Titan paid me on time, every single week.',
  rating: 5,
  consent: true,
};

describe('TestimonialsService.submit', () => {
  it('requires the candidate to have been selected or paid', async () => {
    const { service } = createService({ hired: 0 });
    await expect(service.submit('u1', dto, photo)).rejects.toThrow('selected');
  });

  it('requires a photo the first time', async () => {
    const { service } = createService();
    await expect(service.submit('u1', dto)).rejects.toThrow('photo');
  });

  it('creates a pending testimonial and tells admins', async () => {
    const { service, prisma, notifications } = createService();
    await service.submit('u1', dto, photo);
    expect(prisma.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        status: 'PENDING',
        photoId: 'f9',
        authorName: 'Asha Rao',
      }),
    });
    expect(notifications.notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TESTIMONIAL_SUBMITTED' }),
    );
  });

  it('keeps the live version and stores edits as pending', async () => {
    const { service, prisma } = createService({
      existing: { ...baseRow, status: 'APPROVED' },
    });
    await service.submit('u1', {
      ...dto,
      quote: 'Even better after six months here.',
    });
    const data = prisma.testimonial.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      pendingQuote: 'Even better after six months here.',
    });
    expect(data.status).toBeUndefined();
    expect(data.quote).toBeUndefined();
  });
});

describe('TestimonialsService review', () => {
  it('approving a pending edit applies it to the live version', async () => {
    const { service, prisma, notifications } = createService({
      existing: {
        ...baseRow,
        status: 'APPROVED',
        pendingQuote: 'New words',
        pendingRating: 4,
        pendingPhotoId: 'f2',
      },
    });
    await service.approve('admin-1', 't1');
    expect(prisma.testimonial.update.mock.calls[0][0].data).toMatchObject({
      quote: 'New words',
      rating: 4,
      photoId: 'f2',
      pendingQuote: null,
      status: 'APPROVED',
    });
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'TESTIMONIAL_REVIEWED' }),
    );
  });

  it('rejecting a pending edit keeps the testimonial live', async () => {
    const { service, prisma } = createService({
      existing: { ...baseRow, status: 'APPROVED', pendingQuote: 'New words' },
    });
    await service.reject('admin-1', 't1', 'Please remove the client name');
    const data = prisma.testimonial.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(data).toMatchObject({
      pendingQuote: null,
      rejectionReason: 'Please remove the client name',
    });
  });

  it('rejecting a new submission marks it rejected', async () => {
    const { service, prisma } = createService({ existing: { ...baseRow } });
    await service.reject('admin-1', 't1', 'Too short');
    expect(prisma.testimonial.update.mock.calls[0][0].data.status).toBe(
      'REJECTED',
    );
  });
});
