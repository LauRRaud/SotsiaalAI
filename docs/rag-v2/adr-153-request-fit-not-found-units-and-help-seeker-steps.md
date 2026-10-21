# ADR-153 — Teemaväline palve, leidmata toetus, ühikud ja abiotsija järgmised sammud

21.10.2026. Teostus Claude Opus 5.5. Omanik 21.10: „tee parandused“, „sina tee, mida vaja. main harul“.

## Miks

Soli 50 küsimuse test sotsiaal.pro peal (20.10, väljalase `12cdf6cc`, korpus v92, juhis
`m4-grounded-dialogue-43`) leidis neli viga, mis tulevad juhisest, mitte otsingust
([parandusnimekiri](../audits/sotsiaal-pro-parandusnimekiri-sol-proof-20261014-01.md), punktid 12, 14, 15, 16):

| Punkt | Küsimus | Mis juhtus |
|---|---|---|
| 14 | B01: pitsaretsept | `unsupported`, piirang „Mul pole siin piisavalt teavet, et pitsaretsepti anda.“ Kõlab nagu teabe puudus, mitte et vestlus on muuks mõeldud. |
| 15 | X01: olematu 300-eurone toetus | Vastus pakkus lähima toetuse (200 eurot) ja küsis, kas see on mõeldud, kuid ei öelnud, et nimetatud toetust ei leitud. |
| 12 | N01, R03, R04: tööamps | „kuni 8 kalendripäeva kuus“; allikas: üks leping kuni 8 kalendripäeva, kuus kuni 8 tööpäeva. Kaks piiri liideti üheks vale ühikuga. |
| 16 | N01, G02 abiotsija vaates | Spetsialisti vaates olnud tagajärg (piiri ületamisel lõpetatakse tagasiulatuvalt) ja muu tee (hooldekodu kohatasu puudujääk) jäid abiotsija vastusest välja. |

## Otsus

Uus juhise versioon `m4-grounded-dialogue-44` (`lib/rag-v2/pilot/dialogue.js`). Varasemaid ridu ei muudetud; lisandub kolm
lõiku. Ükski neist ei nimeta allikat, toetust ega juhtumit (AGENTS.md: erandeid allika või oodatud vastuse järgi ei lisata).

1. **`REQUEST_FIT_INSTRUCTIONS`** dialoogi laienduse lõpus.
   - Ütleb, milleks vestlus on: sotsiaalhoolekanne Eestis laias mõttes.
   - Palve, millel sellega pole midagi pistmist, saab `clarification` ilma plokkide ja piiranguteta: üks-kaks lauset,
     milleks vestlus on, ja kutse sellisest asjast küsida. Teabe puudust ei öelda.
   - Osaliselt seotud palve (rahamure, üksildus, lähedase hooldus) ja kahtlane juhtum saavad tavalise vastuse, et
     piirist ei saaks keeldumise põhjust.
   - Kui inimese nimetatud asja (toetus, teenus, makse, reegel, summa) pöörde allikates ei ole, ütleb esimene piirang
     minavormis, et seda ei leitud („Sellist toetust ma oma teabest ei leidnud.“). Endiselt kehtib reegel, et see ei
     tähenda, et asja pole olemas (`LIMITS OF THE EVIDENCE`).
   - Lähedast asja pakutakse võimalusena oma nime ja viidetega ning küsitakse, kas see on mõeldud. Kui allikas ütleb,
     kes sellist abi maksab või osutab, öeldakse viidatud plokis, kelle käest küsida.
2. **`UNIT_INSTRUCTIONS`** kohe arvude ja tingimuste reegli (`COMPLETENESS_INSTRUCTIONS`) järel. Arv jääb oma ühiku ja
   loendatava asjaga, nagu allikas ütleb: kalendripäev ei ole tööpäev, kuu piir ei ole lepingu piir, bruto ei ole neto.
   Eri loendusega piirid öeldakse eraldi ja neid ei liideta.
3. **`ROLE_STEP_INSTRUCTIONS.help_seeker`** abiotsija tööteksti lõpus. See tekst on viimane, mida mudel loeb.
   Lihtne keel muudab ütlemise viisi, mitte seda, mida inimesele öeldakse: tagajärg, tähtaeg, teavitamiskohustus ja
   muu tee jäävad alles nagu spetsialisti vastuses. Spetsialisti ja teenuseosutaja tekst ei muutunud.

`PROMPT_VERSION` (`m4-grounded-answer-13`) ei muutunud, sest vestlusplaan on dialoogiplaan ja iga pööre kasutab
`dialogueRequest`-i. `m4-grounded-dialogue-43` lisati loetavate versioonide hulka, nii et vanad pöörded avanevad.

## Paigaldus

Väljalase uuendab kinnitatud vestlusplaani uuele koodile ise (`scripts/rag-v2-plan-release.mjs`, `renewChatPlan`,
omaniku otsus 27.09.2026). Plaanis muutuvad ainult koodi väljad (`implementationHash`, `promptVersion`); kasutajad,
eelarve, väljasaatmise load, indeksipõlvkond ja otsinguprofiil jäävad samaks. Omaniku käsitööd ei ole vaja.

## Maht

Juhis kasvab umbes 2400 märgi ehk ligikaudu 550 sisendtokeni võrra pöörde kohta. Abiotsija lõik (umbes 330 märki)
läheb ainult abiotsija pöördesse.

## Kontrollitud ja kontrollimata

Kontrollitud ilma mudelita (päringu kokkupanek):
- versioon 44;
- 43 on loetav;
- lõik 1 on iga pöörde juhises;
- lõik 2 on arvude reegli järel;
- lõik 3 on abiotsija arendajasõnumis, aga mitte spetsialisti omas.

Testid `deploy-plan-release` (14/14), `rag-v2-pilot-crisis-route` (2/2) ja `rag-cost` (8/8) läbisid.

## Kordustest serveris (21.10, juhis 44)

Väljalase `7df8616f`, logis „Chat plan: renewed”. Samad küsimused omaniku admin-seansist, eelregistreering
lukustati enne jooksu (`e1dd5fdd`); kulu 0,017 USD. G02 jäeti välja: 20.10 paketis ei olnud ühtki muud teed, seega
see osa on otsingu, mitte juhise viga (vt punkt 10).

| Küsimus | 20.10 (juhis 43) | 21.10 (juhis 44) |
|---|---|---|
| B01 pitsaretsept | „Mul pole siin piisavalt teavet …” | **PASS:** „See vestlus aitab sotsiaalhoolekande, toetuste, teenuste … küsimustes. Küsi julgelt …” |
| X01 olematu toetus | lähim toetus ja küsimus, „ei leidnud” puudus | **PASS:** „Sellise 300-eurose eakate digitoetuse taotlemise korda ma oma teabest ei leidnud. See ei ütle, kas toetus on olemas.” |
| N01 abiotsija | „kuni 8 kalendripäeva kuus”, tagajärg puudus | **FAIL:** ühik sama; tagajärg (tagasiulatuv lõpetamine, tagasimaks) nüüd olemas |
| R03 spetsialist | „kuni 8 kalendripäeva kuus” | **FAIL:** ühik sama |
| R04 teenuseosutaja | „kuni 8 kalendripäeva kuus” | **FAIL:** ühik sama |

Ühikuviga ei tule allikate kokkusulandamisest, nagu esialgu arvati, vaid sõnast: seadus ütleb „kuni kaheksa päeva
**kalendrikuus**”, Töötukassa leht „leping võib kesta kuni kaheksa **kalendripäeva**”, ja vastus tõstis sõna
„kalendri-” päevade juurde.

## Juhis 45

`UNIT_INSTRUCTIONS` lõppu lisandub üks reegel: ühiku sõna kuulub selle sõna juurde, mille kõrval ta allikas seisab.
„kuni viis päeva kalendrikuus” loeb päevi kuu sees ega tee neist kalendripäevi; „kuni viis kalendripäeva” mõõdab
lepingu pikkust. Loendust öeldakse allika sõnaga ja ühiku sõna ei tõsteta ühelt loenduselt teisele. Näide kasutab
arvu viis, mitte kaheksat, ega nimeta allikat. Muud lõigud on samad mis juhises 44. Kordustest: N01, R03, R04 samade
ootustega (eelregistreeringu lisa).

**Kordustest (väljalase `f4e42aeb`, kulu 0,012 USD): 0/3.** Kõik kolm ütlesid endiselt „kuni 8 kalendripäeva kuus”;
R03 tõstis sõna teistpidi („töökord kuni kaheksa päeva”, „kuus kuni kaheksa kalendripäeva”). Abiotsija tagajärg
(N01) jäi teist korda alles.

**Otsus: selle sõna pärast juhist rohkem ei muudeta.** Iga järgmine lause oleks kujundatud ühe juhtumi järgi. Viga on
sõnastuse ebatäpsus: iga töötatud päev on kalendripäev, nii et „8 kalendripäeva kuus” eksitab ainult siis, kui seda
loetakse vahemikuna. Ka 20.10 ootus „kuni 8 tööpäeva” oli ebatäpne (allikas: „töötamispäevade arv”), ja kas see on
viga, hindavad omanik ja spetsialist (RAG-12). Juhise 45 rida jääb: see on üldine, kahjutu ja umbes 120 tokenit;
järgmises juhise ülevaatuses võib selle mõõdetud mõjuta reana eemaldada.
[Tõend](../audits/evidence/sol-proof-20261014-01/server-rag-chat-prompt45.json)

## Mida see ei paranda

- **Punkt 9 (§ 95 juurde ei tule § 72 lg 2):** see on otsingu, mitte juhise viga. Selle parandus muudab profiili
  käitumist, uus profiil (`hybrid-estnltk-chat-v7`) vajab uut omaniku kinnitatud plaani, sest `profileId` kuulub
  kinnitatud ulatusse, ja põhjus tuleb enne kinnitada serveri otsingujäljega.
- **Punkt 10 (PKS § 96) ja 18a (KOV-i kohustuslike teenuste loetelu):** otsingu jälg ja korpuse täiendus.
- **Punktid 11, 13, 17, 18:** omaniku hinnang, korpuse kontroll, keelevead ja kohalik leid, mida pole päris
  kasutuses mõõdetud.
