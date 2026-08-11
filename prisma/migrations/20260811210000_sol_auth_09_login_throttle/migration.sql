-- SOL-AUTH-09: PIN-katsete loendur elas mooduli lokaalses `Map`-is, seega iga Next-instants
-- pidas oma arvet ja iga restart nullis kõik. Neljakohalise PIN-i 10 000 variandi juures oli
-- see ainus serveripoolne konto-kaitse.
--
-- `subject` on e-posti räsi (või usaldatud edge-proxy IP), MITTE kasutaja ID: kui loendur
-- käiks konto järgi, ütleks lukustumine ise ära, kas konto on olemas — täpselt see leke, mille
-- SOL-AUTH-10 sulgeb. Sellepärast ei ole siin ka võõrvõtit `User`-i peale.
--
-- Uus tabel; olemasolevaid ridu ei puudutata.
CREATE TABLE IF NOT EXISTS "AuthThrottleCounter" (
  "id"           TEXT NOT NULL,
  "scope"        TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "count"        INTEGER NOT NULL DEFAULT 0,
  "windowEndsAt" TIMESTAMP(3) NOT NULL,
  "lockedUntil"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthThrottleCounter_pkey" PRIMARY KEY ("id")
);

-- Üks loendur ühe (pind, subjekt) paari kohta. See unikaalsus ON limiit: ilma temata
-- teeksid kaks paralleelset katset kaks rida ja mõlemad loeksid „esimene katse".
CREATE UNIQUE INDEX IF NOT EXISTS "AuthThrottleCounter_scope_subject_key"
  ON "AuthThrottleCounter"("scope", "subject");

-- Aegunud loendurite koristuseks.
CREATE INDEX IF NOT EXISTS "AuthThrottleCounter_windowEndsAt_idx"
  ON "AuthThrottleCounter"("windowEndsAt");
