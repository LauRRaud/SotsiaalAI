# B0 idle-RAG otsuse seis

```text
measurement_window_status = measurement_window_cancelled_by_owner_priority
b0_timeout_decision = deferred
evidence_status = insufficient_evidence
b0_closed = false
```

## Katkestamise põhjus ja ajajoon

Omanik muutis 01.08.2026 tööprioriteeti: mitmepäevane idle-RAG sagedusmõõtmine ei tohi blokeerida `gpt-5.4-mini` Golden-37 baasjoont ega järgnevat kontrollitud Luna hindamist.

| Sündmus | Eesti aeg |
|---|---|
| setup-smoke'i esimene päring | 01.08.2026 12:27:53 |
| setup-smoke'i teine päring | 01.08.2026 12:28:13 |
| cleanup'i eelvaade | 01.08.2026 12:41:44 |
| mõõteakna katkestamine lõpetatud | 01.08.2026 12:42:24 |

Katkestamise hetkel oli järgmine timeri käivitus planeeritud 01.08.2026 kell 12:49. Ühtegi päris idle-valimi katset ei olnud toimunud. Toimunud oli üks kahe päringuga `setup_smoke`, mis ei kuulu idle-valimisse.

## Säilitatud tõend

Serveris säilitati:

- `/home/ubuntu/apps/sotsiaalai-b0-idle-rag-measurement/data/b0-idle-rag-measurements.csv`;
- sama kataloogi `state.json` ja lock;
- mõõteharness'i eraldatud bundle;
- 600-loaga sünteetiline sessioonifail, mida kasutatakse mini/Luna hindamisel.

Sanitiseeritud CSV kopeeriti branchi faili `docs/internal/b0-idle-rag-measurements.csv`. Setup-smoke sisaldab kahte native `rag_search` rida:

- mõlemad HTTP 200, `outcome=ok`, abort puudus;
- mõlemal `retrieval_timeout_ms=12000`;
- source_count 4 ja 4;
- journald'is kummalgi täpselt embedding, retrieval ja search_total;
- duplikaate 0 ning timingud klappisid;
- grupp oli teadlikult `accepted_for_target_bucket=false` ja märgendiga `setup_smoke`.

See üks kontrollgrupp ei tõenda timeout'i esinemissagedust, idle-bucket'ite jaotust ega esimese-vs-teise päringu üldist erinevust.

## Cleanup ja muutmatus

Eemaldati ainult selle akna unitid:

- `sotsiaalai-b0-idle-rag-measure.timer`;
- `sotsiaalai-b0-idle-rag-measure.service`;
- `sotsiaalai-b0-idle-rag-measure-stop.service`.

Automaatne järelkontroll/finalizer eemaldati. `systemctl list-timers --all | grep -i b0-idle` jäi tühjaks. Pärast cleanup'i ja pärast mini baasjooksu:

- tootmise HEAD: `13cfe8605e5ce705b8b4c973a39c389b09e5ac58`;
- frontend active, PID `134972`;
- RAG active, PID `90400`;
- RAG `/health` HTTP 200 ja frontendi root HTTP 200;
- `rag.env` SHA-256 `38d41cfb9f93f3daa974bbe59aa61ef4aef5b89e126b8e2e7fc8a6a5d39caaa1`;
- `frontend.env` SHA-256 `6acbe78110810886fee83343b1a410e487d09502974752879432592e93d98d60`;
- app-teenuseid ei stopitud ega restartitud.

## Otsus

B0a aus retrieval-failure käsitlus ja B0b request-ID/timing/journald instrumentatsioon jäävad tootmisse. Idle timeout'i sageduse kohta ei tehta positiivset ega negatiivset lõppjäreldust ning B0 ei ole tervikuna suletud.

- Native retrieval-timeout jääb 12 000 ms.
- Warm-up'i, readiness't ega retry'd ei lisata.
- Operatiivne idle-risk jääb riskiregistris avatuks.
- Uus täiendav idle-mõõtmisaken kavandatakse pärast kiireloomulist mini/Luna otsust; senine ebapiisav valim ei blokeeri mudelivõrdlust.
