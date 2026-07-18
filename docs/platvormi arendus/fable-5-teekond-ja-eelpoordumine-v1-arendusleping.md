# T06 `JOURNEY-V1` — Teekonna ja eelpöördumise V1 arendusleping

STATUS: COMPLETE (JOURNEY-D0, 2026-07-17)

- Ülesanne: **JOURNEY-D0** — Teekonna ja eelpöördumise otsuste sulgemine ning tervikliku T06 `JOURNEY-V1` arenduslepingu koostamine.
- Koostaja: Fable 5 (analüüsirada). Otsustaja: tooteomanik (ptk 4/16 otsused).
- Iseloom: **arendusleping järgmisele Sol/Terra teostajale** — mitte uus audit. Kõik koodiseisu väited kannavad viidet olemasolevatele analüüsidele; uut Git-, serveri- ega runtime-auditit ei tehtud. Rakenduskoodi, Prisma skeemi, migratsioone ega teste ei muudetud; ei commit'itud, merge'itud ega deploy'tud.
- Lähtedokumendid (loetud täies mahus): `fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md` (783 r; edaspidi **UX-analüüs**), `fable-5-teekond-o-tk9-sent-retention-otsus.md` (**O-TK9 leht**), `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md` (**PILOT-A0**), `fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md` (**K1-U1**), `fable-5-igapaevane-toolaud-ja-jareltegevused.md` (**TÖÖLAUD-A0**), `arendusteemade-masterregister.md` (T04/T05/T06/T16/T19/T26), `platvormi-arendusprogramm-2026-07-17.md`.

Lähteseis (17.07.2026 kanoonilised kontrollid, ei korratud):

| Fakt | Seis | Allikas |
|---|---|---|
| `origin/main` = server | `fe4eb4fa` | arendusprogramm ptk 2 |
| T04 `WORKSPACE-EVENTS-V1` | `CODE_READY` — `codex/workspace-events-v1 @ 87d9a141` (parent K1 `ef5973c9`); DomainEvent outbox + projektor + eelpöördumise staatusevertikaal + ack + minimaalne teavituskeskus | masterregister T04; programm 7.5 |
| T05 `WORKBENCH-V1` | järgmine aktiivne Sol/Terra teema; stack `87d9a141` pealt, portib TÖÖLAUD-P1 `a2393301` süvalingiparandused | masterregister ptk 8 |
| T06 `JOURNEY-V1` | tuleb pärast T05; **serveris on täna lekkega jagamisrada piloodi tuumvoos** | masterregister T26; PILOT-A0 12.2 p2 |
| T26 esimene partnerpiloot | G3 värav nõuab TK-P0 jagamispiiri release'is | PILOT-A0 ptk 12.2 |
| T19 ruumiline prototüüp | **`DEFERRED — OWNER_DECISION 2026-07-18`**; T06 EI oota T19 järele ega kasuta seda sõltuvusena; T06 lahendab oma esitluse ise `tokens.css`/`glass.css` mustritega | masterregister T19; programm ptk 16 |
| O-K1-1 / O-U1-1 / O-U1-2 | **KINNITATUD 17.07.2026** (sõnastik; DomainEvent kiht + retention-klassid; eelpöördumise vertikaal) | programm ptk 11 |
| O-TK1…O-TK9 | **ükski pole formaalselt kinnitatud**; O-TK9 soovitus on B | UX-analüüs 14.11; O-TK9 leht; programm ptk 11 |

---

## 1. Juhtkokkuvõte (üks lehekülg)

**Mis on T06.** Teekond on pöörduja privaatne olukorra-mälu; eelpöördumine on sellest tehtav kontrollitud, külmutatud väljavõte adressaadile (KOV/teenuseosutaja). Serveripoolne selgroog töötab ja on runtime-tõendatud (loomine → detail → prefill → saatmine → vastuvõtulaud → ruum → tagasivõtt/parandus), aga kasutajapoolne kiht on kolmes kohas katki (kerimisblokk, ehitamata esitluskiht, URL-ita olek) ja **jagamisvaliku lubadus ei pea**: kasutaja valikust hoolimata liigub adressaadile pea kogu Teekonna sisu, sh riskisignaalid ja kolmanda isiku andmed (UX-analüüs ptk 13, runtime-tõendatud). See on kinnitatud aktiivne P0-klassi leke, mis asub täpselt T26 piloodi tuumvoos — TK-P0 sulgemine on G3 värava nimeline eeldus.

**Mis tehakse.** Üks terviklik Sol/Terra arendus (üks haru, üks lõppüleandmine), mille sees on seitse sisemist etappi E1–E7 (ptk 13). Need katavad varasemate analüüside kontrollpunktid TK-P0…TK-P5 ja O-TK9 rakenduse TK-R1 — neid EI avata eraldi ülesannetena:

1. **E1** — fail-closed jagamispiir serveris (allowlist + manifest + ignoredKeys + abisoovi hügieen + L5 D-plokk) — otsustevaba, markeri-testidega;
2. **E2** — elutsükli teenuskiht: päris sündmuslogi, aus rada päris seostest, vestlusseos, kustutus-/taasavamis-API, T04 sündmuste emit-punktid, K1 journey-adapter;
3. **E3** — *(tingimuslik, ainult kinnitatud O-TK9 järel)* SENT-kirjete retention-transform (variant B = ainus migratsioon kogu teemas);
4. **E4** — füüsiline ligipääs ja püsivus: kerimine, Esc, sammud URL-i, seadmesisene automaatsalvestus, katkestamise kaitse;
5. **E5** — „kaks ruumi, üks lävi": ainus jagamisvalik elava payload-eelvaatega, aus rada, kriisi-kiirkaart, „mida olen jaganud", eksport ja kustutamise UI;
6. **E6** — esitluskiht: stepper/kiibid/kaardid kanoonilises klaasikeeles, i18n (ET/EN/RU), a11y, mobiil, reduced-motion — lame (flat) esitus, mis on hiljem T19 mootoriga ümbritsetav;
7. **E7** — koondkontroll: sihttestid, autenditud sünteetiline runtime-sond (sh ptk 13 markerisondi kordus), koristus, lõpparuanne.

**Otsused.** Üheksast O-TK otsusest seitse saavad otsustevaba vaikevaliku (ptk 3); päriselt blokeerivad on täpselt kolm (ptk 4/16): **O-J1** (=O-TK9 SENT-retention; soovitus B), **O-J2** (Teekonna kest + raja sisene tagasi-nool — pöörab kaks kehtivat tellijaotsust) ja **O-J3** (=O-TK2 Teekonna kustutamine). E1 ja suurem osa E2-st on otsustevabad; E3 sõltub O-J1-st, kustutus O-J3-st ning E4–E6 struktuur O-J2-st.

**Mida ei tehta.** Vastuvõtja töövoogu ja UI-d ei ehitata ümber (töötab, CAS-idega, testitud); T04 sündmuskihti, projektorit, teavituskeskust ega continuity-mootorit ei dubleerita; T19 flight-esitust ei ehitata; serverimustandit, dokumendiviiteid, ootel-kaarte ja muid PILOOT-taseme võimeid ei lisata (ptk 15).

**Seis:** T06 = `READY_THEME_BUILD_STACK` — analüüsitöö on valmis, TK-P0 leping on arenduseks üheselt määratud ja JOURNEY-D1 vaikevalikud kinnitati 17.07.2026. Ainus käivituse eeldus on T05 lõplik remote SHA.

---

## 2. Tänane Teekonna ja eelpöördumise kasutajatee (koond)

Täistõendid: UX-analüüs ptk 1–2 ja 13–15 (runtime 15.07, `main @ 7ae76d5b`; O-TK9 leht kinnitas 16.07, et pinnafailid on origin/main-is muutumatud); vastuvõtja pool TÖÖLAUD-A0 ptk 3.

**Autor (pöörduja):**

1. **Sisenemine** kolmest kohast: karusselli kaart, `/teekond` (→ redirect `/vestlus?workspace=journey` töölauapaneeli), vestluse „Teekonna režiim". Kolm paralleelset loomisrada, mille suhe pole kasutajale nähtav.
2. **Loomine** kolme React-oleku ekraaniga (list → start → review) ühe URL-i sees; mustandi teeb sünkroonne heuristika, mitte LLM. Review-ekraani 4 „suunanuppu" on tegelikult vormiväli (P2-2).
3. **Detailvaade** `/teekond/[id]`: 18 sektsiooni / 26 tegevust ühel kitsal kaardil; teekonnarada näitab olekuid, mida ei arvutata päris andmetest (P2-1); „Seotud asjad" ja „Tehtud sammud" on surnud lubadused (kirjutajaid pole).
4. **Üleandmine eelpöördumisse:** jagamisvalik → `share=` URL → prefill-marsruut → peidetud „journey" samm teise valikukomplektiga → koostamisvoog (5-sammuline vabalt klõpsitav riba) → eelvaade → salvesta/saada. **Kaks valikukihti, kummagi mõju tekstile pole jälgitav; server austab ainult `assistiveDevices` võtit** — kõik muu (kokkuvõte, teemad, puuduolev info, personContext, serviceContinuity, riskisignaalid) liigub adressaadini valikust sõltumata (ptk 13 runtime-tõend).
5. **Füüsilised blokid:** töölauapaneelis on kerimine võimatu (salvestusnupud kättesaamatud); Esc/F5/tagasi kaotab töö hoiatuseta; olek ei ela URL-is; esitluskiht (stepper, kiibid, rada) on stiilimata skelett.
6. **Järelseis:** „Minu eelpöördumised" (samm 5, sisult arhiiv) + „Minu jagamised" (`/minu-jagamised`, kehtivusahel + tagasivõtt + parandus — töötab hästi, TÖÖLAUD-A0 ptk 5); Teekonna „Seotud eelpöördumised" tagasilink töötab.

**Adressaat (sotsiaaltöötaja/teenuseosutaja):** teavitus + sisuta e-kiri → `/eelpoordumised` vastuvõtjavaade (opt-in väravaga) → hindamine (olukord, jagatud Teekonna plokk, mustand) → tööplaan/kontrollnimekiri/„järgmine kontakt" (CAS-kaitsega) → vajadusel ruum → arhiveerimine. Serveripool on üle keskmise kvaliteediga (omandipiirid, idempotentsus, vaatajapõhine serialiseerimine); UI-augud on peamiselt i18n-hardcode'id ja süvalinkide fallback (viimane parandatud TÖÖLAUD-P1-s, T05 portib).

**Kolm süsteemset juurviga, mida T06 lahendab:** (1) usalduspiir ei pea (leke); (2) voog on füüsiliselt läbimatu ja habras (kerimine + olekukadu); (3) süsteem teeskleb võimeid, mida tal pole (rada, seosed, sammud) — „eemaldamine on odavam kui usalduse kaotus" (UX-analüüs 14.12).

---

## 3. Otsuste koondtabel O-TK1…O-TK9

Veerud: küsimus · olemasolev otsus/soovitus · D0 soovitatud vaikevalik · kas vajab tooteomaniku kinnitust · millist etappi (ptk 13) mõjutab.

| ID | Küsimus | Olemasolev otsus/soovitus | D0 vaikevalik | Omaniku kinnitus? | Mõjutab |
|---|---|---|---|---|---|
| **O-TK1** | Teekonna granulaarsus: üks Teekond = üks elusituatsioon või üks üldine „minu teekond"? | soovitus: üks olukord, mitu aktiivset lubatud (14.11) | sama; harud/peatükid = HILISEM alamstruktuur | **EI** — kood juba nii; midagi ei muudeta | E5 (tekstid), E6 |
| **O-TK2** | Kas kasutaja saab Teekonna jäädavalt kustutada ja mis saab seotud pöördumistest? | soovitus: jah, 2-sammulise kinnitusega; pöördumised jäävad, side katkeb (`sourceJourneyId` SetNull on skeemis); arhiveerimine jääb pehmeks vaikevalikuks | **KINNITATUD 17.07:** sama | **EI** — O-J3 kinnitatud | E2 (API), E5 (UI) |
| **O-TK3** | AI riskisignaalide saatus: kas jäävad ainult kasutajale nähtavaks ega liigu kunagi automaatselt väljavõttesse? | soovitus: jah; TK-P0 allowlist välistab need jäädavalt | sama; kui toode tahab neid kunagi jagatavaks, on see eraldi otsus eraldi eelvaatega | **EI** — vaikevalik tugevdab privaatsust; nõrgendamine oleks eraldi otsus | E1 (allowlist), E5 (kriisi-kiirkaart) |
| **O-TK4** | Kas vestlusest loodud Teekond seotakse `conversationId`-ga (viide „pärineb vestlusest")? | soovitus: jah, viitena (mudel valmis, service.js) | sama; vestluse kustutus → SetNull; sisu ei kopeeru | **EI** | E2 |
| **O-TK5** | Meeldetuletuste kanal: U1 kiht või ainult platvormisisene? | soovitus: U1 platvormisisene; e-kiri ainult olemasoleva üldise opt-in'iga, sisuvaba | sama; NB ootel-kaardid/tähtajad ise on PILOOT-etapp, mitte V1 | **EI** | E2 (sündmused); ülejäänu väljas |
| **O-TK6** | Kolmanda isiku märgis: vabatahtlik või kohustuslik? | soovitus: V1-s vabatahtlik Teekonnal; KOHUSTUSLIK kinnitus jagamislävel, kui `personContext`/lapse-signaal olemas | sama; `personContext` on allowlistis eraldi võti eraldi kinnitusega | **EI** | E1 (võti), E5 (läve hoiatus) |
| **O-TK7** | Avaliku lubaduse (`/voimalused` s3) ajastus: kas pehmendada kuni ausa elutsükli valmimiseni? | soovitus: jah (14.11) | T06 teostatakse ühe teemana ja deploy käib nagunii T27 RC kaudu — eraldi pehmendusrelease'i EI tehta; kui T06 lükkub RC-st välja, tellib omanik pehmenduse T10 tekstimuudatusena | **EI** (aktiveerub ainult siis, kui T06 RC-st välja jääb) | väljaspool T06 (T10) |
| **O-TK8** | Ajutine kärbe (13.8) vs kohene täisleping (13.5)? | soovitus: kärbe ainult siis, kui täisparandust ei jõuta testida | **otse täisleping** E1 etapina; 13.8 jääb varuplaaniks ainult erakorralise vahepealse release'i tellimisel (enne RC-d deploy'sid nagunii ei tehta, kärbe ei annaks ajavõitu) | **EI** | E1 |
| **O-TK9** | Autori konto kustutamisel — mis saab adressaadile kohale toimetatud (`sentAt ≠ null`) eelpöördumisest? | Fable'i soovitus: **B** — sisu kustub; adressaadile jääb anonüümitud faktikiht + tema enda töömärkmed (O-TK9 leht) | **KINNITATUD 17.07:** B; täpne rakendusleping ptk 10 | **EI** — O-J1 kinnitatud; §7.7 ja dialoogi täpne sõnastus kinnitatakse enne merge'i | E3 (ainus migratsioon), §7.7 tekst, testid 15.5 p9–11 |

**UX-tasandi lisavalikud (UX-analüüs ptk 11 T1–T8; ei ole O-TK numbriruumis).** Kõik saavad siin otsustevaba vaikevaliku, v.a T1/T3, mis on koondatud otsusesse **O-J2**:

| ptk 11 ID | Küsimus | D0 vaikevalik | Kinnitus? |
|---|---|---|---|
| T1 | Teekonna kest: töölauapaneeli sees või oma täisleht? | **KINNITATUD 17.07:** iseseisev täisleht `/teekond` + `/teekond/[id]`; töölauakaart avab selle; see määrab kerimisparanduse koha | **EI** — O-J2 kinnitatud |
| T2 | Loomisradade konsolideerimine | ptk 5 hübriid: ÜKS rada, mille sees vestluslik täpsustaja JA struktuurne kokkuvõte sama oleku peal; komposeri journey-režiim jääb, salvestus suundub samale rajale | EI |
| T3 | Tagasi-noole taastamine rajal | **KINNITATUD 17.07:** rajal on nähtav „← Eelmine samm"; paneeli globaalne noolepeitmine jääb mujal kehtima | **EI** — O-J2 kinnitatud |
| T4 | Mustandi serveripüsivus enne kinnitust | V1 = ainult seadmesisene (sessionStorage) taaste; serverimustand = hilisem eraldi privaatsusotsus | EI |
| T5 | Kriisiriba asukoht | püsiv „Kiire abi" riba kogu koostamisraja vältel, rajast ja kerimisest sõltumatu; + riskisignaali korral kriisi-kiirkaart kasutajale endale | EI (turvalisuse kasuks) |
| T6 | Flight-prototüübi sihtleht | T19 teema otsustab; T06 tarnib ainult flat-esituse ja T19-valmiduse (ptk 12) | EI (T06-s) |
| T7 | „Minu eelpöördumised" vs „Minu jagamised" | mõlemad jäävad: `/eelpoordumised` arhiivivaade = koostaja kirjete loend (eraldatakse sammuribalt); „Minu jagamised" = saadetud kirjete järelseisu kanooniline koht; arhiivivaade lingib sinna, funktsionaalsust ei dubleerita | EI |
| T8 | Sammuriba sildid kasutaja keeles | lihtsustatud sildid („Kirjelda" / „Kellele" / „Vaata üle" / „Saada") `t()`-võtmetega; ametnikuterminid jäävad selgitustesse | EI (sõnastuse pilk möödaminnes E6-s) |

---

## 4. Kinnitatud tooteomaniku otsused (JOURNEY-D1, 17.07.2026)

| ID | Otsus | Soovitus | Mida blokeerib | Mida EI blokeeri |
|---|---|---|---|---|
| **O-J1** (= O-TK9) | SENT-eelpöördumise saatus autori konto kustutamisel | **KINNITATUD: B** — sisu kustub; adressaadile jääb anonüümitud faktikiht ja tema enda töömärkmed; E3 teeb ühe migratsiooni ning transformi | E3 (migratsioon + kustutusteenuse transform + §7.7 tekst); testide 15.5 p9–11 lõppkuju | E1/E2/E4–E7; TK-P0 jagamispiiri; L5 D-plokki |
| **O-J2** (= ptk 11 T1+T3) | Teekonna kest ja raja navigeerimine | **KINNITATUD:** „Minu Teekond” on iseseisev täisleht; „← Eelmine samm” on ainult mitmesammulise raja sees | E4–E6 struktuur (kerimisparanduse koht, URL-puu, esitluskiht) | E1–E3 serveripoole; jagamislepingut |
| **O-J3** (= O-TK2) | Teekonna kustutamine | **KINNITATUD:** 2-sammuline kustutamine; seotud pöördumised jäävad, side katkeb; enne pakutakse eksporti; arhiveerimine jääb esmaseks pehmeks valikuks | E2 kustutus-API ja E5 kustutus-UI | ülejäänud E2 (sündmused, seosed, rada); kõiki teisi etappe |

Kõik kolm otsust on nüüd siduvad. Kõik ülejäänud ptk 3 read jäävad otsustevabade vaikevalikutena. O-J1 puhul kinnitatakse §7.7 ja kustutusdialoogi täpne sõnastus enne merge'i; see ei blokeeri T06 haru ega teostust.

---

## 5. Fail-closed jagamisleping (TK-P0; otsustevaba)

Kanooniline alus: UX-analüüs ptk 13.5 + 15.4–15.6. See peatükk fikseerib lepingu kuue nõutava omaduse kaupa; teostuse failid, testid ja tööjärjekord on 15.6-s ja E1 kirjelduses (ptk 13).

1. **Kasutaja näeb enne saatmist täpselt jagatavat sisu.** Läve-ekraan (ainus valikukoht) näitab iga võtme kõrval elavat payload-eelvaadet — linnukese muutus muudab nähtavat kaasaminevat teksti. Koostamisraja igal sammul on „Kaasas:" kiibirida (täpselt läve valikust läbi tulnud osad); eelvaate samm näitab saadetavat versiooni 1:1 koos „adressaat näeb" plokiga.
2. **Server kasutab lubatud väljade manifesti.** `buildPreInquiryPrefillFromJourney` muutub puhtaks funktsiooniks `(journey, shareKeys ⊆ ALLOWLIST) → prefill`. ALLOWLIST (ainus lubatud hulk): `summary`, `domains`, `missingInfo`, `wish` (ainult personWish tekst), `personContext` (**eraldi võti eraldi kinnitusega — kolmanda isiku info; `wish` EI too seda kaasa**), `assistiveDevices`, `serviceContinuity`, `municipality`, `document` (=contextNote), `title`. Salvestamisel talletub kinnitatud manifest `sharedJourneyInfo.confirmedKeys` (olemasoleva `assessmentState` Json-i sees) — hiljem tõendatav, mida kasutaja kinnitas. **Skeemimuudatust ega migratsiooni EI OLE.**
3. **Märkimata väli ei liigu eelpöördumisse, abisoovi ega metadata'sse.** Võtmeta fragment ei satu `situation`'i, mustanditesse, `topic`'usse, `municipality`'sse ega `sharedJourneyInfo`'sse. **`riskSignals` EI OLE allowlistis — ei liigu mitte ühegi võtmega.** Abisoovi suund: help-torustikku ei tohi tekkida ühtegi Journey-lugejat ilma sama väravata (regressioonivalve-test); `extraNotes` ei kanna enam `fromJourney`/`share` stringe; kategooria-tuletuse sisend piiratakse `summary+domains`-iga. Metadata: U1 sündmuste `meta` on vabatekstita (K1-U1 6.4) — Teekonna sisu ei satu ühtegi sündmusesse, teavitusse ega e-kirja.
4. **Tundmatu või vigane võti ei laienda jagamist.** Tundmatud võtmed EIRATAKSE (käsitle kui puuduvat) ja tagastatakse `ignoredKeys` loeteluna; mitte-massiiv → 400; `shareKeys=[]` või kõik tundmatud → prefill = ainult `sourceJourneyId`, `sourceNotice`, `recipientType`, kõik sisukandjad tühjad. Fail-closed: viga kitsendab, mitte ei laienda.
5. **Adressaat ei saa privaatse Teekonna viidet ega jagamata sisu.** `serializePreInquiry` adressaadi-projektsioon ei sisalda `sourceJourneyId`-d ega ühtegi Teekonna-tuletist peale kasutaja kinnitatud `sharedJourneyInfo` ploki (manifesti piires); tagasilink Teekonnale on ainult autori-audience'i väli. Markeri-testid (15.5 p 1–8) tõendavad: adressaadi täisserialiseering ei sisalda ühtegi märkimata markerit. (Kehtiv `sourceJourneyId` nähtavus adressaadile on kontrollimata — leping nõuab autori-audience'i ja test fikseerib selle; vt ptk 15 NOT_PROVEN.)
6. **Eelvaade ja tegelik saatmine kasutavad sama serveripoolset projektsiooni.** „Adressaat näeb" plokk ja eelvaate samm renderdavad SAMA puhta serialiseerimisfunktsiooni väljundi (viewer=adressaat projektsioon koostatava kirje peal) — kas serveri preview-rajana või sama jagatud funktsioonina; eraldi kliendipoolset rekonstruktsiooni ei tohi olla. Kliendifilter jääb ainult esituse abiks; **jõustamine on serveris**. Privaatsuse 409-eelkontroll (maskeeri/muuda/saada) jääb praegusel kujul teiseks võrguks.

Lisapiirid: kaks valikukihti → üks lävi (peidetud „journey" samm kaob); kasutaja OMA kirjutatud teksti ei politseita (tema tekst on tema oma); L5 D-plokk (kustutatud adressaadi `receiverNote/checklist/nextContactOn` nullimine autori kirjel) kuulub E1-e A/B korral, C korral E3-e.

**Verdikt: TK-P0 leping on arenduseks üheselt määratud ja otsustevaba.** Ükski O-J otsus seda ei muuda (O-J1 puudutab ainult kustutusjärgset retention'it).

---

## 6. Teekonna terviklik elutsükkel (V1 leping)

Iga rida: tänane seis (tõendatud) → V1 kohustus. „Etapp" viitab ptk 13 plaanile.

1. **Loomine.** Kolm rada, heuristiline mustand, suunanupud-vormiväli → ÜKS rada (ptk 5 mudel [B]–[C]): kirjeldus + ülevaade, kumbki oma URL-iga; suunanupud eemaldatakse; vestlustöövoog ja komposer suunduvad samale rajale; vestlusest loomine seob `conversationId` (O-TK4). *(E2+E4+E5)*
2. **Automaatsalvestus.** Puudub; Esc/F5/tagasi kaotab töö → Teekonna kirjeldus ja eelpöördumise koostamisseis autosalvestuvad seadmesiseselt (sessionStorage), naasmisel pakutakse taastamist; katkestamine küsib kinnitust, kui salvestamata sisu on; Esc ei tühjenda kunagi fookuses olevat sisestusvälja. Serverimustandit V1-s EI OLE (T4 vaikevalik). *(E4)*
3. **Jätkamine.** „Jätka viimast" olemas; U2 süvalink katki → süvalink `/teekond/[id]` (TÖÖLAUD-P1 parandus, T05 portib; T06 katab testiga, ei dubleeri); iga samm on URL-is avatav/värskendatav; pooleliolev koostamine taastub sammu URL-i + seadmemustandi kaudu. *(E2+E4)*
4. **Versioon või konflikt.** Journey PATCH-il versioonikaitset pole; PreInquiry'l on `expectedUpdatedAt` CAS → Journey muutmine saab updatedAt-CAS-i (409 → „laadi värske seis"; K1 4.2.2 reegel 3; migratsioonita); pöördumise poolel jäävad kehtima olemasolevad CAS-id; parandus loob alati uue versiooni (`supersededById`), saadetut ei muudeta kunagi. *(E2)*
5. **Eelpöördumise koostamine.** 5+1 sammu, kaks paradigmat, peidetud samm → 4-sammuline rada (Sisu → Adressaat → Eelvaade → Kinnitus), iga samm oma URL-iga; sammuribal tehtud/pooleli/ees olekud; adressaadi valik EI vaheta ise sammu; „Minu eelpöördumised" eraldatakse rajalt arhiivivaateks. *(E4+E5)*
6. **Jagamise eelvaade.** Lubadus ilma katteta → lävi „Mida võtan kaasa?" on ainus valikukoht; valik = payload; eelvaade = sama serveriprojektsioon (ptk 5 p 1/6); kolmanda isiku kinnitus lävel (O-TK6); AI-mustand kannab märget kuni kasutaja esimese muudatuseni ja saatmine eeldab eelvaate avamist. *(E1+E5)*
7. **Saatmine.** Töötab (INTERNAL/e-kiri/allalaadimine; 409-privaatsuskontroll) → jääb; saatmine ainult eksplitsiitsest nupust, mitte kunagi kerimise/animatsiooni kõrvalmõjuna; tulemusekraan ütleb, kes näeb, mida saab tagasi võtta ja kust kirje hiljem leitav on. *(E5)*
8. **Tagasivõtmine.** U3 recall töötab (INTERNAL, enne avamist, CAS) → jääb; lisandub adressaadi teavitus `pre_inquiry.recalled` (T04 tüüp; kirje kaob tema loendist re-verify kaudu, timeline'i jääb „pole enam saadaval" märgis). *(E2, T04 baasil)*
9. **Adressaadi vastuvõtt.** Töötab (accept idempotentne; tööplaani salvestus SENT-kirjel = implitsiitne vastuvõtt) → käitumist EI muudeta; implitsiitse vastuvõtu küsimus on T05/TÖÖLAUD otsus 4, mitte T06 oma; autor näeb avamist „Minu jagamiste" kehtivusreast JA T04 teavituskeskusest (`PRE_INQUIRY_STATUS_CHANGED` muutub nähtavaks). *(piir; testid E7)*
10. **Paranduse saatmine.** U3 correction töötab (uus SENT-kirje, `supersededById`, uus saabumisrada, 409-vahekäik) → jääb; „Minu jagamised" näitab asendusahelat (ptk 9). *(piir)*
11. **Seosed ja tagasilink.** `sourceJourneyId` → „Seotud eelpöördumised" töötab; `linked*Ids` on surnud → surnud lubadused eemaldatakse; V1 päris seosed = seotud pöördumised (staatuse peegeldusega rajal) + vestlusseos (O-TK4); dokumendiviited on väljas (ptk 15); adressaadi poolel tagasilinki EI teki (ptk 5 p 5). *(E2+E5)*
12. **Lõpetamine.** Lõpetatud-olekut pole → V1 = arhiveerimine (pehme lõpp) + **taasavamise nupp** (PATCH lubab, UI puudub täna); lõpetamispõhjus ja kasutaja hinnang tulemusele on PILOOT-etapp (väljas). *(E2+E5)*
13. **Eksport.** Puudub → lihtne tekstieksport („minu Teekond" ühe failina; EXPORT-P0 ausa väljundi ja auditikirje mustrid); GDPR-täisandmekoopia on T16 (O-E1) — V1-s ainult viide; enne kustutamist pakutakse eksporti (O-J3). *(E5)*
14. **Kustutamine ja retention.** Kustutamist pole (ainult konto-kaskaad) → O-J3 järgi: jäädav kustutus 2-sammulise kinnitusega; seotud pöördumised jäävad, side katkeb (SetNull); Journey privaatne originaal kustub alati täielikult (kõigis O-TK9 variantides); konto kustutamisel SENT-kirjete saatus O-J1 järgi (ptk 10); retention-tähtaegu (nt arhiveeritud N kuud) V1-s ei lisata. *(E2+E3+E5)*

---

## 7. Autori ja adressaadi vaadete täpne eristus

| Mõõde | Autor (pöörduja) | Adressaat (vastuvõtja) |
|---|---|---|
| Pinnad | „Minu Teekond" (loend+detail; kest O-J2 järgi), koostamisrada, `/eelpoordumised` arhiivivaade, „Minu jagamised" | `/eelpoordumised` vastuvõtjavaade (opt-in väravaga), vastuvõtulaud, ruum |
| Näeb | kogu oma Teekonda (sh riskisignaalid „ettevaatlike tähelepanekutena", personContext, mustandid); täpselt seda, mida adressaat näeb (eelvaade = sama projektsioon) | AINULT: kasutaja enda kirjutatud/kinnitatud olukorra teksti, teemat, kinnitatud `sharedJourneyInfo` plokki (manifesti piires) + OMA töövälju (`receiverNote`, checklist, `nextContactOn`) |
| EI näe | adressaadi sisemisi töömärkmeid (receiver* on `isRecipient`-audience — kehtiv käitumine jääb) | Teekonda ega selle olemasolu detaile; `sourceJourneyId`-d; riskisignaale; märkimata välju; autori e-posti (kehtiv serialiseerimispiir jääb) |
| Tegevused | loo/muuda/arhiveeri/taasava/kustuta (O-J3); vali jagatav (lävi); saada; võta tagasi (enne avamist); paranda (pärast avamist); ekspordi | võta vastu; tööplaan/kontrollnimekiri/järgmine kontakt; ava ruum; arhiveeri; laadi eelinfo alla |
| Teavitused (T04) | „avatud/arhiveeritud" (status_changed, OPTIONAL e-kiri), paranduse kviitung oma loendis | saabumine (N + sisuta e-kiri), recall-teade (uus), `NEXT_CONTACT_DUE` |
| V1 muudatused | kogu autorivoo ümberehitus (E4–E6) | **UI-d ei ehitata ümber**; muutub ainult: serialiseerimispiir (ptk 5 p 5), recall-teavitus, sihitud i18n-võtmed pöörduja rajaga jagatud pindadel |

Püsiv keeld (UX-analüüs 14.9): adressaadile nähtavat Teekonna vaadet ei ehitata mitte mingil kujul; vastuvõtja näeb ainult külmutatud väljavõtet.

---

## 8. T04 sündmuste ja T05 töölaua kasutus

T04 (`87d9a141`) annab: `DomainEvent` outbox (`emitDomainEvent` tehingus), registri (`lib/events/registry.js`), projektori, `NotificationEvent` projektsiooni + delivery, ack/dismiss, minimaalse teavituskeskuse ja action-registry mustri. T05 annab töölaua, mis neid kuvab. **T06 lisab ainult emit-punkte, registrikandeid ja ühe read-adapteri — mitte ühtegi uut mehhanismi.**

**Millised sündmused T06 kirjutab (registrikanded + emit-punktid äritehingus):**

| Tüüp | Millal | Adressaadireegel | Kanal | Ack | Märkus |
|---|---|---|---|---|---|
| `workspace.created` (kind=journey) | Teekonna salvestamine | owner | ainult timeline | — | teavitust EI (tegija ise); K1-U1 7.1 |
| `workspace.archived` (kind=journey) | arhiveerimine/taasavamine | owner | timeline | — | taasavamine = activated |
| `workspace.deleted` (kind=journey) | kustutamine (O-J3) | owner + auditiklass | timeline/audit | — | meta AINULT loendurid, mitte sisu |
| `pre_inquiry.recalled` | tagasivõtu-TX | recipient_owner | N | readAt | T04 registris kavandatud tüüp (K1-U1 7.7); kui `87d9a141` selle juba teostas, T06 ainult testib |
| `pre_inquiry.sent/opened/archived` | — | — | — | — | **EI LISA** — T04 vertikaal + reconciler katavad; T06 kontrollib katvust, ei dubleeri |

Kõigi sündmuste `meta` on vabatekstita (K1-U1 6.4); Teekonna sisu (domains/riskSignals/summary) EI liigu kunagi payload'i ega timeline'i (K1-U1 11.3 p4). Journey-sündmused on `visibilityClass: personal` ja kustuvad konto kustutusel isiklike ridadena (K1-U1 9.5).

**Millised teavitused tekivad:** adressaadile saabumine (olemasolev sisuta e-kiri + N) ja recall-teade (uus, N); autorile „avatud/arhiveeritud" (olemasolev tüüp; muutub nähtavaks T04 teavituskeskuses ja T05 töölaual); Teekonna enda sündmustest teavitusi EI teki (ainult timeline). Uusi e-kirja liike ei looda.

**Milline „Jätka siit" kirje tekib:** uusi continuity-liike EI looda. Olemasolevad hakkavad õigesti tööle: `journey` (prio 7) → `/teekond/[id]` (TÖÖLAUD-P1/T05 parandus; T06 katab testiga); `pre_inquiry_draft` (prio 5) → koostamisraja õige samm URL-i kaudu; `next_contact` (prio 0/4) adressaadile — muutumatu. Enne esimest salvestust elav mustand on seadmesisene taaste (mitte continuity kirje), sest serverikirjet pole (T4 vaikevalik).

**Millised ack/read/dismiss tegevused kehtivad (T04 ackMode-register):** saabumine → `source_resolved` (accept/avamine kaotab „ootab" seisu); status_changed ja recalled → `readAt` (+ dismiss teavituskeskuses); `next_contact` → `source_resolved` (kuupäevamuutus tühistab — olemasolev käitumine); journey timeline-kirjed on ack-ita.

**Millist T04/T05 koodi EI dubleerita:** `emitDomainEvent`/registry/projektor/delivery; `NotificationEvent` mudel ja keskus; action-registry (`open_journey` route on seal juba parandatud kujul); continuity-mootor ja badge'id; TÖÖLAUD-P1 kolm süvalingiparandust (T05 portib); K1 descriptor/registry (T06 lisab AINULT `journeyAdapter` read-adapteri sama lepingu järgi). Kui mõni vajalik registrikanne/emit on T04-s juba olemas, T06 kirjutab ainult testi, mitte koodi uuesti.

---

## 9. „Minu jagamised" leping

Alus: töötav pind (TÖÖLAUD-A0 ptk 5) + U3/U12 kiht. T06 EI ehita seda ümber; leping fikseerib käitumise ja lisab kolm väikest asja.

**Mida kasutaja näeb:** viis omaniku-skoobitud sektsiooni (saadetud eelpöördumised, ruumid, kutsed, abikuulutused, raamistikunõustumised); igal kaardil omandiriba (nähtavus/päritolu/kehtivus). Eelpöördumise kehtivusahel: `recalled → superseded → external_final → opened → until_recall`. **Lisandub (E5):** kirje juures on kinnitatud jagamismanifest („Kinnitasid kaasa: …" — `confirmedKeys` põhjal) ja Teekonna detailvaates „Mida olen sellest Teekonnast jaganud" koondplokk, mis viitab SAMADELE kirjetele (viited, mitte koopiad; funktsionaalsust ei dubleerita).

**Millal saab tagasi võtta:** `canRecall` = INTERNAL + SENT + avamata + tagasi võtmata + asendamata + ilma kanoonilise ruumita; server kontrollib lukus (CAS + 404/409 eristus). Tagasivõtt teavitab adressaati (ptk 8) ja kirje kaob tema loendist.

**Mis jääb pärast avamist:** tagasivõtt muutub võimatuks; rada on „saada parandus" (`canCorrect` = INTERNAL + avatud + tagasi võtmata + asendamata) koos privaatsuse 409-vahekäiguga; allalaaditud (`DOWNLOADED`) kirje on lõplik väljund (external_final). Avatud kirje sisu adressaadi juures ei muutu kunagi tagantjärele.

**Kuidas näidatakse parandust ja supersession'it:** parandus loob uue SENT-kirje ja seob vana `supersededById`-ga; vana kirje kehtivusrida näitab „asendatud" + viidet uuele versioonile; uus kirje käivitab adressaadil tavalise saabumisraja. Ahel on ühesuunaline — asendatud kirjet ei saa uuesti tagasi võtta ega parandada.

Konto kustutamise ristmõju: O-J1=B korral kaovad kirjed autori poolelt koos kontoga; adressaadi loendis asendub autor placeholder'iga „Kustutatud kasutaja pöördumine" ja parandus/tagasivõtt on autorita kirjel võimatud (ptk 10).

---

## 10. O-TK9 variandi B täpne rakendusleping (TK-R1 sisu; käivitub AINULT kinnitatud O-J1=B järel)

Alus: O-TK9 leht ptk 2/6. Üks migratsioon + üks kustutusteenuse transform + placeholder + tekstid. **See on kogu T06 teema AINUS migratsioon.**

1. **Autori sisu kustub.** Konto kustutamisel: saatmata kirjed (DRAFT/saatmata READY) kustuvad kaskaadiga nagu praegu; kohale toimetatud (`sentAt ≠ null`) kirjetel tehakse enne `user.delete`'i teenusepoolne transform (`lib/privacy/userDeletion.js`, üks `updateMany`): `authorId → NULL` (+ uus `authorErasedAt DateTime?`), `topic → NULL`, `situation → ""`, `assessmentState → DbNull` (sh külmutatud Teekonna-väljavõte ja manifest), `generatedDraft/userEditedDraft → NULL`. Migratsioon (täpselt üks): `PreInquiry.authorId String?` + `authorErasedAt DateTime?`. Journey privaatne originaal kustub kaskaadiga täielikult (käitumine ei muutu).
2. **Adressaadile jääb anonüümitud minimaalne faktikiht ja tema enda märkmed.** Säilivad: rea olemasolu; `recipientOwnerId/recipientEntryId/recipientType/deliveryChannel/selectedRecipientName/Email` (adressaadi enda andmed); `status/sentAt/openedAt/recalledAt/supersededById/createdAt/updatedAt`; **adressaadi töömärkmed** `receiverNote/receiverChecklist/nextContactOn`. UI kuvab autori kohale i18n-placeholderi „Kustutatud kasutaja pöördumine" (ET/EN/RU); parandus/tagasivõtt on autorita kirjel peidetud.
3. **Kustutamine ei jäta privaatset snapshot'i, metadata koopiat ega otsinguindeksi jääki.** Snapshot: `assessmentState → NULL` kaotab külmutatud väljavõtte. Metadata: U1 sündmuste payload on sisuvaba (koodid+ID-d); `visibilityClass: personal` sündmusread kustutatakse kustutustöös ja `actorUserId` → SetNull (K1-U1 9.5); teavitused kustuvad kaskaadiga; DataAuditLog/DataDeletionJob säilitavad ainult ID-d ja meta (audit_long, §7.7 lubatud tehniline jälg). Otsinguindeks: Teekond ei sisene RAG-i üheski koodirajas ja vestluslogid kustutatakse eksplitsiitselt (UX-analüüs 15.2); U6 isiklik otsing on omanikuskoobitud — kustutatud omaniku ridu ei serveerita. E7 test kinnitab: pärast autori kustutust ei sisalda adressaadi rida, sündmuskiht ega ükski serialiseering ühtegi sisumarkerit.
4. **Eksport enne kustutamist ainult omaniku teadliku tegevusena.** Konto kustutamise kinnitusdialoog viitab ekspordivõimalusele (Teekonna teksti-eksport E5 + olemasolevad artefaktirajad); automaatset koopiat ei tehta; kustutuse-eelne koopiaportaal on T16 EXPORT-P3 (O-E1/O-TK9 taga) — V1-s ainult viide. Adressaat saab eelinfo alla laadida juba täna („Laadi eelinfo alla") — see võimalus jääb.
5. **Tekstid.** Privaatsuspoliitika §7.7 üks lisalause („kohale toimetatud pöördumisest jääb adressaadile fakt ja tema märkmed") + konto-kustutuse kinnitusdialoogi üks lause; mõlema sõnastuse kinnitab tooteomanik enne merge'i (O-J1 osa).
6. **Vastuvõtukriteeriumid** (O-TK9 leht ptk 6-B): env-väravaga integratsioonitest — autori kustutuse järel adressaadi `GET /api/pre-inquiries` tagastab rea, millel staatused/ajatemplid ja märkmed alles, `authorId=null`, `authorErasedAt` olemas, MITTE ÜHTEGI sisumarkerit; Journey ridu 0; saatmata pöördumisi 0; L5 D-ploki test (adressaadi kustutusel nullitakse tema märkmed); `npx prisma migrate status` puhas pärast täpselt ühte migratsiooni; `npm run db:migrate:check` roheline; markerisondi kordus uue käitumise vastu.

**Kui O-J1 = A:** koodimuudatust ei ole; E3 = ainult §7.7 ja kinnitusdialoogi teksti täpsustus + testid fikseerivad kaskaadi teadliku käitumisena. **Kui O-J1 = C:** E3 asendub suurema paketiga (adressaadi-koopia mudel), mis tuleb ühendada külmutus-arhitektuuriga — sel juhul EI kuulu see enam T06 V1 skoopi, vaid eraldi otsustatavasse järge (D-plokk kolib kaasa). **Kui otsust ei tehta:** kehtib A (praegune kood); E7 test fikseerib kaskaadi ja teema tarnitakse ilma E3-ta; risk (adressaatide töö vaikne kadu) jääb registrisse üles.

---

## 11. ET/EN/RU, mobiili ja ligipääsetavuse nõuded

Need on teema Definition of Done'i osa (masterregister 3.4.1 p5), mitte hilisem eraldi audit.

1. **Keeled:** kõik pöörduja raja tekstid `t()`-võtmetega kolmes keeles samas PR-is; teadaolevad kõvakodeeringud ja mojibake (UX-analüüs P3-1; TÖÖLAUD P2-6 pöörduja-poolsed read: sammunimed, alustusvalikud, külgpaneel, assistendi vahetekstid) kaovad sellel pinnal; `npm run i18n:check` pariteet; DB-sse ei salvestata ühtegi tõlkimata süsteemisilti (K1-U1 4.9 reegel). Vastuvõtja kontroll-loendi olemasolevate DB-siltide võtmestamine on VÄLJAS (T05/TÖÖLAUD otsus 7). Lihtsustatud sammusildid (ptk 3 T8) + O-TK9 placeholder + läve/valdusriba tekstid kolmes keeles.
2. **Mobiil:** iga samm mahub 375 px laiusele ühte veergu ilma horisontaalse ülevooluta; kerimine töötab puutega igas kestas (praegune `overflow:hidden` blokk kaob); puutealad ≥ 44×44 px; kiibiread murduvad.
3. **Klaviatuur ja fookus:** kerimine töötab ka klaviatuuriga (PageDown/nooled); üks kerimisomanik korraga (karusselli window-kuulaja paneelirežiimis deterministlikult väljas; wheel-capture häkk eemaldatakse); Esc ei kaota kunagi sisestust (fookusevälistus); sammu vahetusel liigub fookus sammu pealkirjale; fookusjärjekord = visuaalne järjekord.
4. **Ekraanilugeja:** sammuriba on `<nav>` + `aria-current="step"`; tehtud/aktiivne/ees olekud ka tekstina (mitte ainult värv); „Kiire abi" riba on SR-kasutajale sammu esimene fookuselement; live-region veateadetele; topelt-ⓘ kaob (üks infoallikas kesta kohta).
5. **Reduced-motion:** läve/raja üleminekud ilma liikumiseta (hetkvahetus + tekstiline kinnitus); tulevane flight-esitus = sama sisu lame jada (flight-effect.md piirid on kohustuslikud); ükski tundlik tegevus ei sõltu kerimisest ega animatsioonist.
6. **Kriisirada:** püsiv „Kiire abi" riba (112/Lasteabi/Ohvriabi) igal raja sammul, rajast ja kerimisest sõltumatu; riskisignaali korral kriisi-kiirkaart kasutajale endale — mitte kunagi adressaadile.
7. **Testid:** render-test — igal märkeruudul label, värava kinnitusnupul aria-nimi (15.5 p12); i18n-võtmete pariteeditest.

---

## 12. T19 ruumilise esitluse tingimuslik ühendus

1. **Põhivoog töötab ilma T19-ta.** T06 tarnib lameda (flat) esituse: URL-põhised sammud, tavaline kerimine, eksplitsiitsed nupud, kanooniline klaasikeel (glass.css). See on ka reduced-motion lõppseis, mitte ajutine varuvariant. T19 prototüüp (teises aknas, `ANALYSIS_READY`) EI ole T06 sõltuvus, blokeerija ega vastuvõtukriteerium.
2. **T19-valmidus ilma domeeniloogikat muutmata.** E4 struktuur ON liidesepunkt: iga samm ([B]–[I] UX-analüüsi ptk 6 jadast) on iseseisev, URL-iga avatav lõuend-komponent, mille olek elab väljaspool esituskihti (URL + mustand + server). T19 valmides saab sammujada ümbritseda flight-mootoriga (kaamera liigub lõuendite vahel) ilma ühtegi domeeni-, oleku- ega serverimuudatuseta — vahetub ainult kest, mis samme järjestab ja kuvab.
3. **Piirid ette (flight-effect.md + UX-analüüs V2 õppetunnid):** kerimine tohib ainult VAHETADA VAADET, mitte kinnitada valikuid; saatmisele eelnevad sammud vajavad alati eksplitsiitseid nuppe; iga lõuend on otselingitav; reduced-motion = lame jada; „Kiire abi" riba ei sõltu läbimisest. Need kehtivad juba flat-esituses, seega T19 ühendus ei nõua hilisemat ümberdisaini.
4. **Omandipiir:** ruumiline esitusmootor on T19 omand; Teekonna sisu ja domeen jäävad T06-le (masterregister 3.4: „Teekond on kandja; ruumiline esitus kasutab T19, kuid ei muutu T19 omandiks"). T06 ei tee T19 prototüüpi uuesti ega ehita flight-koodi.

---

## 13. Üks terviklik Sol/Terra arendus: etapid E1–E7

Reeglid (masterregister 1.1 + ülesande piirid): **üks haru, üks worktree, üks lõppüleandmine**; etapid on sama teema sisemised kontrollpunktid (commit'ide kaupa), MITTE eraldi ülesanded; migratsioonid ja teenusekiht enne UI-d; sihttestid + seotud regressioonid (täissviit/koondaudit = T27 lõppvärav); autenditud sünteetiline runtime `tehis-testkontod.md` kontodega; baas = koordinaatori määratud värskeim liin (vaikimisi T05 valmiva haru tipp, mis on T04 `87d9a141` stack).

| Etapp | Katab | Sisu (kanooniline detail viidatud ptk-des) | Otsuse-eeldus |
|---|---|---|---|
| **E1 — jagamispiir (server)** | TK-P0 | allowlist-prefill + route'i võtmevalidatsioon/ignoredKeys + `confirmedKeys` manifest + help-hügieen (extraNotes, tuletuse sisend) + L5 D-plokk; markeri-testid 15.5 p1–8 punane→roheline järjekorras (15.6) | — (otsustevaba) |
| **E2 — elutsükli teenuskiht** | TK-P2/P3 server + T04/K1 sidumine | activityLog kirjutajad (ainult kasutaja enda ja tema algatatud sündmused); raja arvutus päris seostest (linkedPreInquiries + pöördumise staatus); surnud `linked*Ids` lubaduste eemaldus; `conversationId` sidumine (O-TK4); Journey updatedAt-CAS; taasavamise API-kate; kustutus-API 2-sammulise kinnitusega (O-J3); T04 emit-punktid + registrikanded (ptk 8 tabel) + `pre_inquiry.recalled` katvus; K1 `journeyAdapter` (read-descriptor); U2 süvalingi test (T05 parandust ei dubleerita) | kustutus-API: O-J3 |
| **E3 — SENT-retention (tingimuslik)** | TK-R1 | ptk 10 leping: 1 migratsioon + userDeletion transform + placeholder + §7.7/dialoogi tekstid + testid 15.5 p9–11 uuel kujul. O-J1=A → ainult tekstid+testid; otsustamata → etapp jääb välja, test fikseerib kaskaadi | **O-J1** |
| **E4 — püsivus ja navigeerimine (UI)** | TK-P1+P2 | kest O-J2 järgi + päris scroll-konteiner; wheel-capture häki eemaldus; Escape fookusevälistus; karusselli valve deterministlikuks; sammud URL-i (`?samm=`; peidetud journey-samm kaob läve kasuks); sessionStorage-autosave + taastepakkumine; katkestamise kinnitusdialoog; „← Eelmine samm" rajal; × ei vii kunagi vaikselt avalehele salvestamata sisuga | **O-J2** |
| **E5 — lävi ja aus autorivoog (UI)** | TK-P3/P4 UI | üks lävi „Mida võtan kaasa?" elava payload-eelvaatega + „adressaat näeb" plokk (ptk 5 p 1/6); „Kaasas:" kiibirida; topeltvaliku ja suunanuppude eemaldus; aus rada + tööriistakaardid (sektsioonivirna asemel); kolmanda isiku kinnitus lävel (O-TK6); kriisi-kiirkaart + püsiv „Kiire abi" riba; „Mida olen jaganud" plokk + manifesti kuva (ptk 9); taasavamise/kustutamise UI; teksti-eksport; arhiivivaade rajalt eraldi (T7) | O-J2 (kest), O-J3 (kustutus-UI) |
| **E6 — esitluskiht** | TK-P5 (flat) | stepper/kiibid/roadmap/kaardid kanoonilises klaasikeeles; topelt-ⓘ eemaldus; i18n-võtmed + mojibake (ptk 11 p1); mobiil/a11y/reduced-motion (ptk 11 p2–6); T19-valmiduse struktuur (ptk 12 p2) | O-J2 |
| **E7 — koondkontroll** | — | sihttestide koond; autenditud sünteetiline runtime: (a) ptk 13 markerisondi kordus (kaks kontot, minimaalsed võtmed, adressaadi GET → 0 märkimata markerit), (b) kerimis-/URL-/taaste-sond (kuvatõmmise 3 stsenaarium 1600×900 + 375×812), (c) O-J1 korral kustutussond; `npm run i18n:check`; `npx prisma migrate status`; koristus nulljäägiga; lõpparuanne §15 vormis (arendusprogramm) | — |

**Auditipoliitika:** teostaja teeb oma proportsionaalsed kontrollid; koordinaator võtab vastu odava Git-kontrolliga; **sõltumatu koondaudit ja täissviit jäävad T27 release candidate'i lõppväravasse** (mahusäästlik tsükkel, arendusprogramm ptk 4). Riskimärgis koondauditile: privaatsuspiir (E1), pöördumatu kustutamine (E2/E3), migratsioon (E3).

**Keelatud selle arenduse sees:** `serializePreInquiry` vaatajaloogika muutmine peale ptk 5/10 lepingu; vastuvõtja UI/töövoo ümberehitus; T04 kihi dubleerimine; T19/flight kood; EXTERNAL_EMAIL kanal; retention-taimerid; skeemimuudatused peale E3 migratsiooni; eraldi TK-P0/TK-P1/… ülesannete avamine.

---

## 14. `DONE`-definitsioon

T06 `JOURNEY-V1` on DONE, kui KÕIK järgnevad kehtivad (teostaja tõenditega lõpparuandes):

1. **Usalduspiir:** korratud SENT-markerisond annab adressaadi vastuses 0 märkimata markerit (7-markeri komplekt); 15.5 testid p1–8 ja p12 rohelised; help-suuna regressioonivalve roheline; prefill idempotentne.
2. **Manifest:** salvestatud kirjel on `confirmedKeys`; tundmatu võti → `ignoredKeys`; tühi manifest → ainult side-väljad.
3. **Aus elutsükkel:** UX-analüüsi 14.2 tabeli kõik „EKSITAVALT LUBATUD" read on kadunud (rada loeb päris seoseid; activityLog kasvab; surnud lubadused eemaldatud; U2 süvalink avab õige Teekonna; taasavamine olemas).
4. **Püsivus:** F5/tagasi/Esc ei kaota kunagi sisestust; iga samm on URL-is avatav; review-ekraan on keritav ratta, puute JA klaviatuuriga (kasutaja kuvatõmmise 3 stsenaarium); katkestamine küsib kinnitust.
5. **Üks lävi:** jagamisvalikuid on täpselt üks; linnukese muutus muudab nähtavat payload'i; eelvaade = saatmise serveriprojektsioon; riskisignaalid ei liigu ühegi kombinatsiooniga; personContext ainult oma võtmega + kolmanda isiku kinnitus.
6. **Sündmused:** journey-sündmused tekivad DomainEventi kaudu; recall-teavitus jõuab adressaadini; autori status-teavitused nähtavad T04 keskuses; 0 uut paralleelmehhanismi; payload'ides 0 vabateksti.
7. **O-J1 seis rakendatud:** B korral ptk 10 vastuvõtukriteeriumid (sh täpselt 1 migratsioon, `db:migrate:check` roheline); A/otsustamata korral kaskaaditest fikseerib käitumise ja migratsioone on 0.
8. **Kustutamine (O-J3):** 2-sammuline kinnitus; seotud pöördumised jäävad, side katkeb; enne kustutust pakutakse eksporti.
9. **i18n/a11y/mobiil:** `npm run i18n:check` pariteet; uued võtmed kolmes keeles; mojibake 0 sellel rajal; ptk 11 punktid 2–6 täidetud (runtime-sondiga tõendatud osas; ülejäänu `not_run` põhjendusega).
10. **Protsess:** üks haru, üks lõppüleandmine §15 vormis; sihttestid + seotud regressioonid rohelised; sünteetilised andmed koristatud nulljäägiga; merge'i/deploy'd ei tehtud; täissviit/koondaudit teadlikult T27-s.

---

## 15. `NOT_PROVEN` ja skoobist väljas

**NOT_PROVEN (teostaja kontrollib haru avamisel, ei eelda):**

1. UX-analüüsi koodiviidete READ on `main @ 7ae76d5b` (15.07) seisuga; T04/T05 harud muudavad mh `WorkspaceFeaturePage.jsx`-i — failinimed kehtivad, reanumbrid tuleb uuesti lokaliseerida.
2. Kas `pre_inquiry.sent` emit ja `pre_inquiry.recalled` tüüp sisalduvad T04 `87d9a141`-s — kontrollida haru pealt; puudumisel katab reconciler (lubatud üleminekustrateegia) ja E2 lisab ainult puuduva osa registri kaudu.
3. `sourceJourneyId` tänane nähtavus adressaadi serialiseeringus — leping nõuab autori-audience'i; test fikseerib (ptk 5 p 5).
4. Mobiili/ekraanilugeja tegelik käitumine uue UI peal — tõendatakse E7 sondiga; enne seda `not_run`.
5. Toodangu andmeseis (kas päris SENT-kirjeid on tekkinud pärast 16.07) — E3 transform on kirjutatud nii, et töötab sõltumata ridade arvust; tootmisandmeid ei loeta.

**Skoobist väljas (teadlikult; kuhu kuulub):**

- Vastuvõtja UI/töövoo ümberehitus ja „menetluseelne koostöö" laiendused → T06 hilisem järg / T20/T21; implitsiitse vastuvõtu otsus → T05 (TÖÖLAUD otsus 4); vastuvõtja checklist-siltide DB-võtmestamine → T05 (otsus 7); tasuvärava ühtlustus → T05/T09 (TÖÖLAUD otsus 1).
- Teavituste inbox-UI ja kanalid (push/digest) → T04/U1-P3; continuity-mootori muutmine → T05.
- Serverimustand (T4), dokumendiviited, ootel-kaardid, pöördumise tulemuse kirje, „mis muutus" diff, käsitsi ajajoone-sissekanne, kohtumise ettevalmistuskaart, „loe ette" TTS, paberilt-sisse, lihtvaade → PILOOT-etapp (UX-analüüs 14.9); harud/peatükid, selgituskaart, versioonivaade, teenusekaardi kontakti sidumine, „kui vastust ei tule" turvavõrk → HILISEM.
- Püsivalt välistatud (UX-analüüs 14.9): edenemis-/riskiskoorid ja pingeread; adressaadile nähtav Teekonna vaade; lähedase vaatamisõigus ilma rollilepinguta; automaatsed otsused/saatmised; anonüümsed rajamustrid enne k-anon+eetika otsust.
- GDPR-täisandmekoopia ja kustutuse-eelne koopiaportaal → T16 (O-E1; EXPORT-P1/P3); EXTERNAL_EMAIL kanali muutmine → väljas; retention-taimerid/sweep → T18/T27 (OPS); flight/ruumiline mootor → T19; abisoovi/Teenusekaardi voogude edasiarendus (V3–V6) → T11.

---

## 16. Tooteomaniku otsuseplokk JOURNEY-D1 (kinnitatud 17.07.2026)

> **JOURNEY-D1 — kõik kolm vaikevalikut on tooteomaniku poolt kinnitatud 17.07.2026.**
>
> **O-J1 (= O-TK9).** Kui autor kustutab konto — mis saab adressaadile juba kohale toimetatud eelpöördumisest?
> - **Kinnitatud B.** Sisu kustub; adressaadile jääb anonüümitud fakt + tema enda töömärkmed (leping ptk 10; +1 migratsioon).
>
> **O-J2 (= UX-otsused T1+T3).** Teekonna kest ja raja navigeerimine:
> - **Kinnitatud:** „Minu Teekond” saab iseseisva täislehe (`/teekond` lakkab olemast redirect; töölauakaart avab lehe) ja koostamisraja sees kuvatakse „← Eelmine samm”; mujal jääb noolepeitmine kehtima.
>
> **O-J3 (= O-TK2).** Teekonna kustutamine:
> - **Kinnitatud:** kasutaja saab Teekonna jäädavalt kustutada 2-sammulise kinnitusega; seotud pöördumised jäävad, side katkeb; enne kustutust pakutakse eksporti; arhiveerimine jääb esmaseks pehmeks valikuks.
>
> T06 on nüüd `READY_THEME_BUILD_STACK`; enne merge'i kinnitatakse O-J1=B §7.7 ja kustutusdialoogi täpne sõnastus.

---

## 17. Kopeeritav T06 `JOURNEY-V1` Sol/Terra ülesanne

```text
ÜLESANNE: T06 JOURNEY-V1 — Teekond, eelpöördumine ja adressaadi töövoog (ÜKS teemaarendus)

EELDUS: JOURNEY-D1 otsused O-J1/O-J2/O-J3 on kinnitatud (17.07.2026). T05 WORKBENCH-V1 on üle antud.

LOE ENNE ALUSTAMIST:
1. docs/platvormi arendus/fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md (TERVIKUNA — see on sinu leping)
2. docs/platvormi arendus/fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md ptk 13.5, 14.10, 15.4–15.6
3. docs/platvormi arendus/fable-5-teekond-o-tk9-sent-retention-otsus.md ptk 2 ja 6 (kui O-J1=B)
4. docs/platvormi arendus/fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md ptk 6.3–6.4, 7.1, 7.7, 8, 9.2

TÖÖKORD:
- git fetch; värske worktree koordinaatori määratud baasilt (vaikimisi T05 haru tipp, mis on
  T04 codex/workspace-events-v1 @ 87d9a141 stack); haru codex/journey-v1.
- Etapid E1→E7 lepingu ptk 13 järjekorras, iga etapp eraldi commit; migratsioonid ja teenusekiht
  (E1–E3) enne UI-d (E4–E6). E3 rakendab kinnitatud O-J1=B lepingut.
- Testid: markeri-testid (leping ptk 5 + UX-analüüs 15.5) kirjuta ENNE parandust (punane→roheline);
  sihttestid + seotud regressioonid; TÄISSVIITI ega sõltumatut auditit ei tehta (T27 lõppvärav).
- Runtime: autenditud sünteetiline sond tehis-testkontod.md kontodega — SENT-markerisondi kordus
  (kaks kontot, minimaalsed võtmed, adressaadi GET → 0 märkimata markerit), kerimis-/URL-/taaste-sond
  (1600×900 ja 375×812), O-J1=B korral kustutussond. Koristus nulljäägiga.

PIIRID:
- serializePreInquiry vaatajaloogikat muudad AINULT lepingu ptk 5 p5 / ptk 10 ulatuses;
  vastuvõtja UI-d ja töövoogu ei ehita ümber; T04 koodi (emitDomainEvent/registry/projektor/
  teavituskeskus/action-registry) ja T05 töölauda ei dubleeri — lisad ainult emit-punktid,
  registrikanded, journeyAdapteri ja testid;
- skeemimuudatusi peale E3 ühe migratsiooni EI OLE (npx prisma migrate status tõendab);
- T19/flight koodi ei kirjuta; retention-taimereid ei lisa; EXTERNAL_EMAIL kanalit ei muuda;
- riskisignaalid ei liigu adressaadile MITTE ÜHEGI võtmega — see on absoluutne;
- üks haru, üks lõppüleandmine arendusprogrammi §15 vormis; commit'id push'itakse, merge'i/deploy'd EI.

DONE = lepingu ptk 14 kõik punktid; lõpparuandes iga punkti tõend või not_run/NOT_PROVEN põhjendus.
```

---

## Jätkamispunkt

- **Seis (17.07.2026):** JOURNEY-D0 COMPLETE — see leping on T06 kanooniline arendusleping; JOURNEY-D1 vaikevalikud O-J1=B, O-J2=iseseisev leht + rajasisene nool ja O-J3=2-sammuline kustutamine on kinnitatud. T06 = `READY_THEME_BUILD_STACK`: järgmine eeldus on ainult T05 lõplik remote SHA.
- **Kontrollitud allikad:** ptk 0 loend (7 dokumenti täies mahus); Git-/serveri-/runtime-fakte ei kontrollitud uuesti — kõik kanoonilised faktid pärinevad 17.07 kontrollidest (arendusprogramm ptk 2; masterregister ptk 0; K1-U1 ptk 1).
- **Järgmine töökord siin dokumendis:** (1) võta vastu T05 lõpp-SHA ja asenda see ptk 17 tööharu baasina; (2) kui T04/T05 seis muutub (nt recalled-tüübi olemasolu selgub), uuenda ptk 8 tabelit ja ptk 15 NOT_PROVEN ridu; (3) kui omanik tellib erakorralise vahepealse release'i enne T06 järjekorda, rakenda O-TK8 varuplaan (13.8 kärbe eraldi kitsa paketina) — ainult siis on TK-P0 eraldamine teemast põhjendatud (masterregistri 1.2 deploy-piiri erand).
- **Katkemise korral:** see dokument + masterregistri T06 kirje on tõeallikas; ära korda UX-analüüsi, O-TK9 lehte ega K1-U1 analüüsi — need on lukustatud sisendid.

STATUS: COMPLETE
