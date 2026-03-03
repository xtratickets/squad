-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "itemsTotal" REAL NOT NULL,
    "discount" REAL NOT NULL,
    "serviceFee" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "tip" REAL NOT NULL DEFAULT 0,
    "finalTotal" REAL NOT NULL,
    CONSTRAINT "OrderCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderCharge" ("discount", "finalTotal", "id", "itemsTotal", "orderId", "serviceFee", "shiftId", "tax") SELECT "discount", "finalTotal", "id", "itemsTotal", "orderId", "serviceFee", "shiftId", "tax" FROM "OrderCharge";
DROP TABLE "OrderCharge";
ALTER TABLE "new_OrderCharge" RENAME TO "OrderCharge";
CREATE UNIQUE INDEX "OrderCharge_orderId_key" ON "OrderCharge"("orderId");
CREATE TABLE "new_SessionCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "billableMinutes" INTEGER NOT NULL,
    "hourlyPrice" REAL NOT NULL,
    "roomAmount" REAL NOT NULL,
    "ordersAmount" REAL NOT NULL,
    "discount" REAL NOT NULL,
    "serviceFee" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "tip" REAL NOT NULL DEFAULT 0,
    "finalTotal" REAL NOT NULL,
    CONSTRAINT "SessionCharge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SessionCharge" ("billableMinutes", "discount", "durationMinutes", "finalTotal", "hourlyPrice", "id", "ordersAmount", "roomAmount", "serviceFee", "sessionId", "shiftId", "tax") SELECT "billableMinutes", "discount", "durationMinutes", "finalTotal", "hourlyPrice", "id", "ordersAmount", "roomAmount", "serviceFee", "sessionId", "shiftId", "tax" FROM "SessionCharge";
DROP TABLE "SessionCharge";
ALTER TABLE "new_SessionCharge" RENAME TO "SessionCharge";
CREATE UNIQUE INDEX "SessionCharge_sessionId_key" ON "SessionCharge"("sessionId");
CREATE TABLE "new_ShiftStats" (
    "shiftId" TEXT NOT NULL PRIMARY KEY,
    "sessionsRevenue" REAL NOT NULL DEFAULT 0,
    "ordersRevenue" REAL NOT NULL DEFAULT 0,
    "paymentsCash" REAL NOT NULL DEFAULT 0,
    "paymentsCard" REAL NOT NULL DEFAULT 0,
    "paymentsWallet" REAL NOT NULL DEFAULT 0,
    "expensesTotal" REAL NOT NULL DEFAULT 0,
    "salariesTotal" REAL NOT NULL DEFAULT 0,
    "totalRevenue" REAL NOT NULL DEFAULT 0,
    "tipsTotal" REAL NOT NULL DEFAULT 0,
    "openingCash" REAL NOT NULL DEFAULT 0,
    "cashPhysical" REAL NOT NULL DEFAULT 0,
    "cashDifference" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ShiftStats_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShiftStats" ("cashDifference", "cashPhysical", "expensesTotal", "openingCash", "ordersRevenue", "paymentsCard", "paymentsCash", "paymentsWallet", "salariesTotal", "sessionsRevenue", "shiftId", "totalRevenue") SELECT "cashDifference", "cashPhysical", "expensesTotal", "openingCash", "ordersRevenue", "paymentsCard", "paymentsCash", "paymentsWallet", "salariesTotal", "sessionsRevenue", "shiftId", "totalRevenue" FROM "ShiftStats";
DROP TABLE "ShiftStats";
ALTER TABLE "new_ShiftStats" RENAME TO "ShiftStats";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
