-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "applications_deleted_at_idx" ON "applications"("deleted_at");
