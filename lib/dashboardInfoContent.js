export const ABOUT_FEATURE_KEYS = Object.freeze([
  "workspace",
  "knowledge_base",
  "assistants_agents",
  "privacy_safety",
  "crisis_routing",
  "sources",
  "journey",
  "help",
  "rooms",
  "research",
  "drafting",
  "documents",
  "analysis",
  "pre_inquiry",
  "intake",
  "kovisioon",
  "wellbeing",
  "materials_adding",
  "service_card",
  "service_profile"
]);

const DASHBOARD_INFO_ITEMS = Object.freeze({
  workspace: {
    title: "Töölaud",
    aboutFeatureKey: "workspace",
    details: [
      {
        title: "Mida siin teha saab",
        body: "Töölaud koondab rollile sobivad töövahendid ühte vaatesse. Kaardid avavad eraldi tööpinnad või töövood, mis on seotud vestluste, dokumentide, pöördumiste, teenusekaardi ja koostööga."
      },
      {
        title: "Kuidas liikuda",
        items: [
          "Vali tööriist töölaua kaardilt.",
          "Tagasi-nupp viib tagasi vestluse või töölaua ülevaate juurde.",
          "Admini testvaates saab rollivahetajaga kontrollida, kuidas töölaud eri kasutajarollides käitub."
        ]
      }
    ]
  },
  /* TEENUSPÄEVIKU ORG-VAATED. Omaniku kiirmenüü reegel: iga lehe nimi ja
     sektsioonid peavad olema kirjas ja info peab olema kiirmenüüs kättesaadav
     — mitte ainult neil lehtedel, kus keegi mäletas ta lisada. */
  org_service_reports: {
    title: "Teenuspäeviku aruanded",
    aboutFeatureKey: "org",
    details: [
      {
        title: "Mida siin teha saab",
        body: "Siin on kuuaruanded, mille sinu üksuse töötajad on SINULE saatnud. Aruanne on külmutatud koopia failist, mis KOV-ile esitati — mitte viide töötaja dokumendile."
      },
      {
        title: "Kes algatab",
        items: [
          "Jagamise algatab TÖÖTAJA. Sina ei saa aruannet ise võtta ega tellida.",
          "Avamine jääb auditijälge ja saatja näeb, et sa aruande avasid.",
          "Töötaja võib jagamise tagasi võtta — siis kaob rida sinu loendist, aga jälg jääb."
        ]
      },
      {
        title: "Mida siin EI ole",
        body: "Töötaja teenuspäevikut ennast sa ei näe. Näed ainult seda, mis sulle saadeti."
      }
    ]
  },
  org_dispatch: {
    title: "Graafik ja päevaseis",
    aboutFeatureKey: "org",
    details: [
      {
        title: "Mida siin teha saab",
        body: "Sinu üksuse töötajate päev: kes on alustanud, mis on käigus, mis jäi ära ja miks. Siit saab ka tööd määrata ja asendust anda."
      },
      {
        title: "Mida tahvel EI näita",
        items: [
          "Asukohaandmeid ega koordinaate — ka mitte sulle.",
          "Märkuste sisu — see on kliendi asi, mitte töökorralduse oma.",
          "Reaalajas liikumist. Tahvel näitab olekut ja hilinemist, mitte kaardil liikuvat punkti."
        ]
      },
      {
        title: "Tööde määramine",
        items: [
          "Määrata saab ainult oma üksuse töötajale.",
          "Määratud töö on PLAAN. Kohalejõudmise ja teenuse märgib see, kes päriselt kohal käis.",
          "Alustatud tööd ei saa ümber määrata — asenduseks tee uus külastus.",
          "Iga määramine jääb auditijälge."
        ]
      }
    ]
  },
  help_requests: {
    title: "Abisoovid",
    aboutFeatureKey: "help",
    splitHelp: "request",
    details: [
      {
        title: "Töövoog",
        items: [
          "Kirjelda abivajadust loomulikus keeles.",
          "SotsiaalAI aitab kuulutuse selgemaks vormistada ja vajadusel küsib täpsustusi.",
          "Sobiva abipakkumise leidmisel saab suhtlus jätkuda ühises vestlusruumis."
        ]
      }
    ]
  },
  help_offers: {
    title: "Abipakkumised",
    aboutFeatureKey: "help",
    splitHelp: "offer",
    details: [
      {
        title: "Töövoog",
        items: [
          "Kirjelda, millist abi või tuge saad pakkuda.",
          "SotsiaalAI aitab pakkumise arusaadavaks ja nähtavaks vormistada.",
          "Sobiva abisoovi leidmisel saab suhtlus jätkuda ühises vestlusruumis."
        ]
      }
    ]
  },
  service_map: {
    title: "Teenusekaart",
    aboutFeatureKey: "service_card",
    details: [
      {
        title: "Kaardi kasutamine",
        items: [
          "Otsi kontakti märksõna, piirkonna või teenuse tüübi järgi.",
          "Kaardil kuvatakse KOV sotsiaalhoolekande kontaktid ja SotsiaalAI-s nähtavad teenuseosutajad.",
          "Valitud tulemus aitab liikuda konkreetse kontakti või teenuseosutajani."
        ]
      }
    ]
  },
  journey: {
    title: "Teekond",
    aboutFeatureKey: "journey",
    intro:
      "Teekond aitab olukorra kirjelduse põhjal hoida koos kokkuvõtet, seotud teemasid, puuduolevat infot, ettevaatlikke tähelepanekuid ja soovitatud järgmisi samme.",
    details: [
      {
        title: "Mida siin teha saab",
        items: [
          "Alusta teekonda eraldi töövoos, vaata mustand enne salvestamist üle ja salvesta see privaatse objektina.",
          "Ava salvestatud teekond, muuda kokkuvõtet, teemasid, puuduolevat infot ja järgmisi samme.",
          "Arhiveeri teekond siis, kui see ei ole enam aktiivne."
        ]
      },
      {
        title: "Privaatsus",
        body: "Teekond on alguses privaatne. Seda ei jagata spetsialisti, teenuseosutaja ega muu osapoolega enne, kui kasutaja selle hilisemas töövoos ise kinnitab ja jagab."
      },
      {
        title: "Piir praeguses etapis",
        body: "See vaade ei saada veel eelpöördumist, ei ava teenusekaarti kontekstiga ega loo vestlusruumi. Need seosed lisanduvad järgmistes etappides."
      }
    ]
  },
  service_profile: {
    title: "Teenuseprofiil",
    aboutFeatureKey: "service_profile",
    details: [
      {
        title: "Mida täita",
        items: [
          "Lisa teenuseosutaja nimi, teenused, sihtrühmad, piirkond, keeled ja kontaktid.",
          "Märgi, kas teenuseosutaja võtab eelpöördumisi vastu platvormis või e-posti teel.",
          "Kaardil nähtavaks tegemiseks täida asukoha või teeninduspiirkonna andmed."
        ]
      },
      {
        title: "Teenuseosutaja kaardiprofiil",
        body: "Kui teenuseprofiilis on kaardi jaoks vajalik info olemas ja nähtavus on lubatud, saab sama info teha teenusekaardil kasutajatele leitavaks."
      }
    ]
  },
  service_card_listing: {
    title: "Teenuseosutaja kaardiprofiil",
    aboutFeatureKey: "service_card_listing",
    details: [
      {
        title: "Kaardil kuvamine",
        items: [
          "Kontrolli, et asukoht või teeninduspiirkond oleks arusaadav.",
          "Hoia teenuste, sihtrühmade ja kontaktide info ajakohane.",
          "Avaldatud kaart aitab kasutajal kiiremini sobiva pöördumiskohani jõuda."
        ]
      }
    ]
  },
  documents: {
    title: "Dokumendid",
    aboutFeatureKey: "documents",
    details: [
      {
        title: "Milleks see vaade on",
        items: [
          "Laadi üles tööks vajalikud failid, mallid ja taustamaterjalid.",
          "Märgi, milliseid dokumente võib AI kasutada dokumendi koostamisel.",
          "Ava ja halda varem loodud mustandeid ning kinnitatud tulemusi."
        ]
      }
    ]
  },
  document_drafting: {
    title: "Dokumendi koostamine",
    aboutFeatureKey: "drafting",
    details: [
      {
        title: "Kuidas alustada",
        items: [
          "Vali vajadusel dokumendid, mall, sihtrühm, toon ja pikkus.",
          "Kirjelda, millist teksti või dokumenti soovid koostada.",
          "Kontrolli mustand enne kasutamist üle ning salvesta valmis versioon."
        ]
      }
    ]
  },
  pre_inquiry: {
    title: "Eelpöördumine",
    aboutFeatureKey: "pre_inquiry",
    details: [
      {
        title: "Töövoog",
        items: [
          "Kirjelda olukorda ja vajadust võimalikult selgelt.",
          "Assistendi toel saab koostada pöördumise mustandi ja valida sobiva adressaadi.",
          "Mustandit saab üle vaadata, muuta, kopeerida, alla laadida või edasi saata."
        ]
      },
      {
        title: "Oluline piir",
        body: "Eelpöördumine ei ole ametlik abivajaduse hindamine ega otsus. Ametliku hindamise ja otsused teeb pädev spetsialist või organisatsioon."
      }
    ]
  },
  intake: {
    title: "Pöördumiste vastuvõtt",
    aboutFeatureKey: "intake",
    details: [
      {
        title: "Vastuvõtu töö",
        items: [
          "Luba vajadusel platvormis eelpöördumiste vastuvõtt.",
          "Vaata saabunud pöördumise eelinfot ja märgi see vastuvõetuks.",
          "Edasi saab liikuda vestlusruumi, täpsustuste, e-kirja või järgmiste tegevusteni."
        ]
      }
    ]
  },
  invites: {
    title: "Kutsed",
    aboutFeatureKey: "rooms",
    details: [
      {
        title: "Keda kutsuda",
        items: [
          "Kutsu vestlusruumi pöörduja, spetsialist, teenuseosutaja või kolleeg.",
          "Sisesta ühe või mitme kutsutava e-posti aadress.",
          "Kui ruumi veel ei ole, saab kutse saatmisel anda ruumile pealkirja ja kutsuja nime."
        ]
      },
      {
        title: "Ligipääs",
        body: "Kutsetega saab anda inimesele ligipääsu ühisesse vestlusruumi. Sponsoreeritud ühe kuu ligipääsu valik on eraldi kutse töövoo osa."
      }
    ]
  },
  materials: {
    title: "Materjalid",
    aboutFeatureKey: "materials_adding",
    details: [
      {
        title: "Mida saata",
        items: [
          "Saata saab dokumente, juhendeid, teenusekirjeldusi ja muid allikaid.",
          "Lisa vajadusel lühike kommentaar, mis aitab materjali konteksti mõista.",
          "Materjalid vaadatakse enne teadmistebaasi lisamist üle."
        ]
      }
    ]
  },
  kovision: {
    title: "Kovisioon",
    aboutFeatureKey: "kovisioon",
    details: [
      {
        title: "Anonümiseerimise juhis",
        body: "Kovisioonis ei tohi lisada nime, isikukoodi, täpset aadressi, haruldasi äratuntavaid asjaolusid ega muud otseselt tuvastavat infot."
      },
      {
        title: "Kuidas kasutada",
        items: [
          "Alusta anonüümse juhtumipüstituse, keskse küsimuse ja oodatava abi kirjeldamisest.",
          "Lisa teemad, osapooled, riskid, kaitsetegurid ja vajadusel kolleegid.",
          "AI assistent toetab arutelu struktureerimist, küsimuste sõnastamist ja kokkuvõtte koostamist."
        ]
      },
      {
        title: "Praktikakogemus",
        body: "Arutelu järel saab luua üldistatud näidisjuhtumi või praktikakogemuse, mida ei avaldata ilma anonüümsuse kontrolli ja ülevaatuseta."
      }
    ]
  },
  wellbeing: {
    title: "Tööheaolu",
    aboutFeatureKey: "wellbeing",
    intro:
      "Tööheaolu tööriistad aitavad sotsiaalvaldkonna spetsialistil märgata töökoormust, emotsionaalset koormust, taastumise vajadust, korduvaid katkestusi ja keeruliste juhtumite mõju.",
    details: [
      {
        title: "Tööruumi võimalused",
        body:
          "Tööruumis saab teha kiirkontrolli, vaadata nädala või kuu ülevaadet, märkida raske juhtum, käsitleda töövägivalla olukorda ning sõnastada taastumise, tööpiiride, katkestuste, tööprotsesside, rollipiiride ja alustaja toe järgmisi samme."
      },
      {
        title: "Kasutaja kontroll",
        body:
          "Tööheaolu sisestused on vaikimisi kasutaja enda kontrolli all. SotsiaalAI ei jaga neid automaatselt tööandja, juhi, kolleegide ega teenuseosutajatega. Kui kasutaja soovib midagi jagada, saab ta koostada eraldi jagatava versiooni, selle üle vaadata ja kinnitada."
      },
      {
        title: "Oluline piir",
        body:
          "Tööheaolu tööriistad ei asenda professionaalset kriisiabi, supervisiooni, juhtimisvastutust ega tööandja kohustust tagada turvaline töökeskkond. Vahetu ohu, vägivalla, suitsiidiriski või muu kriisi korral tuleb pöörduda vastava abi poole. SotsiaalAI võib aidata infot korrastada ja järgmisi samme sõnastada, kuid lõplikud otsused teeb inimene või vastutav organisatsioon."
      }
    ]
  },
  wellbeing_quick_check: {
    title: "Kiirkontroll",
    aboutFeatureKey: "wellbeing_quick_check",
    intro: "Kiirkontroll aitab kiiresti märgata töökoormuse, taastumise ja emotsionaalse pinge seisu ning valida järgmise väikese sammu.",
    details: [
      {
        title: "Millal kasutada",
        items: [
          "Kui tööpäev või nädal tundub tavapärasest koormavam.",
          "Kui vajad kiiret enesekontrolli enne järgmise tegevuse valimist.",
          "Kui tahad korduvaid koormuse märke järjepidevalt jälgida."
        ]
      },
      {
        title: "Oluline piir",
        body: "Kiirkontroll ei ole diagnoos ega ametlik riskihindamine. See aitab märgata mustreid ja sõnastada praktilisi samme."
      }
    ]
  },
  wellbeing_overview: {
    title: "Ülevaade",
    aboutFeatureKey: "wellbeing_overview",
    intro: "Ülevaade koondab Tööheaolu sisestustest trendid, korduvad koormustegurid ja taastumise mustrid.",
    details: [
      {
        title: "Mida siit jälgida",
        items: [
          "Vaata, kas koormus, katkestused või taastumise vajadus korduvad.",
          "Erista üksik raske päev pikemast mustrist.",
          "Kasuta ülevaadet, et valida järgmine tööheaolu tööriist."
        ]
      }
    ]
  },
  wellbeing_hard_case: {
    title: "Raske juhtum",
    aboutFeatureKey: "wellbeing_hard_case",
    intro: "Raske juhtumi töövoog aitab pärast emotsionaalselt koormavat olukorda mõtted korrastada ja taastumist toetavad sammud sõnastada.",
    details: [
      {
        title: "Töövoo fookus",
        items: [
          "Kirjelda olukorda tööalaselt ja nii vähe isikuandmeid kasutades kui võimalik.",
          "Märgi, mis jäi koormama ja millist tuge või järeltegevust vajad.",
          "Sõnasta lühike taastumis- või aruteluplaan."
        ]
      }
    ]
  },
  wellbeing_workplace_violence: {
    title: "Töövägivald",
    aboutFeatureKey: "wellbeing_workplace_violence",
    intro: "Töövägivalla töövoog toetab ähvarduse, agressiooni, solvamise, jälitamise või füüsilise ohu olukorra dokumenteerimist ja järgmiste sammude valikut.",
    details: [
      {
        title: "Turvalisus enne kõike",
        items: [
          "Vahetu ohu korral kasuta hädaabi või organisatsiooni kriisikanaleid.",
          "Märgi juhtumi faktid, tunnistajad, risk ja vajalik järeltegevus.",
          "Jaga infot ainult nende inimestega, kellel on tööalane vajadus seda teada."
        ]
      }
    ]
  },
  wellbeing_recovery: {
    title: "Taastumine",
    aboutFeatureKey: "wellbeing_recovery",
    intro: "Taastumise töövoog aitab planeerida pause, jõuvarude taastamist ja tööpäeva järeltegevusi.",
    details: [
      {
        title: "Mida planeerida",
        items: [
          "Vali taastumiseks realistlik väike tegevus.",
          "Märgi, mis aitab koormust vähendada juba täna.",
          "Kasuta korduvaid sisestusi, et näha, mis päriselt toimib."
        ]
      }
    ]
  },
  wellbeing_work_boundaries: {
    title: "Tööpiirid",
    aboutFeatureKey: "wellbeing_work_boundaries",
    intro: "Tööpiiride tööriist aitab sõnastada tööaja, kättesaadavuse, pauside ja taastumisaja kokkuleppeid.",
    details: [
      {
        title: "Mida täpsustada",
        items: [
          "Millal oled kättesaadav ja millal mitte.",
          "Millised katkestused on vältimatud ja millised vajavad kokkulepet.",
          "Millist piiri saab ise seada ja milline vajab juhi või tiimi kokkulepet."
        ]
      }
    ]
  },
  wellbeing_interruptions: {
    title: "Katkestused",
    aboutFeatureKey: "wellbeing_interruptions",
    intro: "Katkestuste tööriist aitab märgata ümberlülitumise, töörahu ja korduvate katkestuste mõju.",
    details: [
      {
        title: "Mida jälgida",
        items: [
          "Millised katkestused korduvad kõige sagedamini.",
          "Kui palju need mõjutavad keskendumist või dokumenteerimist.",
          "Milline väike kokkulepe vähendaks katkestuste mõju."
        ]
      }
    ]
  },
  wellbeing_work_processes: {
    title: "Tööprotsessid",
    aboutFeatureKey: "wellbeing_work_processes",
    intro: "Tööprotsesside audit aitab leida tegevused, mis võtavad ebaproportsionaalselt palju aega või tekitavad dubleerimist.",
    details: [
      {
        title: "Auditi fookus",
        items: [
          "Märgi korduvad tegevused, mis võtavad aega ilma selge väärtuseta.",
          "Erista dokumenteerimine, suhtlus, otsing ja koordineerimine.",
          "Sõnasta üks protsessimuudatus, mida saab testida."
        ]
      }
    ]
  },
  wellbeing_role_boundaries: {
    title: "Rollipiirid",
    aboutFeatureKey: "wellbeing_role_boundaries",
    intro: "Rollipiiride tööriist aitab selgemaks teha vastutuse, ootused ja koostööpiirid.",
    details: [
      {
        title: "Mida selgitada",
        items: [
          "Mis on sinu rollis sinu vastutus ja mis ei ole.",
          "Millised ootused vajavad ümbersõnastamist või kokkulepet.",
          "Kellelt on vaja tuge, otsust või selgemat tööjaotust."
        ]
      }
    ]
  },
  wellbeing_starter_support: {
    title: "Alustaja tugi",
    aboutFeatureKey: "wellbeing_starter_support",
    intro: "Alustaja toe tööriist aitab esimestel kuudel sõnastada õppimisvajadusi, mentori küsimusi ja töötoe plaani.",
    details: [
      {
        title: "Kellele see sobib",
        items: [
          "Uuele spetsialistile esimeste kuude jooksul.",
          "Mentorile või juhile, kes aitab töötoe kokkuleppeid seada.",
          "Tiimile, kes tahab alustaja töökoormust ja õppimist paremini toetada."
        ]
      }
    ]
  },
  /* ---- RAG admin: iga lehe juhend (ⓘ sulgemisristi kõrval) ---- */
  rag_admin: {
    title: "RAG admin",
    intro:
      "RAG admin on teadmistebaasi juhtimiskeskus: siit hallatakse dokumente, sisestusvooge, KOV-ide ja organisatsioonide allikakihte ning lähtepakettide ülevaatust.",
    details: [
      {
        title: "Kuidas keskkond on üles ehitatud",
        items: [
          "Ülemine nav viib viide moodulisse: Dokumendid, Sisestus, KOV, Organisatsioonid ja Lähtepaketid.",
          "Moodulkaardid avavad sama vaate mis nav — kasuta kumba tahes.",
          "Kolm seirepaneeli (kontaktiregister, veebiallikate seire, RT register) näitavad allikafailide seisu ja lasevad käivitada veebikontrolle."
        ]
      },
      {
        title: "Seirepaneelide loogika",
        items: [
          "Veebikontroll EI kirjuta põhifaile üle — ta loob kõrvale kontrollfaili ja võrdlusraporti.",
          "Põhifail uueneb alles siis, kui vajutad Uuenda põhifail; enne vaata raport üle.",
          "Baasjoone kinnitamine fikseerib praeguse seisu tulevaste võrdluste aluseks."
        ]
      }
    ]
  },
  rag_admin_documents: {
    title: "Dokumentide haldus",
    intro:
      "Dokumentide register näitab kõiki RAG-i ingestitud materjale: otsi, filtreeri, vaata detaile, muuda metat, reindekseeri või kustuta.",
    details: [
      {
        title: "Register ja eelvaade",
        items: [
          "Klikk dokumendireal avab paremal eelvaate koos metaandmete ja toimingutega.",
          "Kiirsildid ja filtrid (sektsioon, audience, allikas, aasta) kitsendavad nimekirja; linnukesega saab valida mitu dokumenti korraga reindeksiks.",
          "KOV-kihiga seotud read on kaitstud: neid hallatakse paketina KOV vaates, mitte siit ükshaaval."
        ]
      },
      {
        title: "Allikad ja seaded",
        body: "Allikate loogika kaart koondab registrist nähtava allikapildi (domeenid, failitüübid); klikk allikal filtreerib registri. Seadete kaart näitab metadata malle ja vaikevalikuid, mis voolavad samast loogikast mis Sisestuse leht."
      }
    ]
  },
  rag_admin_ingest: {
    title: "Sisestuse töölaud",
    intro:
      "Sisestus toob uue sisu RAG-i nelja voo kaudu: URL, PDF + metaandmed, riiklik Riigi Teataja XML ja artiklite lisamine olemasolevale PDF-ile.",
    details: [
      {
        title: "Vood",
        items: [
          "URL-i lisamine: sisesta aadress, soovi korral pealkiri, kirjeldus, sildid ja audience.",
          "PDF + metaandmed: vali PDF ja JSON (või kleebi JSON tekstina); kontrolli JSON enne saatmist nupuga Kontrolli metaandmete JSON-i.",
          "Riiklik RT XML: ainult Riigikogu seaduste terviktekstidele, ei seota ühegi KOV-iga.",
          "Artiklid: kasuta PDF ingestist tagastatud docId-d; JSON peab sisaldama articles massiivi."
        ]
      },
      {
        title: "Abivahendid",
        items: [
          "Ava metaandmete mallid näitab valmis JSON-i põhju (ülddokument, perioodika, seadus).",
          "Käivita enesetest kontrollib, kas RAG teenus ja võti on seadistatud.",
          "Tulemuse rida vormi all näitab docId-d ja chunkide arvu — see kinnitab, et sisu jõudis kohale."
        ]
      }
    ]
  },
  rag_admin_kov: {
    title: "KOV haldus",
    intro:
      "KOV haldus hoiab iga omavalitsuse kaht allikakihti: KOV veeb (teenused, kontaktid, vormid) ja Riigi Teataja kiht (õigusaktid). Kumbki valideeritakse ja ingestitakse eraldi.",
    details: [
      {
        title: "Kuidas vaadet lugeda",
        items: [
          "Statistikakaardid näitavad filtreeritud tulemuste seisu; Vajab tähelepanu loeb ainult päris probleeme (vigased failid, muudatused, ingest-vead).",
          "Maakonnakaart filtreerib tabelit; helendav täpp märgib maakonda, kus on tähelepanu vajavaid KOV-e.",
          "Rea klikk või Ava avab detaili sahtlis; rea ⋯ menüüs on valideerimine ja ingest."
        ]
      },
      {
        title: "Detailisahtel",
        items: [
          "Salvesta muudatused salvestab lingid, staatused, kontrolli ajad ja märkused.",
          "Failikaartidel Lae üles / Asenda haldab nelja KOV veebi faili ja üht RT XML-i.",
          "Kontrolli muudatusi võrdleb allikaid baasjoonega; diffi järel saad märkida ülevaatuseks või kinnitada kontrollituks.",
          "Reset eemaldab ainult selle KOV-i RAG dokumendid ega puutu repo faile."
        ]
      },
      {
        title: "Hulgitoimingud",
        body: "Vali linnukestega mitu KOV-i — tabeli kohale ilmub riba, kust saab korraga käivitada muudatuste kontrolli, valideerimise ja ingesti mõlemale kihile."
      }
    ]
  },
  rag_admin_organizations: {
    title: "Organisatsioonide haldus",
    intro:
      "Organisatsioonide haldus on vanem paketipõhine töövoog MTÜ-de, sihtasutuste, teenuseosutajate ja teemaveebide jaoks. KOV, RT ja knowledge-doc kihid on sellest eraldi.",
    details: [
      {
        title: "Paketi elukaar",
        items: [
          "Iga organisatsioon vajab nelja tuumfaili; pakett on ingestiks valmis alles siis, kui failid on olemas ja valiidsed.",
          "Vali tabelist organisatsioon — paremal saab muuta püsiandmeid, staatust ja faile.",
          "Ingest RAG-i on lubatud ainult valmis paketile; naidisorganisatsioonid on vaikimisi peidetud ega lähe kunagi RAG-i."
        ]
      },
      {
        title: "Kontroll",
        body: "Metadata audit kontrollib tuumfaile, sourceKeys viiteid ja remote URL materjale. RAG dokumendi seis teeb reaalajas päringu registrisse — chunkide arv 0 tähendab, et sisu pole veel kohal."
      }
    ]
  },
  rag_admin_source_packages: {
    title: "Lähtepakettide ülevaatus",
    intro:
      "Lähtepaketid on KOV-ide teenuspakettide hetktõmmised. See vaade näitab, millistel pakettidel on puudusi (vormid, kontaktid, õiguslik alus) ja mis vajab inimese ülevaatust.",
    details: [
      {
        title: "Järjekorra loogika",
        items: [
          "Vaikimisi kuvatakse ainult aktiivsed blokeerivad ja ülevaatust vajavad probleemid; infohoiatused ja arhiveeritud read saab linnukestega nähtavale.",
          "Pealkirja klikk avab detaili: ülevaatuse põhjused, viidatavuse seis, lünkade kokkuvõte ja ajalugu.",
          "Paranda-nupp viib otse õige KOV-i juurde KOV vaates."
        ]
      },
      {
        title: "Toimingud",
        items: [
          "Märgi üle vaadatuks sulgeb probleemi, kui oled selle sisuliselt üle kontrollinud.",
          "Puuduse saab aktsepteerida põhjusega (nt vorm pole KOV-i veebis avaldatud) — siis see enam järjekorda ei ilmu.",
          "Arvuta uuesti ehitab paketi märgid värske seisu pealt ümber."
        ]
      }
    ]
  },
  /* Konto seaded: andmekoopia SELGITUS elab siin, mitte lehel (omanik
     26.07). Leht kannab ainult toimingut — PIN-välja ja nuppu; kolm
     GDPR-lõiku, mis akna kaks korda pikemaks venitasid, loeb see, kes
     dokis ⓘ vajutab. Tekstid tulevad tõlkevõtmetest, sest nad OLID juba
     tõlgitud (profile.data_export.*) — nende siia sisse kirjutamine
     kaotaks vene ja inglise keele. */
  account_settings: {
    title: "Konto seaded",
    titleKey: "profile.account_settings",
    details: [
      {
        titleKey: "profile.data_export.title",
        title: "Minu andmekoopia",
        itemKeys: [
          ["profile.data_export.description", "See on sinu tervikandmete ZIP-koopia, mitte üksiku faili või vestluse allalaadimine."],
          ["profile.data_export.included", "Koopias on profiil ja nõustumised, sinu vestlused, Teekonnad, dokumendid ja artefaktid, Tööheaolu kirjed ning sinu saadetud eelpöördumised."],
          ["profile.data_export.excluded", "Koopiast jäävad välja teiste inimeste ruumisõnumid ja andmed, adressaadi märkmed, auditilogid, teavituste ajalugu, salvestised ja admini koondid."]
        ]
      },
      {
        title: "Kuidas koopiat taotleda",
        items: [
          "Sisesta praegune PIN — see kinnitab, et taotluse esitad sina.",
          "Koopia koostatakse taustal; olek uueneb siinsamas lehel.",
          "Valmis koopia on allalaaditav tähtajani, pärast seda ZIP eemaldatakse.",
          "Taotluse saab tühistada; tühistamine ega aegumine ei kustuta sinu andmeid."
        ]
      }
    ]
  },
  /* Minu kasutus ja Tellimus olid ainsad konto-pere lehed ⓘ-ta — kasutaja
     nägi loendureid ja kuupäevi, aga mitte kuskilt, mida nad tähendavad.
     SUMMASID SIIN EI KORRATA: kuutasud elavad `lib/subscriptionPlans.js`-is
     ja jõuavad lehele sealt (27.07 hinnaparandus pidi neid juba kolmes
     kohas korraga liigutama) — neljas koopia info-tekstis triiviks
     vaikselt valeks. Tekst ütleb, KUS summa seisab, mitte MIS ta on. */
  usage: {
    title: "Minu kasutus",
    titleKey: "profile.usage.title",
    details: [
      {
        titleKey: "profile.usage.info.plan_title",
        title: "Mida aktiivne pakett tähendab",
        itemKeys: [
          ["profile.usage.info.plan_role", "Tellimus on rollipõhine — kuutasu sõltub sellest, kas oled pöörduja, spetsialist või teenuseosutaja. Sinu praegune pakett ja summa seisavad selle vaate ülaosas."],
          ["profile.usage.info.plan_sponsored", "Sponsoreeritud ligipääs tuleb sind kutsunud inimeselt ja kehtib ühe kuu; pärast seda tuleb jätkamiseks oma tellimus aktiveerida."],
          ["profile.usage.info.plan_free", "Tasuta paketis saab kasutada abisoove ja teenusekaarti; AI-tööriistad avanevad tasulise paketiga."]
        ]
      },
      {
        titleKey: "profile.usage.info.counters_title",
        title: "Mida numbrid näitavad",
        itemKeys: [
          ["profile.usage.info.counters_what", "Iga rida on üks tööriist: assistendi vastused, dokumentide koostamine ja täiustamine, failide analüüs, süvauuringud, teadmusbaasi otsingud, heli transkribeerimine, teksti ettelugemine ja failide salvestusruum."],
          ["profile.usage.info.counters_period", "Limiit on päevane, nädalane või kuine ja „Uueneb\" ütleb, millal loendur nulli läheb. Salvestusmaht ajaga ei uuene — see vabaneb failide kustutamisel."],
          ["profile.usage.info.counters_content", "See vaade näitab ainult koguseid, mitte sisu: siit ei ole näha, mida sa kirjutasid, küsisid või salvestasid."]
        ]
      },
      {
        titleKey: "profile.usage.info.manage_title",
        title: "Kuidas paketti muuta",
        itemKeys: [
          ["profile.usage.info.manage_where", "Vaate lõpus olev nupp viib tellimuse lehele, kus saab paketi aktiveerida või tühistada."],
          ["profile.usage.info.manage_free", "Tasuta paketis pakub nupp pakettide võrdlust, tasulises tellimuse haldust."]
        ]
      }
    ]
  },
  subscription: {
    title: "Tellimus",
    titleKey: "subscription.title",
    details: [
      {
        titleKey: "subscription.about.what_title",
        title: "Mis tellimus on",
        itemKeys: [
          ["subscription.about.what_role", "Tellimus on igakuine ja rollipõhine — kuutasu sõltub sellest, kas oled pöörduja, spetsialist või teenuseosutaja. Sinu summa seisab siinsamas lehel."],
          ["subscription.about.what_recurring", "Tellimus pikeneb iga kuu automaatselt kuni selle tühistad; järgmise kuumakse kuupäev on lehel näha."],
          ["subscription.about.what_payment", "Makseviisi valid Maksekeskuse makselehel ja ligipääs aktiveerub kohe pärast kinnitust."]
        ]
      },
      {
        titleKey: "subscription.about.end_title",
        title: "Tühistamine, sponsorlus ja ebaõnnestunud makse",
        itemKeys: [
          ["subscription.about.end_cancel", "Tühistada saab siitsamalt: ligipääs kehtib perioodi lõpuni ja uut kuumakset ei võeta."],
          ["subscription.about.end_sponsored", "Sponsoreeritud kuu lõppedes tuleb kasutamise jätkamiseks aktiveerida oma tellimus."],
          ["subscription.about.end_failed", "Kui kuumakse ebaõnnestub, proovitakse seda automaatselt uuesti ja sina ei pea midagi tegema; peatatud tellimuse saab uuesti aktiveerida."]
        ]
      }
    ]
  },
  /* MINU JAGAMISED. Sisu järgib küsimust, millega inimene sellele lehele
     tuleb: mis see loend on → mis siin sees on → mida tagasivõtt teeb →
     MIDA TA EI TEE. Viimane osa on kandev ja jääb lõppu: tagasivõtt on
     platvormi toiming, mitte mälukustutus, ja seda ei tohi lubada rohkem,
     kui ta suudab. Varem seisis kogu selgituse asemel üks sissejuhatav lause
     pealkirja all. */
  my_sharings: {
    titleKey: "my_sharings.info.title",
    title: "Minu jagamised",
    details: [
      {
        titleKey: "my_sharings.info.what_title",
        title: "Milleks see on",
        itemKeys: [
          ["my_sharings.info.what_overview", "Siin näed ühes kohas, kellele oled infot jaganud, millal see juhtus ja mida saad veel kontrollida."],
          ["my_sharings.info.what_scope", "Loend katab platvormi enda jagamised. Seda, mille sa oled kellelegi ise e-kirjaga või väljaspool platvormi saatnud, siin ei ole."],
          ["my_sharings.info.what_owner", "Iga kirje juures seisab, kes seda näeb, kust ta tuli ja kui kaua ta kehtib."]
        ]
      },
      {
        titleKey: "my_sharings.info.kinds_title",
        title: "Mis siin sees on",
        itemKeys: [
          ["my_sharings.info.kinds_inquiries", "Saadetud eelpöördumised — kellele saatsid ja kas adressaat on selle avanud."],
          ["my_sharings.info.kinds_rooms", "Aktiivsed ruumid ja kutsed — ruumis näevad jagatud sisu selle aktiivsed liikmed, kutse aga annab ligipääsu alles pärast vastuvõtmist."],
          ["my_sharings.info.kinds_public", "Avaldatud abisoovid ja -pakkumised — need on avalikud kuni sulgemise või aegumiseni."],
          ["my_sharings.info.kinds_records", "Mentorlusse üle antud ettevalmistused ja sinu kinnitatud raamistikud."]
        ]
      },
      {
        titleKey: "my_sharings.info.recall_title",
        title: "Tagasivõtt",
        itemKeys: [
          ["my_sharings.info.recall_window", "Avamata platvormisisese pöördumise saad tagasi võtta: see kaob adressaadi aktiivsest loendist. Pärast avamist tagasivõtu aken sulgub."],
          ["my_sharings.info.recall_correction", "Parandus saadetakse uue versioonina. Varasem avatud versioon jääb ajalukku — vaikselt üle ei kirjutata."],
          ["my_sharings.info.recall_room", "Ruumist saad lahkuda; kui oled ruumi omanik, tuleb omand enne kellelegi üle anda."]
        ]
      },
      {
        titleKey: "my_sharings.info.limits_title",
        title: "Mida tagasivõtt EI tee",
        itemKeys: [
          ["my_sharings.info.limits_memory", "Tagasivõtmine ei kustuta infot, mida adressaat võis juba näha või mäletada. See on platvormi toiming, mitte mälukustutus."],
          ["my_sharings.info.limits_audit", "Auditijälg jääb alles. Nii saab hiljem tõendada, mis toimus — ka sinu enda kasuks."],
          ["my_sharings.info.limits_external", "Välisele e-postile saadetud kirja ei saa platvormilt tagasi kutsuda. Seepärast on väline saatmine eraldi märgitud."]
        ]
      }
    ]
  },
  /* ORGANISATSIOONID (T25 ORG-WORKSPACE-V1). Sisu järgib kasutaja küsimuste
     järjekorda: mis see on → MIDA ORGANISATSIOON EI NÄE → kuidas sisse saab →
     kuidas luua → mis vastuvõtust saab.

     Privaatsuse osa seisab TEISENA, mitte lõpus: erinevalt teenuspäevikust on
     see siin esimene küsimus, mis inimesel tekib („kas mu ülemus näeb nüüd mu
     Tööheaolu?"). Vastus peab tulema enne, kui ta jõuab kuhugi vajutada.
     Varem elas üksainus lause sellest lehe pealkirja all — info ei ole
     pealkirja alamärkus, tema koht on siin. */
  org: {
    titleKey: "org.info.title",
    title: "Organisatsioonid",
    details: [
      {
        titleKey: "org.info.what_title",
        title: "Milleks see on",
        itemKeys: [
          ["org.info.what_personal", "Sa võid töötada isiklikult või ühe või mitme organisatsiooni kontekstis. Isiklik tööruum jääb alati alles ja organisatsioon ei saa seda üle võtta."],
          ["org.info.what_space", "Organisatsiooni tööruum koondab ühte kohta liikmed, üksused, kohad, pöördumiste vastuvõtu ja teenuseprofiili."],
          ["org.info.what_switch", "Tööruumi vahetamine ei vii sind ära platvormilt ega muuda sinu rolli — vahetub ainult see, kelle nimel sa parajasti töötad."]
        ]
      },
      {
        titleKey: "org.info.privacy_title",
        title: "Mida organisatsioon EI näe",
        itemKeys: [
          ["org.info.privacy_personal", "Sinu enda vestlused, dokumendid ja Tööheaolu jäävad sinule. Organisatsioon neid ei näe ka siis, kui ta maksab sinu koha eest."],
          ["org.info.privacy_share", "Tööheaolu kokkuvõtte saad ise kellelegi saata. See on KOOPIA, mitte ligipääs: saaja näeb ainult seda, mille sa saatsid, ja sealt ei vii ühtegi teed sinu ülejäänud kirjeteni. Saatmise saad tagasi võtta."],
          ["org.info.privacy_leave", "Organisatsioonist lahkumine ei puuduta sinu kontot ega isiklikke andmeid."]
        ]
      },
      {
        titleKey: "org.info.join_title",
        title: "Liitumine ja kohad",
        itemKeys: [
          ["org.info.join_invite", "Organisatsiooniga liitutakse kutsega. Sulle saadetud ootel kutsed seisavad sellel lehel."],
          ["org.info.join_seat", "Koht on kas spetsialisti või teenuseosutaja oma. Klienti organisatsiooni kohale ei panda — kliendi ligipääs on eraldi asi."],
          ["org.info.join_payer", "Kui organisatsioon annab sulle koha, maksab tellimuse eest tema. Koha tagasivõtmine ei kustuta sinu kontot."]
        ]
      },
      {
        titleKey: "org.info.create_title",
        title: "Organisatsiooni loomine",
        itemKeys: [
          ["org.info.create_who", "Luua saab spetsialist või teenuseosutaja. Looja saab esimese haldaja koha."],
          ["org.info.create_draft", "Organisatsioon sünnib mustandina. Päris kasutuse avab platvormi identiteedikontroll — enne seda saab tööruumi seadistada, aga mitte sellega päriselt tööd teha."],
          ["org.info.create_legal", "Juriidiline nimi ja registrikood on asutuse tuvastamiseks. Kuvatav nimi võib olla lühem tööpäevane nimi."]
        ]
      },
      {
        titleKey: "org.info.inbox_title",
        title: "Vastuvõtt",
        itemKeys: [
          ["org.info.inbox_shared", "Organisatsioonile saadetud pöördumine jõuab ühisesse vastuvõttu, mitte ühe inimese postkasti. Nii ei jää see puhkuse taha seisma."],
          ["org.info.inbox_assign", "Vastuvõtust määratakse pöördumine edasi konkreetsele inimesele. Kes selle avas ja kellele määras, jääb kirja."],
          ["org.info.inbox_personal", "Sinu isiklikku pöördumiste loendisse organisatsiooni vastuvõtt ei sega — need on kaks eri rada."]
        ]
      }
    ]
  },
  /* TEENUSPÄEVIK-V1 (leping 8.3: ⓘ on KOHUSTUSLIK). Tekstid tulevad
     tõlkevõtmetest — see pind on kolmes keeles ja ⓘ ei tohi olla ainus koht,
     mis jääb eesti keelde.

     Sisu järgib kasutaja PÄEVA järjekorda, mitte koodi oma: milleks see on →
     kuidas päev käib → suunamine ja jääk → kuu lõpp → sisuline aruanne →
     kinnitused → mida siia EI kirjutata. Viimane osa on kõige tähtsam ja jääb
     seetõttu LÕPPU, kuhu lugeja jõuab siis, kui ta juba teab, millest jutt:
     kirjemärge on lühike faktimärge, mitte juhtumilugu; kirje on arve
     alusdokument; asukohta ja mõõtmist selgitatakse enne, kui keegi jõuab neid
     ise avastada. */
  service_log: {
    titleKey: "service_log.info.title",
    title: "Teenuspäevik",
    details: [
      {
        titleKey: "service_log.info.what_title",
        title: "Milleks see on",
        itemKeys: [
          ["service_log.info.what_entry", "Märgi teenus ära seal, kus töö lõpeb — mitte õhtul mälu järgi. Üks kirje on klient, teenus, kuupäev ja kogus."],
          ["service_log.info.what_output", "Kuu lõpus sünnib samadest kirjetest nii tööajaarvestus (arve alus) kui sisulise aruande mustand. Sisestad ühe korra, väljundeid on mitu."],
          ["service_log.info.what_units", "Kui märgid saabumise ja lahkumise kellaaja, arvutab süsteem kestuse ise. Ühiku toob kaasa teenus või suunamine; kui neid on mitu, küsitakse ühik sinult."],
          ["service_log.info.what_field", "Kui külastus algas Välitööst, saad selle lõpetamisel kirje eeltäidetuna: kuupäev, kellaajad ja kestus on juba paigas."]
        ]
      },
      {
        titleKey: "service_log.info.day_title",
        title: "Päev: üks nupp korraga",
        itemKeys: [
          ["service_log.info.day_flow", "Korraga on ekraanil üks nupp ja tema kiri ütleb, mis on järgmine samm: „Olen kohal“, siis „Lahkusin“. Nupu kohal seisab, kus sa parajasti oled — näiteks „Kohal alates 10:12“. Kui külastus on märgitud, salvestad kirje eraldi nupuga."],
          ["service_log.info.day_travel", "Sõiduaja arvestamise saab valida ainult enne alustamist. Siis lisandub ette „Alustan sõitu“ ja lõppu „Jõudsin tagasi“. Pärast esimest märget valik lukustub, sest tagantjärele lisatud sammu jaoks ei ole enam kellaaega."],
          ["service_log.info.day_undo", "Vale vajutus ei ole lõplik: „Paranda eelmist märget“ võtab viimase templi tagasi."],
          ["service_log.info.day_offline", "Levi puudumine ei sega tööd. Kirje salvestub seadmesse ja läheb ise teele, kui võrk tagasi tuleb; ekraan näitab, mitu kirjet on ootel."],
          ["service_log.info.day_no_double", "Kordussaatmine ei tekita topeltkirjet. Igal kirjel on oma tunnus ja server tunneb sama kirje ära ka siis, kui vastus vahepeal kadus."]
        ]
      },
      {
        titleKey: "service_log.info.referral_title",
        title: "Suunamine ja jääk",
        itemKeys: [
          ["service_log.info.referral_what", "Suunamine on KOV-i otsus: kellele, mis teenust, kui palju ja mis ajaks. Kirje seotakse suunamisega ja saab sealt oma ühiku ning saaja."],
          ["service_log.info.referral_saldo", "Jääk on kogu aeg näha. Kui maht hakkab täis saama, hoiatab süsteem — aga ei blokeeri sisestust: dokumenteerimata töö on halvem kui üle mahu dokumenteeritud töö."],
          ["service_log.info.referral_lock", "Kui suunamisel on juba kirjeid, ei saa tema ühikut, saajat ega otsuse numbrit enam muuta. Muidu muutuks tagantjärele see, mille alusel on arve juba esitatud."]
        ]
      },
      {
        titleKey: "service_log.info.report_title",
        title: "Kuu lõpp ja väljundid",
        itemKeys: [
          ["service_log.info.report_deadline", "Aruanne läheb KOV-ile üldjuhul järgmise kuu 10. kuupäevaks. 5. kuupäeval tuleb üks leebe meeldetuletus — rohkem mitte."],
          ["service_log.info.report_finalize", "Kirje sünnib mustandina. Eksport jätab mustandid vaikimisi välja, seega kinnita kuu kirjed enne aruande koostamist — muidu võib fail tulla tühi."],
          ["service_log.info.report_templates", "Nelja malli — tööajaarvestus, hoolduspäevik, sisuline aruanne ja statistikaväljavõte — ei täideta eraldi. Kõik neli sünnivad samadest kirjetest."],
          ["service_log.info.report_multi_kov", "Mitut KOV-i teenindades vali saaja: igaüks saab ainult oma read. Saajata koostatud fail kannab hoiatust, et teda ei tohi ühelegi KOV-ile esitada."],
          ["service_log.info.report_formats", "Vorming on sinu valik: CSV tabelisse, Word toimetamiseks, PDF allkirjastamiseks. PDF ei toeta kirillitsat — kui mõne kliendi nimi on kirillitsas, vali Word."]
        ]
      },
      {
        titleKey: "service_log.info.narrative_title",
        title: "Sisuline aruanne",
        itemKeys: [
          ["service_log.info.narrative_what", "Sisuline aruanne on lugu, mitte number: eesmärgid, tehtu, edenemine, takistused ja lõpuks ettepanek — jätka, muuda mahtu või lõpeta."],
          ["service_log.info.narrative_seed", "Koond on ees ootamas: mahud, tegevused ja märkmed koos päritoluga. Sina kirjutad need lahti."],
          ["service_log.info.narrative_ai", "Soovi korral koostab AI samast koondist mustandi. Ta on märgistatud ja jääb mustandiks kuni sina ta läbi loed, parandad ja salvestad — vastutus on sinu, mitte masina oma."],
          ["service_log.info.narrative_provenance", "Päritolu ei sula kokku: kliendi ütlus, sinu tähelepanek ja dokument jäävad aruandes eristatavaks. Just see vahe teeb aruande usaldusväärseks."]
        ]
      },
      {
        titleKey: "service_log.info.confirm_title",
        title: "Kinnitused",
        itemKeys: [
          ["service_log.info.confirm_manual", "Välise kliendi paberallkirja kohta saab kirjele panna märke. See on märge allkirjast, mitte allkiri ise."],
          ["service_log.info.confirm_client", "Platvormi klient saab oma kuu ise kinnitada, kui see vaade on avatud. Kinnitus on lõplik ja seda ei saa hiljem tagasi võtta — vaidluse koht on inimeste vahel, mitte nupu all."],
          ["service_log.info.confirm_client_sees", "Klient näeb ainult kinnitatud kirjeid: kuupäev, maht ja osutaja nimi. Sinu märkust ta ei näe."]
        ]
      },
      {
        titleKey: "service_log.info.privacy_title",
        title: "Mida siia EI kirjutata",
        itemKeys: [
          ["service_log.info.privacy_note", "Märkus on lühike faktimärge aruande jaoks, mitte juhtumilugu. Tundlik sisu, diagnoosid ja kolmandate isikute andmed siia ei kuulu."],
          ["service_log.info.privacy_retention", "Teenuskirje on arve alusdokument ja seda hoitakse 7 aastat. Tähtaeg algab selle majandusaasta lõpust, mil kirje tehti. Ekslikku kirjet parandatakse põhjusega või tühistatakse — vaikselt üle ei kirjutata."],
          ["service_log.info.privacy_location", "Asukohta vaikimisi ei salvestata. Kui see sisse lülitatakse, küsitakse üksainus punkt „Olen kohal“ vajutuse hetkel ja sulle näidatakse, kas ta salvestus. Pidevat asukohajälge ei koguta kunagi ja loa keeldumine ei takista ajatempli märkimist."],
          ["service_log.info.privacy_measure", "Süsteem mõõdab, kui kaua kulub KIRJE TEGEMISELE — mitte teenusele. See number on sinu oma, seda ei näe keegi teine ja teda kasutatakse tööriista kiiremaks tegemiseks, mitte sinu töötempo hindamiseks."]
        ]
      }
    ]
  }
});

const INFO_ALIASES = Object.freeze({
  kovisioon: "kovision",
  add_person: "invites",
  rooms: "invites",
  materials_adding: "materials",
  drafting: "document_drafting",
  service_card: "service_map"
});

const DASHBOARD_INFO_EXTRA_DETAILS = Object.freeze({
  workspace: [
    {
      title: "Mida siit jälgida",
      items: [
        "Töölaud näitab rollile sobivaid tööriistu ja hoiab need samas tööruumi stiilis.",
        "Kliendivaates on rõhk abisoovidel, dokumentidel, eelpöördumisel ja teenusekaardil.",
        "Teenuseosutaja või spetsialisti vaates lisanduvad teenuseprofiil, pöördumiste vastuvõtt, materjalid ja kovisioon."
      ]
    },
    {
      title: "Kuidas infot edasi kasutada",
      items: [
        "Töölaualt avatud töövood saavad vajadusel kasutada vestluste, dokumentide või profiili infot.",
        "Kui töövoos luuakse mustand või kokkuvõte, kontrolli see enne saatmist või avaldamist üle.",
        "Tagasinupp viib tagasi samasse tööruumi, et kasutaja ei kaotaks konteksti."
      ]
    }
  ],
  help_requests: [
    {
      title: "Mida kirjeldada",
      items: [
        "Kirjelda, millist abi on vaja, kus abi vajatakse ja millal see oleks sobiv.",
        "Lisa piirangud, eelistused ja vajalikud tingimused, näiteks keel, ligipääsetavus või ajakriitilisus.",
        "Ära lisa tundlikke isikuandmeid rohkem, kui kuulutuse mõistmiseks vaja."
      ]
    },
    {
      title: "Pärast avaldamist",
      items: [
        "Platvorm saab otsida sobivaid abipakkumisi ja näidata võimalikke vasteid.",
        "Sobituse korral saab suhtlus jätkuda ühises vestlusruumis.",
        "Kuulutust saab täiendada, kui selgub, et kirjeldus vajab täpsustamist."
      ]
    }
  ],
  help_offers: [
    {
      title: "Mida pakkumisse lisada",
      items: [
        "Kirjelda konkreetset abi või tuge, mida saad pakkuda.",
        "Märgi piirkond, ajad, kontaktiviis ja tingimused, mille korral pakkumine sobib.",
        "Lisa oskused, kogemus või piirid, mis aitavad sobiva abisoovi kiiremini leida."
      ]
    },
    {
      title: "Sobituse järel",
      items: [
        "Sobiva abisoovi leidmisel saab osapooled kokku viia vestlusruumis.",
        "Vestlusruumis saab täpsustada kokkulepped, tähtajad ja järgmised sammud.",
        "Kui pakkumine enam ei kehti, uuenda või peida see, et vasteid ei tekiks ekslikult."
      ]
    }
  ],
  service_map: [
    {
      title: "Otsing ja filter",
      items: [
        "Kasuta otsingut teenuse, organisatsiooni, piirkonna või kontakti leidmiseks.",
        "Kaardivaade aitab võrrelda, milline kontakt või teenuseosutaja on kasutaja asukohale või vajadusele lähim.",
        "Teenuseosutaja detailist saab liikuda edasi kontakti, pöördumise või profiili juurde, kui vastav info on olemas."
      ]
    },
    {
      title: "Andmete usaldus",
      items: [
        "KOV kontaktide ja teenuseosutajate info võib vajada ajakohastamist, seega kontrolli kriitiline kontakt enne kasutamist üle.",
        "SotsiaalAI-s hallatav teenuseprofiil aitab kaardil nähtavat infot hoida värskena.",
        "Kaart on suunav töövahend ega asenda ametlikku otsust või abivajaduse hindamist."
      ]
    }
  ],
  service_profile: [
    {
      title: "Kvaliteetne profiil",
      items: [
        "Kirjelda teenuseid kasutaja vaatest: kellele teenus sobib, mida saab ja kuidas pöörduda.",
        "Hoia kontaktid, lahtiolekuajad, teeninduspiirkond ja ligipääsetavuse info ajakohased.",
        "Lisa keeled, sihtrühmad ja teenuse piirid, et assistent ei soovitaks teenust valesse olukorda."
      ]
    },
    {
      title: "Kus infot kasutatakse",
      items: [
        "Profiili info saab ilmuda teenusekaardil ja aidata assistendil kasutajale sobivat pöördumiskohta soovitada.",
        "Kui profiil lubab eelpöördumisi vastu võtta, saab kasutaja saata paremini struktureeritud eelinfo.",
        "Ebatäpne profiil võib tekitada valesid soovitusi, seega tasub profiili regulaarselt üle vaadata."
      ]
    }
  ],
  service_card_listing: [
    {
      title: "Avaldamise kontroll",
      items: [
        "Kontrolli enne nähtavaks tegemist nime, aadressi, piirkonda, teenuse kirjeldust ja kontaktandmeid.",
        "Kui teenus on mobiilne või piirkonnapõhine, kirjelda asukoha asemel teeninduspiirkond arusaadavalt.",
        "Kaardil kuvatav info peab aitama kasutajal otsustada, kas see on õige pöördumiskoht."
      ]
    }
  ],
  documents: [
    {
      title: "Tööala kasutus",
      items: [
        "Dokumentide vaade on töökoht failide, korduvkasutatavate põhjade ja loodud väljundite hoidmiseks.",
        "Siit saab valida, milliseid faile AI-assistent tohib dokumendi koostamisel kasutada.",
        "Valitud dokumendid saab edasi anda dokumendi koostamise vaatesse, kus nende põhjal saab teha mustandi, kokkuvõtte, kirja või muu tööteksti."
      ]
    },
    {
      title: "Dokumentide kasutamine töövoogudes",
      items: [
        "Dokumendid võivad olla aluseks dokumendi koostamisel, eelpöördumise täpsustamisel või vestluse konteksti hoidmisel.",
        "Vali ainult need failid, mida AI tohib konkreetses töövoos kasutada.",
        "Hoia mallid ja lõplikud versioonid eristatuna, et mustandeid ei kasutataks kogemata valmis dokumendina."
      ]
    },
    {
      title: "Tööalase kasutuse raamistik",
      items: [
        "Kui raamleping või DigiDoc-kinnitus jäi registreerimisel alla laadimata, saab selle dokumendivaates uuesti avada.",
        "Raamistiku plokk on töövoo osa, mitte üldine selgitustekst: selle kaudu saab tööalase kasutuse kinnitust kontrollida ja vajadusel dokumendi alla laadida.",
        "Raamistiku salvestamine või allalaadimine ei muuda üleslaetud dokumentide kasutusõigusi; iga faili AI kasutusse lubamine jääb eraldi valikuks."
      ]
    },
    {
      title: "Privaatsus ja kvaliteet",
      items: [
        "Kontrolli enne üleslaadimist, kas fail sisaldab tundlikke või üleliigseid isikuandmeid.",
        "Faili nimi ja lühikirjeldus peaksid aitama hiljem aru saada, milleks dokument mõeldud on.",
        "Kui dokument on aegunud, asenda see uuema versiooniga või eemalda töövoost."
      ]
    }
  ],
  document_drafting: [
    {
      title: "Hea lähteülesanne",
      items: [
        "Ütle, mis tüüpi dokumenti on vaja, kellele see läheb ja millist tulemust ootad.",
        "Lisa faktid, tähtajad, viited, toon ja vorminõuded, mida tekst peab arvestama.",
        "Kui kasutad olemasolevaid materjale, vali need enne koostamist, et assistent ei lähtuks valest kontekstist."
      ]
    },
    {
      title: "Enne kasutamist",
      items: [
        "Kontrolli nimed, kuupäevad, summad, õiguslikud viited ja kontaktandmed käsitsi üle.",
        "AI koostatud tekst on mustand, mitte automaatselt lõplik dokument.",
        "Salvesta või ekspordi ainult läbivaadatud versioon."
      ]
    }
  ],
  pre_inquiry: [
    {
      title: "Millest alustada",
      items: [
        "Kirjelda olukorda, peamist muret, seniseid samme ja seda, millist abi ootad.",
        "Lisa kontakt või piirkond ainult siis, kui see on edastamiseks vajalik.",
        "Kui olukord on kiire või ohtlik, tuleb kasutada hädaabi või kriisiabi kanaleid, mitte jääda mustandit koostama."
      ]
    },
    {
      title: "Edastamine",
      items: [
        "Enne saatmist saab mustandi üle vaadata ja muuta.",
        "Adressaadi valik aitab suunata pöördumise sobivale spetsialistile või teenuseosutajale.",
        "Pärast edastamist võib suhtlus jätkuda vestlusruumis või väljaspool platvormi, sõltuvalt vastuvõtja töökorraldusest."
      ]
    }
  ],
  intake: [
    {
      title: "Vastuvõtu töökorraldus",
      items: [
        "Saabunud pöördumine annab eelinfo, mille põhjal otsustada, kas ja kuidas suhtlust jätkata.",
        "Vastuvõtja saab vajadusel küsida täpsustusi, suunata edasi või avada vestlusruumi.",
        "Pöördumise vastuvõtt ei tähenda automaatselt teenuse määramist või ametliku otsuse tegemist."
      ]
    },
    {
      title: "Mida kontrollida",
      items: [
        "Kontrolli, kas pöördumine on suunatud õigele organisatsioonile või kontaktile.",
        "Vaata üle nõusolek, kontaktandmed ja võimalik kiireloomulisus.",
        "Kui pöördumine sisaldab liigseid isikuandmeid, käsitle seda organisatsiooni andmekaitse reeglite järgi."
      ]
    }
  ],
  invites: [
    {
      title: "Kutsete saatmine",
      items: [
        "Kutsega saab lisada vestlusruumi vajaliku osapoole ja anda ligipääsu ainult sellele ruumile.",
        "Enne saatmist kontrolli e-posti aadressid, kutsuja nimi ja ruumi pealkiri.",
        "Kui inimene kutsutakse teise eest, peab olema selge, miks ligipääsu antakse ja millist infot ruumis jagatakse."
      ]
    },
    {
      title: "Ligipääsu piirid",
      items: [
        "Kutsutud inimene näeb vestlusruumi sisu vastavalt talle antud ligipääsule.",
        "Sponsoreeritud ligipääs annab ajutise platvormi kasutusõiguse, kuid ei muuda ruumi sisu automaatselt avalikuks.",
        "Vajadusel lõpeta või ära pikenda ligipääsu, kui koostöö on lõppenud."
      ]
    }
  ],
  materials: [
    {
      title: "Hea materjali tunnused",
      items: [
        "Materjal peaks olema asjakohane, ajakohane ja selgelt seotud sotsiaalvaldkonna töö või teenustega.",
        "Lisa võimalusel allikas, versioon, avaldamise aeg ja lühike selgitus, milleks materjal sobib.",
        "Kui fail sisaldab isikuandmeid või konfidentsiaalset infot, eemalda need enne saatmist."
      ]
    },
    {
      title: "Mis edasi saab",
      items: [
        "Saadetud materjalid vaadatakse enne teadmistebaasi lisamist üle.",
        "Ülevaatus aitab vältida aegunud, dubleerivat või ebatäpset sisu.",
        "Materjali lisamine ei tähenda automaatselt, et kogu fail muutub assistendi vastustes kasutatavaks."
      ]
    }
  ],
  kovision: [
    {
      title: "Juhtumipüstituse koostamine",
      items: [
        "Alusta tööalasest küsimusest, mitte inimese täielikust eluloost.",
        "Kirjelda ainult need asjaolud, mis on arutelu jaoks vajalikud.",
        "Sõnasta, millist tagasisidet või kolleegide abi ootad: vaatenurka, riski hindamist, järgmisi samme või sõnastust."
      ]
    },
    {
      title: "Arutelu läbiviimine",
      items: [
        "Kutsu ainult need kolleegid, kellel on arutelu eesmärgi jaoks roll või pädevus.",
        "AI assistent aitab struktuuri ja kokkuvõttega, kuid ei tee kliendi kohta otsuseid.",
        "Kokkuvõttes hoia alles tööalane õppetund, mitte tuvastatav juhtumilugu."
      ]
    }
  ]
});

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function splitHelpIntro(baseIntro, kind) {
  const text = String(baseIntro || "");
  if (kind === "request") {
    return text
      .replace("Abisoovi või abipakkumise saab", "Abisoovi saab")
      .replace("sobivaid abisoove ja abipakkumisi", "sobivaid abipakkumisi");
  }
  if (kind === "offer") {
    return text
      .replace("Abisoovi või abipakkumise saab", "Abipakkumise saab")
      .replace("sobivaid abisoove ja abipakkumisi", "sobivaid abisoove");
  }
  return text;
}

/* Lõik võib oma teksti võtta tõlkevõtmest (titleKey/bodyKey/itemKeys) —
   siis on eestikeelne string ainult varuvõimalus. Vanad lõigud jäävad
   sellest puutumata: ilma võtmeta tagastatakse sama objekt. */
function resolveDetail(t, section) {
  if (!section?.titleKey && !section?.bodyKey && !section?.itemKeys) return section;
  return {
    ...section,
    title: section.titleKey ? readText(t, section.titleKey, section.title) : section.title,
    body: section.bodyKey ? readText(t, section.bodyKey, section.body) : section.body,
    items: section.itemKeys
      ? section.itemKeys.map(([key, fallback]) => readText(t, key, fallback))
      : section.items
  };
}

export function getDashboardInfoContent(t, infoId) {
  const normalized = String(infoId || "").trim();
  const resolvedInfoId = DASHBOARD_INFO_ITEMS[normalized] ? normalized : INFO_ALIASES[normalized];
  const item = DASHBOARD_INFO_ITEMS[resolvedInfoId];
  if (!item) return null;

  /* Sissejuhatus tuleb /meist funktsioonikirjeldusest. Kui lehel sellist
     vastet ei ole (aboutFeatureKey puudub), jääb intro tühjaks — muidu
     otsiks readText võtit "…items.undefined.body". */
  const intro = item.aboutFeatureKey
    ? readText(t, `about.features_page.items.${item.aboutFeatureKey}.body`, item.intro || "")
    : item.intro || "";
  const featureTitle = item.aboutFeatureKey
    ? readText(t, `about.features_page.items.${item.aboutFeatureKey}.title`, item.title)
    : item.titleKey
      ? readText(t, item.titleKey, item.title)
      : item.title;

  return {
    title: item.titleKey ? featureTitle : item.title || featureTitle,
    intro: splitHelpIntro(intro, item.splitHelp),
    details: [
      ...(item.details || []),
      ...(DASHBOARD_INFO_EXTRA_DETAILS[resolvedInfoId] || [])
    ].map((section) => resolveDetail(t, section))
  };
}
