# ADR-156 — Loetelu loetakse koos ja valikumudel jätab alles detaili lõigud

21.10.2026. Teostus Claude Opus 5.5. ADR-154 ja ADR-155 kordustest serveris (`7da241c7`, 8 küsimust, 0,033 USD):
5 PASS, 3 FAIL ([tõend](../audits/evidence/sol-proof-20261014-01/server-rag-chat-prompt46.json)). Kahe vea põhjus on
näha uues admini vaates (`/admin/rag/chat-trace`).

## E9: loetelu oli paketis, vastus seda ei lugenud

Jälg: loetelu järg (ADR-154) lisas SKA lehe lõigu „Neist täiskasvanutele mõeldud teenused on:“ järele seitse
teenuse lõiku (`list_continuations` 1/7, S7–S13). Lõigu tekst algab teenuse nimega („Koduteenus …“). Sissejuhatuse
(S4) ja teenuste vahel olid aga kaks sätet (S5, S6), ja vastus ütles „siin olev teave ei loetle neid teenuseid“.

**Otsus.**
1. **Järjekord.** Loetelu lõigud seisavad otse oma sissejuhatuse järel, oma järjekorras.
2. **Seos AI kontekstis.** Loetelu lõigul on mudeli kontekstis väli `continues: "S4"`
   (`search/model-context.js`). See on ainult uutel lõikudel, nii et vanade pöörete kontekst on sama.
3. **Juhis `m4-grounded-dialogue-47`.** Rida läheb ainult pöördesse, mille tõendites on `continues`. Sn ja selle
   jätkulõigud loetakse ühe tekstina. Kui küsitakse, kas asi on loetelus, nimetatakse loetelu kirjed viidetega ja
   öeldakse, kas küsitu on nende hulgas. Iga muu pöörde juhis on sama mis versioonis 46.

## U01: valikumudel jättis detaili lõigud välja

Jälg: kandidaatide hulgas olid v89 lõigud:
- „Eestis kasutatavate väheintensiivsete psühholoogiliste sekkumiste ülevaade“ (kohad 2–5 ja 8–10, sh „3.2.
  Spetsialistide …“);
- „Vaimse tervise astmelise abi tegevuskava 2024–2027“ (6. koht).

Valikumudel jättis 36 kandidaadist alles kaks: TAI lehe, mis koolitust kõige paremini kirjeldab, ja PM+ uuringu.
Küsimus oli piloteerimise algusaja kohta. Vigane ei olnud otsing ega korpus, vaid valik.

**Otsus: `rag-v2/search-assist-15`.** Valikumudeli juhisesse tuleb pärast rida „Cover every part of the request“ üks
rida (`RERANK_DETAIL_INSTRUCTIONS`). Kui küsitakse nimetatud teema üht detaili (millal algab või lõpeb, kui kaua
kestab, kui palju, kui mitu, kes osaleda saab, millest koosneb, kus see on loetletud), jäetakse alles iga selle teema
lõik, mis võib detaili öelda, ka siis, kui teine lõik kirjeldab teemat paremini. Plaani juhis on sama. Valitud lõike
on endiselt kuni üheksa.

## Ülejäänud kordustesti tulemused

- **Parandatud:**
  - G13: PKS § 96 on paketis ja vastuses („olete ema täisealiste lastena ülalpidamiskohustuslased“);
  - N01: 378,40 eurot on vastuses ilma piiranguta ja kuupiir on „kuni 8 päeva kalendrikuus“;
  - G04, G42: keelevigu ei ole;
  - G33: § 72 lg 2 on paketis ja välistus on öeldud. Seekord oli § 95 järjestatud lõik, nii et teine lugemine on
    näidatud ainult kohalikus kontrollis.
- **E7 jääb lahtiseks:** linna kord ei tulnud paketti, sest plaan ei saanud aru, kas mõeldi Tartu linna või Tartu
  valda, ja vastus küsis seda. Omavalitsuse tee on vastuses teises plokis (SHS § 17), aga ilma taotlemiseta.

## Kontroll

Kohalik kontroll päris `retrieve()` koodiga mälus olevate väljamõeldud dokumentide peal:
- teise dokumendi valitud lõik on sissejuhatuse ja kirjete vahel; järjekord on sissejuhatus, kirjed, teine lõik;
- `continues` on kirjetel `S1`, mujal puudub;
- juhise rida on ainult siis, kui kontekstis on `continues`.

Mudeli käitumine mõõdetakse E9 ja U01 kordustestiga (eelregistreeringu lisa enne jooksu).

## Kordustest serveris (21.10, `375271b1`, 0,008 USD): 2/2

- **E9 PASS:** „Ei. Eakate päevakeskus ei kuulu nende 13 sotsiaalteenuse hulka, mille korraldamise kohustus on seadusega omavalitsusele pandud. Vald võib korraldada ka muid sotsiaalteenuseid.“ Juurde tulevad omavalitsuse hindamiskohustus (SHS § 15 lg 1) ja pöördumine. Piirangut ei ole.
- **U01: vastus on õige, viga on korpuses.** Piloodi aeg, 24 EAP ja viis moodulit on Sotsiaalministeeriumi VIPS-spetsialisti lehel, mis korpuses puudub (omaniku tekst `Andmebaasi/Uut juurde/VIPS-spetsialist.txt`; korje nimekirjas „Veel puudu: … lisada veebilehena“). Vastus „ei saa oma teabest öelda“ on siis õige. 20.10 ootus eeldas ekslikult, et v89 sisaldab seda. Valikumudel jättis seekord alles ühe lõigu; puuduva lehe tõttu ei muuda see vastust. search-assist-15 mõju ei ole sellega mõõdetud.

[Tõend](../audits/evidence/sol-proof-20261014-01/server-rag-chat-prompt47.json)
