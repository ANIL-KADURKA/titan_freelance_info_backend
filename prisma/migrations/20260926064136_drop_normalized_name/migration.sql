/*
  Warnings:

  - You are about to drop the column `normalized_name` on the `job_categories` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `job_categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - A unique constraint covering the columns `[name]` on the table `job_categories` will be added. If there are existing duplicate values, this will fail.

*/
-- The normalized-name migration has a later timestamp and therefore runs after
-- this migration in a fresh shadow database. Make this cleanup order-safe.
DROP INDEX IF EXISTS "job_categories_normalized_name_key";

-- AlterTable
ALTER TABLE "job_categories"
DROP COLUMN IF EXISTS "normalized_name",
ALTER COLUMN "name" SET DATA TYPE VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_name_key" ON "job_categories"("name");
