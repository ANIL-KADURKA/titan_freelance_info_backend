import { BadRequestException } from '@nestjs/common';
import type { UploadedDocument } from './document-validation.service.js';

export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** PNG / JPG / WebP up to 5 MB (magic bytes are checked again on upload). */
export function assertPhoto(file: UploadedDocument) {
  if (!PHOTO_TYPES.includes((file.mimetype ?? '').toLowerCase())) {
    throw new BadRequestException('Upload a PNG, JPG or WebP image.');
  }
  if ((file.size ?? file.buffer.length) > PHOTO_MAX_BYTES) {
    throw new BadRequestException('The image must be 5 MB or smaller.');
  }
}
