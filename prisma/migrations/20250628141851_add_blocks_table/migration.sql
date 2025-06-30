/*
  Warnings:

  - Changed the type of `content` on the `BlogPost` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
-- First, add a new content_json column
ALTER TABLE "BlogPost" ADD COLUMN "content_json" JSONB;

-- Copy existing content to the new JSON column (treating it as a simple text block)
UPDATE "BlogPost" SET "content_json" = json_build_array(
  json_build_object(
    'id', 'legacy-' || "id",
    'type', 'text',
    'content', "content",
    'order', 0
  )
);

-- Make the new column NOT NULL
ALTER TABLE "BlogPost" ALTER COLUMN "content_json" SET NOT NULL;

-- Drop the old content column
ALTER TABLE "BlogPost" DROP COLUMN "content";

-- Rename the new column to content
ALTER TABLE "BlogPost" RENAME COLUMN "content_json" TO "content";

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
