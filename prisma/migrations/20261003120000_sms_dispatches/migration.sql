-- CreateTable
CREATE TABLE "sms_dispatches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_dispatches_user_id_created_at_idx" ON "sms_dispatches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sms_dispatches_phone_created_at_idx" ON "sms_dispatches"("phone", "created_at");

-- AddForeignKey
ALTER TABLE "sms_dispatches" ADD CONSTRAINT "sms_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

