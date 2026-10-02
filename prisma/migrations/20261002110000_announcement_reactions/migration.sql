-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'TASK_UPDATE', 'PAYMENT_UPDATE', 'PLATFORM_UPDATE', 'EVENT');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE');

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "announcement_reactions" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcement_reactions_announcement_id_type_idx" ON "announcement_reactions"("announcement_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reactions_announcement_id_user_id_type_key" ON "announcement_reactions"("announcement_id", "user_id", "type");

-- AddForeignKey
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

