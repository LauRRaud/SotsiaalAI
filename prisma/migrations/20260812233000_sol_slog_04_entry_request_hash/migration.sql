-- SOL-SLOG-04 — sama clientRequestId ei tohi varjata erinevat teenuskirjet.
-- Nullable hoiab olemasolevad read puutumata; nende võrdlusräsi tuletab
-- teenusekiht vajadusel rea enda kanoniseeritud sisust.
ALTER TABLE "ServiceEntry" ADD COLUMN "clientRequestHash" TEXT;
