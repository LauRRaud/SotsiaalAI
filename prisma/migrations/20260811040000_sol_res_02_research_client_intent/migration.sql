-- SOL-RES-02: idempotentsusvõti sidus ainult kasutusühikut, mitte tööd ennast. Sama võtmega sai
-- käivitada järjest uusi täismahus uuringuid, mille lõpp-commit taaskasutas juba arvestatud ühikut.
-- Kliendi kavatsus saab nüüd oma veeru ja (userId, clientIntentKey) on unikaalne: üks kavatsus =
-- üks reservatsioon = üks töö. NULL jääb piiranguta, seega võtmeta vanad ja sisemised tööd ei muutu.
ALTER TABLE "ResearchJob" ADD COLUMN IF NOT EXISTS "clientIntentKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchJob_userId_clientIntentKey_key"
ON "ResearchJob"("userId", "clientIntentKey");
