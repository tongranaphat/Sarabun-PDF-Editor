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

CREATE TABLE IF NOT EXISTS public."User" (
    id text NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Variable" (
    id text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    scope text DEFAULT 'USER'::text NOT NULL,
    "ownerId" text
);

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

CREATE TABLE IF NOT EXISTS public."Signatory" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    "signatureImage" text,
    "variableName" text NOT NULL,
    "prefixText" text,
    "position" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public."StampConfig" (
    id text NOT NULL,
    "schoolName" text DEFAULT 'โรงเรียนทดสอบ'::text NOT NULL,
    "seqNo" integer NOT NULL,
    "pdfCacheId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

DO $$ BEGIN
    ALTER TABLE ONLY public."User" ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ONLY public."Variable" ADD CONSTRAINT "Variable_pkey" PRIMARY KEY (id);
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

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON public."User" USING btree (username);
CREATE UNIQUE INDEX IF NOT EXISTS "Signatory_variableName_key" ON public."Signatory" USING btree ("variableName");
CREATE UNIQUE INDEX IF NOT EXISTS "StampConfig_pdfCacheId_key" ON public."StampConfig" USING btree ("pdfCacheId");

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

INSERT INTO public."Signatory" (id, "fullName", "signatureImage", "variableName", "prefixText", "position", "createdAt") VALUES
('8c86513f-50f3-42aa-b4a8-4df5610dd020', 'นายเทสเตอร์ ทดลองระบบ', '/uploads/signatures/signature (2).png', '{{test_sig}}', 'ขอมอบหมายให้ไปทดลองระบบ', 'นักทดลองระบบ', '2026-04-01 03:14:37.428')
ON CONFLICT (id) DO NOTHING;
