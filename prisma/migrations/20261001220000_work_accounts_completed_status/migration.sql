-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'COMPLETED';

-- CreateTable
CREATE TABLE "application_work_accounts" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "work_email" VARCHAR(254) NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "instructions" TEXT,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "application_work_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_work_accounts_application_id_key" ON "application_work_accounts"("application_id");

-- AddForeignKey
ALTER TABLE "application_work_accounts" ADD CONSTRAINT "application_work_accounts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_work_accounts" ADD CONSTRAINT "application_work_accounts_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

