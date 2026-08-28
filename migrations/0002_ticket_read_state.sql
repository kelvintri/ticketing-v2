CREATE TABLE "TicketRead" (
    "agentId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("agentId", "ticketId"),
    CONSTRAINT "TicketRead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE,
    CONSTRAINT "TicketRead_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE
);
