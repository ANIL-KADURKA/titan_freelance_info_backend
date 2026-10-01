import { BadRequestException } from '@nestjs/common';

/**
 * Normalises a user-entered mobile number to E.164 (e.g. "+919876543210").
 * Bare 10-digit numbers are treated as Indian mobiles.
 */
export function normalizePhone(raw: string): string {
  const compact = raw.trim().replace(/[\s()-]/g, '');
  let phone = compact;

  if (/^[6-9]\d{9}$/.test(compact)) {
    phone = `+91${compact}`;
  } else if (/^91[6-9]\d{9}$/.test(compact)) {
    phone = `+${compact}`;
  } else if (/^0[6-9]\d{9}$/.test(compact)) {
    phone = `+91${compact.slice(1)}`;
  }

  if (!/^\+\d{10,15}$/.test(phone)) {
    throw new BadRequestException('Enter a valid mobile number');
  }

  return phone;
}
