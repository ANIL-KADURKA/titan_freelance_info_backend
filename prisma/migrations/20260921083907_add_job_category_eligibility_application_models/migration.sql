-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationFieldType" AS ENUM ('TEXT', 'SHORT_TEXT', 'NUMBER', 'EMAIL', 'URL', 'SELECT', 'MULTI_SELECT', 'DATE', 'FILE', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "EligibilityFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "EligibilityOperator" AS ENUM ('EQ', 'NE', 'GT', 'LT', 'GTE', 'LTE', 'IN', 'NOT_IN', 'EXISTS', 'CONTAINS');

-- CreateTable
CREATE TABLE "job_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "work_mode" "WorkMode" NOT NULL DEFAULT 'REMOTE',
    "duration" TEXT,
    "openings" INTEGER,
    "application_instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "work_instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additional_info" JSONB,
    "cover_image_id" UUID,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ,
    "application_deadline" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_fields" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "field_type" "ApplicationFieldType" NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_application_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_eligibility_rules" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "field_type" "EligibilityFieldType" NOT NULL,
    "operator" "EligibilityOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_slug_key" ON "job_categories"("slug");

-- CreateIndex
CREATE INDEX "job_categories_is_active_sort_order_idx" ON "job_categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_idx" ON "jobs"("status", "published_at");

-- CreateIndex
CREATE INDEX "jobs_category_id_idx" ON "jobs"("category_id");

-- CreateIndex
CREATE INDEX "jobs_created_by_id_idx" ON "jobs"("created_by_id");

-- CreateIndex
CREATE INDEX "jobs_application_deadline_idx" ON "jobs"("application_deadline");

-- CreateIndex
CREATE INDEX "jobs_deleted_at_idx" ON "jobs"("deleted_at");

-- CreateIndex
CREATE INDEX "job_application_fields_job_id_idx" ON "job_application_fields"("job_id");

-- CreateIndex
CREATE INDEX "job_application_fields_job_id_display_order_idx" ON "job_application_fields"("job_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_fields_job_id_field_key_key" ON "job_application_fields"("job_id", "field_key");

-- CreateIndex
CREATE INDEX "job_eligibility_rules_job_id_idx" ON "job_eligibility_rules"("job_id");

-- CreateIndex
CREATE INDEX "job_eligibility_rules_job_id_display_order_idx" ON "job_eligibility_rules"("job_id", "display_order");

-- CreateIndex
CREATE INDEX "job_eligibility_rules_job_id_field_key_idx" ON "job_eligibility_rules"("job_id", "field_key");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_fields" ADD CONSTRAINT "job_application_fields_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_eligibility_rules" ADD CONSTRAINT "job_eligibility_rules_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
