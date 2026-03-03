-- AddColumn: guestName, guestPhone, note, createdById to Reservation table
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestName"   TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestPhone"  TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "note"        TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- Optional FK to User (nullable)
ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_createdById_fkey"
    FOREIGN KEY ("createdById")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
