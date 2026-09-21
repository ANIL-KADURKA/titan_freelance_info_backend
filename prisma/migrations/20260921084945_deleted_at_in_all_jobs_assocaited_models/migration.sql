-- DropForeignKey
ALTER TABLE "job_application_fields" DROP CONSTRAINT "job_application_fields_job_id_fkey";

-- DropForeignKey
ALTER TABLE "job_eligibility_rules" DROP CONSTRAINT "job_eligibility_rules_job_id_fkey";

-- AlterTable
ALTER TABLE "job_application_fields" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "job_eligibility_rules" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- AddForeignKey
ALTER TABLE "job_application_fields" ADD CONSTRAINT "job_application_fields_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_eligibility_rules" ADD CONSTRAINT "job_eligibility_rules_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
