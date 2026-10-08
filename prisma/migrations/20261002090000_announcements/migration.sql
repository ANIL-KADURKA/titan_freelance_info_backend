-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('ANNOUNCEMENT', 'NEW_PROJECT');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "job_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_status_pinned_published_at_idx" ON "announcements"("status", "pinned", "published_at");

-- CreateIndex
CREATE INDEX "announcements_expires_at_idx" ON "announcements"("expires_at");

-- CreateIndex
CREATE INDEX "announcements_job_id_idx" ON "announcements"("job_id");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

