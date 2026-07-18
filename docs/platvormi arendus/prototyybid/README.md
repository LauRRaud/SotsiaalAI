# Ruumilise töölaua prototüübid

STATUS: DEFERRED — HISTORICAL REFERENCE (tooteomaniku otsus 2026-07-18)

Kuupäev: 2026-07-17 · Staatus uuendatud: 2026-07-18

> **T19 on `DEFERRED — OWNER_DECISION 2026-07-18`.** Tooteomanik otsustas, et kogu T19 ruumilise esitlusmootori suund on praegu ebaoluline. Selle kausta failid on **ajalooline viitematerjal, mitte kinnitatud tootedisain ega pooleliolev töö**. `RUUM-VIS-D1` disainiringi ei väljastata ja väljunddokumenti `fable-5-uhe-teema-fookusruum-ja-brandisuund.md` ei kirjutata.
>
> Kanooniline `ruumilise-toolaua-prototuup.html` **on olemas ja valmis** (commit `faeaf04c`, main'is) — allolev „Jätkamispunkt" kirjeldab seda ekslikult tulevase iteratsioonina ja on aegunud.
>
> Ükski arendusteema ei oota T19 järele: kuni teema on edasi lükatud, lahendab iga teema oma esitluse ise, järgides `app/styles/tokens.css` ja `glass.css` mustreid.

## Eesmärk

Selle kausta HTML-failid ei ole eraldiseisvate lehtede demod ega ühe funktsiooni tulevane lõppkuju. Need on käitumispõhised alusproovid ühe platvormiülese **ruumilise töölaua prototüübi** jaoks.

Siht on üks ühine prototüüp, mille avavaates saab valida kasutusnäite. Näite vahetamine muudab töövoo sisu, faase, tööobjekte, võrdluspaare ja nähtavusreegleid, kuid ei loo igale funktsioonile uut dokki, faasiriba, liikumismootorit ega vaaterežiimide süsteemi.

Praegused HTML-id tõendavad eri käitumisi eraldi. Need ei tõenda veel valmis ühist näitevalikut.

## Praegused alusproovid

| Fail | Tõendatav käitumine | Praeguse mock-sisu roll |
|---|---|---|
| `ruumilise-toolaua-fookuse-ja-vordluse-prototuup.html` | üks aktiivne faas, alumine faasiriba, dokk, Fookus/Ülevaade/Võrdlus, kahe pinna kõrvutamine ja kitsas A/B-vaade | Dokumendi koostamine on testandmestik, mitte prototüübi omanik ega ainus sihtleht |
| `ruumilise-toolaua-faasiliikumise-prototuup.html` | faaside ruumiline vahetus, eelvaade, värav, klaviatuur, rullik ja reduced-motion'i alus | Tööheaolu on testandmestik, mitte eraldi „heaolu demo” |
| `ruumilise-toolaua-lugemiskihi-prototuup.html` | pika sisu sisekerimine, peatükimarkerid, URL-ankrud ja suletav lugemiskiht | Kasutusjuhend on testandmestik, mitte eraldi lehearhitektuur |

## Ühise prototüübi näitevalik

Esimese ühise prototüübi valikus peavad olema vähemalt kõik praegu dokumenteeritud referentsid:

1. **Dokumendi koostamine** — faasid, mustand, lähtedokument, versioonid ja kõrvutamine.
2. **Tööheaolu** — privaatne faasiteekond, naasmine, väravad ja ajavõrdlus.
3. **Teekond** — kompass, ajajoon, järgmine samm ja jagatava väljavõtte ettevalmistus.
4. **Kovisioon** — töötava kaheksaetapilise põhivoo ruumiline esitlus, ühine ja privaatne kiht ning etappide/versioonide võrdlus.
5. **Registreerimine / sisenemine** — valikupõhise flight-liikumise tehniline referents; see ei muuda registreerimislehte prototüübi keskpunktiks.
6. **Kasutusjuhend / lugemiskiht** — näide olukorrast, kus loomulik kerimine on ruumilisest faasivahetusest selgem.

Register on avatud: uus dokumenteeritud töövoonäide lisatakse samasse valikusse, mitte uue lehespetsiifilise demo nime alla.

## Ühine kest ja näiteadapter

Ühine kest omab:

- näitevalikut ja tagasiteed valikusse;
- platvormi dokki või sanga;
- faasiriba ja aktiivse faasi fookust;
- Fookuse, Ülevaate ja Võrdluse vaaterežiime;
- ruumilise ülemineku mootorit koos lameda ning reduced-motion'i vastega;
- URL-is taastatavat näite-, faasi- ja vaateseisu;
- klaviatuuri-, puute-, fookuse- ja ekraanilugejalepingut.

Iga näide annab adapterina ainult oma nimetuse, faasid, tööobjektid, tegevused ja väravad, lubatud võrdluspaarid, nähtavus-/privaatsussildid ning sobiva liikumisprofiili. Näide ei tohi ümber defineerida ühise kesta navigeerimist ega kasutada liikumist õiguste, kriisiinfo või salvestusoleku varjamiseks.

## Välised käitumisreferentsid

Need ei ole uued näited ega paigaldatavad sõltuvused, vaid platvormiülesed interaktsioonikandidaadid, mida võib katsetada sobiva näite sees. Referentsi välimust ei kopeerita üks ühele: SotsiaalAI enda materjal, ruumigrammatika, ligipääsetavus ja olekuleping jäävad määravaks.

| Referents | Sobiv roll ühises prototüübis | Piirang |
|---|---|---|
| [React Bits Carousel](https://reactbits.dev/components/carousel) | tööobjektide, näidete, versioonide või arhiivikirjete ruumiline sirvimine; eelkõige Dokumendi koostamise, Teekonna ja Kovisiooni sees | ei asenda ühist näitevalikut, dokki ega faasiriba; ei tekita teist globaalset karusselli olemasoleva `GlassCarousel` kõrvale; autoplay vaikimisi väljas ning alati peavad olema nupud, klaviatuuritee, positsiooniteade ja reduced-motion'i vaste |
| [React Bits Animated List](https://reactbits.dev/components/animated-list) | tegevuste, muudatuste, tulemuste, ajajoone või „mis muutus” sündmuste elav loend; kasutatav kõigis näidetes, kus päris olekusündmused lisanduvad | ei ole dekoratiivne lõputu voog; rida ei kao ega vaheta vaikides kohta; lisandumine peab vastama päris sündmusele, säilitama fookuse ja lugemisjärje ning olema ekraanilugejale tekstina teatatud |

Esimeses ühises HTML-is katsetatakse neid vähemalt kahes eri töövoos, et tõendada platvormiülest sobivust. Carousel'i kandidaat sobib näiteks Dokumendi koostamise versiooniriiulisse ja Kovisiooni kaustadesse; Animated List sobib Teekonna ajajoonele ning Kovisiooni või Tööheaolu „muutunud pärast viimast külastust” vaatesse. Need on **sisupinna mustrid**, mitte näitevaliku uued kirjed.

Kui referentsist saab hiljem tootmiskoodi kandidaat, tehakse enne eraldi sobivusotsus: võrreldakse seda olemasoleva `components/room/GlassCarousel.jsx`-iga, kontrollitakse sõltuvusi, lähtekoodi ja litsentsi ning lisatakse ainult vajalik kohandatud kood. React Bitsi projekt pakub komponente kopeeritava lähtekoodina ja kasutab MIT + Commons Clause'i litsentsi; CLI-käsku ei käivitata selle prototüübimärkme alusel.

## Jätkamispunkt

> **AEGUNUD 18.07:** see peatükk kirjutati enne, kui `ruumilise-toolaua-prototuup.html` valmis sai. Fail on nüüd olemas ja main'is (`faeaf04c`); T19 on edasi lükatud, nii et jätkamispunkti ei kasutata. Peatükk on alles ainult ajaloolise kontekstina.

Järgmise HTML-iteratsiooni kanooniline sihtnimi on `ruumilise-toolaua-prototuup.html`. See fail peab alustama näitevalikust ja koondama praeguste alusproovide tõendatud käitumised; seda ei nimetata ühe lehe järgi.

Praeguseid kolme HTML-i säilitatakse võrdlusbaasina. Neid ei kasvatata üksteisest sõltumatuteks lehedemodeks ega käsitleta tootmiskoodina. Päris rakenduse muudatused paketistatakse hiljem tööruumilepingu, õiguste, sündmuste ja kasutajatesti järel.
