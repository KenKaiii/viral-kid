-- Add vision model support
-- AlterTable: Add supportsVision to OpenRouterModel
ALTER TABLE "OpenRouterModel" ADD COLUMN IF NOT EXISTS "supportsVision" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex for supportsVision
CREATE INDEX IF NOT EXISTS "OpenRouterModel_supportsVision_idx" ON "OpenRouterModel"("supportsVision");

-- AlterTable: Add selectedVisionModel to OpenRouterCredentials
ALTER TABLE "OpenRouterCredentials" ADD COLUMN IF NOT EXISTS "selectedVisionModel" TEXT;
