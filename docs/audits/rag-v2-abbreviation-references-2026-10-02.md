# Lühendiga seaduseviited („SHS § 25“) — mõõtmine 02.10.2026

Teostus Claude Opus 5.5. Omanik 02.10: „Alusta B tasuta mõõtmisest … Too konkreetsed näited ja soovitus, kas uut reeglit on vaja. Arenduse otsustame mõõtmise tulemuse järgi.“ Taust: [ADR-064](../rag-v2/adr-064-named-other-act.md) järgib teist seadust ainult siis, kui see on nimetatud täisnimega; lühend jäeti [ADR-063](../rag-v2/adr-063-checked-relations.md) järel mõõtmata.

**Soovitus: uut reeglit praegu ei ole vaja.** 30 raskes küsimuses ei toonud lühendi järgimine ühtegi puuduvat otsustavat sätet. Põhjendus ja see, mis otsust muudaks, on all.

Mõõtmine oli tasuta ja ainult luges: serveris, korpus v47 (indeks `34fe1590`, 40 489 lõiku), ilma mudelikutseta. Skript: [rag-v2-abbreviation-references-2026-10-02-probes.mjs](rag-v2-abbreviation-references-2026-10-02-probes.mjs); tulemus: [evidence/abbreviation-references-2026-10-02.json](evidence/abbreviation-references-2026-10-02.json).

## 1. Kui sageli lühendiga viiteid esineb

Loetud on kuju „lühend vahetult paragrahvimärgi ees“ (SHS § 16, SHS-i §-s 105, LasteKS § 27 lg 1).

- **Kokku 800 viidet, 51 eri lühendit.**
- **364 neist (45,5%) nimetab seadust, mis on korpuses**: SHS 226, LasteKS 73, PKS 30, SÜS 21, HMS 14. Lisaks 20 kirjapildi varianti (SHSi, LasteKSi), mida ei loetud.
- **436 (54,5%) nimetab seadust, mida korpuses ei ole**: IKS 79, PGS 56, VÕS 30, AvTS 28, TTTS 23, TTKS 22, TLS 15, PISTS 14, PS 14 jt. Neid ei saa ükski otsingureegel järgida; see on korpuse ulatuse küsimus.

Kus korpuses olevate seaduste lühendiviited asuvad:

| Allika liik | Dokumente kokku | Dokumente, kus viide on | Viiteid |
|---|---:|---:|---:|
| Juhendid ja uuringud | 171 | 12 | 190 |
| Ajakirja artiklid | 892 | 33 | 120 |
| Valdade ja linnade määrused | 510 | 19 | 54 |
| Riiklikud seadused | 23 | 0 | 0 |
| Kataloogikirjed (teenused, toetused, vormid, kontaktid) | 4874 | 0 | 0 |
| **Kokku** | 6470 | **64** | **364** |

- Järgitav lühendiviide on 64 dokumendis, see on 4% teadmusallikatest (1596).
- **Määrused kasutavad täisnime.** SHS-ile viitab määrustes täisnimega 720 ja lühendiga 48 kohta. Täisnime järgib otsing juba (profiil v4).
- **Artiklid ja juhendid kasutavad lühendit.** SHS: artiklites 60 lühendiga ja 22 täisnimega, juhendites 118 ja 18.
- 47 dokumendist, mis viitavad SHS-ile lühendiga, selgitab lühendi lahti 15 („edaspidi SHS“).

## 2. Kas järgimine leiaks puuduva sätte

Simulatsioon kolmel raskel kataloogil (30 küsimust, igaühel teada otsustav lõik), profiili v6 valitud lõikudel (otsingukatse salvestatud read, ilma eelvaliku mudelita). Iga valitud lõigu lühendiviide lahendati korpuse kehtiva redaktsiooni paragrahviks samade funktsioonidega, mida täisnime reegel kasutab.

| | |
|---|---:|
| Küsimusi | 30 |
| Otsustav lõik leitud juba praegu | 28 |
| Küsimusi, mille valitud lõikudes on mõni lühendiviide | 6 |
| Lühendiviiteid neis | 18 |
| … seadus pole korpuses | 4 |
| … viidatud lõik on juba valitud | 3 |
| … reegel lisaks lõigu | 11 (viies küsimuses) |
| Lisanduvaid tokeneid kokku | 2647 |
| **Lisandusi, mis toovad puuduva otsustava lõigu** | **0** |

Kaks küsimust, kus otsustav lõik praegu puudub:

- `coach-reports-child`: valitud lõikudes on LasteKS § 27 lg 1 ja lg 5, mõlemad juba valitud. Puuduv säte on § 27¹; päris vestluses toob selle eelvaliku piir ([ADR-065](../rag-v2/adr-065-pool-limit-per-document.md)).
- `child-rehabilitation-need`: LasteKS § 26 lisanduks, aga puuduvat lõiku see ei sisalda.

## 3. Näited

Mida reegel lisaks (küsimus → viitav allikas → viide):

- `reclaim-limitation` → ajakirja artikkel pöördumisele vastamisest → HMS § 72, 78, 79, 83 lg 1, 84 lg 1, 87. Kuus lisandust ühest artiklist, 1118 tokenit; otsustav säte oli juba leitud.
- `involuntary-placement` → uuring psüühikahäirega inimeste teenustest → SHS § 3 ja § 15 (üldpõhimõtted), 1046 tokenit; otsustav säte oli juba leitud.
- `reclaim-enforcement` ja `special-care-decision-time` → kaks artiklit → SHS § 16 (abi andmise põhimõtted), 190 tokenit kumbki.

Viited korpuses, mida reegel järgida saaks:

- Narva linna asendus- ja järelhooldusteenuse kord viitab kolmes kohas SHS § 45¹¹ lõigetele 3 ja 4 (isiklike kulude miinimum, hoolduspere vanema tasu). See on sama liiki juhtum nagu Harku tugiisiku küsimus, mille pärast täisnime reegel tehti.
- Ühe valla sotsiaaltoetuste kord viitab SHS § 141 lõikele 1.
- MARAC-i juhend viitab LasteKS § 4 ja § 29 lg 3¹-le; PDF-is on ülaindeksist saanud ülakoma („lg 3'“).

Viited, mida järgida ei saa: PS § 20 lg 2 (põhiseadus), IKS, PGS, VÕS — neid seadusi korpuses ei ole.

## 4. Miks reeglit praegu mitte teha

- **Kasu ei ole mõõdetav.** 11 lisandust, 0 neist tõi puuduva sätte. Alusotsing leiab seaduse sätte ise (28/30); kaks möödalasku ei ole lühendiga ulatutavad.
- **Lisandused on üldpõhimõtted.** Artiklid viitavad enamasti SHS § 3, § 15, § 16 ja HMS-i üldsätetele. Need pikendavad konteksti (keskmiselt 530 tokenit mõjutatud küsimuse kohta) ja võtavad teise seaduse kaks kohta, mida täisnime reegel kasutab.
- **Artiklite ja juhendite numbrid pole täpsed.** Need on PDF-id, kus ülaindeks kaob („SHS § 131“ võib olla § 13¹). Praegune reegel jätab sellise numbri järgimata, kui see pole ühene, seega osa viiteid jääks nagunii kõrvale.
- **Üle poole lühendiviidetest läheb seadustesse, mida korpuses pole.**

## 5. Mis otsust muudaks

- **Määruste kitsas juhtum.** 19 määrust viitavad SHS-ile või SÜS-ile lühendiga (54 kohta), numbrid on seal täpsed (XML). Kui mõni päris küsimus puudutab just sellist sätet (näiteks Narva asendushoolduse isiklike kulude miinimum) ja vastus jääb SHS-i tekstita, tasub teha kitsas reegel: ainult õigusakti XML-ist, ainult korpuses olev seadus. Seda saab enne mõõta kahe-kolme küsimusega otsingukatses (embedding'u kulu alla 0,001 USD).
- **Korpuse ulatus.** Kui kasutajate küsimused vajavad IKS-i, PGS-i, PISTS-i või VÕS-i sätteid, on see nende seaduste lisamise, mitte viidete järgimise küsimus.

## Piirid

- Simulatsioon kasutas valikut ilma eelvaliku mudelita; päris vestluses valib mudel 30 kandidaadi seast ja lõigud võivad erineda.
- 30 rasket küsimust on koostatud tingimuste ja erandite leidmiseks; ükski neist ei küsi määruse sätet, mis viitab SHS-ile lühendiga.
- Loetud on ainult kuju „lühend § number“. Viiteid kujul „§ 25 (SHS)“ või lühendit ilma paragrahvita ei loetud.
- Lühendi all on loetud kuni 10-täheline sõna vähemalt kahe suurtähega; käändelõpuga kokku kirjutatud kujud (SHSi) läksid eraldi lühendiks.
