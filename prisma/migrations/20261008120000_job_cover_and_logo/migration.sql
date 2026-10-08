-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "logo_id" UUID;

-- AddForeignKey
-- NOT VALID: existing cover_image_id values were never linked to a file, so
-- old rows aren't checked; every new or changed value is.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_logo_id_fkey" FOREIGN KEY ("logo_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
