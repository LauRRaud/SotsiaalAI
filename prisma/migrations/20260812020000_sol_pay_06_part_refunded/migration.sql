-- SOL-PAY-06: provideri `PART_REFUNDED` mapiti samasse `REFUNDED` väärtusse nagu täielik
-- tagastus, ja `REFUNDED` vaiketegevus on `cancel`. Seega 0,01 € korrigeerimine lõpetas kogu
-- ligipääsu, revoke'is korduvmakse mandaadi ja sponsorkutse puhul võttis ära ka juba antud
-- tellimuse ning ruumiliikmesuse.
--
-- Osaline tagastus saab oma seisu ja tagastatud summa oma veeru. Õigus lõpeb siis, kui makse on
-- TÄIELIKULT tagastatud — mitte siis, kui tagastati üks sent. Olemasolevaid ridu ei puudutata.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PART_REFUNDED';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(10,2);
