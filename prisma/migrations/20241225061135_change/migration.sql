/*
  Warnings:

  - You are about to drop the column `leave_Check` on the `StatusRecord` table. All the data in the column will be lost.
  - Added the required column `leave_check` to the `StatusRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StatusRecord" DROP COLUMN "leave_Check",
ADD COLUMN     "leave_check" INTEGER NOT NULL;
