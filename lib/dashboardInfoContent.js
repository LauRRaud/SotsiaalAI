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

export function getDashboardInfoContent(t, infoId) {
  const normalized = String(infoId || "").trim();
  const resolvedInfoId = DASHBOARD_INFO_ITEMS[normalized] ? normalized : INFO_ALIASES[normalized];
  const item = DASHBOARD_INFO_ITEMS[resolvedInfoId];
  if (!item) return null;

  const intro = readText(
    t,
    `about.features_page.items.${item.aboutFeatureKey}.body`,
    item.intro || ""
  );
  const featureTitle = readText(
    t,
    `about.features_page.items.${item.aboutFeatureKey}.title`,
    item.title
  );

  return {
    title: item.title || featureTitle,
    intro: splitHelpIntro(intro, item.splitHelp),
    details: [
      ...(item.details || []),
      ...(DASHBOARD_INFO_EXTRA_DETAILS[resolvedInfoId] || [])
    ]
  };
}
