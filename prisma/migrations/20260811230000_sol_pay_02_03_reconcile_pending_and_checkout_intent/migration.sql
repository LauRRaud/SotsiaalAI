-- SOL-PAY-02: ebamäärane provideritulemus ei tohi maanduda terminaalsesse FAILED-i.
-- `FAILED` tähendab edaspidi AINULT providerilt kinnitatud eitust (webhook või selge 4xx
-- vastus). Timeout, katkenud võrk, 5xx ja meie enda kirjutusviga PÄRAST providerikutset
-- jäävad `RECONCILE_PENDING` seisu: raha võis liikuda, seega hilisem `PAID` peab need veel
-- üles korjama. Olemasolevaid ridu see ei puuduta — uut väärtust ei omista siin keegi.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'RECONCILE_PENDING';

-- SOL-PAY-03: checkout-init ei olnud idempotentne. Iga päring lõi uue juhusliku
-- `providerPaymentId`-ga makse ja uue provideritransaktsiooni, seega topeltklõps või kaks
-- vahekaarti võisid avada kaks tasutavat checkout'i ja mõlema tasumine pikendas sama
-- tellimust kaks korda. Kliendi kavatsus saab oma veeru ja (userId, clientIntentKey) on
-- unikaalne: üks kavatsus = üks makse. NULL jääb piiranguta, seega pärandread ja
-- serveripoolsed kordusmaksed ei muutu.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "clientIntentKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_userId_clientIntentKey_key"
ON "Payment"("userId", "clientIntentKey");

-- Lahendamata katse otsitakse üles seisu järgi (renewal-valik, reconciliation-worker,
-- admini loendur), mitte kasutaja järgi.
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
