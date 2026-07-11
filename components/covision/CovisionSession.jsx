"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * CovisionSession — kovisiooni 8-etapiline sessioonilõuend.
 * Spetsifikatsioon: Kovisioon/kovisiooni digitaalne lõuend.md
 *
 * Ehitatud: 1. etapp (alustamine ja juhtumi kinnitamine),
 * 2. etapp (juhtumi avamine ja ühise pildi loomine).
 * Etapid 3–8 on platseholderid. Andmed on näidis — päris sisend
 * tuleb hiljem teemaseemnete lehelt.
 *
 * Nuppude loogika (tellija 10.07: iga nupp peab loogikaga olema):
 * Paus (peatab taimeri + katab lõuendi), Vajan tuge (avab etapi
 * abikihi), Kõik kokkulepped (täisloend), Kinnita juhtum ja alusta
 * (1. etapi värav), fookusküsimuse sisestus (2. etapi värav avaneb
 * alles sõnastatud küsimusega), märksõnade eemaldus + kinnitamine
 * (mustand → avalik), privaatsed märkmed (ainult sulle).
 */

const STAGES = [
  { title: "Alustamine ja juhtumi kinnitamine", minutes: 10 },
  { title: "Juhtumi avamine ja ühise pildi loomine", minutes: 12 },
  { title: "Juhtumi uurimine", minutes: 15 },
  { title: "Mõistmise süvendamine", minutes: 10 },
  { title: "Võimaluste loomine", minutes: 10 },
  { title: "Ressursid ja jõustamine", minutes: 7 },
  { title: "Valik ja järgmised sammud", minutes: 8 },
  { title: "Kokkuvõte ja õppimine", minutes: 10 }
];

/* Näidisandmed (spec §5.1 näide) — asenduvad teemaseemnete sisendiga */
const DEMO_CASE = {
  title: "Katkendlik kooliskäimine",
  owner: "Mari Mets",
  context: "Lastekaitse",
  kind: "Aktuaalne väljakutse",
  themes: "kooliskäimine · koostöö vanemaga · motivatsioon",
  whyNow: "Puudumised on sagenenud ja koostöö vanemaga on nõrgenenud.",
  support: "Olukorra paremat mõistmist ja uusi vaatenurki.",
  importance: "9 / 10",
  waited: "18 päeva"
};

/* 2. etapi ühine juhtumipilt (spec §8 juhtumikaardi osad) */
const DEMO_PICTURE = [
  { label: "Teema liik", value: "Aktuaalne väljakutse" },
  { label: "Juba proovitud", value: "Vestlused õpilasega, kokkulepped, päevikusse märkamised, kodused kõned." },
  { label: "Soovitud muutus / tulemus", value: "Regulaarne kooliskäimine ja parem koostöö vanemaga." },
  { label: "Mis on toiminud / mis mitte", value: "Mõned päevad lähevad paremini, kuid puudumised korduvad." },
  { label: "Seotud osapooled (rollid)", value: "Õpilane, ema, klassijuhataja, tugispetsialist." },
  { label: "Piirangud / takistused", value: "Väike meeskond, piiratud vanema koostöö, õpilase motivatsioon kõigub." },
  { label: "Aeg / võtmesündmused", value: "Puudumised sagenenud alates sügisest." },
  { label: "Millist abi soovin?", value: "Olukorra paremat mõistmist ja uusi vaatenurki." }
];

const DEMO_KEYWORDS = [
  "sagenenud puudumised",
  "koostöö nõrk",
  "motiveerub kõigub",
  "vestlused",
  "kokkulepped tehtud",
  "väike meeskond",
  "vanemaga suhtlus keeruline"
];

const DEMO_PARTICIPANTS = [
  { id: "mari", name: "Mari Mets", role: "Juhtumi tooja" },
  { id: "jaanika", name: "Jaanika Kask", role: "Sessiooni juht" },
  { id: "liisa", name: "Liisa Laan", role: "Kokkuvõtte hoidja" },
  { id: "aveli", name: "Aveli Kivi", role: "Grupiliige" },
  { id: "timo", name: "Timo Tamm", role: "Grupiliige" },
  { id: "marko", name: "Marko Suur", role: "Grupiliige" }
];

/* Demo-vaated (spec §29.5: üks vaade = üks roll). Vaatevahetaja on
   prototüübi tööriist — päris rakenduses määrab vaate sisselogitud
   kasutaja roll. */
const DEMO_VIEWS = [
  { id: "jaanika", label: "Sessiooni juht" },
  { id: "mari", label: "Juhtumi tooja" },
  { id: "liisa", label: "Kaardi haldaja" },
  { id: "aveli", label: "Grupiliige" }
];

/* Kokkulepped Etapp 1 final pildi järjekorras; note = väike lisamärge */
const AGREEMENTS = [
  { title: "Kuulame lõpuni", detail: "Me ei katkesta ega valmista kuulamise ajal oma vastust ette." },
  { title: "Räägime lugupidavalt ja hinnanguvabalt", detail: "Me ei kritiseeri juhtumi toojat ega teisi osalejaid." },
  { title: "Kirjutame enne, kui räägime", note: "3. ja 5. etapis", detail: "Küsimused ja võimalused paneme esmalt vaikuses kirja — nii saab ka vaiksem osaleja võrdse ruumi." },
  { title: "Hoiame konfidentsiaalsust", detail: "Juhtumi sisu ja isikuid puudutav info ei liigu sellest ruumist välja." },
  { title: "Keskendume juhtumile", detail: "Me ei vii arutelu enda lugudele ega kõrvalistele teemadele." },
  { title: "Hoiame etapid lahus", detail: "Me ei paku võimalusi enne selleks ettenähtud etappi." },
  { title: "Lubame vaikust", detail: "Vaikus on mõtlemise ja refleksiooni osa." },
  { title: "Peatame hoolivalt", note: "pausi-/sekkumissignaal", detail: "Kui kellegi piir, turvalisus või konfidentsiaalsus on ohus, kasutame kokkulepitud signaali." }
];

/* Sessiooni seaded (spec §16.2 vaikeväärtused) — demo; muutmine tuleb
   kontekstikihtidega koos päris andmetega */
const SESSION_SETTINGS = [
  ["Kohtumise koguaeg", "90 min"],
  ["Selle juhtumi aeg", "75 min"],
  ["Protsessi sügavus", "Täisvoog"],
  ["Toetuse tase", "Toetatud"],
  ["Ühise kaardi haldus", "Kokkuvõtte hoidja"],
  ["Detailne töömaterjal", "Ajutine"],
  ["Heli ja video", "Ei salvestata"],
  ["Pausisignaal", "Tõsta käsi"],
  ["Sekkumissignaal", "„Peatume korraks”"]
];

/* Rollipõhine abikiht (spec §18.2) — "Vajan tuge" EI peata protsessi */
const ROLE_SUPPORT = {
  jaanika: {
    title: "Sessiooni juhi tugi",
    rows: [
      "Vaata valmisolekuribalt, millised tingimused on veel täitmata.",
      "Selgita kokkulepet käitumise kaudu, mitte märksõnaga.",
      "Sekku hoolivalt: nimeta etapi eesmärk, mitte inimese viga.",
      "Kvoorumi erand on teadlik otsus — kinnita see selgelt.",
      "Sina ei pea juhtumit lahendama. Sa hoiad protsessi."
    ]
  },
  mari: {
    title: "Juhtumi tooja tugi",
    rows: [
      "1. etapis kinnitad ainult, et see on sinu tänane juhtum.",
      "Sinu detailne ettevalmistus jääb privaatseks — jagad alles loo ajal, kui ise otsustad.",
      "Kui grupile nähtav üldistus pole sobiv, paranda see enne kinnitamist.",
      "Detailset lugu räägid alles 2. etapis."
    ]
  },
  default: {
    title: "Grupiliikme tugi",
    rows: [
      "Kinnita oma roll — see ütleb, mida sinult täna oodatakse.",
      "Loe kokkulepped läbi ja kinnita, kui mõistad neid.",
      "Pausi võid küsida igal hetkel, põhjust avalikult selgitama ei pea.",
      "Küsimused ja lahendused tulevad hilisemates etappides."
    ]
  }
};

/* 3. etapp: teiste osalejate kaetud küsimusekaardid (näidis).
   Avanevad KOOS alles siis, kui kõik on kirjutanud — nii ei ankurda
   esimene küsija teiste mõtlemist (mockup: "kirjuta enne, ava hiljem"). */
const DEMO_OTHER_QUESTIONS = [
  { author: "Jaanika Kask", question: "Milline on seni olnud sinu kontakt emaga?" },
  { author: "Liisa Laan", question: "Mis on need päevad, mil laps kooli jõuab — mis siis on teisiti?" },
  { author: "Aveli Kivi", question: "Mida laps ise selle olukorra kohta ütleb?" },
  { author: "Timo Tamm", question: "Kes võrgustikust on praegu kõige rohkem kaasatud?" },
  { author: "Marko Suur", question: "Mis sind selle juhtumi juures kõige rohkem väsitab?" }
];

/* 3. etapp: uurimisviisid (spec §9) — sessiooni juht valib ühe */
const EXPLORE_MODES = [
  { key: "guided", label: "Juhitud vestlus", detail: "Sessiooni juht küsib mõned põhiküsimused. Teised kuulavad ja lisavad ainult väga olulise täpsustuse." },
  { key: "one-each", label: "Üks küsimus osaleja kohta", detail: "Igaüks valib ühe kõige olulisema küsimuse ja esitab selle." },
  { key: "silent", label: "Vaikne küsimustekogu", detail: "Kõik kirjutavad küsimused privaatselt. Kordused koondatakse ja avatakse ainult sisuliselt erinevad." },
  { key: "timeline", label: "Ajajoon", detail: "Sündmused ja pöördepunktid paigutatakse ajaliselt, et näha muutusi ja kordusi." },
  { key: "parties", label: "Osapoolte kaart", detail: "Vaadatakse iga osapoole kogemust, vajadusi ja mõju. Kelle hääl on veel puudu?" },
  { key: "strengths", label: "Tugevustele suunatud", detail: "Uuritakse, mis juba toimib, millised ressursid on olemas ja mis on varem aidanud." }
];

/* 3. etapp: küsimuste kompass (spec §9 A–F). F avaneb sessiooni
   juhi valikul — sügav refleksioon eeldab valmis gruppi. */
const COMPASS = [
  { key: "A", name: "Olukord ja faktid", questions: [
    "Mis selles olukorras konkreetselt juhtus?",
    "Millal see algas?",
    "Kes on seotud?",
    "Mida on juba proovitud?",
    "Mis on seni toiminud ja mis mitte?"
  ] },
  { key: "B", name: "Mõju ja tähendus", questions: [
    "Mida see olukord sinu jaoks tähendab?",
    "Keda see veel mõjutab?",
    "Mis sind selle juures kõige rohkem häirib?",
    "Millise suurema pildi osa see võib olla?",
    "Mida see olukord võib varjata?"
  ] },
  { key: "C", name: "Juhtumi tooja roll ja mõju", questions: [
    "Milline on sinu roll selles olukorras?",
    "Mille üle on sul mõju?",
    "Milline on siin sinu vastutus?",
    "Mida märkad enda reaktsioonide juures?",
    "Kuidas võiksid teised sinu rolli kirjeldada?"
  ] },
  { key: "D", name: "Osapooled ja süsteem", questions: [
    "Kuidas võiks teine osapool seda olukorda kogeda?",
    "Mida ta võib vajada?",
    "Milline vaatenurk on veel puudu?",
    "Millised suhted mõjutavad olukorra püsimist?",
    "Kelle hääl ei ole veel nähtav?"
  ] },
  { key: "E", name: "Tugevused ja ressursid", questions: [
    "Mis selles olukorras juba toimib?",
    "Milliseid tugevusi on juba kasutatud?",
    "Kes või mis võiks toetada?",
    "Mis on varem sarnases olukorras aidanud?",
    "Milline ressurss on veel kasutamata?"
  ] },
  { key: "F", name: "Sügavam refleksioon", gated: true, questions: [
    "Millist korduvat mustrit sa märkad?",
    "Milline uskumus võib sinu tegutsemist mõjutada?",
    "Mida sa pole võib-olla tahtnud näha?",
    "Mis aitab olukorral püsida?",
    "Mida oleks oluline õppida?"
  ] }
];

/* Etapi abikiht ("Vajan tuge") — spec §7–9 lühendatult */
const STAGE_SUPPORT = {
  1: {
    title: "Kuidas seda etappi juhtida?",
    rows: [
      "Tehke lühike avaring — igaüks jõuab kohale ühe lausega.",
      "Vaadake üle tänane valitud juhtum ja selle tooja soovitud tugi.",
      "Kinnitage rollid: sessiooni juht ei ole ekspert ega lahenduse andja.",
      "Käige kokkulepped läbi nii, et kõik mõistavad neid ühtemoodi.",
      "Leppige kokku pausi- ja sekkumissignaal.",
      "Alustage alles siis, kui kõik on valmis juhtumit kuulama."
    ]
  },
  2: {
    title: "Abiküsimused loo rääkimiseks",
    rows: [
      "Mis juhtus?",
      "Kes on seotud?",
      "Miks see on oluline?",
      "Mida oled juba proovinud?",
      "Mis on aidanud, mis on takistanud?",
      "Millist muutust soovid?",
      "Millist abi grupilt vajad?"
    ]
  },
  3: {
    title: "Kuidas uurida toetavalt?",
    rows: [
      "Küsi selleks, et mõista — mitte selleks, et lahendust ette anda.",
      "Ära peida küsimusse soovitust („Kas sa oled mõelnud, et võiksid…“).",
      "Küsi korraga ühte asja ja lase juhtumi toojal lühidalt vastata.",
      "Faktidest ei piisa — uuri ka rolli, mõju, tundeid ja ressursse.",
      "Juhtumi tooja võib vastamata jätta — see on piir, mitte viga.",
      "Kui vajalik info on koos, ära venita: liigu edasi."
    ]
  }
};

/* ============================================================
   2. ETAPI konstandid (spec v1.1 §20, §22, §24, §42.9)
   ============================================================ */

/* Ankrud allikasiltidega — tekivad demo-s kaardi haldaja tööna loo
   ajal (režiim A). "Juhtumi tooja kogemus" on teadlikult ERALDI
   liigist "Töötaja vaatlus" (§20.5 vs §33.4). */
const S2_ANCHORS = [
  { id: "laps", type: "Inimese enda vaade", source: "lapse enda sõnad", text: "„Kool tundub koormav ja ma ei taha klassi ees tähelepanu.”" },
  { id: "vanaema", type: "Võrgustikuliige", source: "juhtumi tooja kirjeldus", text: "Vanaema on lapse jaoks toetav ja aitab hommikurutiiniga." },
  { id: "tegevus", type: "Tehtud tegevus", source: "juhtumi tooja kirjeldus", text: "Toimus vestlus vanemaga ja kooli tugispetsialistiga." },
  { id: "tulemus", type: "Kirjeldatud tulemus", source: "juhtumi tooja kirjeldus", text: "Kokkulepped ei püsinud ja puudumised jätkusid." },
  { id: "kogemus", type: "Juhtumi tooja kogemus", source: "juhtumi tooja kirjeldus", text: "„Tunnen, et vastutus liigub liiga palju minu peale.”" },
  { id: "tolgendus", type: "Töötaja tõlgendus", source: "töötaja tõlgendus", text: "Vanema ebajärjekindel osalus võib suurendada lapse ebaturvalisust." },
  { id: "muutus", type: "Soovitud muutus", source: "juhtumi tooja kirjeldus", text: "Kooliskäimine muutub stabiilsemaks ja rollid võrgustikus selgemaks." }
];

/* Nimetatud seosed (§24.1) — ainult kirjeldavad; ebakindel seos on
   katkendlik ja liigub 3. etappi */
const S2_LINKS = [
  { a: "tegevus", b: "tulemus", rel: "kirjeldatud tulemus", sure: true },
  { a: "vanaema", b: "laps", rel: "toetab praegust olukorda", sure: true },
  { a: "laps", b: "muutus", rel: "on seotud soovitud muutusega", sure: true },
  { a: "kogemus", b: "tolgendus", rel: "vaated seotud · uurime 3. etapis", sure: false }
];

/* Tööfookuse demo-sõnastus (§30.2) — simulatsioon kasutab, kui Mari
   pole vaadatav roll */
const S2_FOCUS_DEMO =
  "Kuidas saan toetada võrgustiku selgemat vastutuse jagunemist nii, et lapse vajadused jäävad keskmesse?";

/* Juhtumi tooja privaatne Kovisioonipakk (§17.1) — ainult tema vaates */
const S2_PREP = [
  { title: "Ühe minuti kokkuvõte", state: "privaatne" },
  { title: "Loo struktuur (5 punkti)", state: "privaatne" },
  { title: "Võrgustikukaart", state: "jagamiskandidaat" },
  { title: "Senised meetodid ja tegevused", state: "jagamiskandidaat" },
  { title: "Minu rollirefleksioon", state: "privaatne" }
];

/* Rollipõhine abikiht 2. etapis (spec §16.2 + §36 kompassid) */
const ROLE_SUPPORT2 = {
  jaanika: {
    title: "Sessiooni juhi tugi",
    rows: [
      "Kas juhtumi tooja saab rääkida segamatult?",
      "Kas grupp püsib kuulamisrežiimis?",
      "Kas kaart sisaldab ainult kirjeldavaid ankruid?",
      "Kas töötaja tõlgendus on allikana eristatud?",
      "Kas soovitud muutus ja tööfookus on eristatavad?",
      "Kas mõni lahendus tuleb parkida?"
    ]
  },
  mari: {
    title: "Juhtumi tooja tugi",
    rows: [
      "Räägi oma lugu enda sõnadega — ettevalmistus jääb privaatseks.",
      "Mis on juhtunud ja miks see on sulle praegu oluline?",
      "Mida on seni tehtud ja mis tulemus tekkis?",
      "Mida laps ise soovib, kui see on teada?",
      "Millist muutust või õppimist sa ootad?",
      "Ülevaatuses otsustad sina, mis ühisele pildile jääb."
    ]
  },
  liisa: {
    title: "Kaardi haldaja tugi",
    rows: [
      "Üks kaart sisaldab üht mõtet.",
      "Kirjuta kuuldu, mitte enda järeldus.",
      "Lisa igale kaardile infoallikas.",
      "Asenda nimi rolliga.",
      "Seos on kirjeldav, mitte põhjuslik."
    ]
  },
  default: {
    title: "Grupiliikme tugi",
    rows: [
      "Kuula tervikut — küsimused tulevad 3. etapis.",
      "Märgi enda jaoks „Uuri hiljem”, ära esita seda veel.",
      "Erista, mida kuulsid ja mida ise oletad.",
      "Pane lahendusidee parklasse."
    ]
  }
};

/* ============================================================
   3. ETAPI konstandid (spec v1.1 §12–13, §21, §51.10)
   ============================================================ */

/* Mari valitud uurimiskohad — sõnastused on hinnangu- ja põhjuse-
   vabad (§51.10), MITTE süsteemi järeldused */
const S3_SITES = [
  { id: "laps", label: "Lapse enda vaade", plan: "Mõista lapse enda kogemust ja tema kirjeldatud raskusi." },
  { id: "vastutus", label: "Vastutuse jaotus", plan: "Täpsustada praegust vastutuse jaotust lapse, vanema, kooli ja töötaja vahel." },
  { id: "kokkulepped", label: "Senised kokkulepped", plan: "Uurida seniseid kokkuleppeid ning seda, mis nende rakendamist mõjutas." },
  { id: "erand", label: "Toimiv erand", plan: "Märgata hetki, mil olukord oli veidi parem, ja uurida, mis oli siis teisiti." }
];

/* Küsimuste järjekord — küsijad on grupiliikmed (§11.3; sessiooni
   juht EI ole vaikimisi küsija, §51.7). Aveli küsimuse teksti asendab
   vaikses ettevalmistuses kirjutatud enda küsimus, kui vaatad Avelina. */
const S3_QUESTIONS = [
  { id: "q1", by: "aveli", byName: "Aveli Kivi", byRole: "grupiliige", site: "laps", text: "Mida laps ise on öelnud selle kohta, millal koolis käimine on tema jaoks kergem?" },
  { id: "q2", by: "timo", byName: "Timo Tamm", byRole: "grupiliige", site: "vastutus", text: "Kes on seni olnud kokkulepete algataja — sina, kool või vanem?" },
  { id: "q3", by: "marko", byName: "Marko Suur", byRole: "grupiliige", site: "erand", text: "Milline oli viimane nädal, mil laps käis koolis järjepidevamalt — mis oli siis teisiti?" }
];

/* Rollipõhine abikiht 3. etapis (§11, §22, §44.5) */
const ROLE_SUPPORT3 = {
  jaanika: {
    title: "Sessiooni juhi tugi",
    rows: [
      "Ava korraga ainult üks küsimus ja hoia kõnevooru piire.",
      "Peata peidetud soovitus või hinnang hoolivalt.",
      "Mari ei pea vastama kõigile küsimustele — „ei tea” on väärtuslik tulemus.",
      "Kõiki järjekorra küsimusi ei pea esitama.",
      "Jälgi, et küsimused ei jääks ainult faktidesse."
    ]
  },
  mari: {
    title: "Juhtumi tooja tugi",
    rows: [
      "Vasta küsimusele, mitte kogu lugu uuesti.",
      "„Ma ei tea veel” on väärtuslik vastus.",
      "Võid alati öelda „ei soovi vastata” — põhjendust ei küsita.",
      "Võid vastata üldistatult, kui detail pole vajalik.",
      "Sina otsustad, millal on piisavalt uuritud."
    ]
  },
  liisa: {
    title: "Kaardi haldaja tugi",
    rows: [
      "Kanna vastusest lõuendile ainult oluline täpsustus.",
      "Lisa uuele infole allikas.",
      "Teadmata jääb teadmata — ära täida lünka oletusega.",
      "Voldi vastatud küsimus objekti alla."
    ]
  },
  default: {
    title: "Grupiliikme tugi",
    rows: [
      "Kirjuta küsimus enne vaikselt valmis.",
      "Küsi selleks, et mõista — ära peida küsimusse soovitust.",
      "Üks asi korraga; kaks küsimärki tähendab kahte küsimust.",
      "Pärast vastust ütle „Aitäh” — arutelu ei avane.",
      "Lahendusidee pargi 5. etappi."
    ]
  }
};

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ParticipantsPanel() {
  return (
    <section className="cvs-cell">
      <h3 className="cvs-cell-title">
        Kohal ({DEMO_PARTICIPANTS.length}/{DEMO_PARTICIPANTS.length})
      </h3>
      <ul className="cvs-people">
        {DEMO_PARTICIPANTS.map((p) => (
          <li key={p.name} className="cvs-person">
            <span className="cvs-person-name">{p.name}</span>
            <span className="cvs-person-role" data-lead={p.role !== "Grupiliige" ? "1" : "0"}>
              {p.role}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CovisionSession() {
  const [stage, setStage] = useState(1);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  /* ============================================================
     1. ETAPP — vaatepõhine olekumudel (spec v1.1 §29.5–29.6).
     SINA oled demo-vaates valitud inimene; teised osalejad on
     simuleeritud ja täidavad oma kinnitused pärast "Alusta
     kohtumist" järk-järgult. Timo on lukus ~25 s, et referents-
     seis (§29.6: Timo kaks puudujääki) oleks päriselt näha.
     Päris versioonis asendub simulatsioon reaalajasünkiga.
     Aus olek (§12.1): mitte midagi pole kinnitatud enne inimese
     (või simuleeritud inimese) tegevust.
     ============================================================ */
  const [view, setView] = useState("jaanika");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  const [pState, setPState] = useState(() =>
    Object.fromEntries(
      DEMO_PARTICIPANTS.map((p) => [p.id, { role: false, agreed: false, status: "none" }])
    )
  );
  const [caseConfirmed, setCaseConfirmed] = useState(false);
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [agreementsOpen, setAgreementsOpen] = useState(false);
  const [heroDetailOpen, setHeroDetailOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const my = pState[view];
  const mark = (id, patch) =>
    setPState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const total = DEMO_PARTICIPANTS.length;
  const roleCount = DEMO_PARTICIPANTS.filter((p) => pState[p.id].role).length;
  const agreedCount = DEMO_PARTICIPANTS.filter((p) => pState[p.id].agreed).length;
  const readyCount = DEMO_PARTICIPANTS.filter((p) => pState[p.id].status === "ready").length;

  const switchView = (id) => {
    setView(id);
    setAgreementsOpen(false);
    setReadyOpen(false);
    setSupportOpen(false);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2200);
    } catch {}
  };

  /* Puuduvad tingimused (§21.3) — inimese kaupa kokku pandud, nagu
     referentsvaates: "Timo peab kinnitama rolli ja kokkulepped." */
  const missing = [];
  if (!sessionStarted) {
    missing.push("Sessiooni juht peab kohtumise alustama.");
  } else {
    DEMO_PARTICIPANTS.forEach((p) => {
      const parts = [];
      if (!pState[p.id].role) parts.push("rolli");
      if (!pState[p.id].agreed) parts.push("kokkulepped");
      if (parts.length) {
        missing.push(`${p.name.split(" ")[0]} peab kinnitama ${parts.join(" ja ")}.`);
      }
    });
    if (!settingsConfirmed) missing.push("Sessiooni seaded vajavad kinnitamist.");
    if (!caseConfirmed) missing.push("Juhtumi tooja peab kinnitama tänase juhtumi.");
    DEMO_PARTICIPANTS.forEach((p) => {
      const st = pState[p.id];
      if (st.role && st.agreed && st.status !== "ready") {
        missing.push(`${p.name.split(" ")[0]} pole veel valmisolekut kinnitanud.`);
      }
    });
  }
  const gateHint =
    missing.length === 0
      ? "Kõik on valmis. Järgmises etapis räägib juhtumi tooja oma loo."
      : missing.length <= 2
        ? missing.join(" ")
        : `${missing.slice(0, 2).join(" ")} (+${missing.length - 2} tingimust)`;

  /* Alaribalt paneelini: oleku puudutus avab vastava kihi (§20.3) */
  const peopleRef = useRef(null);
  const heroRef = useRef(null);
  const agreeRef = useRef(null);
  const settingsRef = useRef(null);
  const scrollTo = (ref) => ref.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });

  /* ============================================================
     2. ETAPP — loo jagamine ja ühise pildi ülevaatus (spec v1.1).
     Faasid (§12): ready → sharing → review. Ankrud tekivad demo-s
     kaardi haldaja tööna loo ajal (režiim A); vaadatava rolli
     toimingud on sinu käes, teised simuleeritakse viidetega.
     ============================================================ */
  const [s2Phase, setS2Phase] = useState("ready");
  const [shareStart, setShareStart] = useState(0);
  const [reviewStart, setReviewStart] = useState(0);
  const [anchorCount, setAnchorCount] = useState(0);
  const [investigate, setInvestigate] = useState(() => new Set(["tolgendus"]));
  const [pictureConfirmed, setPictureConfirmed] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [focusStatus, setFocusStatus] = useState("none"); /* none|confirmed|temp */
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusDraft, setFocusDraft] = useState("");
  const [prepOpen, setPrepOpen] = useState(false);

  const startSharing = () => {
    setS2Phase("sharing");
    setShareStart(elapsed);
  };
  const finishSharing = () => {
    setS2Phase("review");
    setReviewStart(elapsed);
    setAnchorCount(S2_ANCHORS.length);
  };
  const toggleInvestigate = (id) =>
    setInvestigate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const confirmFocus = (mode) => {
    const text = focusDraft.trim();
    if (!text) return;
    setFocusStatus(mode);
    setFocusQuestion(text);
    setFocusOpen(false);
  };

  /* 2. etapi värav — puudujäägid inimese kaupa (§42.8) */
  const s2Missing = [];
  if (s2Phase !== "review") {
    s2Missing.push("Juhtumi tooja peab loo jagamise lõpetama.");
  } else {
    if (!pictureConfirmed) s2Missing.push("Mari peab kinnitama ühise pildi.");
    if (!privacyChecked) s2Missing.push("Liisa peab lõpetama privaatsuskontrolli.");
    if (focusStatus === "none") s2Missing.push("Mari peab sõnastama tööfookuse.");
  }
  const s2GateHint =
    s2Missing.length === 0
      ? "Kõik on valmis. Järgmises etapis uurib grupp juhtumit."
      : s2Missing.length <= 2
        ? s2Missing.join(" ")
        : `${s2Missing.length} tingimust on veel täitmata · ${s2Missing.join(" ")}`;

  /* Demo-simulatsioon 2. etapis: mitte-vaadatavad rollid täidavad oma
     toimingud viidetega; ankrud ilmuvad loo ajal üksteise järel. */
  useEffect(() => {
    if (stage !== 2 || paused) return;
    if (s2Phase === "ready" && view !== "mari" && elapsed >= 4) {
      startSharing();
      return;
    }
    if (s2Phase === "sharing") {
      if (anchorCount < S2_ANCHORS.length && elapsed >= shareStart + 3 + anchorCount * 2) {
        setAnchorCount((v) => v + 1);
        return;
      }
      if (
        view !== "mari" &&
        anchorCount >= S2_ANCHORS.length &&
        elapsed >= shareStart + 3 + S2_ANCHORS.length * 2 + 4
      ) {
        finishSharing();
        return;
      }
    }
    if (s2Phase === "review") {
      if (!privacyChecked && view !== "liisa" && elapsed >= reviewStart + 6) {
        setPrivacyChecked(true);
        return;
      }
      if (view !== "mari") {
        if (!pictureConfirmed && elapsed >= reviewStart + 10) {
          setPictureConfirmed(true);
          return;
        }
        if (focusStatus === "none" && elapsed >= reviewStart + 14) {
          setFocusStatus("confirmed");
          setFocusQuestion(S2_FOCUS_DEMO);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, stage]);

  /* ============================================================
     3. ETAPP — juhtumi uurimine (spec v1.1 §51.8–51.10).
     Faasid: plan (uurimisplaan §12–13) → prep (vaikne ettevalmistus
     §16) → round (küsimuste voor §21). Aktiivse küsimuse töövoog
     jagab toimingud rollide vahel; mitte-vaadatavad rollid
     simuleeritakse.
     ============================================================ */
  const [s3Phase, setS3Phase] = useState("plan");
  const [prepStart, setPrepStart] = useState(0);
  const [roundStart, setRoundStart] = useState(0);
  const [queue, setQueue] = useState(() =>
    S3_QUESTIONS.map((q) => ({ ...q, status: "queued", result: "" }))
  );
  const [activeId, setActiveId] = useState(null);
  const [aState, setAState] = useState("opened"); /* opened|answering|answered */
  const [aTick, setATick] = useState(0);
  const [enough, setEnough] = useState(false);

  const activeQ = queue.find((q) => q.id === activeId) || null;
  const queuedQs = queue.filter((q) => q.status === "queued");
  const answeredSites = new Set(
    queue.filter((q) => q.status === "closed" && q.result === "Vastatud").map((q) => q.site)
  );
  const siteStatus = (id) =>
    activeQ && activeQ.site === id
      ? "Uurime"
      : answeredSites.has(id)
        ? "Täpsustatud"
        : enough
          ? "Teadlikult avatud"
          : "Vajab uurimist";

  const startPrep = () => {
    setS3Phase("prep");
    setPrepStart(elapsed);
  };
  const startRound = () => {
    setS3Phase("round");
    setRoundStart(elapsed);
    /* Aveli küsimus = sinu kirjutatud küsimus, kui vaatad Avelina */
    setQueue((prev) =>
      prev.map((q) =>
        q.id === "q1" && view === "aveli" && myQuestion.trim()
          ? { ...q, text: myQuestion.trim() }
          : q
      )
    );
    setATick(elapsed);
  };
  const openNextQ = () => {
    const next = queue.find((q) => q.status === "queued");
    if (!next) return;
    setActiveId(next.id);
    setQueue((prev) => prev.map((q) => (q.id === next.id ? { ...q, status: "active" } : q)));
    setAState("opened");
    setATick(elapsed);
  };
  const closeActiveQ = (result) => {
    if (!activeId) return;
    setQueue((prev) =>
      prev.map((q) =>
        q.id === activeId
          ? { ...q, status: result === "Pargitud" ? "parked" : "closed", result }
          : q
      )
    );
    setActiveId(null);
    setATick(elapsed);
  };

  /* 3. etapi värav (§44.4 demo-alamhulk; järjekorra küsimusi EI nõuta §44.5) */
  const s3Missing = [];
  if (s3Phase !== "round") {
    s3Missing.push("Uurimine ei ole veel alanud.");
  } else {
    if (activeQ) s3Missing.push("Üks küsimus on veel aktiivne.");
    if (!enough) s3Missing.push("Mari peab kinnitama, et olukorda on piisavalt uuritud.");
    if (focusStatus === "temp") s3Missing.push("Mari peab kinnitama uuritud tööfookuse.");
  }
  const s3GateHint =
    s3Missing.length === 0
      ? "Juhtum on piisavalt uuritud. Järgmises etapis kuulab Mari grupi peegeldusi."
      : s3Missing.length <= 2
        ? s3Missing.join(" ")
        : `${s3Missing.length} tingimust on veel täitmata · ${s3Missing.join(" ")}`;

  /* Demo-simulatsioon 3. etapis */
  useEffect(() => {
    if (stage !== 3 || paused) return;
    if (s3Phase === "plan" && view !== "jaanika" && elapsed >= 4) {
      startPrep();
      return;
    }
    if (s3Phase === "prep" && view !== "jaanika" && elapsed >= prepStart + 10) {
      startRound();
      return;
    }
    if (s3Phase !== "round") return;
    if (!activeQ) {
      if (queuedQs.length && view !== "jaanika" && elapsed >= aTick + 3) {
        openNextQ();
        return;
      }
      if (!queuedQs.length) {
        if (!enough && view !== "mari" && elapsed >= aTick + 4) {
          setEnough(true);
          return;
        }
        if (enough && focusStatus === "temp" && view !== "mari" && elapsed >= aTick + 7) {
          setFocusStatus("confirmed");
        }
      }
      return;
    }
    if (aState === "opened" && view !== "jaanika" && elapsed >= aTick + 3) {
      setAState("answering");
      setATick(elapsed);
      return;
    }
    if (aState === "answering" && view !== "mari" && elapsed >= aTick + 6) {
      setAState("answered");
      setATick(elapsed);
      return;
    }
    if (aState === "answered" && view !== activeQ.by && elapsed >= aTick + 3) {
      closeActiveQ("Vastatud");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, stage, paused]);

  /* 2. etapp: fookusküsimus (värav), märksõnade mustand, privaatsed
     märkmed. Elavad sessiooni tasandil, et etapivahetus neid ei kaotaks. */
  const [focusQuestion, setFocusQuestion] = useState("");
  const [keywords, setKeywords] = useState(DEMO_KEYWORDS);
  const [keywordsPublic, setKeywordsPublic] = useState(false);
  const [privateNotes, setPrivateNotes] = useState("");

  const stageMeta = STAGES[stage - 1];
  const totalSeconds = stageMeta.minutes * 60;

  /* Taimerid (spec §8 olek 0/1): EI käivitu ruumi avamisel, vaid alles
     "Alusta kohtumist" vajutusega. Etapi aeg nullub etapivahetusel,
     kohtumise koguaeg jookseb üle etappide. Paus peatab mõlemad.
     Taimer ei sulge etappi kunagi ise (toetav, mitte karistav). */
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    setElapsed(0);
  }, [stage]);
  useEffect(() => {
    if (!sessionStarted) return undefined;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setElapsed((v) => v + 1);
      setMeetingElapsed((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionStarted]);

  /* Demo-simulatsioon: iga ~2 s täidab ÜKS mitte-vaadatav osaleja oma
     järgmise puuduva kinnituse (rollid → juhtum → kokkulepped → seaded
     → valmisolek). Timo on lukus kuni 25. sekundini (§29.6 referents-
     seis). Vaadatava inimese kinnitused on alati SINU käes. */
  useEffect(() => {
    if (!sessionStarted || stage !== 1) return;
    if (elapsed === 0 || elapsed % 2 !== 0) return;
    const eligible = DEMO_PARTICIPANTS.filter(
      (p) => p.id !== view && (p.id !== "timo" || elapsed >= 25)
    );
    const needsRole = eligible.find((p) => !pState[p.id].role);
    if (needsRole) {
      mark(needsRole.id, { role: true });
      return;
    }
    if (!caseConfirmed && view !== "mari") {
      setCaseConfirmed(true);
      return;
    }
    const needsAgree = eligible.find((p) => !pState[p.id].agreed);
    if (needsAgree) {
      mark(needsAgree.id, { agreed: true });
      return;
    }
    if (!settingsConfirmed && view !== "jaanika") {
      setSettingsConfirmed(true);
      return;
    }
    const needsReady = eligible.find(
      (p) => pState[p.id].role && pState[p.id].agreed && pState[p.id].status !== "ready"
    );
    if (needsReady) {
      mark(needsReady.id, { status: "ready" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, sessionStarted, stage]);

  const overTime = elapsed > totalSeconds;
  const timeLabel = useMemo(
    () => `${formatTime(Math.min(elapsed, 5999))} / ${formatTime(totalSeconds)}`,
    [elapsed, totalSeconds]
  );

  const advance = () => {
    setSupportOpen(false);
    /* Nulli etapi taimer SAMAS patšis — muidu näevad etapi
       simulatsioonid esimesel renderil eelmise etapi sekundeid ja
       salvestavad valed alguspunktid (shareStart jm). */
    setElapsed(0);
    setStage((s) => Math.min(s + 1, STAGES.length));
  };
  const back = () => {
    setSupportOpen(false);
    setElapsed(0);
    setStage((s) => Math.max(s - 1, 1));
  };

  /* 2. etapi värav: fookusküsimus peab olema juhtumi tooja sõnastuses.
     Vihjed on täpsed (allikad): Kas → jah/ei; Miks → hindamine;
     muu → soovita „Kuidas“. Ükski ei blokeeri — otsus jääb inimesele. */
  const focusReady = focusQuestion.trim().length >= 5;
  const focusHint = useMemo(() => {
    const q = focusQuestion.trim().toLowerCase();
    if (!q) return null;
    if (q.startsWith("kas "))
      return "„Kas…?“ kutsub esile jah- või ei-vastuse. „Kuidas…?“ avab võimalusi.";
    if (q.startsWith("miks "))
      return "„Miks…?“ suunab teist inimest hindama. „Kuidas…?“ keskendub sellele, mida sina saad mõjutada.";
    if (!q.startsWith("kuidas"))
      return "Soovituslik algus on „Kuidas…?“ — see avab võimalusi ega anna vastutust grupile.";
    return null;
  }, [focusQuestion]);

  /* Märksõna lisamine (spec: juhtumi tooja saab mustandit muuta) */
  const [newKeyword, setNewKeyword] = useState("");
  const addKeyword = (e) => {
    e.preventDefault();
    const value = newKeyword.trim();
    if (!value) return;
    setKeywords((list) => (list.includes(value) ? list : [...list, value]));
    setNewKeyword("");
  };

  /* 3. etapp: uurimisviis, kompassi katvus, privaatne küsimus.
     Kompassi küsimusele klõps = "seda on küsitud" → katvuse näidik. */
  const [exploreMode, setExploreMode] = useState(null);
  const [usedQuestions, setUsedQuestions] = useState(() => new Set());
  const [deepUnlocked, setDeepUnlocked] = useState(false);
  const [myQuestion, setMyQuestion] = useState("");

  /* Kaetud kaardid: kirjuta enne → ava koos → täpsustame ükshaaval.
     Klõps avatud kaardil märgib selle arutatuks (hajub). */
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const [discussedCards, setDiscussedCards] = useState(() => new Set());
  const myCardReady = myQuestion.trim().length >= 5;
  const qStep = cardsRevealed ? 3 : myCardReady ? 2 : 1;
  const toggleDiscussed = (key) => {
    setDiscussedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* Kompassi klõps LOOB: enne kaartide avamist toob küsimuse sinu
     kaardi mustandisse (kohanda see juhtumile) ja märgib suuna.
     Pärast avamist (kirjutamine läbi) lülitab klõps suuna kaetust —
     katvuse näidik suulise vooru jaoks. */
  const useCompassQuestion = (q) => {
    if (!cardsRevealed) {
      setMyQuestion(q);
      setUsedQuestions((prev) => new Set(prev).add(q));
      return;
    }
    setUsedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };
  const directionCovered = (dir) => dir.questions.some((q) => usedQuestions.has(q));
  const coveredCount = COMPASS.filter(directionCovered).length;

  /* Küsimuse kvaliteeditugi (spec §9): privaatne, ei blokeeri, ei
     kirjuta küsimust inimese eest. Lihtsad mustripõhised vihjed. */
  const myQuestionHint = useMemo(() => {
    const q = myQuestion.trim().toLowerCase();
    if (!q) return null;
    if (/(oled (sa )?mõelnud|äkki (sa )?võiksid|võib-?olla peaksid)/.test(q))
      return { tone: "warn", text: "See kõlab peidetud soovitusena. Proovi sama uudishimu avatud küsimusena: „Milline on seni olnud…?“" };
    if ((q.match(/\?/g) || []).length > 1)
      return { tone: "warn", text: "Siin on mitu küsimust korraga. Vali neist kõige olulisem." };
    if (q.startsWith("miks sa") || q.startsWith("miks te"))
      return { tone: "warn", text: "„Miks sa…?“ võib kõlada hinnanguna. „Mis viis selleni…?“ uurib sama asja pehmemalt." };
    if (q.startsWith("kas "))
      return { tone: "warn", text: "Kinnine küsimus annab jah/ei vastuse. Avatud algus (mis, kuidas, milline) avab rohkem." };
    if (q.length >= 12)
      return { tone: "ok", text: "Avatud ja selge küsimus." };
    return null;
  }, [myQuestion]);

  const support = STAGE_SUPPORT[stage] || null;

  return (
    <div className="cvs" data-paused={paused ? "1" : "0"}>
      {/* Püsiv kiht etappidele 4–8 (etappidel 1–3 on oma täisekraani päis) */}
      {stage > 3 ? (
      <header className="cvs-top">
        <ol className="cvs-rail" aria-label="Kovisiooni etapid">
          {STAGES.map((s, i) => {
            const n = i + 1;
            return (
              <li
                key={s.title}
                className="cvs-rail-step"
                data-state={n === stage ? "active" : n < stage ? "done" : "todo"}
                aria-current={n === stage ? "step" : undefined}
              >
                <span className="cvs-rail-dot">{n < stage ? "✓" : n}</span>
                <span className="cvs-rail-label">{s.title}</span>
              </li>
            );
          })}
        </ol>
        <div className="cvs-top-tools">
          <div className="cvs-timer" data-over={overTime ? "1" : "0"}>
            <span className="cvs-timer-label">Aeg etapile</span>
            <span className="cvs-timer-time">{timeLabel}</span>
          </div>
          <button
            type="button"
            data-variant
            className="cvs-pause-btn"
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? "Jätka" : "Paus"}
          </button>
        </div>
      </header>
      ) : null}

      {/* Püsiv tööfookuse ankur etappidel 4–8 (etapil 3 on oma
          ankruriba cv3 päises) */}
      {stage >= 4 && focusQuestion.trim() ? (
        <p className="cvs-anchor">
          <span className="cvs-anchor-label">Fookusküsimus</span>
          {focusQuestion.trim()}
        </p>
      ) : null}

      {stage === 1 ? (
        <section className="cv1" aria-label="1. etapp — alustamine ja juhtumi kinnitamine">
          {/* Päis: ruumikontroll + bränd, etapirada, taimerid + toimingud */}
          <header className="cv1-top">
            <div className="cv1-brand">
              <button
                type="button"
                className="cv1-exit"
                title="Välju ruumist"
                onClick={() => window.history.back()}
              >
                ← Välju
              </button>
              <div>
                <p className="cv1-brand-name">Kovisioon</p>
                <p className="cv1-brand-sub">Koos mõtestame. Koos leiame võimalusi.</p>
              </div>
            </div>
            <ol className="cv1-rail" aria-label="Kovisiooni etapid">
              {STAGES.map((s, i) => (
                <li
                  key={s.title}
                  className="cv1-step"
                  data-state={i === 0 ? "active" : "todo"}
                  aria-current={i === 0 ? "step" : undefined}
                >
                  <span className="cv1-step-dot">{i + 1}</span>
                  <span className="cv1-step-label">{s.title}</span>
                </li>
              ))}
            </ol>
            <div className="cv1-tools">
              {sessionStarted ? (
                <>
                  <div className="cv1-chip">
                    <span className="cv1-chip-label">Kohtumine</span>
                    <span className="cv1-chip-value">{formatTime(meetingElapsed)}</span>
                  </div>
                  <div className="cv1-chip" data-over={elapsed > totalSeconds ? "1" : "0"}>
                    <span className="cv1-chip-label">Etapp 1</span>
                    <span className="cv1-chip-value">
                      {formatTime(Math.min(elapsed, 5999))} / {formatTime(totalSeconds)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="cv1-chip">
                  <span className="cv1-chip-label">Etapp 1</span>
                  <span className="cv1-chip-value">Valmis alustama</span>
                </div>
              )}
              {!sessionStarted && view === "jaanika" ? (
                <button
                  type="button"
                  data-variant="primary"
                  className="cv1-acc"
                  onClick={() => setSessionStarted(true)}
                >
                  Alusta kohtumist
                </button>
              ) : null}
              <button
                type="button"
                data-variant
                aria-pressed={paused}
                disabled={!sessionStarted}
                onClick={() => setPaused((v) => !v)}
              >
                {paused ? "Jätka" : "Paus"}
              </button>
              <button
                type="button"
                data-variant
                aria-expanded={supportOpen}
                onClick={() => setSupportOpen((v) => !v)}
              >
                Vajan tuge
              </button>
            </div>
          </header>

          <div className="cv1-main">
            {/* Vasak: osalejad ja rollid (§13.1 rea sisu) */}
            <aside className="cv1-panel cv1-left" ref={peopleRef}>
              <header className="cv1-panel-head">
                <h2 className="cv1-panel-title">Osalejad ja rollid</h2>
                <span className="cv1-panel-meta">{total}/{total} kohal</span>
              </header>
              <ul className="cv1-people">
                {DEMO_PARTICIPANTS.map((p) => {
                  const st = pState[p.id];
                  const isMe = p.id === view;
                  const stateText = [
                    "Kohal",
                    st.role ? "roll kinnitatud" : "roll määratud",
                    st.status === "ready"
                      ? "valmis"
                      : st.status === "moment"
                        ? "vajab hetke"
                        : st.status === "tech"
                          ? "tehniline takistus"
                          : "pole valmis"
                  ].join(" · ");
                  return (
                    <li key={p.id} className="cv1-person" data-me={isMe ? "1" : "0"}>
                      <span className="cv1-avatar" aria-hidden="true">
                        {p.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <span className="cv1-person-main">
                        <span className="cv1-person-name">
                          {p.name}
                          {isMe ? <span className="cv1-me-tag"> (sina)</span> : null}
                        </span>
                        <span className="cv1-role-chip" data-role={p.role}>{p.role}</span>
                        <span
                          className="cv1-person-state"
                          data-done={st.role && st.status === "ready" ? "1" : "0"}
                        >
                          {stateText}
                        </span>
                        {isMe && sessionStarted && !st.role ? (
                          <button
                            type="button"
                            data-variant
                            className="cv1-mini-btn"
                            onClick={() => mark(view, { role: true })}
                          >
                            Kinnitan rolli
                          </button>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {/* Isiklik valmisolek (§17) — avaneb rolli + kokkulepete järel */}
              {sessionStarted && my.role && my.agreed && my.status !== "ready" ? (
                <button
                  type="button"
                  data-variant
                  className="cv1-panel-btn"
                  aria-expanded={readyOpen}
                  onClick={() => setReadyOpen((v) => !v)}
                >
                  Olen kohal ja valmis
                </button>
              ) : null}
              {readyOpen ? (
                <div className="cv1-ready-menu">
                  <button
                    type="button"
                    data-variant
                    onClick={() => { mark(view, { status: "ready" }); setReadyOpen(false); }}
                  >
                    Olen valmis
                  </button>
                  <button
                    type="button"
                    data-variant
                    onClick={() => { mark(view, { status: "moment" }); setReadyOpen(false); }}
                  >
                    Vajan hetke
                  </button>
                  <button
                    type="button"
                    data-variant
                    onClick={() => { mark(view, { status: "tech" }); setReadyOpen(false); }}
                  >
                    Mul on tehniline takistus
                  </button>
                </div>
              ) : null}
              <button type="button" data-variant className="cv1-panel-btn" onClick={copyInvite}>
                {inviteCopied ? "Link kopeeritud" : "Kutsu osalejaid"}
              </button>
            </aside>

            {/* Keskel: hero — Tänane juhtum (§11) */}
            <section className="cv1-hero" ref={heroRef} aria-labelledby="cv1-hero-title">
              <p className="cv1-hero-kicker">Tänane juhtum</p>
              <h1 id="cv1-hero-title" className="cv1-hero-title">{DEMO_CASE.title}</h1>
              <div className="cv1-hero-chips">
                <div className="cv1-hero-fact">
                  <span className="cv1-fact-label">Juhtumi tooja</span>
                  <span className="cv1-fact-value">{DEMO_CASE.owner}</span>
                </div>
                <div className="cv1-hero-fact">
                  <span className="cv1-fact-label">Kontekst</span>
                  <span className="cv1-fact-value">{DEMO_CASE.context}</span>
                </div>
                <div className="cv1-hero-fact">
                  <span className="cv1-fact-label">Juhtumi liik</span>
                  <span className="cv1-fact-value">{DEMO_CASE.kind}</span>
                </div>
              </div>
              <div className="cv1-hero-cols">
                <div className="cv1-hero-fact">
                  <span className="cv1-fact-label">Miks praegu?</span>
                  <span className="cv1-fact-value">{DEMO_CASE.whyNow}</span>
                </div>
                <div className="cv1-hero-fact">
                  <span className="cv1-fact-label">Millist tuge soovin?</span>
                  <span className="cv1-fact-value">{DEMO_CASE.support}</span>
                </div>
              </div>
              <button type="button" className="cv1-seed" onClick={() => setHeroDetailOpen(true)}>
                Vaata algset teemaseemet ↗
              </button>

              {/* Juhtumi kinnitus: nuppu näeb AINULT juhtumi tooja (§29.5);
                  teised näevad ausat olekut */}
              {caseConfirmed ? (
                <p className="cv1-case-state" data-done="1">
                  ✓ Juhtumi tooja kinnitas tänase juhtumi
                </p>
              ) : view === "mari" ? (
                <div className="cv1-case-confirm">
                  <div>
                    <p className="cv1-case-title">See on minu tänane juhtum</p>
                    <p className="cv1-case-sub">
                      Kinnita, et see on teema, millega soovid täna töötada.
                      Privaatne ettevalmistus jääb sinu kontrolli alla.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-variant="primary"
                    className="cv1-acc"
                    disabled={!sessionStarted}
                    title={!sessionStarted ? "Kinnitused avanevad pärast kohtumise algust" : undefined}
                    onClick={() => setCaseConfirmed(true)}
                  >
                    Kinnita juhtum
                  </button>
                </div>
              ) : (
                <p className="cv1-case-state">Ootab juhtumi tooja kinnitust</p>
              )}
            </section>

            {/* Parem: kokkulepped + seaded */}
            <div className="cv1-right">
              <section className="cv1-panel" ref={agreeRef}>
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Meie kokkulepped</h2>
                  <span className="cv1-panel-meta">{agreedCount}/{total} kinnitanud</span>
                </header>
                <ul className="cv1-list">
                  {AGREEMENTS.map((a) => (
                    <li key={a.title} className="cv1-list-row" title={a.detail}>
                      {a.title}
                      {a.note ? <span className="cv1-note"> ({a.note})</span> : null}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  data-variant
                  className="cv1-panel-btn"
                  onClick={() => setAgreementsOpen(true)}
                >
                  Vaata ja kinnita kokkulepped
                </button>
              </section>
              <section className="cv1-panel" ref={settingsRef}>
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Sessiooni seaded</h2>
                  <span className="cv1-panel-meta" data-done={settingsConfirmed ? "1" : "0"}>
                    {settingsConfirmed ? "Kinnitatud" : "Kinnitamata"}
                  </span>
                </header>
                <dl className="cv1-settings">
                  {SESSION_SETTINGS.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                {view === "jaanika" ? (
                  <button
                    type="button"
                    data-variant
                    className="cv1-panel-btn"
                    disabled={settingsConfirmed || !sessionStarted}
                    title={!sessionStarted ? "Kinnitused avanevad pärast kohtumise algust" : undefined}
                    onClick={() => setSettingsConfirmed(true)}
                  >
                    {settingsConfirmed ? "Seaded kinnitatud" : "Kinnita sessiooni seaded"}
                  </button>
                ) : (
                  <p className="cv1-quiet">Seadeid kinnitab sessiooni juht.</p>
                )}
              </section>
            </div>
          </div>

          {/* All: valmisoleku riba (§20) + värav (§21) */}
          <footer className="cv1-bottom">
            <ul className="cv1-status">
              <li>
                <button type="button" onClick={() => scrollTo(peopleRef)}>
                  <span className="cv1-status-k">Osalejad</span>
                  <span className="cv1-status-v">
                    {total}/{total} kohal · {readyCount}/{total} valmis · kvoorum täidetud
                  </span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(peopleRef)}>
                  <span className="cv1-status-k">Rollid</span>
                  <span className="cv1-status-v">{roleCount}/{total} kinnitatud</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setAgreementsOpen(true)}>
                  <span className="cv1-status-k">Kokkulepped</span>
                  <span className="cv1-status-v">{agreedCount}/{total} kinnitanud</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(settingsRef)}>
                  <span className="cv1-status-k">Seaded</span>
                  <span className="cv1-status-v">{settingsConfirmed ? "Kinnitatud" : "Kinnitamata"}</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(heroRef)}>
                  <span className="cv1-status-k">Tänane juhtum</span>
                  <span className="cv1-status-v">{caseConfirmed ? "Kinnitatud" : "Kinnitamata"}</span>
                </button>
              </li>
            </ul>
            <div className="cv1-gate">
              {view === "jaanika" ? (
                <button
                  type="button"
                  data-variant="primary"
                  className="cv1-acc cv1-gate-btn"
                  disabled={missing.length > 0}
                  onClick={advance}
                >
                  Ava juhtum
                </button>
              ) : null}
              <p className="cv1-gate-hint" data-ok={missing.length === 0 ? "1" : "0"}>
                {view !== "jaanika" && missing.length === 0
                  ? "Grupp on valmis. Sessiooni juht avab juhtumi."
                  : gateHint}
              </p>
            </div>
          </footer>

          {/* Demo-vaatevahetaja (§29.5: üks vaade = üks roll) */}
          <div className="cv1-view" role="group" aria-label="Demo vaade">
            <span className="cv1-view-label">Demo vaade</span>
            {DEMO_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                data-variant
                data-selected={view === v.id ? "true" : undefined}
                className="cv1-view-btn"
                onClick={() => switchView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Kihid: kokkulepped, teemaseemne üldistus, rollipõhine tugi */}
          {agreementsOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Kokkulepete kinnitamine">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Meie kokkulepped</h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setAgreementsOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <ul className="cv1-layer-list">
                  {AGREEMENTS.map((a) => (
                    <li key={a.title}>
                      <p className="cv1-layer-item-title">
                        {a.title}
                        {a.note ? <span className="cv1-note"> ({a.note})</span> : null}
                      </p>
                      <p className="cv1-layer-item-detail">{a.detail}</p>
                    </li>
                  ))}
                </ul>
                <p className="cv1-quiet">
                  Andmerežiim: detailne töömaterjal on ajutine; heli ja videot ei salvestata.
                </p>
                <button
                  type="button"
                  data-variant="primary"
                  className="cv1-acc"
                  disabled={my.agreed || !sessionStarted}
                  title={!sessionStarted ? "Kinnitused avanevad pärast kohtumise algust" : undefined}
                  onClick={() => mark(view, { agreed: true })}
                >
                  {my.agreed ? "Kinnitatud" : "Mõistan ja kinnitan"}
                </button>
                <ul className="cv1-people-state" aria-label="Kes on kinnitanud">
                  {DEMO_PARTICIPANTS.map((p) => (
                    <li key={p.id} data-done={pState[p.id].agreed ? "1" : "0"}>
                      {p.name.split(" ")[0]} · {pState[p.id].agreed ? "kinnitanud" : "ootab"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {heroDetailOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Teemaseemne üldistus">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Teemaseemne üldistus</h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setHeroDetailOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <dl className="cv1-settings">
                  <div><dt>Pealkiri</dt><dd>{DEMO_CASE.title}</dd></div>
                  <div><dt>Juhtumi tooja</dt><dd>{DEMO_CASE.owner}</dd></div>
                  <div><dt>Kontekst</dt><dd>{DEMO_CASE.context}</dd></div>
                  <div><dt>Juhtumi liik</dt><dd>{DEMO_CASE.kind}</dd></div>
                  <div><dt>Põhiteemad</dt><dd>{DEMO_CASE.themes}</dd></div>
                  <div><dt>Olulisus</dt><dd>{DEMO_CASE.importance}</dd></div>
                  <div><dt>Oodanud</dt><dd>{DEMO_CASE.waited}</dd></div>
                  <div><dt>Varasem järelvaade</dt><dd>puudub</dd></div>
                </dl>
                <p className="cv1-quiet">
                  Detailne ettevalmistus jääb juhtumi toojale privaatseks.
                </p>
              </div>
            </div>
          ) : null}

          {supportOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Etapi tugi">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">
                    {(ROLE_SUPPORT[view] || ROLE_SUPPORT.default).title}
                  </h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setSupportOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <p className="cv1-quiet">
                  Kinnitame enne juhtumi avamist ühise raami. Juhtumi detailne
                  lugu algab järgmises etapis.
                </p>
                <ol className="cv1-support-list">
                  {(ROLE_SUPPORT[view] || ROLE_SUPPORT.default).rows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </section>
      ) : stage === 2 ? (
        <section className="cv1 cv2" aria-label="2. etapp — juhtumi avamine ja ühise pildi loomine">
          {/* Päis: sama kroom mis 1. etapil, rada näitab 2. aktiivsena */}
          <header className="cv1-top">
            <div className="cv1-brand">
              <button
                type="button"
                className="cv1-exit"
                title="Välju ruumist"
                onClick={() => window.history.back()}
              >
                ← Välju
              </button>
              <div>
                <p className="cv1-brand-name">Kovisioon</p>
                <p className="cv1-brand-sub">Koos mõtestame. Koos leiame võimalusi.</p>
              </div>
            </div>
            <ol className="cv1-rail" aria-label="Kovisiooni etapid">
              {STAGES.map((s, i) => (
                <li
                  key={s.title}
                  className="cv1-step"
                  data-state={i + 1 === 2 ? "active" : i + 1 < 2 ? "done" : "todo"}
                  aria-current={i + 1 === 2 ? "step" : undefined}
                >
                  <span className="cv1-step-dot">{i + 1 < 2 ? "✓" : i + 1}</span>
                  <span className="cv1-step-label">{s.title}</span>
                </li>
              ))}
            </ol>
            <div className="cv1-tools">
              <div className="cv1-chip">
                <span className="cv1-chip-label">Kohtumine</span>
                <span className="cv1-chip-value">{formatTime(meetingElapsed)}</span>
              </div>
              <div className="cv1-chip">
                <span className="cv1-chip-label">
                  {s2Phase === "sharing" ? "Lugu" : s2Phase === "review" ? "Ülevaatus" : "Etapp 2"}
                </span>
                <span className="cv1-chip-value">
                  {s2Phase === "sharing"
                    ? `${formatTime(Math.max(0, elapsed - shareStart))} / 10:00`
                    : s2Phase === "review"
                      ? `${formatTime(Math.max(0, elapsed - reviewStart))} / 05:00`
                      : "Valmis loo jagamiseks"}
                </span>
              </div>
              <button
                type="button"
                data-variant
                aria-pressed={paused}
                onClick={() => setPaused((v) => !v)}
              >
                {paused ? "Jätka" : "Paus"}
              </button>
              <button
                type="button"
                data-variant
                aria-expanded={supportOpen}
                onClick={() => setSupportOpen((v) => !v)}
              >
                Vajan tuge
              </button>
            </div>
          </header>

          <div className="cv1-main">
            {/* Vasak: aktiivsed rollid (§15.3 — kokku volditud nimekiri) */}
            <aside className="cv1-panel cv1-left">
              <header className="cv1-panel-head">
                <h2 className="cv1-panel-title">Aktiivsed rollid</h2>
              </header>
              <ul className="cv1-people">
                {DEMO_PARTICIPANTS.slice(0, 3).map((p) => (
                  <li key={p.id} className="cv1-person" data-me={p.id === view ? "1" : "0"}>
                    <span className="cv1-avatar" aria-hidden="true">
                      {p.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <span className="cv1-person-main">
                      <span className="cv1-person-name">
                        {p.name}
                        {p.id === view ? <span className="cv1-me-tag"> (sina)</span> : null}
                      </span>
                      <span className="cv1-role-chip" data-role={p.role}>{p.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="cv1-quiet">Osalejad — 3 kuulamisrežiimis</p>
              <p className="cv2-phase" role="status">
                {s2Phase === "ready"
                  ? "Valmis loo jagamiseks"
                  : s2Phase === "sharing"
                    ? "Aktiivne kõneleja: Mari Mets · jagab lugu"
                    : "Loo jagamine lõpetatud · Mari vaatab ühist pilti üle"}
              </p>
            </aside>

            {/* Keskel: juhtumi tuum + ankrud + seosed + tööfookus */}
            <section className="cv2-center">
              <div className="cv1-hero cv2-core" ref={heroRef}>
                <p className="cv1-hero-kicker">Tänane juhtum</p>
                {/* Pealkiri on 1. etapi hetktõmmisega IDENTNE (§42.9) */}
                <h1 className="cv1-hero-title">{DEMO_CASE.title}</h1>
                <p className="cv2-worklabel">Juhtumi tooja kirjeldus — tööversioon</p>
                <div className="cv1-hero-chips">
                  <div className="cv1-hero-fact">
                    <span className="cv1-fact-label">Juhtumi tooja</span>
                    <span className="cv1-fact-value">{DEMO_CASE.owner}</span>
                  </div>
                  <div className="cv1-hero-fact">
                    <span className="cv1-fact-label">Kontekst</span>
                    <span className="cv1-fact-value">{DEMO_CASE.context}</span>
                  </div>
                  <div className="cv1-hero-fact">
                    <span className="cv1-fact-label">Miks praegu?</span>
                    <span className="cv1-fact-value">{DEMO_CASE.whyNow}</span>
                  </div>
                </div>

                {/* Juhtumi tooja loo-toimingud (§29.5: ainult tema vaates) */}
                {view === "mari" && s2Phase === "ready" ? (
                  <div className="cv2-actions">
                    <button type="button" data-variant="primary" className="cv1-acc" onClick={startSharing}>
                      Alusta loo jagamist
                    </button>
                    <button type="button" data-variant onClick={() => setPrepOpen(true)}>
                      Minu ettevalmistus
                    </button>
                  </div>
                ) : view === "mari" && s2Phase === "sharing" ? (
                  <div className="cv2-actions">
                    <button type="button" data-variant="primary" className="cv1-acc" onClick={finishSharing}>
                      Lõpeta loo jagamine
                    </button>
                    <button type="button" data-variant onClick={() => setPaused(true)}>
                      Vajan hetke
                    </button>
                  </div>
                ) : null}

                {/* Ühise pildi kinnitus (§28.5) */}
                {s2Phase === "review" ? (
                  pictureConfirmed ? (
                    <p className="cv1-case-state" data-done="1">
                      ✓ Juhtumi tooja kinnitas ühise pildi
                    </p>
                  ) : view === "mari" ? (
                    <div className="cv1-case-confirm">
                      <div>
                        <p className="cv1-case-title">Ühine pilt vastab minu loole</p>
                        <p className="cv1-case-sub">
                          Kinnitad, et kaart peegeldab sinu praegust kirjeldust
                          piisavalt. See ei tähenda, et kõik väited on lõplikult
                          kontrollitud.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-variant="primary"
                        className="cv1-acc"
                        onClick={() => setPictureConfirmed(true)}
                      >
                        Kinnitan
                      </button>
                    </div>
                  ) : (
                    <p className="cv1-case-state">Ühine pilt · ootab Mari kinnitust</p>
                  )
                ) : null}
              </div>

              {/* Ankrud allikasiltidega (§20 + §22) */}
              {anchorCount > 0 ? (
                <ul className="cv2-anchors" aria-label="Ühise pildi ankrud">
                  {S2_ANCHORS.slice(0, anchorCount).map((a) => {
                    const flagged = investigate.has(a.id);
                    const editable = view === "mari" && s2Phase === "review";
                    const Tag = editable ? "button" : "div";
                    return (
                      <li key={a.id}>
                        <Tag
                          {...(editable ? { type: "button", onClick: () => toggleInvestigate(a.id), title: "Klõps lülitab märke „vajab uurimist”" } : {})}
                          className="cv2-anchor"
                          data-investigate={flagged ? "1" : "0"}
                        >
                          <span className="cv2-anchor-type">
                            {a.type}
                            {flagged ? " — vajab uurimist" : ""}
                          </span>
                          <span className="cv2-anchor-text">{a.text}</span>
                          <span className="cv2-anchor-source">allikas: {a.source}</span>
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="cv1-quiet cv2-empty">
                  Ühine pilt tekib loo ajal — kaardi haldaja lisab kuni 7 ankrut.
                </p>
              )}

              {/* Nimetatud seosed (§24.1) — ilmuvad ülevaatuses */}
              {s2Phase === "review" ? (
                <div className="cv2-links">
                  <span className="cv2-links-label">Nimetatud seosed</span>
                  <ul>
                    {S2_LINKS.map((l) => {
                      const from = S2_ANCHORS.find((x) => x.id === l.a)?.type;
                      const to = S2_ANCHORS.find((x) => x.id === l.b)?.type;
                      return (
                        <li key={`${l.a}-${l.b}`} data-sure={l.sure ? "1" : "0"}>
                          {from} → {to} · <em>{l.rel}</em>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {/* Tööfookus (§31) — tuuma all, tegutseja nähtav */}
              {s2Phase === "review" ? (
                <div className="cv2-focus" data-state={focusStatus}>
                  <span className="cv2-focus-label">Tööfookus</span>
                  {focusStatus === "none" ? (
                    view === "mari" ? (
                      <button
                        type="button"
                        data-variant
                        className="cv1-mini-btn"
                        onClick={() => {
                          setFocusDraft(focusQuestion);
                          setFocusOpen(true);
                        }}
                      >
                        Sõnasta tööfookus
                      </button>
                    ) : (
                      <span className="cv2-focus-wait">Ootab Mari sõnastust</span>
                    )
                  ) : (
                    <>
                      <span className="cv2-focus-text">{focusQuestion}</span>
                      <span className="cv2-focus-state">
                        {focusStatus === "confirmed" ? "Kinnitatud" : "Täpsustub 3. etapi lõpus"}
                      </span>
                    </>
                  )}
                </div>
              ) : null}
            </section>

            {/* Parem: etapi juhis + rollide vastutused (§42.8) */}
            <div className="cv1-right">
              <section className="cv1-panel">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Etapi juhis</h2>
                </header>
                <p className="cv2-guide">
                  {s2Phase === "review"
                    ? "Juhtumi tooja vaatab koos kaardi haldajaga ühise pildi üle. Teised ei küsi, tõlgenda ega lahenda veel."
                    : "Juhtumi tooja räägib oma loo. Teised kuulavad ega küsi, tõlgenda või lahenda veel."}
                </p>
                {s2Phase !== "review" ? (
                  <p className="cv1-quiet">Ühise pildi loomine: ankrud loo ajal</p>
                ) : null}
              </section>
              <section className="cv1-panel">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Rollide vastutused</h2>
                </header>
                <ul className="cv2-duties">
                  <li data-done={pictureConfirmed ? "1" : "0"}>
                    <span>Mari kinnitab ühise pildi</span>
                    <span>
                      {pictureConfirmed
                        ? "✓ Kinnitatud"
                        : s2Phase === "review"
                          ? "Ootab Mari kinnitust"
                          : "Pärast lugu"}
                    </span>
                  </li>
                  <li data-done={privacyChecked ? "1" : "0"}>
                    <span>Liisa kontrollib sõnastust ja privaatsust</span>
                    <span>
                      {privacyChecked
                        ? "✓ Üle vaadatud"
                        : s2Phase === "review"
                          ? "Liisa vaatab üle"
                          : "Pärast lugu"}
                    </span>
                  </li>
                  <li data-done={focusStatus !== "none" ? "1" : "0"}>
                    <span>Mari sõnastab tööfookuse</span>
                    <span>
                      {focusStatus !== "none"
                        ? "✓ Sõnastatud"
                        : s2Phase === "review"
                          ? "Ootab Mari sõnastust"
                          : "Pärast ülevaatust"}
                    </span>
                  </li>
                  <li data-done={s2Missing.length === 0 ? "1" : "0"}>
                    <span>Jaanika avab järgmise etapi</span>
                    <span>{s2Missing.length === 0 ? "Valmis" : "Ootab tingimusi"}</span>
                  </li>
                </ul>
                {/* Kaardi haldaja toiming (§28.4) — ainult tema vaates */}
                {view === "liisa" && s2Phase === "review" && !privacyChecked ? (
                  <button
                    type="button"
                    data-variant
                    className="cv1-panel-btn"
                    onClick={() => setPrivacyChecked(true)}
                  >
                    Sõnastus ja privaatsus üle vaadatud
                  </button>
                ) : null}
              </section>
            </div>
          </div>

          {/* All: üks õhuke värav (§42.8) */}
          <footer className="cv1-bottom cv2-gatebar">
            <p className="cv1-gate-hint cv2-gate-hint" data-ok={s2Missing.length === 0 ? "1" : "0"}>
              {view !== "jaanika" && s2Missing.length === 0
                ? "Grupp on valmis. Sessiooni juht avab uurimise."
                : s2GateHint}
            </p>
            {view === "jaanika" ? (
              <button
                type="button"
                data-variant="primary"
                className="cv1-acc cv1-gate-btn"
                disabled={s2Missing.length > 0}
                onClick={advance}
              >
                Liigu uurimisse
              </button>
            ) : null}
          </footer>

          {/* Demo-vaatevahetaja (§42.7: üks vaade = üks roll) */}
          <div className="cv1-view" role="group" aria-label="Demo vaade">
            <span className="cv1-view-label">Demo vaade</span>
            {DEMO_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                data-variant
                data-selected={view === v.id ? "true" : undefined}
                className="cv1-view-btn"
                onClick={() => switchView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Kihid: rollipõhine tugi, Kovisioonipakk, tööfookuse sõnastus */}
          {supportOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Etapi tugi">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">
                    {(ROLE_SUPPORT2[view] || ROLE_SUPPORT2.default).title}
                  </h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setSupportOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <p className="cv1-quiet">
                  Juhtumi tooja räägib. Teised kuulavad ega küsi, tõlgenda või
                  lahenda veel.
                </p>
                <ol className="cv1-support-list">
                  {(ROLE_SUPPORT2[view] || ROLE_SUPPORT2.default).rows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}

          {prepOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Minu ettevalmistus">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Minu ettevalmistus · privaatne</h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setPrepOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <ul className="cv1-layer-list">
                  {S2_PREP.map((p) => (
                    <li key={p.title}>
                      <p className="cv1-layer-item-title">{p.title}</p>
                      <p className="cv1-layer-item-detail">
                        {p.state === "jagamiskandidaat"
                          ? "Jagamiskandidaat — saad loo käigus teadlikult jagada."
                          : "Privaatne — nähtav ainult sulle."}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="cv1-quiet">
                  Mitte midagi privaatset ei jagata automaatselt (§17.3).
                </p>
              </div>
            </div>
          ) : null}

          {focusOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Tööfookuse sõnastamine">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Sõnasta tööfookus</h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setFocusOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <p className="cv1-quiet">
                  Mida sina professionaalina tahad selle grupi abil mõista,
                  uurida või otsustada? Fookus jääb sinu mõjuvälja — kovisioon
                  ei lahenda inimese elu tema eest.
                </p>
                <textarea
                  className="cvs-focus-input cv2-focus-input"
                  rows={3}
                  placeholder="Kuidas…?"
                  value={focusDraft}
                  onChange={(e) => setFocusDraft(e.target.value)}
                />
                {focusDraft.trim() && !/^kuidas/i.test(focusDraft.trim()) ? (
                  <p className="cvs-focus-hint" data-tone="warn">
                    Soovituslik algus on „Kuidas…?” — see hoiab fookuse avatuna
                    ja sinu mõjuväljas.
                  </p>
                ) : null}
                <div className="cv2-focus-btns">
                  <button
                    type="button"
                    data-variant="primary"
                    className="cv1-acc"
                    disabled={focusDraft.trim().length < 5}
                    onClick={() => confirmFocus("confirmed")}
                  >
                    Kinnitan tööfookuse
                  </button>
                  <button
                    type="button"
                    data-variant
                    disabled={focusDraft.trim().length < 5}
                    onClick={() => confirmFocus("temp")}
                  >
                    Täpsustan pärast uurimist
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : stage === 3 ? (
        <section className="cv1 cv3" aria-label="3. etapp — juhtumi uurimine">
          {/* Päis: sama kroom; rada näitab 3. aktiivsena */}
          <header className="cv1-top">
            <div className="cv1-brand">
              <button
                type="button"
                className="cv1-exit"
                title="Välju ruumist"
                onClick={() => window.history.back()}
              >
                ← Välju
              </button>
              <div>
                <p className="cv1-brand-name">Kovisioon</p>
                <p className="cv1-brand-sub">Koos mõtestame. Koos leiame võimalusi.</p>
              </div>
            </div>
            <ol className="cv1-rail" aria-label="Kovisiooni etapid">
              {STAGES.map((s, i) => (
                <li
                  key={s.title}
                  className="cv1-step"
                  data-state={i + 1 === 3 ? "active" : i + 1 < 3 ? "done" : "todo"}
                  aria-current={i + 1 === 3 ? "step" : undefined}
                >
                  <span className="cv1-step-dot">{i + 1 < 3 ? "✓" : i + 1}</span>
                  <span className="cv1-step-label">{s.title}</span>
                </li>
              ))}
            </ol>
            <div className="cv1-tools">
              <div className="cv1-chip">
                <span className="cv1-chip-label">Kohtumine</span>
                <span className="cv1-chip-value">{formatTime(meetingElapsed)}</span>
              </div>
              <div className="cv1-chip">
                <span className="cv1-chip-label">
                  {s3Phase === "prep" ? "Vaikne ettevalmistus" : s3Phase === "round" ? "Uurimine" : "Etapp 3"}
                </span>
                <span className="cv1-chip-value">
                  {s3Phase === "prep"
                    ? `${formatTime(Math.max(0, elapsed - prepStart))} / 03:00`
                    : s3Phase === "round"
                      ? `${formatTime(Math.max(0, elapsed - roundStart))} / 15:00`
                      : "Uurimisplaan"}
                </span>
              </div>
              <button
                type="button"
                data-variant
                aria-pressed={paused}
                onClick={() => setPaused((v) => !v)}
              >
                {paused ? "Jätka" : "Paus"}
              </button>
              <button
                type="button"
                data-variant
                aria-expanded={supportOpen}
                onClick={() => setSupportOpen((v) => !v)}
              >
                Vajan tuge
              </button>
            </div>
          </header>

          {/* Kompaktne juhtumi + tööfookuse ankruriba (§51.10) */}
          <p className="cv3-anchorbar">
            <strong>{DEMO_CASE.title}</strong>
            <span> · Fookus: {focusQuestion.trim() || "täpsustub uurimise lõpus"}</span>
          </p>

          <div className="cv1-main">
            {/* Vasak: rollid + protsessi olek */}
            <aside className="cv1-panel cv1-left">
              <header className="cv1-panel-head">
                <h2 className="cv1-panel-title">Sessiooni rollid</h2>
              </header>
              <ul className="cv1-people">
                {DEMO_PARTICIPANTS.slice(0, 3).map((p) => (
                  <li key={p.id} className="cv1-person" data-me={p.id === view ? "1" : "0"}>
                    <span className="cv1-avatar" aria-hidden="true">
                      {p.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <span className="cv1-person-main">
                      <span className="cv1-person-name">
                        {p.name}
                        {p.id === view ? <span className="cv1-me-tag"> (sina)</span> : null}
                      </span>
                      <span className="cv1-role-chip" data-role={p.role}>{p.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="cv2-phase" role="status">
                {s3Phase === "plan"
                  ? "Uurimisplaan · Mari valitud kohad on kinnitatud"
                  : s3Phase === "prep"
                    ? "Vaikne ettevalmistus käib · küsimused on privaatsed"
                    : `Vaikne ettevalmistus lõpetatud · ${queuedQs.length} küsimust järjekorras · Teiste küsimused on kaetud`}
              </p>
            </aside>

            {/* Keskel: uurimiskohad + faasi hero */}
            <section className="cv2-center">
              {/* Uurimiskohad olekutega — need on interaktiivne kaart,
                  parem paneel EI dubleeri neid (§51.9) */}
              <ul className="cv3-sites" aria-label="Uurimiskohad">
                {S3_SITES.map((site) => {
                  const st = siteStatus(site.id);
                  return (
                    <li
                      key={site.id}
                      className="cv3-site"
                      data-state={st === "Uurime" ? "active" : st === "Täpsustatud" ? "done" : "todo"}
                      title={site.plan}
                    >
                      <span className="cv3-site-label">{site.label}</span>
                      <span className="cv3-site-state">{st}</span>
                    </li>
                  );
                })}
              </ul>

              {s3Phase === "plan" ? (
                /* Uurimisplaani kiht (§12–13) */
                <div className="cv1-hero cv3-hero">
                  <p className="cv1-hero-kicker">Mida on vaja uurida?</p>
                  <p className="cv2-worklabel">Mari valitud uurimiskohad — kandidaadid, mitte järeldused</p>
                  <ol className="cv3-plan">
                    {S3_SITES.map((site) => (
                      <li key={site.id}>
                        <strong>{site.label}.</strong> {site.plan}
                      </li>
                    ))}
                  </ol>
                  {view === "jaanika" ? (
                    <div className="cv2-actions">
                      <button type="button" data-variant="primary" className="cv1-acc" onClick={startPrep}>
                        Alusta uurimist
                      </button>
                    </div>
                  ) : (
                    <p className="cv1-case-state">Sessiooni juht avab uurimise.</p>
                  )}
                </div>
              ) : s3Phase === "prep" ? (
                /* Vaikne ettevalmistus (§16): grupiliige kirjutab oma
                   küsimuse privaatselt; teised ootavad rahus */
                <div className="cv1-hero cv3-hero">
                  <p className="cv1-hero-kicker">Vaikne ettevalmistus</p>
                  {view === "aveli" ? (
                    <>
                      <p className="cv2-worklabel">
                        Sinu küsimus on privaatne, kuni sessiooni juht avab vooru.
                      </p>
                      <textarea
                        className="cvs-focus-input cv2-focus-input"
                        rows={3}
                        placeholder="Kirjuta oma küsimus…"
                        value={myQuestion}
                        onChange={(e) => setMyQuestion(e.target.value)}
                      />
                      {myQuestionHint ? (
                        <p className="cvs-focus-hint" data-tone={myQuestionHint.tone}>
                          {myQuestionHint.text}
                        </p>
                      ) : null}
                      <p className="cv1-quiet">
                        Kompassist (paremal) saad tuua küsimuse alguse ja kohandada
                        selle juhtumile.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="cv2-worklabel">
                        Osalejad kirjutavad küsimusi privaatselt. Teiste küsimused
                        on kaetud.
                      </p>
                      {view === "jaanika" ? (
                        <div className="cv2-actions">
                          <button type="button" data-variant="primary" className="cv1-acc" onClick={startRound}>
                            Lõpeta vaikne ettevalmistus
                          </button>
                        </div>
                      ) : (
                        <p className="cv1-case-state">Kirjutamine käib · vaikus on osa protsessist.</p>
                      )}
                    </>
                  )}
                </div>
              ) : activeQ ? (
                /* Aktiivne küsimus — etapi HERO (§51.10) */
                <div className="cv1-hero cv3-hero cv3-qhero">
                  <div className="cv1-hero-toprow">
                    <p className="cv1-hero-kicker">Aktiivne küsimus</p>
                    {view === "jaanika" ? (
                      <span className="cv3-qduration">Küsimus · {formatTime(Math.max(0, elapsed - aTick))}</span>
                    ) : null}
                  </div>
                  <h1 className="cv1-hero-title cv3-qtext">{activeQ.text}</h1>
                  <p className="cv3-qmeta">
                    Küsib: <strong>{activeQ.byName}</strong> · {activeQ.byRole}
                    <span> · Seotud uurimiskoht: {S3_SITES.find((s) => s.id === activeQ.site)?.label}</span>
                  </p>
                  <p className="cv3-astate" data-state={aState}>
                    {aState === "opened"
                      ? "Küsija loeb küsimuse ette."
                      : aState === "answering"
                        ? "Mari vastab häälega."
                        : "Vastatud · ootab küsija kinnitust."}
                  </p>

                  {/* Rollipõhised toimingud (§51.8) */}
                  {view === "jaanika" ? (
                    <div className="cv2-actions">
                      {aState === "opened" ? (
                        <button
                          type="button"
                          data-variant="primary"
                          className="cv1-acc"
                          onClick={() => {
                            setAState("answering");
                            setATick(elapsed);
                          }}
                        >
                          Anna sõna Marile
                        </button>
                      ) : null}
                      <button type="button" data-variant onClick={() => closeActiveQ("Pargitud")}>
                        Pargi küsimus
                      </button>
                      <button type="button" data-variant onClick={() => closeActiveQ("Suletud")}>
                        Sulge küsimus
                      </button>
                    </div>
                  ) : view === "mari" && aState === "answering" ? (
                    <div className="cv2-actions">
                      <button
                        type="button"
                        data-variant="primary"
                        className="cv1-acc"
                        onClick={() => {
                          setAState("answered");
                          setATick(elapsed);
                        }}
                      >
                        Vastasin
                      </button>
                      <button type="button" data-variant onClick={() => { setAState("opened"); setATick(elapsed); }}>
                        Palun täpsusta
                      </button>
                      <button type="button" data-variant onClick={() => closeActiveQ("Teadmata")}>
                        Ma ei tea veel
                      </button>
                      <button type="button" data-variant onClick={() => closeActiveQ("Ei jagata")}>
                        Ei soovi vastata
                      </button>
                      <button type="button" data-variant onClick={() => setPaused(true)}>
                        Vajan hetke
                      </button>
                    </div>
                  ) : view === activeQ.by && aState === "answered" ? (
                    <div className="cv2-actions">
                      <button
                        type="button"
                        data-variant="primary"
                        className="cv1-acc"
                        onClick={() => closeActiveQ("Vastatud")}
                      >
                        Aitäh, vastus on piisav
                      </button>
                    </div>
                  ) : (
                    <p className="cv1-quiet">Kuulame. Arutelu ei avane (§21.7).</p>
                  )}
                </div>
              ) : (
                /* Voor ilma aktiivse küsimuseta: järgmine küsimus või lõpetus */
                <div className="cv1-hero cv3-hero">
                  <p className="cv1-hero-kicker">
                    {queuedQs.length ? "Küsimuste voor" : "Uurimise lõpetamine"}
                  </p>
                  {queuedQs.length ? (
                    view === "jaanika" ? (
                      <div className="cv2-actions">
                        <button type="button" data-variant="primary" className="cv1-acc" onClick={openNextQ}>
                          Ava järgmine küsimus
                        </button>
                      </div>
                    ) : (
                      <p className="cv1-case-state">
                        Sessiooni juht avab järgmise küsimuse · {queuedQs.length} järjekorras.
                      </p>
                    )
                  ) : enough ? (
                    <>
                      <p className="cv1-case-state" data-done="1">
                        ✓ Mari kinnitas: olukorda on piisavalt uuritud
                      </p>
                      {focusStatus === "temp" ? (
                        view === "mari" ? (
                          <div className="cv2-actions">
                            <button
                              type="button"
                              data-variant="primary"
                              className="cv1-acc"
                              onClick={() => setFocusStatus("confirmed")}
                            >
                              Kinnitan uuritud tööfookuse
                            </button>
                          </div>
                        ) : (
                          <p className="cv1-case-state">Tööfookus · ootab Mari kinnitust</p>
                        )
                      ) : (
                        <p className="cv1-case-state" data-done="1">✓ Tööfookus kinnitatud</p>
                      )}
                    </>
                  ) : view === "mari" ? (
                    <div className="cv1-case-confirm">
                      <div>
                        <p className="cv1-case-title">Kas olukorda on sinu jaoks piisavalt uuritud?</p>
                        <p className="cv1-case-sub">
                          Kõiki lünki ei pea sulgema — teadmata võib jääda teadlikult avatuks.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-variant="primary"
                        className="cv1-acc"
                        onClick={() => setEnough(true)}
                      >
                        Minu jaoks on piisavalt uuritud
                      </button>
                    </div>
                  ) : (
                    <p className="cv1-case-state">Ootab Mari kinnitust: kas olukorda on piisavalt uuritud.</p>
                  )}
                </div>
              )}
            </section>

            {/* Parem: kompaktne plaan + järjekord + kompass (§51.9) */}
            <div className="cv1-right">
              <section className="cv1-panel">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Uurimisplaan</h2>
                  <span className="cv1-panel-meta">Mari kinnitatud</span>
                </header>
                <p className="cv2-guide">
                  {answeredSites.size}/{S3_SITES.length} käsil
                  {activeQ ? ` · Aktiivne: ${S3_SITES.find((s) => s.id === activeQ.site)?.label}` : ""}
                </p>
                <p className="cv1-quiet">Prioriteete muudab Mari koos Jaanikaga.</p>
              </section>
              <section className="cv1-panel">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">Järjekord</h2>
                </header>
                <p className="cv2-guide">
                  {activeQ
                    ? `Aktiivne küsimus · ${queuedQs.length} järjekorras`
                    : queuedQs.length
                      ? `${queuedQs.length} küsimust järjekorras`
                      : "Järjekord on tühi"}
                </p>
                <p className="cv1-quiet">
                  Suletud: {queue.filter((q) => q.status === "closed").length} · Pargitud:{" "}
                  {queue.filter((q) => q.status === "parked").length}
                </p>
              </section>
              {/* Kompass: sessiooni juhil suunad; grupiliikmel loomekihis (§51.8) */}
              {view === "jaanika" || (view === "aveli" && s3Phase === "prep") ? (
                <section className="cv1-panel">
                  <details className="cvs-details" open={view === "aveli" && s3Phase === "prep"}>
                    <summary className="cvs-details-summary">Küsimuste kompass</summary>
                    {view === "aveli" && s3Phase === "prep" ? (
                      COMPASS.filter((d) => !d.gated).map((dir) => (
                        <details key={dir.key} className="cvs-details cvs-compass-dir">
                          <summary className="cvs-details-summary">{dir.name}</summary>
                          <ul className="cvs-compass-list">
                            {dir.questions.map((q) => (
                              <li key={q}>
                                <button
                                  type="button"
                                  className="cvs-compass-q"
                                  onClick={() => setMyQuestion(q)}
                                >
                                  {q}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ))
                    ) : (
                      <ul className="cv1-list">
                        {COMPASS.map((dir) => (
                          <li key={dir.key} className="cv1-list-row">{dir.name}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                  {view === "aveli" && s3Phase === "prep" ? (
                    <p className="cv1-quiet">Klõps toob küsimuse sinu väljale — kohanda see juhtumile.</p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>

          {/* All: õhuke värav (§43–44) */}
          <footer className="cv1-bottom cv2-gatebar">
            <p className="cv1-gate-hint cv2-gate-hint" data-ok={s3Missing.length === 0 ? "1" : "0"}>
              {s3Phase === "round" && activeQ
                ? `Uurimine pooleli · Aktiivne küsimus ootab vastust · ${queuedQs.length} küsimust järjekorras`
                : view !== "jaanika" && s3Missing.length === 0
                  ? "Grupp on valmis. Sessiooni juht avab mõistmise süvendamise."
                  : s3GateHint}
            </p>
            {view === "jaanika" ? (
              <button
                type="button"
                data-variant="primary"
                className="cv1-acc cv1-gate-btn"
                disabled={s3Missing.length > 0}
                onClick={advance}
              >
                Liigu mõistmise süvendamisse
              </button>
            ) : null}
          </footer>

          {/* Demo-vaatevahetaja */}
          <div className="cv1-view" role="group" aria-label="Demo vaade">
            <span className="cv1-view-label">Demo vaade</span>
            {DEMO_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                data-variant
                data-selected={view === v.id ? "true" : undefined}
                className="cv1-view-btn"
                onClick={() => switchView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Rollipõhine tugi */}
          {supportOpen ? (
            <div className="cv1-layer" role="dialog" aria-modal="true" aria-label="Etapi tugi">
              <div className="cv1-layer-card">
                <header className="cv1-panel-head">
                  <h2 className="cv1-panel-title">
                    {(ROLE_SUPPORT3[view] || ROLE_SUPPORT3.default).title}
                  </h2>
                  <button
                    type="button"
                    data-variant
                    className="cv1-mini-btn"
                    onClick={() => setSupportOpen(false)}
                  >
                    Sulge
                  </button>
                </header>
                <p className="cv1-quiet">
                  Uurime lünki ja puuduvaid vaatenurki. Küsimused aitavad mõista,
                  mitte soovitada.
                </p>
                <ol className="cv1-support-list">
                  {(ROLE_SUPPORT3[view] || ROLE_SUPPORT3.default).rows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        /* Etapid 4–8: platseholder kuni ehitame */
        <div className="cvs-placeholder">
          <p className="cvs-stage-kicker">{stage}. etapp</p>
          <h2 className="cvs-stage-title">{stageMeta.title}</h2>
          <p className="cvs-stage-lead">See etapp on ehitamisel.</p>
        </div>
      )}

      {stage > 3 && supportOpen && support ? (
        <section className="cvs-support" aria-label="Etapi tugi">
          <h3 className="cvs-cell-title">{support.title}</h3>
          <ol className="cvs-support-list">
            {support.rows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {stage > 3 ? (
      <footer className="cvs-actions">
        {stage > 1 ? (
          <button type="button" data-variant onClick={back}>
            Eelmine etapp
          </button>
        ) : null}
        {support ? (
          <button
            type="button"
            data-variant
            aria-expanded={supportOpen}
            onClick={() => setSupportOpen((v) => !v)}
          >
            Vajan tuge
          </button>
        ) : null}
        {stage < STAGES.length ? (
          <button type="button" data-variant="primary" onClick={advance}>
            Järgmine etapp
          </button>
        ) : null}
      </footer>
      ) : null}


      {/* Pausikate: taimer seisab, ruum ootab */}
      {paused ? (
        <div className="cvs-pause-veil" role="status">
          <p className="cvs-pause-title">Paus</p>
          <p className="cvs-pause-text">Jätkame, kui kõik on valmis.</p>
          <button type="button" data-variant="primary" onClick={() => setPaused(false)}>
            Jätka
          </button>
        </div>
      ) : null}
    </div>
  );
}
