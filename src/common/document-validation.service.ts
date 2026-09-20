import { BadRequestException, Injectable } from '@nestjs/common';

export type UploadedDocument = {
  fieldname?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

type SignatureMatch = {
  mimeTypes: string[];
  extensions: string[];
  signature: number[];
};

@Injectable()
export class DocumentValidationService {
  private readonly allowedTypes: Map<string, SignatureMatch> = new Map([
    [
      'image/png',
      {
        mimeTypes: ['image/png'],
        extensions: ['.png'],
        signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      },
    ],
    [
      'image/jpeg',
      {
        mimeTypes: ['image/jpeg', 'image/jpg'],
        extensions: ['.jpg', '.jpeg'],
        signature: [0xff, 0xd8, 0xff],
      },
    ],
    [
      'image/webp',
      {
        mimeTypes: ['image/webp'],
        extensions: ['.webp'],
        signature: [0x52, 0x49, 0x46, 0x46],
      },
    ],
    [
      'image/gif',
      {
        mimeTypes: ['image/gif'],
        extensions: ['.gif'],
        signature: [0x47, 0x49, 0x46, 0x38],
      },
    ],
    [
      'application/pdf',
      {
        mimeTypes: ['application/pdf'],
        extensions: ['.pdf'],
        signature: [0x25, 0x50, 0x44, 0x46],
      },
    ],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      {
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        extensions: ['.docx'],
        signature: [0x50, 0x4b],
      },
    ],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      {
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        extensions: ['.xlsx'],
        signature: [0x50, 0x4b],
      },
    ],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      {
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        extensions: ['.pptx'],
        signature: [0x50, 0x4b],
      },
    ],
  ]);

  validate(file: UploadedDocument): void {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('A valid document file is required.');
    }

    const originalName = file.originalname ?? '';
    const mimeType = (file.mimetype ?? '').toLowerCase();
    const extension = originalName.includes('.')
      ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase()
      : '';

    const match = this.findMatch(mimeType, extension);

    if (!match) {
      throw new BadRequestException(
        'Unsupported file type. Allowed types: PNG, JPG, JPEG, WEBP, GIF, PDF, DOCX, XLSX, PPTX.',
      );
    }

    const firstBytes = file.buffer.subarray(0, match.signature.length);

    if (!firstBytes.equals(Buffer.from(match.signature))) {
      throw new BadRequestException(
        `The uploaded file looks corrupted or does not match the expected ${match.mimeTypes[0]} format.`,
      );
    }

    if (file.size && file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Document size must be 10 MB or less.');
    }
  }

  private findMatch(mimeType: string, extension: string) {
    const normalisedMime = mimeType.trim().toLowerCase();
    const normalisedExtension = extension.trim().toLowerCase();

    const directMatch = this.allowedTypes.get(normalisedMime);
    if (directMatch) {
      return directMatch;
    }

    for (const match of this.allowedTypes.values()) {
      if (match.extensions.includes(normalisedExtension)) {
        return match;
      }
    }

    return undefined;
  }
}
