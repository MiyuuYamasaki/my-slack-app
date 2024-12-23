-- DropForeignKey
ALTER TABLE "StatusRecord" DROP CONSTRAINT "StatusRecord_user_id_fkey";

-- AlterTable
ALTER TABLE "StatusRecord" ALTER COLUMN "user_id" SET DATA TYPE TEXT;
