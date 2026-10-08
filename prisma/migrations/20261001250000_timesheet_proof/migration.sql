-- AlterTable
ALTER TABLE "timesheet_entries" ADD COLUMN     "proof_file_id" UUID;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

