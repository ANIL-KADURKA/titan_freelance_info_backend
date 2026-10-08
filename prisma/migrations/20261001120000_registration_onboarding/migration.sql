-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'TRAINER_AGREEMENT';

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PHONE_VERIFICATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "onboarding_completed_at" TIMESTAMPTZ,
ADD COLUMN     "phone_verified_at" TIMESTAMPTZ,
ADD COLUMN     "referral_source" VARCHAR(60);

-- AlterTable
ALTER TABLE "auth_otps" ADD COLUMN     "target" VARCHAR(320);

-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "signature_name" TEXT;

