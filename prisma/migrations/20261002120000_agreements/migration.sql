-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_UPDATED';

-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "agreement_id" UUID;

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "change_note" VARCHAR(300),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agreements_major_minor_key" ON "agreements"("major", "minor");

-- CreateIndex
CREATE INDEX "consent_records_agreement_id_idx" ON "consent_records"("agreement_id");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed v1.0 with the agreement candidates have been signing so far, and link
-- their existing signatures to it.
INSERT INTO "agreements" ("id", "major", "minor", "title", "body", "change_note")
VALUES (
  gen_random_uuid(), 1, 0, 'Titan Trainer Agreement',
  $body$By signing this agreement you confirm that you have read, understood, and accept the following terms as an independent AI trainer on the Titan platform.

## 1. Scope of work
- You will complete data annotation, collection and review tasks assigned through Titan.
- Each project lists its own instructions, rates and deadlines — follow them for every submission.

## 2. Payments
- You are paid in ₹ for every approved task at the rate shown on the project.
- Rejected or incomplete submissions are not paid. Approved earnings are withdrawable to your verified bank account.

## 3. Quality
- Submissions are reviewed for accuracy. Repeated low-quality work may limit the projects offered to you.

## 4. Confidentiality & data
- Project data, instructions and client details are confidential. Do not copy, share or reuse them outside Titan.
- Recordings and content you submit become the property of the client once paid for.

## 5. Conduct & termination
- Fraud, quality manipulation, referral abuse, or harassment leads to suspension and forfeiture of unapproved amounts.
- You may stop working at any time; approved earnings remain withdrawable. Titan may suspend accounts that breach these terms.

## 6. General
- You work as an independent contractor — this agreement does not create employment.
- Titan may update this agreement; continued work after an update (and re-acceptance where required) means you accept the new terms.$body$,
  'Initial version'
);

UPDATE "consent_records"
SET "agreement_id" = (SELECT "id" FROM "agreements" WHERE "major" = 1 AND "minor" = 0)
WHERE "type" = 'TRAINER_AGREEMENT' AND "agreement_id" IS NULL;
