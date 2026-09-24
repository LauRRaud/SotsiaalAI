# ADR-024 — Päringu üldsõnad: kataloogis sees, põhiotsingus mõõdetud, kuid välja lülitatud

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

Sõnaline päring ühendab kõik sõnad VÕI-tingimusega. Olukorralause üldsõnad („on”, „ja”, „ei”, „mul”, „kellega”, „kui”, „vajan”) tabavad peaaegu iga tekstiosa. Mõju:
- „Kellega vallas rääkida, kui vajan sotsiaalabi?” leidis õige kontakti hübriidis alles 22. kohal;
- ADR-023 kataloogijärjestus kaotas müra tõttu kahes osalises loendis ühe asjakohase teenuse.

## Otsus

- `query-stopwords.js`: versioonitud (`rag-v2/query-stopwords-1`) ET/EN/RU funktsioonisõnade ja abipalve üldsõnade loend. Sinna kuuluvad ka „abi/help/помощь” ja „vaja/need/нужно”. Eemaldatakse ainult **päringust**; indeksid, generatsioonid ja vahemälu ei muutu. Sisusõnad, numbrid ja sidekriipsuga nimed jäävad alles.
- **KOV-kataloogi järjestus kasutab seda alati.** Kui päringust ei jää sisusõna, jääb stabiilne ID järjekord.
- **Põhiotsingus on see valikuline** päringuvalik `lexicalStopwords`, mida ükski profiil ei lülita sisse. Mõõtmine seda ei toeta (vt allpool).
- `evaluateRetrieval({ queryOptions })` viib profiili päringuvalikud (kanalikaalud, üldsõnad) muutmata mõõtemeetoditesse, nii et neid saab tootmiskoodiga mõõta ilma koopiateta.

## Mõõtmine (kulu 0, salvestatud päris vektorid)

**KOV-kataloog, 53 valla ja olukorralause paari (vt ADR-023):**

| | ID järjekord | ADR-023 | + üldsõnad |
| --- | ---: | ---: | ---: |
| Kõik asjakohased teenused kataloogis | 46 | 51 | **52** |
| Vähemalt ühel asjakohasel kokkuvõte | 0 | 19 | 18 |

- Mõlemad ADR-023 halvenemised kadusid: Tallinn „raha otsas” 2 → 3 ja Jõhvi „eakas isa” 3 → 4.
- Ükski paar pole halvem kui ID järjekord.

**12 olukorralauset (§2.7 valim), asjakohane allikas top-5-s:**

| | Sõnaline | Hübriid | Hübriid, vektor ×2 |
| --- | ---: | ---: | ---: |
| Ilma üldsõnadeta | 4 | 10 | 11 |
| Üldsõnad eemaldatud | **8** | **11** | 11 |

- „Kellega vallas rääkida…” tõusis 22. kohalt 14. kohale; vektor ×2 korral 18. kohalt 6. kohale.
- Neli lauset tõusis esikohale.

**05.09 artiklivõrdlus (18 täielikku küsimust), hübriid:**

| Variant | Tulemus | Kontrollosa |
| --- | ---: | ---: |
| Alus | 17/18 | 6/7 |
| Üldsõnad eemaldatud | 15/18 | 4/7 |
| Vektor ×2 | 17/18 | 6/7 |
| Vektor ×2 + üldsõnad | 16/18 | 5/7 |

- Kaotused:
  - „…riskide **ja** vägivallajuhtumijärgse toe puhul?” — eemaldati ainult „ja”, mis näitab, kui piiri peal see järjestus oli;
  - „**Millise** piiri seab artikkel…”.
- Hästi sõnastatud artikliküsimuses on küsisõnad ja sidesõnad sõnalisele kanalile mõõdetavalt kasulikud.
- M2.2 regressioon püsis 7/7.

## Järeldus ja piirid

- Põhiotsingus kaalu 2 (ADR-022) hit@5 üldsõnade eemaldamisest ei parane, ainult järjestus paraneb. Artikliküsimustes kaotab see 1–2 küsimust. Seetõttu ei lülitata seda sisse enne suuremat märgistatud komplekti. Valik jääb mõõdetavaks.
- Kataloogis on kasu selge ja halvenemist pole.
- Loend on põhimõtteline, mitte selle valimi järgi häälestatud; küsisõnade lisamine halvendas artiklivõrdlust ja see on siin avaldatud.
- Valimid on väikesed ja kataloogi asjakohasus on pealkirjamuster, mitte inimhinnang.

## Kinnitus holdout-2 valimil (24.09)

Kolmkümmend uut, enne mõõtmist külmutatud küsimust (vt ADR-022 kinnitus):

| Variant | Sõnaline | Hübriid | Hübriid top-1 |
| --- | ---: | ---: | ---: |
| Alus | 19/30 | 26/30 | 15 |
| Üldsõnad eemaldatud | **23/30** | 26/30 | 19 |
| Vektor ×2 | 19/30 | **28/30** | 18 |
| Vektor ×2 + üldsõnad | 23/30 | 26/30 | 17 |

Üldsõnade eemaldamine parandab sõnalist kanalit selgelt ja tõstab esimese koha tabamusi, kuid hübriidi lõpptulemust mitte. Samas kaotas see kaks küsimust („sotsiaaltöötajad ei taha rääkida”, „vanainimene üksildane”). Kokku 48 küsimusel: alus 43, üldsõnad 41, vektor ×2 45, mõlemad 42. Otsus jätta põhiotsingus välja jääb kehtima. Kataloogis (ADR-023) jääb see sisse.
