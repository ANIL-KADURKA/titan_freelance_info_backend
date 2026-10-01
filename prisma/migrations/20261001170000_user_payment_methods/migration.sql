-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('UPI', 'BANK');

-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('VERIFICATION_PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "user_payment_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'VERIFICATION_PENDING',
    "upi_id" VARCHAR(256),
    "account_holder_name" VARCHAR(120),
    "account_number_encrypted" TEXT,
    "account_number_last4" VARCHAR(4),
    "ifsc" VARCHAR(11),
    "fingerprint" VARCHAR(64) NOT NULL,
    "rejection_reason" VARCHAR(500),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_payment_methods_user_id_deleted_at_idx" ON "user_payment_methods"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "user_payment_methods_status_created_at_idx" ON "user_payment_methods"("status", "created_at");

-- CreateIndex
CREATE INDEX "user_payment_methods_user_id_fingerprint_idx" ON "user_payment_methods"("user_id", "fingerprint");

-- AddForeignKey
ALTER TABLE "user_payment_methods" ADD CONSTRAINT "user_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_payment_methods" ADD CONSTRAINT "user_payment_methods_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

