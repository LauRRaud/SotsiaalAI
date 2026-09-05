# ADR-004: mitme allika otsingukvaliteedi järelkatse

Seis: vastu võetud kohaliku ettevalmistuse jaoks; pärisembedding'u käivitus vajab eraldi täpset luba.
Kuupäev: 05.09.2026.

## Otsus

M0–M2.2 ühe artikli pilooti ei korrata ega kirjutata ümber. Järgmine M2 kvaliteedikatse kasutab väikest omaniku materjalidest valitud päriskorpust, kus sarnased teemad ja kaks sama programmi kirjeldust konkureerivad sama päringu pärast.

- Kõik testkasutajale lubatud dokumendid jäävad üldpäringus otsingule nähtavaks. Õige dokumendi ID, lehekülg, ankur ja vastatavuse silt kuuluvad ainult hindajasse.
- Ankrurühma iga alternatiiv nimetab alg-PDF-i räsi, PDF-lehe ja muutmata tekstikatkendi. Hindaja lahendab need enne päringuid konkreetseteks dokumendi-, versiooni- ja span-ID-deks.
- Küsimuseperekonnad jagatakse arendus- ja kontrollosaks. Sama perekonna tõlked jäävad alati samale poolele.
- Võrreldakse leksikaalset, pärisvektori, hübriid-RRF-i ja piiratud struktuurse laienduse rada sama viie ühiku ning 6000-tokenise lõppkonteksti piires. Struktuurirada kasutab kuni kolme seemet ja kuni kaht lisandust.
- Raport eristab toorkandidaadi leidmise, top-1/3/5 järjestuse, lõppkonteksti valiku, eksitava dokumendi, osalise/puuduva toe ja tehnilise vea. Vastuseta silt ei muutu runtime'i piisavusotsustajaks.
- Sama sisendiräsiga vektor võetakse ainult terviklikult kontrollitud varasemast ledger'ist. Uus väljasaatmismanifest sisaldab ainult puuduvaid sisendeid ning seob taaskasutuse vana manifesti, ledger'i ja vektorikirje räsidega.
- Ajaloolist piloodiraportit ei muudeta. Iga uus raport saab käivituse ID, Git SHA ja dirty-seisu, lähte- ja otsingupõlvkonna, konfiguratsiooni/hindamiskogu räsid, väljundskeemi ning ajamärgi.

## Piir

See töö ei lisa Lunat, mudelipõhist hindajat, avalikku RAG API-t, HTTP-autentimist ega M3 semantilist graafi. Testvektoritega mehaanikajooks tõendab ainult andme- ja raportirada. Pärisotsingu tulemus tekib alles muutumatu uue manifesti, omaniku loa, värske hinnakirje ja püsiva kulupäeviku alusel.

## Tagajärjed

Katse saab näidata, kas vajalik tugi jäi leidmata, järjestati halvasti või tõrjuti kontekstist välja. Väike valim ei anna üldist täpsusprotsenti ega tootmise p95 tulemust. Parseri või paigutuse hoiatus jääb korpusemanifestis dokumendi juurde ning probleemset veebitrüki müra ei kasutata hindamisankruna.
