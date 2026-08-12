-- SOL-PAY-10: sama recurring-mandaat sai kaks aktiivset rida. `token_return` callback ja PAID
-- webhook salvestasid mandaadi kumbki oma koodiga, callback ei lukustanud makse rida üldse ja
-- `providerMandateId` oli skeemis ainult indeks, mitte piir. Kaks rada võisid mõlemad lugeda
-- nulli ja luua eraldi aktiivse krüptitud tokenirea; osa ridu ei olnud ühegi tellimusega seotud,
-- aga kandsid endiselt kasutatavat mandaati — revoke, limiit ja võtmerotatsioon ei tea siis,
-- milline rida on autoriteetne.
--
-- NULL jääb piiranguta: mandaadita read on eri asjad, mitte duplikaadid.
CREATE UNIQUE INDEX IF NOT EXISTS "BillingMethod_provider_userId_providerMandateId_key"
ON "BillingMethod"("provider", "userId", "providerMandateId");
