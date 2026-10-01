-- CreateEnum
CREATE TYPE "JobResourceType" AS ENUM ('PDF', 'VIDEO', 'IMAGE', 'AUDIO', 'DOCUMENT', 'YOUTUBE', 'LINK');

-- CreateTable
CREATE TABLE "job_resources" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "type" "JobResourceType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "file_id" UUID,
    "url" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_resources_job_id_display_order_idx" ON "job_resources"("job_id", "display_order");

-- CreateIndex
CREATE INDEX "job_resources_file_id_idx" ON "job_resources"("file_id");

-- AddForeignKey
ALTER TABLE "job_resources" ADD CONSTRAINT "job_resources_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_resources" ADD CONSTRAINT "job_resources_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

