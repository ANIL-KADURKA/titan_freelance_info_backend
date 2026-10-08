-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'JOB_OPENED';

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'UPCOMING';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "pre_apply_bonus" DECIMAL(12,2),
ADD COLUMN     "pre_apply_deadline" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "job_pre_applications" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "location" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_pre_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_pre_applications_user_id_idx" ON "job_pre_applications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_pre_applications_job_id_user_id_key" ON "job_pre_applications"("job_id", "user_id");

-- AddForeignKey
ALTER TABLE "job_pre_applications" ADD CONSTRAINT "job_pre_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_pre_applications" ADD CONSTRAINT "job_pre_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

