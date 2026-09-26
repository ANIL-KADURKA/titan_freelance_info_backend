-- Normalize category names for case-insensitive uniqueness while preserving display names.
ALTER TABLE "job_categories"
ADD COLUMN "normalized_name" TEXT;

UPDATE "job_categories"
SET "normalized_name" = lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'));

ALTER TABLE "job_categories"
ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE UNIQUE INDEX "job_categories_normalized_name_key"
ON "job_categories"("normalized_name");
