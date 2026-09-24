# Codexile antav algusjuhis

Loe selle kausta `CODEX_M2_2_PARIS_EMBEDDING_JA_HINDAMINE_v0_3.md` ning repositooriumi kehtivaid juhiseid, RAG masterit ja ADR-001/002. Jätka tegelikult tööpuult; kasutaja raporteeris M2.1 commit’iks 2577100af. Ära taasta ega kirjuta olemasolevat süsteemi ümber.

Teosta M2.2 tehniline osa: erista täielik audit ja kompaktne mudelikontekst, kontrolli ainult päisest koosneva üksuse käsitlemist, loo pärisembedding’u adapter koos range loa- ja kulukontrolliga ning samade salvestatud vektoritega nelja otsinguraja hindamine. Säilita kohaliku arenduse andmebaasid, põlvkonnad, õigused ja struktuurne graaf. Ära lisa agente, Lunat ega HTTP-chat’i.

Käivita kohalikud regressiooni- ja integratsioonitestid. Tavalised testid, build ning kuivjooks ei tohi teha väliseid mudelikutseid. Koosta täpne plaan ja näita, kas väljasaadetavad sisendid on varasema 16 tekstiosa + 9 küsimusega identsed. Esita tegelik tokenite summa ja lokaalse konteksti enne/pärast võrdlus.

Paketis olev approval.template.json on kinnitamata näidis, mitte käivitusluba. Kui omanik pole materjalide väljasaatmist ja kulupiiri eraldi kinnitanud, peatu valmis adapteri ja kuivjooksu järel. Kui sama ulatuse luba on selgesõnaliselt antud, valideeri see ja tee üks piiratud pärisembedding’u katse. Ei tehta push’i, deploy’d ega uut massindekseerimist.

Lõppraportis erista pass/fail/skip, lähtekoodi seis, väljundite asukohad, päriselt tehtud API-katsed, kasutus/kulu ning veel tõendamata omadused. Halba otsingutulemust ei tohi varjata kuldmärgendi või küsimusepõhise erireegli muutmisega.
