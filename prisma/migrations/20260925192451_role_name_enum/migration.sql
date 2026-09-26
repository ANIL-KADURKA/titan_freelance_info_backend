-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'RECRUITER', 'EMPLOYEE', 'CANDIDATE');

-- AlterTable
ALTER TABLE "roles"
ALTER COLUMN "name" TYPE "RoleName" USING "name"::"RoleName";
