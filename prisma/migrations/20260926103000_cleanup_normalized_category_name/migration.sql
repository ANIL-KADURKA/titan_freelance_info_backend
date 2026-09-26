-- The historical normalized-name migration runs after drop_normalized_name
-- because of its timestamp. Remove its temporary column/index at the end so the
-- database matches the current JobCategory schema, which uses name and slug.
DROP INDEX IF EXISTS "job_categories_normalized_name_key";
ALTER TABLE "job_categories" DROP COLUMN IF EXISTS "normalized_name";
