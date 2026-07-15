STATUS: ACTIVE HANDOFF

# Tööheaolu koondseis ja jätkamispunkt

Kuupäev: 15.07.2026

See fail seob üheks tööjärjeks Tööheaolu tervikanalüüsi, E0 paranduse, ruumilise kujunduse ideatsioonid ja järgmised tooteotsused. See ei asenda detailseid lähtefaile ega anna prototüüpidele tootmiskoodi staatust.

## 1. Praegune seis ühe pilguga

| Osa | Seis | Asukoht / tõend | Järgmine samm |
|---|---|---|---|
| Tööheaolu tervikloogika, metoodika ja UX | Valmis | `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` | Kinnitada TO-1…TO-10 otsused |
| E0: V17, lekketa veateade ja salvestuse idempotentsus | Koodina valmis, testitud ja push'itud; pole merge'itud ega deploy'itud | `fable/tooheaolu-e0` @ `fe8c7df2`; `fable-5-tooheaolu-e0-progress.md` | Sõltumatu järelkontroll, seejärel merge-otsus |
| Faasiteekonna ruumiline idee | Klikitav ideatsiooniversioon valmis | `prototyybid/heaolu-faasiteekond-demo.html` | Kasutajatest ja alles seejärel päris makett |
| Kasutusjuhendi lugemispaneeli idee | Klikitav ideatsiooniversioon valmis | `prototyybid/kasutusjuhend-lugemispaneel-demo.html` | Kontrollida loetavust, navigeerimist ja mobiilivaadet |
| E1–E6 | Alustamata | Teostusjärg tervikanalüüsi ptk 13 järgi | Ei alustata enne sõltuvaid tooteotsuseid |

## 2. E0 külmutatud pakett

E0 sulgeb kolm varasemat konkreetset viga:

1. standardne Tööheaolu → Kovisiooni üleandmine ei takerdu enam reavahetust ületava nime-valepositiivi taha;
2. tuvastajavea korral saab kasutaja lekketa tüübipõhise parandamisvihje, kuid vastus ei avalda tuvastatud väärtust;
3. kõik üheksa Tööheaolu salvestusteed on 30 sekundi aknas idempotentsed ka paralleelsete korduspäringute korral.

Kontrollseis: 1238/1238 testi, i18n ja lint rohelised, autenditud runtime-vood läbitud, testandmed koristatud, Prisma skeemi ega migratsioone ei muudetud. E0 haru ei tohi laiendada E1–E6 ega kujunduskatsetega. Järelkontroll peab keskenduma detektori kolmele kutsujale, dedupe-akna tootesemantikale ning 200/201 API-lepingule.

## 3. Kaks prototüüpi ja nende roll

### 3.1. Heaolu faasiteekond

Fail: `prototyybid/heaolu-faasiteekond-demo.html`

Privaatne artefakt: https://claude.ai/code/artifact/2a95c319-520d-4fa2-a7aa-751287b07fab

Mida see tõestab:

- ühe tööfaasi saab hoida ekraanil ühe keskse klaaspinnana;
- faaside vahel saab liikuda rulliku, nooleklahvide ja jaamaklõpsuga;
- hover võib näidata järgmist või eelmist faasi ilma tööolekut muutmata;
- värav võib näidata arusaadavalt, miks edasi veel ei saa;
- alumine faasiriba vastab küsimusele „kus ma selles töös olen";
- eraldi dokisang vastab küsimusele „kus ma platvormis olen".

See on CSS-transition-põhine tunnetuskatse. Päris teostuse jaoks tuleb liikumine ehitada eraldi flight-/kaameramudeliga, säilitades vähendatud liikumise, klaviatuuri, fookuse ja automaatse salvestamise pariteedi. Seda HTML-i ei laiendata tootmiskoodiks.

### 3.2. Kasutusjuhendi lugemispaneel

Fail: `prototyybid/kasutusjuhend-lugemispaneel-demo.html`

Privaatne artefakt: https://claude.ai/code/artifact/86bcefb9-edf4-4891-ae69-7d83d0371255

Mida see tõestab:

- pikk lugemissisu võib jääda loomulikult keritavaks oma konteineris;
- peatükke ei ole vaja dubleerida eraldi suure menüüna: veerise marker näitab asukohta ja hover/fookus nime;
- URL-ankrud võimaldavad avada juhendi otse õigest peatükist;
- sulgemine töötab X-i ja Esc-iga;
- ruumiline faasivahetus ei pea asendama tavalist kerimist seal, kus kasutaja eesmärk on lugeda.

See on eraldi lugemispinna muster, mitte Tööheaolu töövormi navigatsioon.

## 4. Ühine kujundusleping

Prototüüpidest ja varasemast ruumilise lehe analüüsist tuleneb järgmine piir:

- **tööprotsess**: üks faas korraga, faasiriba, nooled/rullik/klikk, väravad ja automaatne salvestamine;
- **lugemissisu**: loomulik kerimine selleks ettenähtud konteineris, peatükimarkerid ja URL-ankrud;
- **platvormi asukoht**: eraldi taanduv dokk või sang, mis ei dubleeri faasiriba;
- **võrdlemine**: eraldi teadlik režiim, mitte vaikimisi püsiv külgpaneel;
- **ohutusrajad**: Töövägivald ja Raske juhtum ei tohi peita kiireloomulist infot animatsiooni ega mitme värava taha;
- **oleku säilimine**: iga tehtud valik salvestub kohe ning jääb alles tagasi liikudes, lehele naastes ja katkestuse järel;
- **ligipääsetavus**: kõik rulliku- ja liikumisteed peavad omama klaviatuuri-, puute- ja reduced-motion vastet.

## 5. Otsused enne E1–E6 alustamist

Tööheaolu tervikanalüüsi TO-1…TO-10 tuleb vormistada eraldi otsustusleheks. Kõigepealt otsustatakse arendust otseselt avavad küsimused:

1. TO-1 — kirjete elutsükkel;
2. TO-2 — kontrollpunkt ja meeldetuletus;
3. TO-4 — Katkestuste ja Tööprotsesside ühendamine;
4. TO-5 — Taastumise ümberehitus;
5. TO-8 — vormifaktor ja ruumilise faasiteekonna kasutuspiir.

Seejärel otsustatakse partnerlust, ohutust ja vastutust puudutavad TO-6, TO-7 ja TO-9 ning lõpuks juhtimis- ja tulevikuvalikud TO-3 ja TO-10.

Otsustuslehe sihtfail: `fable-5-tooheaolu-tooteotsuste-otsustusleht.md`. Iga otsus peab sisaldama soovitatud vaikevalikut, kasutajamõju, privaatsus-/turvamõju, avatavat E-etappi ja üht lühidalt vastatavat tooteomaniku küsimust.

## 6. Soovitatud tööjärjekord

1. Sõltumatu järelkontroll harule `fable/tooheaolu-e0`.
2. TO-1…TO-10 otsustusleht, kirjutatuna jooksvalt ja katkestuskindlalt.
3. Kasutajatest kahele prototüübile; tulemused dokumenteerida, mitte prototüübi lähtekoodi vaikimisi kasvatada.
4. E0 merge pärast heakskiitu; deploy eraldi otsusena.
5. Valida kinnitatud otsustest esimene väike E1–E6 teostuspakett.
6. Enne päris ruumilise kesta ehitamist teha tootmiskoodi mitte puudutav makett, mis tõestab vähemalt: faasivahetus, värav, automaatsalvestus, tagasi-tulek, keritava sisekonteineri piir ja reduced-motion.

## 7. Failihügieen

E0 kood kuulub ainult harule `fable/tooheaolu-e0`. Analüüsi-, otsustus- ja prototüübidokumendid kuuluvad dokumentatsioonikihina eraldi commit'i. Neid ei segata E0 paranduse järelkontrolli diffi ning prototüüpe ei deploy'ita.

## 8. Täpne jätkamispunkt

- Fable: lõpeta `fable-5-tooheaolu-tooteotsuste-otsustusleht.md`; ära auditeeri ise E0 paketti ega alusta E1–E6.
- Sõltumatu järelkontrollija: vaata üle `fable/tooheaolu-e0` @ `fe8c7df2` progressidoki fookuste järgi.
- Tooteomanik: testi mõlemat prototüüpi tunnetuse, arusaadavuse ja navigeerimise seisukohalt; prototüüp ei pea veel visuaalselt olema lõplik.
- Järgmine teostaja: alusta alles pärast E0 verdikti ja vastavate TO-otsuste kinnitamist.
