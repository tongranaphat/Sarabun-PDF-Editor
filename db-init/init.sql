--
-- Sarabun System - Database Init
-- ตรงกับ prisma/schema.prisma (ไม่มี Template)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';
SET default_table_access_method = heap;

-- ============================================
-- Tables
-- ============================================

-- User
CREATE TABLE IF NOT EXISTS public."User" (
    id text NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);

-- Variable
CREATE TABLE IF NOT EXISTS public."Variable" (
    id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    scope text DEFAULT 'USER'::text NOT NULL,
    "ownerId" text
);

-- ReportInstance
CREATE TABLE IF NOT EXISTS public."ReportInstance" (
    id text NOT NULL,
    name text NOT NULL,
    "variableSnapshot" jsonb,
    pages jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "pdfUrl" text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

-- Asset
CREATE TABLE IF NOT EXISTS public."Asset" (
    id text NOT NULL,
    filename text NOT NULL,
    mimetype text NOT NULL,
    filepath text NOT NULL,
    url text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- PdfCache
CREATE TABLE IF NOT EXISTS public."PdfCache" (
    "OriginalFileId" text NOT NULL,
    "OriginalFile" boolean DEFAULT true NOT NULL,
    "FileName" text NOT NULL,
    "OriginalUrlorPath" text NOT NULL,
    "FilePath" text NOT NULL,
    "EditedFile" boolean DEFAULT false NOT NULL,
    "TempFilePath" text,
    "editState" jsonb,
    "EditedFilePath" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastEditAt" timestamp(3) without time zone NOT NULL
);

-- Signatory
CREATE TABLE IF NOT EXISTS public."Signatory" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "signatureImage" text,
    "variableName" text NOT NULL,
    "prefixText" text,
    "position" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- StampConfig
CREATE TABLE IF NOT EXISTS public."StampConfig" (
    id text NOT NULL,
    "schoolName" text DEFAULT 'โรงเรียนทดสอบ'::text NOT NULL,
    "seqNo" integer NOT NULL,
    "pdfCacheId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

-- ============================================
-- Primary Keys
-- ============================================

DO $$ BEGIN
    ALTER TABLE ONLY public."User" ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."Variable" ADD CONSTRAINT "Variable_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."ReportInstance" ADD CONSTRAINT "ReportInstance_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."Asset" ADD CONSTRAINT "Asset_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."PdfCache" ADD CONSTRAINT "PdfCache_pkey" PRIMARY KEY ("OriginalFileId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."Signatory" ADD CONSTRAINT "Signatory_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."StampConfig" ADD CONSTRAINT "StampConfig_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Unique Indexes
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON public."User" USING btree (username);
CREATE UNIQUE INDEX IF NOT EXISTS "Signatory_variableName_key" ON public."Signatory" USING btree ("variableName");
CREATE UNIQUE INDEX IF NOT EXISTS "StampConfig_pdfCacheId_key" ON public."StampConfig" USING btree ("pdfCacheId");

-- ============================================
-- Foreign Keys
-- ============================================

DO $$ BEGIN
    ALTER TABLE ONLY public."Variable"
        ADD CONSTRAINT "Variable_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."StampConfig"
        ADD CONSTRAINT "StampConfig_pdfCacheId_fkey" FOREIGN KEY ("pdfCacheId") REFERENCES public."PdfCache"("OriginalFileId") ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Sample Data (ข้อมูลเริ่มต้น)
-- ============================================

-- Assets
INSERT INTO public."Asset" (id, filename, mimetype, filepath, url, "createdAt") VALUES
('c8a2f033-e53a-4da6-b2f9-a60172a13e3e', '1774863860446-reference_crops_forcep1.png', 'image/png', '/uploads/assets/1774863860446-reference_crops_forcep1.png', 'http://localhost:4011/uploads/assets/1774863860446-reference_crops_forcep1.png', '2026-03-30 09:44:20.453'),
('88e71e83-31df-44c5-9f52-9a1f0568b787', '1774928291327-reference_crops_plier.png', 'image/png', '/uploads/assets/1774928291327-reference_crops_plier.png', 'http://localhost:4011/uploads/assets/1774928291327-reference_crops_plier.png', '2026-03-31 03:38:11.331'),
('e9366bb1-9905-4a2b-a730-ca3c569fc7e9', '1775640614831-signature.png', 'image/png', '/uploads/assets/1775640614831-signature.png', 'http://localhost:4011/uploads/assets/1775640614831-signature.png', '2026-04-08 09:30:14.835')
ON CONFLICT (id) DO NOTHING;

-- Signatories
INSERT INTO public."Signatory" (id, "fullName", "signatureImage", "variableName", "prefixText", "position", "createdAt") VALUES
('8c86513f-50f3-42aa-b4a8-4df5610dd020', 'นายเทสเตอร์ ทดลองระบบ', '/uploads/signatures/signature (2).png', '{{test_sig}}', 'ขอมอบหมายให้ไปทดลองระบบ', 'นักทดลองระบบ', '2026-04-01 03:14:37.428')
ON CONFLICT (id) DO NOTHING;
