import { JobResourceType } from '@prisma/client';

const MB = 1024 * 1024;

export type UploadableResourceType = Exclude<
  JobResourceType,
  'YOUTUBE' | 'LINK'
>;

type FileRule = {
  maxBytes: number;
  mimeTypes: string[];
  /** True when the first bytes look like one of the allowed formats. */
  matches: (head: Buffer) => boolean;
};

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => head[offset + index] === byte);
const ascii = (value: string) => [...Buffer.from(value, 'latin1')];

const isPdf = (head: Buffer) => startsWith(head, ascii('%PDF'));
const isPng = (head: Buffer) =>
  startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isJpeg = (head: Buffer) => startsWith(head, [0xff, 0xd8, 0xff]);
const isGif = (head: Buffer) => startsWith(head, ascii('GIF8'));
const isWebp = (head: Buffer) =>
  startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8);
/** MP4, MOV and M4A all carry an `ftyp` box at offset 4. */
const isIsoMedia = (head: Buffer) => startsWith(head, ascii('ftyp'), 4);
/** WebM / Matroska (EBML header). */
const isWebm = (head: Buffer) => startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]);
const isMp3 = (head: Buffer) =>
  startsWith(head, ascii('ID3')) ||
  (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0);
const isWav = (head: Buffer) =>
  startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WAVE'), 8);
const isOgg = (head: Buffer) => startsWith(head, ascii('OggS'));
/** DOCX, XLSX and PPTX are zip containers. */
const isZip = (head: Buffer) => startsWith(head, [0x50, 0x4b, 0x03, 0x04]);

export const resourceFileRules: Record<UploadableResourceType, FileRule> = {
  PDF: { maxBytes: 25 * MB, mimeTypes: ['application/pdf'], matches: isPdf },
  IMAGE: {
    maxBytes: 10 * MB,
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    matches: (head) =>
      isPng(head) || isJpeg(head) || isWebp(head) || isGif(head),
  },
  VIDEO: {
    maxBytes: 500 * MB,
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    matches: (head) => isIsoMedia(head) || isWebm(head),
  },
  AUDIO: {
    maxBytes: 50 * MB,
    mimeTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/wav',
      'audio/x-wav',
      'audio/webm',
      'audio/ogg',
    ],
    matches: (head) =>
      isMp3(head) ||
      isIsoMedia(head) ||
      isWav(head) ||
      isWebm(head) ||
      isOgg(head),
  },
  DOCUMENT: {
    maxBytes: 25 * MB,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    matches: isZip,
  },
};

export function isUploadableType(
  type: JobResourceType,
): type is UploadableResourceType {
  return type in resourceFileRules;
}

/** Returns an error message, or null when the file is acceptable. */
export function checkResourceFile(
  type: UploadableResourceType,
  file: { mimeType: string; sizeBytes: number },
): string | null {
  const rule = resourceFileRules[type];
  if (!rule.mimeTypes.includes(file.mimeType)) {
    return `This file type isn't allowed for ${type.toLowerCase()} resources.`;
  }
  if (file.sizeBytes <= 0) {
    return 'The file is empty.';
  }
  if (file.sizeBytes > rule.maxBytes) {
    return `The file is too large. Maximum is ${rule.maxBytes / MB} MB.`;
  }
  return null;
}

/** Accepts youtube.com/watch, youtu.be and /shorts|/embed links. */
export function getYoutubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
        : null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
