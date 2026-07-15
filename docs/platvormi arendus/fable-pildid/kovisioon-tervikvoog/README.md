# Kovisiooni kujunduse kuvatõendid ja jätkamispunkt

Kuupäev: 15.07.2026

Selle kausta eesmärk on anda järgmisele Fable'i aknale päris rakenduse kuvatõendid Teemaseemne ja Kovisiooni tervikvoost ning hoida alles täpne koht, kust kujundusteemaga jätkata.

## Põhivoog

Failid `01`–`10` näitavad sünteetilise juhtumiga päriselt läbi mängitud rada:

1. Teemaseemnete leht;
2. Kovisiooni etapp 1 — Algus;
3. Kovisiooni etapp 2 — Lugu;
4. Kovisiooni etapp 3 — Uurimine;
5. Kovisiooni etapp 4 — Peegeldus;
6. Kovisiooni etapp 5 — Võimalused;
7. Kovisiooni etapp 6 — Ressursid;
8. Kovisiooni etapp 7 — Valik;
9. Kovisiooni etapp 8 — Lõpp;
10. Lõpetatud juhtumite leht pärast juhtumi sulgemist.

Need on tehtud kohalikust `localhost:3000` rakendusest administraatori kontoga. Need ei ole maketid. Serveri, kasutajakonto, andmete või ekraani mõõdu erinevuse tõttu ei pruugi need olla produktsioonivaatega pikslitäpselt samad.

Kasutaja enda kuvatõmmised on failid `Kuvatõmmis 2026-07-15 ...`. Neid tuleb käsitleda päris kasutajavaate lisatõenditena ning võrrelda põhivoo piltidega.

## Jäädvustatud UX-tupik

Kuvatõend: `error-edasi-ei-saa.png`.

Vaade „Privaatne professionaalne ettevalmistus” kuvab aktiivse 2. sammu ja viieosalise edenemisraja:

1. Kiire seeme;
2. Professionaalne ettevalmistus;
3. Võrgustik ja senine töö;
4. Fookus ja soovitud muutus;
5. Eelvaade, jagamine ja töövorm.

Kasutaja loomulik ootus on jätkata sellel lehel 3. sammu või vajutada selget edasi-nuppu. Seda võimalust ei ole. Tekst ütleb tagasihoidlikult, et ettevalmistuse moodulid on alles järgmises ehitusjärgus, ning ainus toimiv tegevus viib tagasi Teemaseemnete lehele. Sealt peab kasutaja ise leidma seemne, lisama selle Kovisiooni järjekorda ja alustama Kovisiooni.

See ei ole kasutaja eksimus. Vaade lubab visuaalselt jätkuvat protsessi, kuid käitub tupikuna. Probleem on eriti oluline esmakasutajale, kes ei tea süsteemi sisemist loogikat.

## Kujundusringi lähtekoht

Järgmises Kovisiooni kujundusringis tuleb otsustada vähemalt:

- kas professionaalse ettevalmistuse sammud 2–5 ehitatakse päriselt lõpuni või eemaldatakse seni eksitav sammurida;
- kas põhitegevus peab olema otse `Jaga seeme Kovisiooni järjekorda` või `Tagasi Teemaseemnetesse` koos väga selge järgmise sammu juhisega;
- kuidas eristada privaatset ettevalmistust, teadlikku jagamist ja Kovisiooni alustamist ühe arusaadava teekonnana;
- kas kasutaja näeb igas Kovisiooni etapis kohe, mida temalt oodatakse, mis on juba valmis ja milline tegevus viib edasi;
- kuidas vähendada korraga nähtava info hulka, säilitades Kovisiooni metoodilise struktuuri ja inimese teadlikud kinnitused;
- kuidas sama voog toimib väiksemal ekraanil ja erinevate Kovisiooni rollidega.

## Jätkamisjuhis järgmisele Fable'i aknale

Loe enne ettepanekute tegemist:

1. `docs/platvormi arendus/fable-5-kovisiooni-tervikvoo-teadmistekaart.md`;
2. käesolev fail;
3. kõik selle kausta PNG-d, pöörates eraldi tähelepanu failile `error-edasi-ei-saa.png` ja kasutaja enda kuvatõmmistele.

Seejärel jätka Kovisiooni ruumilise ja kasutusloogilise kujunduse teemaga. Ära käsitle praegust paigutust valmis disainina ega eelda, et kasutaja teab, milliselt lehelt järgmine tegevus leitakse. Erista oma väljundis:

- aktiivse koodi või kuvatõendi põhjal kinnitatud probleemid;
- metoodikast tulenevad muutumatud nõuded;
- kujundusvariandid ja tooteotsust vajavad ettepanekud.
