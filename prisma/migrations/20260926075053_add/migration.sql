-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "allow_candidate_reuse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "job_application_documents" ADD COLUMN     "candidate_document_id" UUID;

-- AlterTable
ALTER TABLE "job_application_fields" ADD COLUMN     "profile_field_id" UUID;

-- CreateTable
CREATE TABLE "candidate_profile_fields" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "field_type" "ApplicationFieldType" NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidate_profile_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profile_values" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidate_profile_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_profile_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "file_object_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidate_profile_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profile_fields_key_key" ON "candidate_profile_fields"("key");

-- CreateIndex
CREATE INDEX "candidate_profile_values_user_id_idx" ON "candidate_profile_values"("user_id");

-- CreateIndex
CREATE INDEX "candidate_profile_values_field_id_idx" ON "candidate_profile_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profile_values_user_id_field_id_key" ON "candidate_profile_values"("user_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profile_documents_file_object_id_key" ON "candidate_profile_documents"("file_object_id");

-- CreateIndex
CREATE INDEX "candidate_profile_documents_user_id_document_type_id_is_cur_idx" ON "candidate_profile_documents"("user_id", "document_type_id", "is_current", "deleted_at");

-- CreateIndex
CREATE INDEX "job_application_documents_candidate_document_id_idx" ON "job_application_documents"("candidate_document_id");

-- CreateIndex
CREATE INDEX "job_application_fields_profile_field_id_idx" ON "job_application_fields"("profile_field_id");

-- AddForeignKey
ALTER TABLE "job_application_fields" ADD CONSTRAINT "job_application_fields_profile_field_id_fkey" FOREIGN KEY ("profile_field_id") REFERENCES "candidate_profile_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_documents" ADD CONSTRAINT "job_application_documents_candidate_document_id_fkey" FOREIGN KEY ("candidate_document_id") REFERENCES "candidate_profile_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profile_values" ADD CONSTRAINT "candidate_profile_values_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profile_values" ADD CONSTRAINT "candidate_profile_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "candidate_profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profile_documents" ADD CONSTRAINT "candidate_profile_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profile_documents" ADD CONSTRAINT "candidate_profile_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profile_documents" ADD CONSTRAINT "candidate_profile_documents_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
