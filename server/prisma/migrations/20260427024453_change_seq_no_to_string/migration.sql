/*
  Warnings:

  - You are about to drop the `ReportInstance` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "StampConfig" ALTER COLUMN "seqNo" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "ReportInstance";
