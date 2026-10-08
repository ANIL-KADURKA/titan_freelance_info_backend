-- AlterTable: Cloudinary URLs for job images (older S3 ids stay as a fallback).
ALTER TABLE "jobs" ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "logo_url" TEXT;
