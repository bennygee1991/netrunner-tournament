-- CreateTable
CREATE TABLE "GuidePage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editorId" TEXT,
    "editorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuideRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuidePage_slug_key" ON "GuidePage"("slug");

-- CreateIndex
CREATE INDEX "GuidePage_published_sortOrder_idx" ON "GuidePage"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "GuideRevision_pageId_createdAt_idx" ON "GuideRevision"("pageId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuideRevision" ADD CONSTRAINT "GuideRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GuidePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideRevision" ADD CONSTRAINT "GuideRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
