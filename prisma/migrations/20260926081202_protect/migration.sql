-- DropForeignKey
ALTER TABLE "job_application_field_values" DROP CONSTRAINT "job_application_field_values_field_id_fkey";

-- AddForeignKey
ALTER TABLE "job_application_field_values" ADD CONSTRAINT "job_application_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "job_application_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
