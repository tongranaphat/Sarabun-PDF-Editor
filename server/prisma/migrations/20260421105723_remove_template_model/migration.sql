/*
  Warnings:

  - You are about to drop the column `templateId` on the `ReportInstance` table. All the data in the column will be lost.
  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReportInstance" DROP CONSTRAINT "ReportInstance_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_originTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_ownerId_fkey";

-- AlterTable
ALTER TABLE "ReportInstance" DROP COLUMN "templateId",
ADD COLUMN     "data" JSONB;

-- DropTable
DROP TABLE "Template";

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfCache" (
    "OriginalFileId" TEXT NOT NULL,
    "OriginalFile" BOOLEAN NOT NULL DEFAULT true,
    "FileName" TEXT NOT NULL,
    "OriginalUrlorPath" TEXT NOT NULL,
    "FilePath" TEXT NOT NULL,
    "EditedFile" BOOLEAN NOT NULL DEFAULT false,
    "TempFilePath" TEXT,
    "editState" JSONB,
    "EditedFilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEditAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfCache_pkey" PRIMARY KEY ("OriginalFileId")
);

-- CreateTable
CREATE TABLE "Signatory" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "signatureImage" TEXT,
    "variableName" TEXT NOT NULL,
    "prefixText" TEXT,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signatory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StampConfig" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL DEFAULT 'โรงเรียนทดสอบ',
    "seqNo" INTEGER NOT NULL,
    "pdfCacheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StampConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signatory_variableName_key" ON "Signatory"("variableName");

-- CreateIndex
CREATE UNIQUE INDEX "StampConfig_pdfCacheId_key" ON "StampConfig"("pdfCacheId");

-- AddForeignKey
ALTER TABLE "StampConfig" ADD CONSTRAINT "StampConfig_pdfCacheId_fkey" FOREIGN KEY ("pdfCacheId") REFERENCES "PdfCache"("OriginalFileId") ON DELETE CASCADE ON UPDATE CASCADE;
