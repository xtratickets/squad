-- CreateTable
CREATE TABLE "ReceiptSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "snapshotData" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "roomId" TEXT,
    "sessionId" TEXT,
    "shiftId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Order_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdById", "id", "roomId", "sessionId", "shiftId", "status", "type") SELECT "createdById", "id", "roomId", "sessionId", "shiftId", "status", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_sessionId_idx" ON "Order"("sessionId");
CREATE INDEX "Order_shiftId_idx" ON "Order"("shiftId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ReceiptSnapshot_type_referenceId_idx" ON "ReceiptSnapshot"("type", "referenceId");
