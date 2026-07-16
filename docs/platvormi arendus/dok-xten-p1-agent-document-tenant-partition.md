# DOK-XTEN-P1 — agent-dokumentide püsiv omaniku- ja tenant-piir

## Staatus

Jätkupakett pärast DOK-XTEN-P0. P0 ei sõltu sellest tööst: üldotsingu fail-closed keeld välistab `source_type=agent_document` ja `collection_id=agent_documents` enne retrieval'i ka siis, kui legacy chunk'il puudub omaniku- või tenant-metadata.

## Eesmärk

Viia privaatsete agent-dokumentide otsing püsivalt autentitud omaniku- ja tenant-piiri taha ning eelistatult eraldi füüsilisse RAG-kollektsiooni või tenant-partitsiooni. Üldise põhivestluse ja süvauuringu jaoks jäävad agent-dokumendid ka pärast P1 tööd keelatuks.

## Kavandatav ulatus

1. Defineerida muutmatu RAG metadata leping vähemalt väljadele `owner_id`, `tenant_id`, `source_type`, `collection_id` ja `doc_id`.
2. Siduda privaatotsingu serveripoolne filter autentitud sessiooni identiteediga; brauseri payload ei tohi owner- ega tenant-ID-d määrata.
3. Viia agent-dokumendid eraldi füüsilisse kollektsiooni või samaväärsesse tenant-partitsiooni.
4. Planeerida legacy agent-dokumentide kontrollitud backfill ja ümberindekseerimine koos katkestus-, rollback- ja jäägikontrolliga.
5. Lisada ristkasutaja runtime-regressioonid, mis kontrollivad nii õiget omanikku kui võõrast kasutajat.

## P1-st teadlikult väljas

- DOK-XTEN-P0 keelu eemaldamine või lõdvendamine.
- Attribution'i, prompti või mudelijuhise kasutamine turvapiirina.
- Tootmisandmete ümberindekseerimine ilma eraldi kinnitatud käitusplaani ja hooldusaknaga.

## Valmisolekukriteeriumid

- Iga uus privaatne chunk kannab serveris tuletatud muutmatut owner-/tenant-identiteeti.
- Privaatotsing kasutab ainult serveris autentitud identiteeti ja täpset dokumendivalikut.
- Legacy backfill on mõõdetav, korratav ja nulljäägiga tagasipööratav.
- Sõltumatu kahe konto audit kinnitab 0 cross-tenant tulemust kõigis retrieval-kanalites.
