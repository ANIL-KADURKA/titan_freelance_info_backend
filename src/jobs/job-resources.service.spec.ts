import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { S3StorageService } from '../common/s3-storage.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { checkResourceFile, getYoutubeVideoId } from './job-resource-files.js';
import { JobResourcesService } from './job-resources.service.js';

const jobId = '11111111-1111-4111-8111-111111111111';
const pdfHead = Buffer.from('%PDF-1.7\n');

function createService({
  head = { sizeBytes: 2048, contentType: 'application/pdf' } as {
    sizeBytes: number;
    contentType?: string;
  } | null,
  firstBytes = pdfHead,
} = {}) {
  const resourceCreate = vi.fn(({ data }) =>
    Promise.resolve({
      id: 'res-1',
      description: null,
      url: null,
      fileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      file: data.fileId
        ? {
            id: data.fileId,
            bucket: 'bucket',
            objectKey: 'key',
            originalName: 'guide.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048n,
          }
        : null,
      ...data,
    }),
  );
  const fileCreate = vi.fn().mockResolvedValue({ id: 'file-1' });
  const tx = {
    fileObject: { create: fileCreate },
    jobResource: { create: resourceCreate },
  };
  const prisma = {
    job: { findFirst: vi.fn().mockResolvedValue({ id: jobId }) },
    jobResource: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: resourceCreate,
    },
    fileObject: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;
  const createUploadUrl = vi
    .fn()
    .mockResolvedValue({ url: 'https://s3/put', expiresIn: 900 });
  const deleteObject = vi.fn().mockResolvedValue(undefined);
  const storage = {
    bucket: 'bucket',
    buildObjectKey: vi.fn(
      (folder: string, name: string) => `${folder}/123-${name}`,
    ),
    createUploadUrl,
    createViewUrl: vi.fn().mockResolvedValue('https://s3/get'),
    headObject: vi.fn().mockResolvedValue(head),
    readHead: vi.fn().mockResolvedValue(firstBytes),
    deleteObject,
  } as unknown as S3StorageService;
  return {
    service: new JobResourcesService(prisma, storage),
    createUploadUrl,
    deleteObject,
    fileCreate,
    resourceCreate,
  };
}

describe('job resource file rules', () => {
  it('enforces type and size limits', () => {
    expect(
      checkResourceFile('PDF', { mimeType: 'application/pdf', sizeBytes: 10 }),
    ).toBeNull();
    expect(
      checkResourceFile('PDF', { mimeType: 'image/png', sizeBytes: 10 }),
    ).toMatch(/isn't allowed/);
    expect(
      checkResourceFile('IMAGE', {
        mimeType: 'image/png',
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).toMatch(/Maximum is 10 MB/);
  });

  it('parses YouTube links', () => {
    expect(getYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      getYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'),
    ).toBe('dQw4w9WgXcQ');
    expect(getYoutubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      getYoutubeVideoId('https://evil.com/watch?v=dQw4w9WgXcQ'),
    ).toBeNull();
  });
});

describe('JobResourcesService', () => {
  it('rejects oversized files before handing out an upload URL', async () => {
    const { service, createUploadUrl } = createService();
    await expect(
      service.createUploadUrl(jobId, {
        type: 'VIDEO',
        fileName: 'intro.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 600 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it('issues upload URLs under the job folder', async () => {
    const { service } = createService();
    const result = await service.createUploadUrl(jobId, {
      type: 'PDF',
      fileName: 'guide.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    });
    expect(result.objectKey).toBe(`job-resources/${jobId}/123-guide.pdf`);
    expect(result.headers).toEqual({ 'Content-Type': 'application/pdf' });
  });

  it('saves a verified upload as a file resource', async () => {
    const { service, fileCreate } = createService();
    const view = await service.create(
      jobId,
      {
        type: 'PDF',
        title: 'Guidelines',
        objectKey: `job-resources/${jobId}/123-guide.pdf`,
        fileName: 'guide.pdf',
      },
      'admin-1',
    );
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mimeType: 'application/pdf',
        sizeBytes: 2048n,
        uploadedById: 'admin-1',
      }),
    });
    expect(view.viewUrl).toBe('https://s3/get');
    expect(view.file?.sizeBytes).toBe(2048);
  });

  it('refuses object keys from another folder', async () => {
    const { service } = createService();
    await expect(
      service.create(
        jobId,
        {
          type: 'PDF',
          title: 'Guidelines',
          objectKey: 'candidate-profile/someone/secret.pdf',
          fileName: 'x.pdf',
        },
        'admin-1',
      ),
    ).rejects.toThrow('Invalid upload reference.');
  });

  it('deletes uploads whose bytes do not match the declared type', async () => {
    const { service, deleteObject, fileCreate } = createService({
      firstBytes: Buffer.from('MZ\x90\x00not a pdf'),
    });
    await expect(
      service.create(
        jobId,
        {
          type: 'PDF',
          title: 'Guidelines',
          objectKey: `job-resources/${jobId}/123-guide.pdf`,
          fileName: 'guide.pdf',
        },
        'admin-1',
      ),
    ).rejects.toThrow("don't match");
    expect(deleteObject).toHaveBeenCalled();
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('reports a missing upload', async () => {
    const { service } = createService({ head: null });
    await expect(
      service.create(
        jobId,
        {
          type: 'PDF',
          title: 'Guidelines',
          objectKey: `job-resources/${jobId}/123-guide.pdf`,
          fileName: 'guide.pdf',
        },
        'admin-1',
      ),
    ).rejects.toThrow('Upload not found');
  });

  it('normalises YouTube links', async () => {
    const { service, resourceCreate } = createService();
    const view = await service.create(
      jobId,
      {
        type: 'YOUTUBE',
        title: 'Walkthrough',
        url: 'https://youtu.be/dQw4w9WgXcQ',
      },
      'admin-1',
    );
    expect(resourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      }),
    );
    expect(view.youtubeId).toBe('dQw4w9WgXcQ');
  });
});
