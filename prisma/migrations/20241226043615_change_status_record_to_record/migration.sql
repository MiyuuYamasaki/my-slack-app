-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "token" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record" (
    "id" SERIAL NOT NULL,
    "ymd" TIMESTAMP(3) NOT NULL,
    "selected_status" TEXT,
    "leave_check" INTEGER,
    "channel_id" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_slack_user_id_key" ON "user"("slack_user_id");

-- AddForeignKey
ALTER TABLE "record" ADD CONSTRAINT "record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("slack_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
