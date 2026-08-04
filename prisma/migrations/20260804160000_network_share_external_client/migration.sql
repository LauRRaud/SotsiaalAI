-- COLLAB-P4 — klient ei pea olema platvormi kasutaja (omanik 04.08).
--
-- Võrgustikutöö on sotsiaaltöötaja tööülesanne ja klient saab info nagunii
-- hiljem; kasutajaks olemist EI SAA nõuda. Kui klient on kasutaja, kinnitab ta
-- ise; kui ei ole, kannab töötaja tema kinnituse üle ja meetod märgitakse.
--
-- Sama kahe-raja muster, mis "ServiceReferral"-il juba on: kasutaja VÕI väline
-- klient minimeeritud kujul. Väline rada ei dubleeri isikuandmeid rohkem kui
-- töötaja tänane märkmik.
--
-- "clientConfirmationMethod" hoiab kinnituse tõendiväärtust nähtavana: IN_APP on
-- ainus, kus klient ise vajutas. Ülejäänud kolm on töötaja ülekantud kinnitus ja
-- neid ei tohi esitada nii, nagu oleks klient ise vajutanud.

CREATE TYPE "ClientConfirmationMethod" AS ENUM ('IN_APP', 'IN_PERSON', 'PHONE', 'WRITTEN');

-- Klient muutub valikuliseks. FK käitumine muutub CASCADE -> SET NULL: kliendi
-- konto kustutamine ei tohi kustutada töötaja tööd, vaid muudab kirje väliseks.
ALTER TABLE "NetworkShare" DROP CONSTRAINT "NetworkShare_clientUserId_fkey";
ALTER TABLE "NetworkShare" ALTER COLUMN "clientUserId" DROP NOT NULL;
ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NetworkShare" ADD COLUMN "clientDisplayName" TEXT;
ALTER TABLE "NetworkShare" ADD COLUMN "clientExternalRef" TEXT;
ALTER TABLE "NetworkShare" ADD COLUMN "clientConfirmationMethod" "ClientConfirmationMethod";
ALTER TABLE "NetworkShare" ADD COLUMN "clientConfirmationAttestedById" TEXT;

ALTER TABLE "NetworkShare" ADD CONSTRAINT "NetworkShare_clientConfirmationAttestedById_fkey"
  FOREIGN KEY ("clientConfirmationAttestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
