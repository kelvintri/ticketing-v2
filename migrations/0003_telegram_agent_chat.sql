ALTER TABLE "Agent" ADD COLUMN "telegramChatId" TEXT;
CREATE UNIQUE INDEX "Agent_telegramChatId_key" ON "Agent"("telegramChatId");
