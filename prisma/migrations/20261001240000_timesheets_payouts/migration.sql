-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TIMESHEET_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'TIMESHEET_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_SENT';

-- CreateTable
CREATE TABLE "timesheet_entries" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "currency" "PayCurrency" NOT NULL,
    "unit" "PayUnit" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'SUBMITTED',
    "rejection_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "PayCurrency" NOT NULL,
    "reference" VARCHAR(120),
    "note" TEXT,
    "proof_file_id" UUID,
    "payment_method_id" UUID,
    "payment_method_label" VARCHAR(200),
    "paid_by_id" UUID,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_entries_user_id_status_idx" ON "timesheet_entries"("user_id", "status");

-- CreateIndex
CREATE INDEX "timesheet_entries_job_id_work_date_idx" ON "timesheet_entries"("job_id", "work_date");

-- CreateIndex
CREATE INDEX "timesheet_entries_status_idx" ON "timesheet_entries"("status");

-- CreateIndex
CREATE INDEX "timesheet_entries_payout_id_idx" ON "timesheet_entries"("payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_entries_application_id_work_date_key" ON "timesheet_entries"("application_id", "work_date");

-- CreateIndex
CREATE INDEX "payouts_user_id_paid_at_idx" ON "payouts"("user_id", "paid_at");

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "user_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

