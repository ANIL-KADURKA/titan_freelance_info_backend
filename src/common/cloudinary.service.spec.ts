import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryService } from './cloudinary.service.js';

const png = {
  originalname: 'cover.png',
  mimetype: 'image/png',
  size: 4,
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
};

function service(values: Record<string, string>) {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new CloudinaryService(config);
}

describe('CloudinaryService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads CLOUDINARY_URL and recognises only its own image URLs', () => {
    const cloudinary = service({
      CLOUDINARY_URL: 'cloudinary://key:secret@titan',
    });
    expect(
      cloudinary.isOwnImageUrl(
        'https://res.cloudinary.com/titan/image/upload/v1/titan/jobs/a.jpg',
      ),
    ).toBe(true);
    expect(
      cloudinary.isOwnImageUrl(
        'https://res.cloudinary.com/other/image/upload/v1/a.jpg',
      ),
    ).toBe(false);
    expect(cloudinary.isOwnImageUrl('https://example.com/a.jpg')).toBe(false);
  });

  it('signs the upload and returns an auto-format URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({
          secure_url:
            'https://res.cloudinary.com/titan/image/upload/v1/titan/jobs/a.png',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cloudinary = service({
      CLOUDINARY_CLOUD_NAME: 'titan',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });

    const url = await cloudinary.uploadImage(png, 'jobs');

    expect(url).toBe(
      'https://res.cloudinary.com/titan/image/upload/f_auto,q_auto/v1/titan/jobs/a.png',
    );
    const [endpoint, init] = fetchMock.mock.calls[0] as [
      string,
      { body: FormData },
    ];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/titan/image/upload');
    const body = init.body;
    const timestamp = body.get('timestamp') as string;
    expect(body.get('folder')).toBe('titan/jobs');
    expect(body.get('api_key')).toBe('key');
    expect(body.get('signature')).toBe(
      createHash('sha1')
        .update(`folder=titan/jobs&timestamp=${timestamp}secret`)
        .digest('hex'),
    );
  });

  it('refuses uploads when Cloudinary is not configured', async () => {
    await expect(service({}).uploadImage(png, 'jobs')).rejects.toThrow(
      'not set up',
    );
  });
});
