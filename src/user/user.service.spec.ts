import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service.js';

describe('UserService', () => {
  it('converts education date strings to Date objects before updating', async () => {
    const updateMock = vi.fn().mockResolvedValue({ id: 'edu-1' });
    const prisma = {
      userEducation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'edu-1' }),
        update: updateMock,
      },
    } as any;

    const service = new UserService(prisma);

    await service.updateEducation('user-1', 'edu-1', {
      institution: 'Harvard University',
      degree: 'BSc',
      fieldOfStudy: 'Computer Science',
      startDate: '2020-09-01',
      endDate: '2024-06-30',
      grade: 'A',
    });

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'edu-1' },
      data: {
        institution: 'Harvard University',
        degree: 'BSc',
        fieldOfStudy: 'Computer Science',
        startDate: new Date('2020-09-01'),
        endDate: new Date('2024-06-30'),
        grade: 'A',
      },
    });
  });

  it('throws if the education record does not belong to the user', async () => {
    const prisma = {
      userEducation: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new UserService(prisma);

    await expect(
      service.updateEducation('user-1', 'edu-1', {
        institution: 'Harvard University',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
