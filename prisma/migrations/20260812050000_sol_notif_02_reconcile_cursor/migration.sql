-- SOL-NOTIF-02: reconciler luges seitset allikat ID-kursoriga, aga alustas IGAL käivitusel
-- `cursor = null` pealt ja katkestas 100 lehekülje järel. Allikaread ei saa „reconciled" märget
-- (deduplikatsioon käib eraldi `NotificationEvent.dedupeKey` kaudu), seega järgmine jooks luges
-- uuesti samad kuni 10 000 vanimat rida ja hilisemateni ei jõudnud kunagi.
--
-- Edenemine on nüüd püsiv ja RINGI KÄIV: allika lõppu jõudes salvestatakse NULL ja järgmine
-- jooks alustab algusest. Vastasel juhul jääksid välja read, mis muutuvad sobivaks alles hiljem
-- (nt eelpöördumine, mille `nextContactOn` saabub) — nende ID on vesimärgist vanem.
CREATE TABLE IF NOT EXISTS "NotificationReconcileCursor" (
  "source"    TEXT NOT NULL,
  "cursorId"  TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationReconcileCursor_pkey" PRIMARY KEY ("source")
);
