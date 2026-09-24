# Codexi lähtepakett: SotsiaalAI uus RAG/Graph-teadmistesüsteem

Versioon 0.1 • 2026-09-05

See pakett on arendusülesanne, sisendnäited ja vastuvõtutestide kirjeldused. See ei ole valmis rakendus. Rakenduskoodi, päris-Qdranti otsingut ega Luna vastamist pole selle paketi loomisel käivitatud. Materjalide baidid ja testikirjelduste JSON-vorming on kontrollitud.

## Paketi sisu

| Fail/kaust | Otstarve |
| --- | --- |
| `CODEX_RAG_GRAPH_LAHTEULESANNE.md` | Terviklahenduse piirid, andmemudel, töövood, etapid ja vastuvõtt |
| `NAIDISFAILIDE_AUDIT.md` | Konkreetse artikli ja metafaili leiud ning väljade ülekandekaart |
| `tests/acceptance_cases.json` | Etapiviisilised testikirjeldused, millest Codex loob käivitatavad testid |
| `inputs/` | Kolm muutmata kasutaja sisendfaili ja nende kontrollsummade manifest |

Ava Codexis tegelik arendusrepositoorium ning tee see kaust seal kättesaadavaks näiteks nimega `rag-spec-v0.1`. Ära kirjuta olemasolevaid projekti juhiseid või algmaterjale selle pakiga üle. Materjalid ei kuulu automaatselt avalikku Git-repositooriumi.

## Codexile antav esimene ülesanne

```text
Loe rag-spec-v0.1/CODEX_RAG_GRAPH_LAHTEULESANNE.md,
rag-spec-v0.1/NAIDISFAILIDE_AUDIT.md ja asjakohased testikirjeldused.

Ehita uus, olemasolevast platvormist eraldatava põhiosaga RAG/Graph-
teadmistesüsteem. Ära taasta vana RAG-i lihtsalt teise andmebaasi.
Selles töövoorus teosta M0 ja M1: vaata tegelik repositoorium üle ning
loo töötav ingest lisatud PDF-i ja JSON-i jaoks koos andmeskeemi,
väljade päritolu, täpsete allikakohtade, tekstiosade, struktuursete seoste,
idempotentsuse ja automaattestidega.

Ära piirdu plaaniga: tee lokaalne teostus ning käivita testid. Säilita
olemasolev platvorm ja kasutaja muud tööd. Ära kasuta selles etapis
väliseid mudelikutseid, ära tee tasulist massindekseerimist, tootmismigratsiooni
ega lisa käitusaegseid AI-agente. Qdrant ja Luna tulevad järgmiste etappide
adapterite kaudu; täpset Luna API-ID-d ei tohi nime põhjal oletada.

Esita lõpuks tehtud muudatused, tegelikult käivitatud kontrollid,
normaliseeritud näidise asukoht, andmekvaliteedi leiud ja järgmise etapi
blokeerivad asjaolud. Märgi ausalt, mis jäi käivitamata. Peatu enne M2
päris-API kulusid ja tootmiskeskkonna muutmist.
```

Codexi arendustöö ja toote päringuaegne töö on eri asjad: Codex aitab koodi luua; sellest ei tulene vajadust panna lõppkasutajat teenindama agentide ahelat.

## Kuidas etappe vastu võtta?

Esimene kontroll on päris ingest, mitte lõppvastuse mulje. Seejärel võetakse eraldi vastu hübriidotsing, tingimuste kaasamine, Luna ühendus ja ajalooline ülevaade. Artiklinäide ei asenda tulevast mitme dokumendi hindamiskogu.

Testikirjeldustes olevad leheküljed viitavad kaasasolevale PDF-ile. „Sünteetiline test” tähendab eraldi tehnilist näidet, mitte artiklisse või kliendi päriskorpusesse lisatavat väljamõeldud teadmist.
