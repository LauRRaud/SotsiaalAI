-- SOL-PAY-11: worker piiras SMTP-kutset `Promise.race()` timeout'iga, aga ei katkestanud algset
-- saatmist; lease-taaste tõstis vana `SENDING` rea `RETRY`-ks teadmata, kas SMTP kirja vastu
-- võttis. Uus katse saatis sama kirja uuesti ILMA püsiva sõnumitunnuseta, seega adressaadi
-- postkasti jõudis kaks eri kirja.
--
-- Püsiv Message-ID teeb korduskatsest SAMA kirja (RFC 5322 järgi identifitseerib Message-ID
-- sõnumi). Olemasolevaid ridu ei puudutata — neil jääb väärtus NULL ja worker mindib puuduva
-- tunnuse esimesel katsel.
ALTER TABLE "PaymentEmailOutbox" ADD COLUMN IF NOT EXISTS "messageId" TEXT;
