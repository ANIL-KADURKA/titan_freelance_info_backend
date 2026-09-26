-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- DropIndex
DROP INDEX "job_categories_name_key";

-- AlterTable
ALTER TABLE "job_application_fields" ADD COLUMN     "document_type_id" UUID;

-- AlterTable
ALTER TABLE "job_categories" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "application_no" VARCHAR(30) NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "status_changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cover_note" TEXT,
    "rejection_reason" TEXT,
    "withdrawn_reason" TEXT,
    "assigned_to_id" UUID,
    "source" TEXT,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "changed_by_id" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "allowed_mime_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_size_bytes" BIGINT,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "file_object_id" UUID NOT NULL,
    "field_key" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ,
    "verified_by_id" UUID,
    "verification_comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_field_values" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_application_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_no_key" ON "applications"("application_no");

-- CreateIndex
CREATE INDEX "applications_job_id_status_idx" ON "applications"("job_id", "status");

-- CreateIndex
CREATE INDEX "applications_status_status_changed_at_idx" ON "applications"("status", "status_changed_at");

-- CreateIndex
CREATE INDEX "applications_assigned_to_id_idx" ON "applications"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_user_id_job_id_key" ON "applications"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_created_at_idx" ON "application_status_history"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_key_key" ON "document_types"("key");

-- CreateIndex
CREATE INDEX "job_application_documents_application_id_idx" ON "job_application_documents"("application_id");

-- CreateIndex
CREATE INDEX "job_application_documents_application_id_field_key_idx" ON "job_application_documents"("application_id", "field_key");

-- CreateIndex
CREATE INDEX "job_application_documents_document_type_id_idx" ON "job_application_documents"("document_type_id");

-- CreateIndex
CREATE INDEX "job_application_documents_file_object_id_idx" ON "job_application_documents"("file_object_id");

-- CreateIndex
CREATE INDEX "job_application_field_values_application_id_idx" ON "job_application_field_values"("application_id");

-- CreateIndex
CREATE INDEX "job_application_field_values_field_id_idx" ON "job_application_field_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_field_values_application_id_field_id_key" ON "job_application_field_values"("application_id", "field_id");

-- CreateIndex
CREATE INDEX "job_application_fields_document_type_id_idx" ON "job_application_fields"("document_type_id");

-- AddForeignKey
ALTER TABLE "job_application_fields" ADD CONSTRAINT "job_application_fields_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_documents" ADD CONSTRAINT "job_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_documents" ADD CONSTRAINT "job_application_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_documents" ADD CONSTRAINT "job_application_documents_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_documents" ADD CONSTRAINT "job_application_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_field_values" ADD CONSTRAINT "job_application_field_values_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_field_values" ADD CONSTRAINT "job_application_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "job_application_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
