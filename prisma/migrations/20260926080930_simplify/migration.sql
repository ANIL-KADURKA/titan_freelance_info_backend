/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `candidate_profile_documents` table. All the data in the column will be lost.
  - You are about to alter the column `max_size_bytes` on the `document_types` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- DropIndex
DROP INDEX "candidate_profile_documents_user_id_document_type_id_is_cur_idx";

-- DropIndex
DROP INDEX "candidate_profile_values_user_id_idx";

-- DropIndex
DROP INDEX "job_application_documents_application_id_idx";

-- DropIndex
DROP INDEX "job_application_field_values_application_id_idx";

-- DropIndex
DROP INDEX "job_application_fields_job_id_idx";

-- DropIndex
DROP INDEX "job_eligibility_rules_job_id_idx";

-- DropIndex
DROP INDEX "user_addresses_user_id_idx";

-- AlterTable
ALTER TABLE "candidate_profile_documents" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "document_types" ALTER COLUMN "max_size_bytes" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "candidate_profile_documents_user_id_document_type_id_is_cur_idx" ON "candidate_profile_documents"("user_id", "document_type_id", "is_current");
