CREATE TABLE "AgentConversation" (
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "previousInteractionId" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("channel", "externalId")
);

CREATE TABLE "TelegramUpdate" (
    "updateId" INTEGER NOT NULL PRIMARY KEY,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

CREATE INDEX "AgentConversation_updatedAt_idx" ON "AgentConversation"("updatedAt");
CREATE INDEX "TelegramUpdate_receivedAt_idx" ON "TelegramUpdate"("receivedAt");