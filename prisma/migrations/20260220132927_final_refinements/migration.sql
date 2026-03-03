-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "originalUnitPrice" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "cashPhysical" REAL NOT NULL DEFAULT 0,
    "cashDifference" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ShiftStats_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShiftStats" ("expensesTotal", "ordersRevenue", "paymentsCard", "paymentsCash", "paymentsWallet", "salariesTotal", "sessionsRevenue", "shiftId", "totalRevenue") SELECT "expensesTotal", "ordersRevenue", "paymentsCard", "paymentsCash", "paymentsWallet", "salariesTotal", "sessionsRevenue", "shiftId", "totalRevenue" FROM "ShiftStats";
DROP TABLE "ShiftStats";
ALTER TABLE "new_ShiftStats" RENAME TO "ShiftStats";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
