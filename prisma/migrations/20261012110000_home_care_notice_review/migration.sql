-- KODUTEENUS K5-s — teate põhjus „otsustaja küsis ülevaadet" (kava II.6.13).
--
-- Enne teenuse ülevaatust küsib omavalitsuse sotsiaaltöötaja kliendi kohta ülevaate. See
-- on sama teade mis K5-r, uue põhjusega REVIEW; teate teksti saab lisada viimaste kuude
-- arvud (rakenduses, veerge juurde ei tule).
--
-- Lubatud väärtuste hulk LAIENEB: eelmine rakenduse versioon uut väärtust ei kirjuta ja
-- vanad read vastavad uuele tingimusele. Tabel on värske ja väike, kontroll on kiire.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareDecisionNotice" DROP CONSTRAINT "CareDecisionNotice_reason_check";
ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_reason_check"
  CHECK ("reason" IN ('NEED_GROWN', 'NEED_REDUCED', 'SERVICE_UNFIT', 'OTHER_SERVICE', 'RELATIVE_CHANGED', 'REVIEW'));

-- Rollback (kommentaarina; eeldab, et REVIEW-ridu ei ole):
--   ALTER TABLE "CareDecisionNotice" DROP CONSTRAINT "CareDecisionNotice_reason_check";
--   ALTER TABLE "CareDecisionNotice" ADD CONSTRAINT "CareDecisionNotice_reason_check"
--     CHECK ("reason" IN ('NEED_GROWN', 'NEED_REDUCED', 'SERVICE_UNFIT', 'OTHER_SERVICE', 'RELATIVE_CHANGED'));
