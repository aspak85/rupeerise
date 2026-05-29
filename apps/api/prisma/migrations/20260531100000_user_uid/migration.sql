-- Add sequential UID to User (auto-increment starting at 1001)
-- Step 1: Add column with a sequence starting at 1001
CREATE SEQUENCE "User_uid_seq" START 1001;
ALTER TABLE "User" ADD COLUMN "uid" INTEGER NOT NULL DEFAULT nextval('"User_uid_seq"');
ALTER SEQUENCE "User_uid_seq" OWNED BY "User"."uid";

-- Step 2: Backfill existing users with sequential UIDs based on creation order
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) + 1000 AS new_uid
  FROM "User"
)
UPDATE "User" SET "uid" = ranked.new_uid FROM ranked WHERE "User"."id" = ranked."id";

-- Step 3: Create unique index
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");
