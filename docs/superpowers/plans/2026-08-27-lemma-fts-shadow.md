# Lemma-FTS shadow-kanali teostusplaan

1. Lisa EstNLTK/Vabamorfi lazy analüsaator ja eraldi atomaarne SQLite FTS5
   lemmaindeks.
2. Seo lemmaindeks aktiivse registrigeneratsiooni ja olemasolevate korpuse
   stale/refresh sündmustega; ehita startupis taustal.
3. Edasta olemasoleva keeleplaani `queryLanguage` RAG `/search` päringule.
4. Käivita lemmaotsing ainult valmis indeksi ja eesti päringu korral ning arvuta
   bounded shadow-võrdlus tootmistulemusega.
5. Saniteeri shadow-vaatlus Next.js rag-trace'i; ära muuda fusion'it ega vastust.
6. Lisa health/status/rebuild observability ning requirements-hashil põhinev
   Python-sõltuvuste paigaldus production deploy'sse.
7. Uuenda elav `SotsiaalAI.md` seis ja RAG süsteemikaart.
8. Käivita repo lubatud staatilised väravad ja production build. Automaatseid
   teste, probe'e, smoke'i ega E2E-d ei looda ega käivitata.
9. Commit, push ja deploy omaniku loal; kontrolli SHA-d, teenuseid, `/vestlus`,
   RAG health'i ning lemmaindeksi taustal valmimist. Runtime-vastus jääb kuni
   käsitsi kontrollini `NOT_PROVEN`.
