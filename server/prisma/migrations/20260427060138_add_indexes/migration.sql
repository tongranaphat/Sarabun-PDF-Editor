-- CreateIndex
CREATE INDEX "PdfCache_OriginalUrlorPath_idx" ON "PdfCache"("OriginalUrlorPath");

-- CreateIndex
CREATE INDEX "PdfCache_FileName_idx" ON "PdfCache"("FileName");

-- CreateIndex
CREATE INDEX "PdfCache_createdAt_idx" ON "PdfCache"("createdAt");

-- CreateIndex
CREATE INDEX "StampConfig_seqNo_idx" ON "StampConfig"("seqNo");

-- CreateIndex
CREATE INDEX "Variable_key_idx" ON "Variable"("key");

-- CreateIndex
CREATE INDEX "Variable_scope_idx" ON "Variable"("scope");
