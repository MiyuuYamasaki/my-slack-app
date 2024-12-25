/*
  Warnings:

  - You are about to drop the column `created_at` on the `StatusRecord` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `StatusRecord` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - Added the required column `channel_id` to the `StatusRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leave_Check` to the `StatusRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ymd` to the `StatusRecord` table without a default value. This is not possible if the table is not empty.
  - Made the column `user_id` on table `StatusRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `selected_status` on table `StatusRecord` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `token` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StatusRecord" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "channel_id" TEXT NOT NULL,
ADD COLUMN     "leave_Check" INTEGER NOT NULL,
ADD COLUMN     "ymd" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "user_id" SET NOT NULL,
ALTER COLUMN "selected_status" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "token" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "StatusRecord" ADD CONSTRAINT "StatusRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("slack_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
