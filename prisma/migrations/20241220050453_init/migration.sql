-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusRecord" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "selected_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_slack_user_id_key" ON "User"("slack_user_id");

-- AddForeignKey
ALTER TABLE "StatusRecord" ADD CONSTRAINT "StatusRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
