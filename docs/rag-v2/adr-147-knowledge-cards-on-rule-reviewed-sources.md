# ADR-147: teadmiskaardid reegliga ülevaadatud lehtedel ja dokumentidel

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Seis: **esimene partii (korpuse v82 34 dokumenti) on kaartidega kogus (v86); kulu läks üle omanikule nimetatud lae; laiendamine ülejäänud kogule ei ole otsustatud ega soovitatud enne mõõtmist.**

## Miks

Omanik 11.10.2026: „kõik peavad saama meta failid ja graph peab looma seosed“. Metafail on igal allikal. Mudeliga koostatud teadmiskaardid ja nende seosed ([ADR-054](adr-054-semantic-graph-pilot.md)) olid aga ainult seitsmel piloodi dokumendil: partiitöötlus, millega täiendused v25-st alates on tehtud, seda sammu ei käivita. Viite seaduse sättele järgib otsing kõigil dokumentidel ilma selle sammuta ([ADR-145](adr-145-a-passage-points-at-the-provision-it-names.md)).

Ütlesin omanikule, mida esimene partii maksaks: „lagi 1 USD, hinnanguliselt umbes 0,3 USD“. Tema vastus kõigele, mis otsust ootas: „kõik vaja ära teha“.

## Mis tehti

Korpuse v82 34 dokumendile (27 tubakainfo.ee lehte, 7 dokumenti) koostati serveris kaardid käsuga `scripts/rag-v2-knowledge-batch.mjs` (plaan, käik, mustand; ainult käik on tasuline).

| | |
|---|---:|
| mudelikõnesid | 44 (48-st; neli jäi dokumendi piiri taha) |
| kaarte | 1 174 (väide 934, tingimus 152, mõiste 76, erand 12) |
| seoseid | 184 (eeldab 92, täpsustab 46, kirjeldab 28, määratleb 14, erand 4) |
| lahendamata sõltuvusi | 15 |
| sisendmärke / väljundmärke | 259 144 / 250 837 |
| **kulu seade hindadega** | **2,83 USD** |

## Kulu läks üle lae

Nimetatud lagi oli 1 USD; kulu seade hindadega (1,25 ja 10 USD miljoni märgi kohta) on 2,83 USD. Põhjused:

- **Seade `maxSpendUsd` kehtib dokumendi, mitte partii kohta.** Partii teeb igale dokumendile oma töökausta ja arvestuse; piir peatas ainult ühe pika raporti viienda osa. Eeldasin, et see piirab kogu partiid, ja ei kontrollinud.
- **Hinnang oli kümme korda liiga väike.** See tuli piloodi arvust (27 kõnet, 0,16 USD). Siin maksis üks osa umbes 0,06 USD: 300-sõnaline leht andis 30 kuni 40 kaarti ja 6 000 kuni 7 000 väljundmärki, pikk dokument 20 000 kuni 26 000.
- Ühe dokumendiga proovi enne partiid ei tehtud.

Omanikule teatati kohe, kui mustandi aruanne summat näitas, ja rohkem mudelikõnesid ei tehtud. Tegelik arve selgub teenusepakkuja töölaualt.

**Reegel edaspidi:** enne kaardipartiid tehakse üks dokument, loetakse selle kulu mustandi aruandest ja korrutatakse; lagi nimetatakse omanikule selle põhjal. Partii piiratakse ise: dokumendid käivad rühmade kaupa ja töö peatub, kui aruannete summa jõuab laeni.

## Kuidas kaardid allika külge said

Lehed ja dokumendid on väljaspool hoidlat, oma ekspordiregistriga. Mustand kirjutab iga allika kohta faili `<nimi>.knowledge.json`, mis nimetab allika teed ja räsi. Fail pandi allikate kausta `teadmised/` alla, allika kirje sai välja `knowledge_path` ja fail oma kirje rolliga `knowledge` (`tmp/rag-v2-v82/knowledge/attach-knowledge.mjs`), nagu hoidla registris. Töötlus kontrollib iga kaardi tsitaati allika enda teksti vastu ja märgib impordi ülevaatamata (`knowledge_import_unreviewed`).

**Ülevaatuse reegel** (`scripts/rag-v2-review-by-rule.mjs`) ei lasknud seda märget läbi. Nüüd laseb lehe, organisatsiooni lehe ja dokumendi puhul, ja kirje märkus ütleb, mis kaardid on: tsitaat on kontrollitud allika teksti vastu, väidete sõnastust ja seoseid ei ole inimene üle vaadanud, need on otsinguabi, mitte allikas.

## Ost

Lõikude tekst on sama mis v82-s, seega vektoreid osta ei olnud vaja; käigule anti ruumi 20 sisendi ja 0,01 USD jagu, et see peatuks, kui plaan küsib rohkem.

| Käik | Dokumente uue versiooniga | Sisendeid ostetud | Hind | Indeks | Dokumente kokku | Lõike kokku |
|---|---:|---:|---:|---|---:|---:|
| v86 | 34 | 0 | 0,0000 USD | `ed2d72bd` | 10 571 | 93 471 |

Kontroll pärast käiku (ainult lugemine, `w4/knowledge-count.mjs` serveris): töötava indeksi otsingu andmebaasis on 1 954 kaarti 41 dokumendil, 466 seost 35 dokumendil ja 76 lahendamata sõltuvust 15 dokumendil, ehk piloodi seitse dokumenti (780 kaarti, 282 seost) ja need 34.

Järgmine alus: põhikausta `tmp/rag-v2-v82/knowledge/ship/policy.json`.

## Mida ei ole mõõdetud

- Kas kaardid muudavad vastuseid nende 34 dokumendi pealt. Samad küsimused on ilma kaartideta küsitud samal päeval (tasuline kontroll, tubaka, insuldi ja eetikakoodeksi küsimused); kordus kaartidega oleks umbes 12 pööret ja vajab omaniku luba.
- Kaardid on ülevaatamata. Pilood (ADR-054, ADR-057) näitas kasu raskete õiguslike tingimuste juures, mitte tavaküsimustes; infolehtede kaardid on valdavalt väited (934 kaarti 1 174-st).

## Soovitus

Kogu kogule (üle 10 000 dokumendi) kaartide tegemine maksaks nende hindadega mitusada dollarit. Seda ei tasu alustada enne, kui mõõtmine näitab kasu. Kui kaarte laiendada, siis esmalt dokumentidele, kus on tingimusi ja erandeid (õigusaktid, kohalike omavalitsuste määrused, juhendid).
