# B0 idle-RAG mõõtmisprotokoll

See protokoll kirjeldab ainult mõõtmis- ja analüüsikihti. Frontendi,
RAG-service'i ega nende konfiguratsiooni mõõtmisakna jooksul ei muudeta.

## Eesmärk

Mõõta esimese native rag_search-kutse tehnilisi kestusi pärast tegelikku
jõudeaega ning võrrelda seda kohe järgneva sünteetilise kontrollpäringuga.
Mõõtmine ei otsusta ette timeout'i, embeddingu eelarve, warm-up'i ega
readiness-lahendust.

## Päringud ja konto

Kasutatakse ainult olemasolevat sünteetilist NextAuth testisessiooni.
Päringuvariandid on mittetundlikud, sisuliselt võrreldavad ja salvestatakse
mõõteartefaktis ainult tähistega A/B. Päringutekstid hoitakse serveris 600-
loaga ajutises env-failis; CSV-sse, journald'i ja analüüsifailidesse neid ei
kirjutata. Dokumentatsioonis võib hoida ainult variandi lühihashi ja üldist
kirjeldust.

Iga mõõtegrupi mõlemad päringud tehakse uues mitte-püsivas sünteetilises
chat-kutses. Järjekord vaheldub AB, BA, AB, BA.

## Mõõtegrupp

One-shot mõõtja:

1. kontrollib mõlema app-teenuse aktiivsust ja baseline PID-e;
2. kontrollib sünteetilist sessiooni ilma selle väärtust logimata;
3. teeb esimese päringu ilma warm-up'i või retry'ta;
4. leiab sama kasutaja rag_search AuditEventi ja selle kõik timingud;
5. korreleerib iga request-ID RAG journald'i etapiridadega;
6. teeb 10–60 sekundi jooksul teise võrreldava päringu;
7. kordab AuditEventi ja journald'i kontrolli;
8. kirjutab ainult sanitiseeritud tehnilised väljad CSV-sse.

Kui esimene päring ebaõnnestub, jääb tulemus valimisse ja teine päring tehakse
siiski üks kord. Mõõtja ei tee automaatset päringu-retry't.

## Aktsepteerimine

Esimese päringu idle-bucket määratakse ainult esimese native observabilityStage
väärtusega rag_search timingust:

- 15–30 min: 900 000 kuni 1 800 000 ms;
- 60–120 min: 3 600 000 kuni 7 200 000 ms;
- vähemalt 6 h: vähemalt 21 600 000 ms.

Kui mõõteaknas on muu RAG-liiklus, märgitakse grupp
intervening_rag_traffic ja seda ei loeta nõutud valimisse. Setup-smoke ei ole
idle-valim.

Iga eduka request-ID kohta peab olema journald'is täpselt embedding, retrieval
ja search_total rida, ilma duplikaatideta, ning upstream_stage peab võrduma
frontend'i observabilityStage väärtusega. Kestused peavad klappima lubatud
ümardusvahemikus.

## Privaatsus

CSV-sse ja analüüsi ei salvestata küpsist, kasutaja ID-d, e-posti, vestluse ID-d,
päringu- ega vastuseteksti, allikate ID-sid, pealkirju, sisu ega embeddinguid.
Request-ID on lubatud ainult tehnilise korrelatsiooniväljana.

## Systemd

Mõõtja on eraldatud oneshot/timer. Unitidel ei ole Requires= ega Wants=
sõltuvust frontendile või RAG-service'ile. Mõõtühik ei tee daemon-reload'i,
restarti ega app-teenuste muudatust. Lock-fail välistab kattuvad jooksud,
TimeoutStartSec katkestab kinni jäänud mõõtühiku ja OnFailure peatab mõõtetimeri.

Timeri graafik genereeritakse kindlate Eesti ajahetkedena. `Persistent=false`
väldib seisaku järel tagantjärele mõõtmist, mis rikuks idle-bucketi tähendust.

## Cleanup

Pärast piisava valimi või viiepäevase akna lõppu timer disable/stop-itakse,
loodud unitid eemaldatakse, tehakse daemon-reload ning kontrollitakse, et
app-teenused on endiselt active ja nende PID-id ei muutunud. Säilitatakse ainult
sanitiseeritud CSV ja analüüs; ajutine päringu-env ning mõõtebundle eemaldatakse.
