/*
  Warnings:

  - Made the column `leave_check` on table `record` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "record" ALTER COLUMN "ymd" SET DATA TYPE TEXT,
ALTER COLUMN "leave_check" SET NOT NULL;
