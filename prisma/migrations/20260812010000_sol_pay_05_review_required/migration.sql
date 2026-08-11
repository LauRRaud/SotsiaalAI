-- SOL-PAY-05: allkirjastatud webhooki `PAID` otsuseks piisas kehtivast MAC-ist, leitavast
-- viitest ja PAID-iks mapitavast staatusest — makse summat ja valuutat ei võrreldud kunagi
-- kohaliku reaga, kuigi need on `Payment` peal olemas. Väiksem või vale makse oleks andnud
-- täismahus kuu või sponsorkutse õiguse.
--
-- `REVIEW_REQUIRED` on selle otsuse kolmas väljund: allkiri kehtib, aga sõnum ei vasta sellele
-- maksele. Õigust ei anta ja automaatika seda ise ei lahenda — seis on inimesele nähtav.
-- Olemasolevaid ridu see ei puuduta.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
