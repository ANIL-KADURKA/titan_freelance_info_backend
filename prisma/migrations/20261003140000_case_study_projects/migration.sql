-- Case studies become client-project write-ups (category, tags, headline
-- stats, problem/approach or project cards, optional breakdown table,
-- results, quote).
-- Existing freelancer stories are carried over: background → problem,
-- support → approach, outcome → quote; stats/results start empty.

-- DropForeignKey
ALTER TABLE "case_studies" DROP CONSTRAINT "case_studies_photo_id_fkey";
ALTER TABLE "case_studies" DROP CONSTRAINT "case_studies_user_id_fkey";
ALTER TABLE "case_studies" DROP CONSTRAINT "case_studies_job_id_fkey";

-- New columns (category gets a temporary default for existing rows)
ALTER TABLE "case_studies"
ADD COLUMN "approach_body" TEXT,
ADD COLUMN "approach_title" VARCHAR(200),
ADD COLUMN "breakdown" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "breakdown_title" VARCHAR(80),
ADD COLUMN "category" VARCHAR(60) NOT NULL DEFAULT 'Freelancer story',
ADD COLUMN "client_label" VARCHAR(80),
ADD COLUMN "cover_id" UUID,
ADD COLUMN "focus_tag" VARCHAR(60),
ADD COLUMN "is_upcoming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "period" VARCHAR(40),
ADD COLUMN "problem_body" TEXT,
ADD COLUMN "projects" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "problem_title" VARCHAR(200),
ADD COLUMN "quote" TEXT,
ADD COLUMN "quote_author" VARCHAR(160),
ADD COLUMN "results" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "results_title" VARCHAR(80),
ADD COLUMN "stats" JSONB NOT NULL DEFAULT '[]';

-- Carry existing stories over
UPDATE "case_studies" SET
  "cover_id" = "photo_id",
  "focus_tag" = "person_role",
  "problem_title" = 'Where it started',
  "problem_body" = "background",
  "approach_title" = 'How Titan helped',
  "approach_body" = "support",
  "quote" = "outcome",
  "quote_author" = "person_name";

ALTER TABLE "case_studies" ALTER COLUMN "category" DROP DEFAULT;

-- Drop the old story columns
ALTER TABLE "case_studies"
DROP COLUMN "background",
DROP COLUMN "consent_recorded_at",
DROP COLUMN "duration_text",
DROP COLUMN "earnings_text",
DROP COLUMN "finding_footing",
DROP COLUMN "getting_selected",
DROP COLUMN "hard_parts",
DROP COLUMN "how_it_began",
DROP COLUMN "job_id",
DROP COLUMN "outcome",
DROP COLUMN "person_name",
DROP COLUMN "person_role",
DROP COLUMN "photo_id",
DROP COLUMN "support",
DROP COLUMN "user_id";

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
