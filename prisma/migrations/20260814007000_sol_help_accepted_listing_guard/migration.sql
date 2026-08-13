ALTER TABLE "public"."HelpMatch"
  DROP CONSTRAINT "HelpMatch_requestId_fkey",
  ADD CONSTRAINT "HelpMatch_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."HelpMatch"
  DROP CONSTRAINT "HelpMatch_offerId_fkey",
  ADD CONSTRAINT "HelpMatch_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "public"."HelpOffer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
