# ADR-013: otsingu valikuline allikalaadimine

23.09.2026. Kohalik teostus; tootmiskeskkonda pole paigaldatud.
Aktiivne arendusseis on `docs/platvormi arendus/SotsiaalAI.md` S2-s.

## Probleem ja otsus

Senine päring laadis PostgreSQL-ist kõik kasutajale lubatud allikapaketid,
normaliseeritud objektid ja indeksiüksused enne otsingukandidaatide leidmist.
See sidus ühe vestluspöörde töö kogu nähtava korpuse tekstimahuga.

Indekseerimine salvestab nüüd iga dokumendi ja indeksipõlvkonna juurde
`rag-v2/retrieval-directory-1` loendi. See sisaldab versiooni, allikapaketi räsi,
kuupäeva-/piirkonnafiltri väärtusi, üksuste aadresse ja struktuurset rolli ning
teistest dokumentidest lähtuvate erandite/definitsioonide/täpsustuste/uuenduste
sihtaadresse. Algteksti ega tuletatud väidete teksti selles pole.
Loend ja räsi on omavahel seotud; täitmine ja kontroll kuuluvad olemasolevasse
indeksi importimistehingusse. Põlvkonna ja vektorite identiteet ei muutu.

Päring teeb järgmised sammud:

1. Fikseerib aktiivse põlvkonna ja kasutaja lubatud dokumendid.
2. Loeb nende väiksed loendid. Piirkond, kuupäev ja väljaande päise välistamine
   rakenduvad mõlemale otsingukanalile enne kandidaatide arvu piirangut.
3. PostgreSQL ja Qdrant leiavad kandidaadid. Tundmatu või väljaspool lubatud
   hulka olev üksuse ID põhjustab vea enne täisteksti laadimist.
4. Laeb ainult kandidaatide dokumendid. Allikapaketi räsi, kõik normaliseeritud
   objektid, indeksiüksused ning nende seos tekstiosadega kontrollitakse endiselt.
   Laaditud allikast tuletatud loend peab vastama varem loetud loendile.
5. Sõltuvuste läbimisel laadib puuduvad sihtdokumendid vajaduse korral.
   Pöördadressid toovad kaasa ka mujal asuva erandi, mille dokumendil ei olnud
   iseseisvat otsingutabamust. Dokumendiõigus, päringufiltrid ja täpne versioon
   kehtivad ka sellele rajale. Suund, JA/VÕI ning tundmatu rakenduvus säilivad.
6. Piirab lisaks seostele ja sammudele uusi sõltuvusdokumente olemasoleva
   `dependencySteps` eelarvega. Piiri ületamine annab konteksti puudulikkuse
   põhjuse, mitte näilise täielikkuse. Lõpus kontrollib uuesti jooksvaid õigusi.

Uue sõltuvusraja valikuleping on `selection-v4-lazy-dependencies`; tulemus
salvestab ka `dependency_document_limit` väärtuse. Vana täieliku lugemise
valikuleping säilib, et täiendava laadimispiiri mõju oleks tulemuses nähtav.

Tuuma tööviis ei sõltu allika nimest, konkreetse kliendi andmetest ega oodatavast
vastusest. Uusi mudelikihte ega mudelikutseid ei lisandu.

## Ühilduvus ja piirid

- Migratsioon `202609230004_retrieval_directory` lisab ainult eraldi RAG-i
  andmebaasi kaks nullable veergu ja nende koosolemise kontrolli.
- Vanal loendita indeksil säilib senine kontrollitud täielik lugemisrada.
  Tavaline uuesti indekseerimine täidab puuduvad loendid; olemasolevate
  vahemäluvektoritega ei ole selleks vaja uusi embedding'uid. Juba lõpetatud
  partiitöö `run` tagastab jätkuvalt oma varasema tulemuse ega tee varjatud
  uuendust. Mõne vigase loendi olemasolu ei tohi peituda vana raja taha.
- Valik toimub praegu **dokumendi tasemel**: ühe valitud dokumendi pakett,
  objektid ja indeksiüksused laaditakse tervikuna. Üksikute tekstiosade ja
  sõltuvusobjektide veel peenem laadimine on eraldi edasitöö.
- Lubatud dokumentide aadressiloendid loetakse endiselt tervikuna, seega jääb
  väike metaandmetöö korpuse mahust sõltuvaks. 5000 tekstiosa piir säilib.
- Otsing kontrollib tegelikult laaditud allikate terviklust; see ei ole kogu
  korpuse terviseaudit. Laadimata dokumendi tekstiviga ei peata seotud allikatest
  sõltumatut päringut. Indeksi lõppkontroll ja admini enesetest säilivad.
- Räsi kontrollib andmete kooskõla; see ei ole sõltumatu allkiri pahatahtlikult
  ümberkirjutatud andmebaasi vastu. Valitud dokumendi loendit võrreldakse lisaks
  kanoonilise allikaga. Teiste dokumentide puudulik sisu ei muutu tõendiks.
- Katsed kasutavad sünteetilisi allikaid ja testvektoreid. Pärismudeli keeleline
  või olukorrapõhine kvaliteet, kogu korpuse koormus ja tootmise töökindlus on
  selle muudatusega `NOT_PROVEN`. Tasuline testiring ei ole arenduse nõue.

## Kontrollitud tulemus

Kohalik PostgreSQL `rag_v2_dev` ja Qdrant, juhuslik eraldatud testtenant,
12 sünteetilist dokumenti. Välisvõrgu mudelikutsed keelatud. Testandmed koristati.

| Päring | Senine rada | Valikuline rada |
| --- | ---: | ---: |
| Üks otsingutulemus, eraldi tingimus ja sisse tulev erand | 12 dokumenti / 13 üksust | 3 dokumenti / 4 üksust |
| Tulemusi pole või kõik välistuvad filtriga | Senine rada loeb allikapaketid | 0 täistekstidokumenti |

Kolme dokumendi näites olid mudelikontekst, tõendikirjed ja järjestused samad.
Päris kohaliku Qdrantiga kontrolliti eraldi hübriid-, vektor- ja tekstotsingut
koos struktuursete naabritega. Need on andmelaadimise mõõtmised, mitte latentsuse
ega tootmiskoormuse võrdlus.

49 sihttesti läbisid ühe jooksuna (`TZ=UTC`):

```text
node --test tests/rag-v2-selective-retrieval.integration.test.mjs tests/rag-v2-knowledge.test.mjs tests/rag-v2-selection.test.mjs tests/rag-v2-index-jobs.integration.test.mjs tests/rag-v2-ingest-publication.integration.test.mjs tests/rag-v2-morphology.integration.test.mjs
```

Seejärel lisatud päise välistamise katse läbis koos kaheksa senise valikutestiga:
`node --test tests/rag-v2-selection.test.mjs` — 9/9. Kokku kontrollitud 50 eri testi.
Valikulepingu versiooni ja laadimismõõdiku lõpptäpsustuse järel läbisid uuesti
10 valikulise lugemise teenusetesti ning 9 valikutesti (19/19).
Uued kümme teenusetesti ja üks valikutest katavad muuhulgas:

- päringu päriselt vähenevad allikalaadimised ja vana rajaga sama tulemus;
- teise dokumendi tingimuse ning vastassuunas leitava erandi;
- filtrid, õigused, hilisema õiguse eemaldamise ja võõra tenanti tõrjumise;
- loendi, valitud allika, indeksi tekstiveeru ja allikaobjekti rikked;
- puuduva indeksiüksuse ja lubamatust kanalist saabuva ID;
- põlvkonna fikseerimise aktiivse osuti muutumise ajal;
- sõltuvuste laadimise eelarve ja vana indeksi uuendamise ilma uute vektoriteta.

Muudetud JS/MJS failide ESLint, Prisma valideerimine ning `git diff --check`
läbisid. Migratsioon rakendus ainult kohalikus eraldi RAG-i andmebaasis.
Olemasoleva teadmiste impordi testi andmebaasi jäljend viidi kehtiva
indeksilepinguga kooskõlla; runtime'i kontrolli selleks ei nõrgendatud.
Tasulisi kutseid, push'i ega deploy'd ei tehtud.
