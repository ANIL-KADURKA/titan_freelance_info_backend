-- CreateEnum
CREATE TYPE "PayCurrency" AS ENUM ('INR', 'USD');

-- CreateEnum
CREATE TYPE "PayUnit" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'TASK', 'PROJECT');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "pay_amount" DECIMAL(12,2),
ADD COLUMN     "pay_currency" "PayCurrency",
ADD COLUMN     "pay_unit" "PayUnit";

