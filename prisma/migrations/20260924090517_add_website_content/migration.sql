-- CreateEnum
CREATE TYPE "WebsiteScreen" AS ENUM ('HOME', 'ABOUT', 'JOBS', 'CONTACT', 'FAQ', 'TESTIMONIALS', 'CASE_STUDIES', 'ANNOUNCEMENTS');

-- CreateTable
CREATE TABLE "website_content" (
    "id" TEXT NOT NULL,
    "screen_key" "WebsiteScreen" NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT,
    "quote" TEXT NOT NULL,
    "joined_at" DATE,
    "photo_id" UUID,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_content_screen_key_key" ON "website_content"("screen_key");

-- CreateIndex
CREATE INDEX "testimonials_status_sort_order_idx" ON "testimonials"("status", "sort_order");

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
