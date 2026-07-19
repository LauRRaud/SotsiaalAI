-- T14 WELLBEING-V2 teine viil (WB-V2-P2): „järgmine samm + kontrollkuupäev" ja „kas pidas?".
-- Puhtalt additiivne. Kõigil olemasolevatel kirjetel jäävad mõlemad veerud NULL-iks
-- ja nende käitumine ei muutu; kontrollpunktita kirje on ja jääb täiesti kehtivaks.

-- Kontrollpunkt elab vastustest ERALDI. „Kas pidas?" on hilisem muudatus ja kui ta
-- elaks `standardizedFields` sees, muutuks vastuste plokk pärast salvestamist —
-- see hägustaks TO-1 piiri („vastuseid ei muudeta kunagi kohapeal, parandus on uus kirje").
-- Siin jäävad vastused puutumatuks ja muutub ainult plaan/järelmärge.
ALTER TABLE "WellbeingRecord" ADD COLUMN "checkpointDueOn" TIMESTAMP(3);
ALTER TABLE "WellbeingRecord" ADD COLUMN "checkpoint" JSONB;

-- Skalaar + indeks, mitte JSON-väli: U1 taimer peab leidma saabunud kontrollpunktid
-- ilma kogu tabeli JSON-skaneeringuta. Enamik ridu on NULL, nii et indeks jääb väikeseks.
CREATE INDEX "WellbeingRecord_checkpointDueOn_idx" ON "WellbeingRecord"("checkpointDueOn");
