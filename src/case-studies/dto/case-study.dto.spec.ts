import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UpdateCaseStudyDto } from './case-study.dto.js';

// Same options as main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

const validate = (body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype: UpdateCaseStudyDto });

describe('case study form (multipart)', () => {
  it('accepts lists sent as JSON strings', async () => {
    const dto = (await validate({
      title: 'Multi-Language Freelance Execution',
      imageUrl: '/images/case-2.webp',
      stats: JSON.stringify([{ value: '100%', label: 'Timesheet compliance' }]),
      projects: JSON.stringify([
        { name: 'Outlier — Aether', problem: 'p', approach: 'a' },
      ]),
      breakdown: JSON.stringify([
        { code: 'L1', text: 'Auto QA', value: '100%' },
      ]),
      results: JSON.stringify([{ value: '96%', label: 'Accuracy', note: 'n' }]),
      isUpcoming: 'false',
    })) as UpdateCaseStudyDto;
    expect(dto.stats).toEqual([
      { value: '100%', label: 'Timesheet compliance' },
    ]);
    expect(dto.results?.[0]?.note).toBe('n');
    expect(dto.imageUrl).toBe('/images/case-2.webp');
  });

  it('still rejects unknown fields inside a row', async () => {
    await expect(
      validate({
        stats: JSON.stringify([{ value: '1', label: 'x', extra: 1 }]),
      }),
    ).rejects.toThrow();
  });

  it('rejects an image link that is not https or a site path', async () => {
    await expect(
      validate({ imageUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow();
  });
});
