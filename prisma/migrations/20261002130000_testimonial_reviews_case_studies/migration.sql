-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'TESTIMONIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TESTIMONIAL_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'TESTIMONIAL_REVIEWED';

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "consented_at" TIMESTAMPTZ,
ADD COLUMN     "pending_photo_id" UUID,
ADD COLUMN     "pending_quote" TEXT,
ADD COLUMN     "pending_rating" INTEGER,
ADD COLUMN     "pending_role" TEXT,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "reviewed_by_id" UUID,
ADD COLUMN     "submitted_at" TIMESTAMPTZ,
ADD COLUMN     "user_id" UUID;

-- Keep existing testimonials: Published -> Approved (live), Draft -> Pending,
-- Archived -> Withdrawn.
ALTER TABLE "testimonials" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "testimonials" ALTER COLUMN "status" TYPE "TestimonialStatus" USING (
  CASE "status"::text
    WHEN 'PUBLISHED' THEN 'APPROVED'
    WHEN 'ARCHIVED' THEN 'WITHDRAWN'
    ELSE 'PENDING'
  END
)::"TestimonialStatus";
ALTER TABLE "testimonials" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "case_studies" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "person_name" VARCHAR(120) NOT NULL,
    "person_role" VARCHAR(120),
    "photo_id" UUID,
    "user_id" UUID,
    "job_id" UUID,
    "background" TEXT NOT NULL,
    "how_it_began" TEXT NOT NULL,
    "getting_selected" TEXT NOT NULL,
    "finding_footing" TEXT NOT NULL,
    "hard_parts" TEXT NOT NULL,
    "support" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "duration_text" VARCHAR(60),
    "earnings_text" TEXT,
    "consent_recorded_at" TIMESTAMPTZ,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_slug_key" ON "case_studies"("slug");

-- CreateIndex
CREATE INDEX "case_studies_status_sort_order_idx" ON "case_studies"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "testimonials_user_id_key" ON "testimonials"("user_id");

-- CreateIndex
-- This index was created by 20260924090517_add_website_content. Keep this
-- idempotent because this migration changes the testimonials.status enum type.
CREATE INDEX IF NOT EXISTS "testimonials_status_sort_order_idx" ON "testimonials"("status", "sort_order");

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_pending_photo_id_fkey" FOREIGN KEY ("pending_photo_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Move the case studies that were hard-coded in the frontend into the table.
INSERT INTO "case_studies" ("id", "slug", "title", "summary", "person_name", "background", "how_it_began", "getting_selected", "finding_footing", "hard_parts", "support", "outcome", "duration_text", "earnings_text", "consent_recorded_at", "status", "published_at", "sort_order", "updated_at")
VALUES
  (gen_random_uuid(), 'rahul-freelance-data-analyst', 'From Job Application to Freelance Data Analyst', 'Rahul was looking for flexible project-based opportunities where he could apply his data analysis skills.', 'Rahul Kumar', 'Rahul was looking for flexible project-based opportunities where he could apply his data analysis skills.', 'Rahul discovered an opportunity through the Titan Freelance jobs section and submitted his application with the required documents.', 'Rahul submitted his application, completed the recruitment process, attended the scheduled call, and was selected for onboarding.', 'The onboarding process included document verification and setting up his freelancer profile before receiving a project assignment.', 'Rahul initially needed a structured way to track his daily work hours and understand the status of his submitted timesheets.', 'The platform provided project assignments, timesheet submission, approval tracking, earnings information, and payment history.', 'Rahul was able to manage his assigned project, submit his work regularly, and track his approved hours and earnings.', '6 months', 'Rahul could view his approved hours, applicable rates, earnings, billing records, and payment history through his dashboard.', '2026-01-10T10:00:00Z', 'PUBLISHED', '2026-02-01T10:00:00Z', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'priya-content-specialist', 'Building a Freelance Career Through Titan', 'Priya wanted to find project-based work that matched her content and communication skills.', 'Priya Sharma', 'Priya wanted to find project-based work that matched her content and communication skills.', 'She browsed available jobs, created an account, completed her profile, and submitted an application.', 'Her application progressed through review and shortlisting before the scheduled recruitment call and selection.', 'Priya completed the required onboarding steps and document verification before becoming an active freelancer.', 'Managing work records and keeping track of submitted and approved hours was initially difficult.', 'Titan provided a centralized dashboard for projects, timesheets, approvals, earnings, billing, and payments.', 'Priya was able to consistently track her work and maintain a clear record of her freelance activities.', '8 months', 'Her dashboard provided visibility into approved hours, earnings calculations, billing records, and payment status.', '2026-02-15T09:30:00Z', 'PUBLISHED', '2026-03-01T10:00:00Z', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'arjun-software-engineer', 'From Selection to Software Engineering Project', 'Arjun was seeking freelance software engineering projects that would allow him to work on real-world assignments.', 'Arjun Reddy', 'Arjun was seeking freelance software engineering projects that would allow him to work on real-world assignments.', 'Arjun applied for a suitable software engineering opportunity through the Titan Freelance platform.', 'Arjun completed the application, recruitment review, scheduled call, and selection process before onboarding.', 'His freelancer profile was activated after completing the required onboarding process.', 'Arjun wanted a simple way to record daily hours and provide evidence of completed work.', 'The platform allowed him to submit daily timesheets along with work descriptions and screenshots or other work proof.', 'Arjun was able to maintain regular timesheets and monitor the approval status of his submitted work.', '1 year', 'Approved hours were used to calculate earnings based on the applicable project or freelancer rate.', '2026-03-20T11:00:00Z', 'PUBLISHED', '2026-04-01T10:00:00Z', 3, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
