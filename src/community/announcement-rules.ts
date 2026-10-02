import {
  AnnouncementStatus,
  AnnouncementType,
  JobStatus,
  type Prisma,
} from '@prisma/client';

/** New-project posts disappear from the feed after this long. */
export const NEW_PROJECT_POST_DAYS = 2;

/** Visible in the feed: published and not yet expired (null = never). */
export function liveWhere(now = new Date()): Prisma.AnnouncementWhereInput {
  return {
    status: AnnouncementStatus.PUBLISHED,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export function expiredWhere(now = new Date()): Prisma.AnnouncementWhereInput {
  return {
    status: AnnouncementStatus.PUBLISHED,
    expiresAt: { lte: now },
  };
}

/** Plain-text summary of a job for its community post. */
function excerpt(text: string, max = 280) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * The community post created when an admin ticks "Post to Community" on a
 * new job. It goes live with the job (a draft job gives a draft post) and
 * expires two days later.
 */
export function newProjectAnnouncement(
  job: {
    id: string;
    title: string;
    summary: string | null;
    description: string;
    status: JobStatus;
  },
  createdById: string,
  now = new Date(),
): Prisma.AnnouncementUncheckedCreateInput {
  const published = job.status === JobStatus.PUBLISHED;
  return {
    type: AnnouncementType.NEW_PROJECT,
    title: `New project: ${job.title}`.slice(0, 200),
    body: excerpt(job.summary || job.description),
    status: published ? AnnouncementStatus.PUBLISHED : AnnouncementStatus.DRAFT,
    publishedAt: published ? now : null,
    expiresAt: new Date(
      now.getTime() + NEW_PROJECT_POST_DAYS * 24 * 60 * 60 * 1000,
    ),
    jobId: job.id,
    createdById,
  };
}
