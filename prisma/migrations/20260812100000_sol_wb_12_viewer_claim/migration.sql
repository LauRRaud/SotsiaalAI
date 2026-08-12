-- SOL-WB-12 (P1) — piloodivaataja ligipääsu ei saanud platvormi API kaudu ära võtta,
-- ja e-posti rida elas kontost kauem.
--
-- MIS OLI. Admini piloodi API pakkus ainult skoopide GET/POST-i ja vaataja
-- lisamise POST-i: puudusid viewer DELETE, skoobi PATCH/deaktiveerimine ja
-- aegumise muutmine. Valesti lisatud, rolli vahetanud või lahkunud vaataja
-- juurdepääsu ei saanud tavapärase haldusvooga eemaldada.
--
-- Ja `WellbeingPilotViewer.userId` oli `ON DELETE SET NULL`: konto kustutamisel
-- jäi rida alles, tema e-post edasi ja **samale aadressile hiljem loodud UUS
-- konto sobitus vana reaga** — pärides kustutatud inimese vaate tundlikule
-- koondile.
--
-- MIDA SEE MIGRATSIOON TEEB.
--
-- 1. `claimedAt`: e-posti rida on KUTSE, mitte igavene võti. Esimesel
--    kasutamisel seotakse ta konkreetse kontoga ja sellest hetkest e-post enam
--    ei sobitu. Kui see konto hiljem kustutatakse, jääb `claimedAt` alles ja rida
--    on inertne ka siis, kui kaskaad mingil põhjusel ei jõudnud temani.
--
-- 2. `ON DELETE CASCADE`: õigus anti INIMESELE. Konto kustumisel kaob ka
--    õigus — mitte ei jää lamama, ootama järgmist sama aadressiga kontot.
--    Piloodi konfiguratsioon ise (skoop, künnis) jääb puutumata; kaob ainult
--    üks vaataja rida.
--
-- Backfill: 12.08.2026 seisuga on tootmises 0 pilooti ja 0 vaatajat (mõõdetud).
-- Olemasolevad read (kui neid arenduskeskkonnas on) jäävad `claimedAt = NULL`
-- ehk „kutse on veel lunastamata" — see on nende tegelik seis.
ALTER TABLE "WellbeingPilotViewer" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);

ALTER TABLE "WellbeingPilotViewer" DROP CONSTRAINT IF EXISTS "WellbeingPilotViewer_userId_fkey";

ALTER TABLE "WellbeingPilotViewer"
  ADD CONSTRAINT "WellbeingPilotViewer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
