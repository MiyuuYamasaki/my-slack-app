/*
  Warnings:

  - Made the column `selected_status` on table `record` required. This step will fail if there are existing NULL values in that column.
  - Made the column `leave_check` on table `record` required. This step will fail if there are existing NULL values in that column.
  - Made the column `channel_id` on table `record` required. This step will fail if there are existing NULL values in that column.
  - Made the column `token` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "record" ALTER COLUMN "selected_status" SET NOT NULL,
ALTER COLUMN "leave_check" SET NOT NULL,
ALTER COLUMN "channel_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "token" SET NOT NULL;
