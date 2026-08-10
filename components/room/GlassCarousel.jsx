"use client";

/**
 * GlassCarousel — mattklaasist paneelide karussell (brief §7, pilt 8/11).
 *
 * Ringjas: fookuspaneel keskel, üks külgmine kummalgi pool nähtav,
 * ülejäänud rea peidus. Pööramine: nooleklahvid ja hiirerullik (terve
 * ekraani ulatuses, kui kaardid on avatud), servanupud, lohistus,
 * svaip. Klikk/Enter avab keskmise; klikk külgmisel pöörab keskele.
 * Üks 3D-tasand: perspective vanemal, kaardid otse selle all (iOS).
 *
 * SÜGAVUSLAUD (zones): töölaud ja tööheaolu EI ole karussell ega
 * lehitsetav riiul, vaid ruumis taanduv pind. Kaardid seisavad astmetel
 * (tsoonidel), lähim aste all, kaugem taga — kõik korraga nähtavad.
 * Vt WORKSPACE_ZONES (RoomStage) ja .gc-desk (carousel.css).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IconButton from "@/components/glass/IconButton";
import GlassCard from "@/components/glass/GlassCard";
import ChevronIcon from "@/components/brand/icons/ChevronIcon";
import RoleViewSwitcher from "@/components/workspace/RoleViewSwitcher";

/* Sama brauserivaate eluea jooksul hoitav kiire mälu. sessionStorage on
   endiselt püsiv varuvariant (F5 ja route-remount), kuid seda saab lugeda
   alles pärast esimest renderit. See kaart võimaldab tavalisel
   peamenüü ↔ profiil navigeerimisel õige keskkaardi valida juba komponendi
   ESIMESEL renderil — ekraanile ei teki hetkeks kahte eri valguskeset. */
const carouselPositionMemory = new Map();
let hasMountedRoomCarousel = false;

const wrapPos = (i, active, n) => {
  let pos = (((i - active) % n) + n) % n;
  if (pos > n / 2) pos -= n;
  return pos;
};

export default function GlassCarousel({
  items,
  backItem = null,
  initialKey,
  onSelect,
  onRoleChanged = null,
  t,
  setKey = null,
  forceInitial = false,
  visible = 3,
  zones = null,
  /* Ruumi toiteseis (RoomStage `power`): "standby" | "igniting" | "on".
     Karussell ei juhi seda, kuid peab teadma, kas ta tekkis PÕLEVASSE
     ruumi (siis on tegu komplektivahetusega) või käivitusrituaali sisse. */
  roomPower = "on",
  /* Ainult dokk, ilma kaartideta: avatud akna all püsiv kiirmenüü
     (omanik 26.07). Sama komponent, sest dokk EI TOHI olla teine
     komponent oma koopiaga — otseteede, tagasi-noole ja tooltip'ide
     loogika on üks ja seesama. */
  dockOnly = false,
  /* Dokirežiimis: parajasti avatud leht (silt + ikoon). null = ei tuvastatud,
     siis jääb dokki ainult tagasi-nool. */
  currentItem = null,
  /* Dokirežiimis: lehe info-lüliti lehe nime kõrval ({label, icon, active}).
     null = sellel lehel infot ei ole. */
  infoItem = null,
}) {
  const n = items.length;

  /* Esimene karussell kuulub ruumi käivituslavastusse. Iga järgmine mount
     PÕLEVAS ruumis on menüütaseme vahetus, mitte uus käivitus — neile
     annab CSS lühikese viiteta hajumise (gc-set-enter).

     Toiteseis on siin värav, mitte ilustus. `.room[data-power="on"]
     .gc[data-set-entry="1"] .gc-item` võidab spetsiifilisuses
     käivitusreeglit, seega kui märgis jääks ⏻-i ajaks külge, vahetuks
     900 ms pealt (igniting → on) animatsioon gc-ignite → gc-set-enter.
     Nimevahetus katkestab poolelioleva hajumise ja alustab uue nullist:
     kaardid sähvatavad korraks olematuks ja tulevad teist korda tagasi.
     Seepärast: märgise saab AINULT mount põlevasse ruumi, ja ooterežiim
     (või käivituse algus) kustutab ta. Kustutus on ohutu just seal —
     standby's ei kehti kummagi reegli animatsioon ja karussell on
     nähtamatu, seega vahetus ei saa midagi vilgutada. */
  const [isSetEntry, setIsSetEntry] = useState(
    () =>
      !dockOnly &&
      typeof window !== "undefined" &&
      hasMountedRoomCarousel &&
      roomPower === "on"
  );
  useEffect(() => {
    if (!dockOnly) hasMountedRoomCarousel = true;
  }, [dockOnly]);
  useEffect(() => {
    if (roomPower !== "on") setIsSetEntry(false);
  }, [roomPower]);

  /* Laiad paigutused: 5-kaardiline karussell või sügavuslaud (zones).
     Kitsas aknas kukub mõlemad tagasi kolme kaardiga karusselliks.
     SSR alustab 3-ga (deterministlik), laius mõõdetakse pärast
     hüdreerimist. */
  const hasZones = Array.isArray(zones) && zones.length > 0;
  const [wideEnough, setWideEnough] = useState(false);
  useEffect(() => {
    if ((!hasZones && visible !== 5) || typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(min-width: 1200px)");
    const update = () => setWideEnough(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [hasZones, visible]);
  const isDesk = hasZones && wideEnough;
  const shown = isDesk ? "desk" : visible === 5 && wideEnough && n >= 5 ? 5 : 3;
  const posLimit = shown === 5 ? 2.4 : 1.4;
  const hideBeyond = shown === 5 ? 2 : 1;

  /* ---------- Sügavuslaua astmed ----------
     Tsooni järjekord tuleb kutsujalt (lähim eespool); kaardi järjekord
     astme sees tuleb items-loendi järjekorrast. Tundmatu tsooniga kaart
     ei kao ära, vaid maandub viimasele astmele — laud ei tohi kaarti
     alla neelata ka siis, kui andmed on poolikud. */
  const zoneGroups = useMemo(() => {
    if (!hasZones) return [];
    const groups = zones.map((id) => ({ id, items: [] }));
    const byId = new Map(groups.map((g) => [g.id, g]));
    items.forEach((item) => {
      (byId.get(item.zone) || groups[groups.length - 1]).items.push(item);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [hasZones, zones, items]);

  /* Laua laiuse otsustab PIKIM aste: kaardid on kõigil astmetel ühes
     mõõdus, seega peab kaardilaiuse valem (carousel.css --gc-w) teadma,
     mitu kaarti kõige täiemasse ritta mahutada tuleb. Ilma selleta oleks
     see arv CSS-i sisse kirjutatud oletus, mis roll-lülituse (klient 4,
     spetsialist 5) järel vaikselt valeks läheb. */
  const deskCols = useMemo(
    () => zoneGroups.reduce((max, g) => Math.max(max, g.items.length), 1),
    [zoneGroups]
  );

  /* ASTE EI TÕUSE ENAM — EI HÕLJUMISE EGA VAJUTUSE PEALE (omanik 03.08:
     "terve rida tuleb suureks ja fookusesse, tahan seda, et ainult see
     kaart tuleb, millel on hiire hover").

     Mis siit ära läks ja miks seda tagasi ei tooda: 25.07 tõstis rida end
     esile kahel teel — hiir rea kohal (ooteajaga, et läbisõit ei jätaks
     jälge) ja doki silt. Mõlemad suubusid ühte `activeZone`-i, mis kasvatas
     valitud astet ja tuhmistas teisi. Tulemus oli, et üheainsa kaardi
     otsimine liigutas tervet maastikku: silm pidi iga hiireliigutuse järel
     uuesti kohanema. Nüüd liigub ainult see, mille peal käsi on — kaart ise
     (.gc-card:hover, translateZ + vari, mõõt ei muutu).

     Astmete PUHKESÜGAVUS jääb: `data-d` annab kaugusudu ja Z-nihke, sest
     see kannab tähendust (lähim aste = vahetuim suhe), mitte tähelepanu. */
  const deskRef = useRef(null);
  /* Dokk on nüüd HÜPPESILT, mitte lüliti: ta ei muuda enam laua kuju, vaid
     viib fookuse selle astme esimesele kaardile. Klaviatuuriga liikujale on
     see päris otsetee; hiirega vajutajale ütleb ta, kus rida asub. */
  const [jumpZone, setJumpZone] = useState(null);
  useEffect(() => {
    setJumpZone(null);
  }, [setKey]);
  const jumpToZone = useCallback((id) => {
    setJumpZone(id);
    const list = deskRef.current?.querySelector(`[data-zone-list="${CSS.escape(id)}"]`);
    const first = list?.querySelector("a, button");
    first?.focus?.();
  }, []);

  /* Viimase keskkaardi mälu komplekti kohta (sessionStorage), et elaks
     üle karusselli remountide (key={carouselSet}) ja route-vahetuste. */
  const storageId = setKey ? `gc:last:${setKey}` : null;
  const indexOfKey = useCallback(
    (key) => (key ? items.findIndex((it) => it.key === key) : -1),
    [items]
  );

  /* Algne keskkaart on DETERMINISTLIK (initialKey) — sama serveris ja
     kliendis. sessionStorage'i (viimane keskkaart) EI tohi lugeda siin, sest
     see on klient-ainult → SSR tsentreeriks initialKey, klient salvestatud
     kaardi ja tekiks HYDRATION-MISMATCH: React regenereerib karusselli puu,
     kaardid virnaks hetkeks üksteise peale + topeltvarjud (tellija 07.07).
     Salvestatud koht taastatakse allpool ALLES pärast hüdreerimist. */
  const memoryActive =
    !forceInitial && storageId && typeof window !== "undefined"
      ? indexOfKey(carouselPositionMemory.get(storageId))
      : -1;
  const [active, setActive] = useState(() =>
    memoryActive >= 0 ? memoryActive : Math.max(0, indexOfKey(initialKey))
  );
  const activeRef = useRef(active);
  activeRef.current = active;

  /* Komplekti vahetusel (nt peamenüü → profiil → peamenüü) sünnib
     karussell uuesti. Server ja esimene kliendirender alustavad teadlikult
     `initialKey`-st, kuid sessionStorage võib kohe pärast hüdreerimist
     taastada mõne teise keskkaardi. See taastamine EI OLE kasutaja tehtud
     karussellisamm: kui ta saaks 480 ms transformi, näiks terve uus menüü
     vasakult/paremalt sisse sõitvat ja kaardi küljes olev läige voolaks
     koos temaga üle ekraani. Esimese kahe kaadri jooksul keelame ainult
     asukohatransitsiooni; gc-ignite'i opacity-sisenemine jääb alles. */
  const [restoringPosition, setRestoringPosition] = useState(
    () => Boolean(storageId && !forceInitial && memoryActive < 0)
  );

  /* Taasta viimane keskkaart (sessionStorage) — AINULT kliendis, pärast
     esimest renderit, nii et hüdreerimine kattub serveriga. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (forceInitial || !storageId || typeof window === "undefined") return;
    try {
      const saved = window.sessionStorage.getItem(storageId);
      const savedIdx = indexOfKey(saved);
      if (savedIdx >= 0 && savedIdx !== activeRef.current) setActive(savedIdx);
    } catch {}
  }, [forceInitial, storageId, indexOfKey]);

  useEffect(() => {
    if (!restoringPosition || typeof window === "undefined") return undefined;
    let settleFrame = 0;
    const paintFrame = window.requestAnimationFrame(() => {
      settleFrame = window.requestAnimationFrame(() => setRestoringPosition(false));
    });
    return () => {
      window.cancelAnimationFrame(paintFrame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [restoringPosition]);

  /* Jäta iga vahetus meelde — tagasitulek samasse komplekti taastab koha. */
  useEffect(() => {
    if (!storageId || typeof window === "undefined") return;
    const key = items[active]?.key;
    if (!key) return;
    carouselPositionMemory.set(storageId, key);
    try {
      window.sessionStorage.setItem(storageId, key);
    } catch {}
  }, [active, items, storageId]);

  /* ---------- Positsioonid: pöördlaud, mitte lineaarne ringitõmme ----------
     Iga kaart liigub sammu kohta täpselt ÜHE koha võrra ja LÜHIMAT teed:
     lahkuv külgkaart taandub oma poolele (nt −1 → −2), mitte üle esiplaani
     vastasserva (+2). Ringi-õmblus (pos hüppab üle poole ringi) tehakse
     HETKEGA, ilma transform-üleminekuta (data-warp), sel hetkel kui kaart
     on nagunii peidus/hajumas — nii ei teki nähtavat ülelendu. */
  const posRef = useRef(null);
  if (posRef.current === null) {
    posRef.current = items.map((_, i) => wrapPos(i, active, n));
  }
  const [layout, setLayout] = useState(() => ({
    pos: posRef.current,
    warp: items.map(() => false),
  }));
  const prevActiveRef = useRef(active);

  useEffect(() => {
    const curPos = posRef.current;
    // Komplekt/pikkus vahetus (nt haldus↔töö) — algsea puhtalt.
    if (!curPos || curPos.length !== n) {
      const seeded = items.map((_, i) => wrapPos(i, activeRef.current, n));
      posRef.current = seeded;
      prevActiveRef.current = activeRef.current;
      setLayout({ pos: seeded, warp: items.map(() => false) });
      return;
    }
    const prev = prevActiveRef.current;
    if (prev === active) return;
    prevActiveRef.current = active;
    // Lühim ringisuund prev→active (sammud, −n/2..n/2)
    let d = (((active - prev) % n) + n) % n;
    if (d > n / 2) d -= n;
    const pos = curPos.map((p) => {
      let np = p - d;
      // Aken [-n/2, n/2]: mõlemad tagaosa esitused (±n/2) on lubatud
      // puhkekohad; wrap käivitub alles siis, kui kaart läheb neist
      // KAUGEMALE (siis on ta juba peidus → hüpe tehakse hetkega).
      while (np < -n / 2) np += n;
      while (np > n / 2) np -= n;
      return np;
    });
    const warp = pos.map((np, i) => Math.abs(np - curPos[i]) > 1.0001);
    posRef.current = pos;
    setLayout({ pos, warp });
  }, [active, n, items]);

  const navRef = useRef(null);
  const listRef = useRef(null);
  const drag = useRef({ on: false, x0: 0, dx: 0, moved: false, pid: null });
  const itemRefs = useRef([]);
  const shortcutTrackRef = useRef(null);

  /* Kiirmenüü riba, mis ei mahu ära, PEAB seda ise ütlema. Mobiilil (390 px)
     mõõdab kaheksa otseteed 410 px, riba nähtav osa on 295 px — ülejäänu oli
     lihtsalt ÄRA LÕIGATUD, ilma ühegi märgita, et seal veel midagi on
     (omanik 26.07: „alumine kiirmenüü on ära lõigatud ja kõik ikoonid ei
     mahugi peale"). Kaks vastust, mõlemad vajalikud:
     1) `data-overflow="1"` lülitab sisse servahäive (carousel.css) — riba
        lõpp hajub, mis ütleb „siit läheb edasi", mitte „siin on katki";
     2) aktiivne otsetee keritakse vaatesse, et avatud leht ei oleks kunagi
        peidus servataga.
     Nuppude kahandamine EI ole lahendus: kaheksa 44 px puutesihtmärki + tagasi-
     nool ei mahu 390 px ekraanile ühelegi reale (373 px ainuüksi ikoonid). */
  useEffect(() => {
    const track = shortcutTrackRef.current;
    if (!track) return undefined;

    /* Häive tuleb AINULT sinna poolele, kus päriselt on midagi peidus, ja
       alles siis, kui peidus on vähemalt pool ikooni. Esimene versioon
       hajutas mõlemat serva niipea, kui riba üldse üle ääre ulatus —
       laual tähendas see 14 px ülejääki, mille pärast tuhmus 22 px
       MÕLEMAL pool ehk päris ikoonid, kusjuures vasakul ei olnud peidus
       mitte midagi (omanik 26.07: „desktopis on imelik fade kiirmenüül,
       vasakul ja paremal pool, katab ikoone"). Alla selle läve on riba
       sisuliselt terve ja häive oleks lihtsalt müra. */
    const HIDDEN_MIN = 24;
    /* Ülejääki mõõdetakse NUPPUDE, mitte `scrollWidth`-i järgi. Vihje on
       nupu sees `position: absolute` ja ulatub temast laiemale — abs-lapsed
       kasvatavad kerimisala, seega luges `scrollWidth` riba ülevoolavaks
       just nende võrra, mida ta ise peidab (mõõdetud sotsiaal.ai 1280 px:
       vihjetega 496, ilma 486, nähtav 485 — ehk 10 px tuli vihjetest ja
       1 px ümardusest). Riba lülitas seepeale sisse häive, mille mask
       omakorda lõikas vihjed ära. Viimase nupu parem serv annab ainsana
       selle, mis päriselt peidus on. */
    const hiddenWidth = () => {
      const last = track.lastElementChild;
      if (!last) return 0;
      const end =
        last.getBoundingClientRect().right -
        track.getBoundingClientRect().left +
        track.scrollLeft;
      return Math.max(0, Math.round(end - track.clientWidth));
    };
    const syncFade = () => {
      const max = hiddenWidth();
      if (max <= 2) {
        track.dataset.overflow = "0";
        track.dataset.fade = "none";
        return false;
      }
      track.dataset.overflow = "1";
      const start = track.scrollLeft > HIDDEN_MIN;
      const end = max - track.scrollLeft > HIDDEN_MIN;
      track.dataset.fade = start && end ? "both" : start ? "start" : end ? "end" : "none";
      return true;
    };
    const sync = () => {
      if (!syncFade()) return;
      const on = track.querySelector('.gc-shortcut[data-on="1"]');
      if (!on) return;
      const mid = on.offsetLeft + on.offsetWidth / 2 - track.clientWidth / 2;
      /* Vähendatud liikumise all EI libiseta — seal on hüpe ainus aus
         vastus (sama reegel mis dokil endal, room.css). */
      const reduced = document.documentElement.dataset.reduceMotion === "1";
      track.scrollTo({ left: Math.max(0, mid), behavior: reduced ? "auto" : "smooth" });
    };
    sync();
    track.addEventListener("scroll", syncFade, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(sync);
      ro.observe(track);
    }
    return () => {
      track.removeEventListener("scroll", syncFade);
      ro?.disconnect();
    };
  }, [active, items]);

  /* Sammu lukk: iga pööre on ÜKS kaart ja animatsioon lõpetatakse
     enne järgmist sammu — kaarte ei saa läbi vuhistada. Kestus on
     seotud kaardi transitioniga (480 ms, carousel.css). */
  const stepLockUntil = useRef(0);
  const STEP_LOCK_MS = 460;
  const stepAllowed = () => {
    const now = performance.now();
    if (now < stepLockUntil.current) return false;
    stepLockUntil.current = now + STEP_LOCK_MS;
    return true;
  };

  /* `count` > 1 tuleb AINULT näpu alt (vt endDrag): rullik ja nooled
     annavad ikka ühe kaardi korraga. `force` jätab sammuluku vahele —
     lukk on rulliku hoo taltsutaja, aga näpuvedu on juba iseenesest üks
     lõpetatud žest, ja tema kinnihoidmine oli see, mis tegi kiired
     järjestikused svaibid mõjutuks (omanik 26.07: „menüü scroll on kuidagi
     raske, kui ma tahan näpuga vasakule või paremale kerida"). */
  const step = useCallback(
    (delta, { focus = false, count = 1, force = false } = {}) => {
      if (!force && !stepAllowed()) return;
      if (force) stepLockUntil.current = performance.now() + 120;
      const dir = delta < 0 ? -1 : 1;
      const hops = Math.max(1, Math.min(count, n));
      setActive((cur) => {
        const next = (((cur + dir * hops) % n) + n) % n;
        if (focus) {
          requestAnimationFrame(() => itemRefs.current[next]?.focus?.());
        }
        return next;
      });
    },
    [n]
  );

  /* Küljenool: ainult karussellis. Laual ei ole kuhugi kerida — kõik
     kaardid on korraga väljas, seega nooli seal ei ole. */
  const navigate = useCallback((dir) => step(dir), [step]);

  /* Klaviatuur karussellil */
  const onKeyDown = useCallback(
    (e) => {
      if (isDesk) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        e.preventDefault();
        step(dir, { focus: true });
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        if (stepAllowed()) setActive(e.key === "Home" ? 0 : n - 1);
      }
    },
    [isDesk, step, n]
  );

  /* Lohistamine ja svaip. NB: pointer capture võetakse ALLES siis,
     kui lohistus päriselt algab — varajane capture suunaks pointerup'i
     UL-ile ja kaartide click-sündmus ei jõuaks kunagi kohale.
     Laual lohistust ei ole: seal ei pöörle miski. */
  const onPointerDown = useCallback(
    (e) => {
      if (isDesk) return;
      if (e.button != null && e.button !== 0) return;
      drag.current = { on: true, x0: e.clientX, dx: 0, moved: false, pid: e.pointerId };
    },
    [isDesk]
  );
  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d.on) return;
    d.dx = e.clientX - d.x0;
    /* 8 px jääb 8-ks: see lävi otsustab ka selle, kas vajutus loeb
       KLIKIKS (vt handleActivate). Madalam lävi teeks väriseva näpuga
       tehtud koputusest lohistuse ja kaart ei avaneks. */
    if (!d.moved && Math.abs(d.dx) > 8) {
      d.moved = true;
      listRef.current?.setPointerCapture?.(d.pid);
    }
    if (d.moved && listRef.current) {
      listRef.current.dataset.dragging = "1";
      /* Kaart käib näpuga peaaegu kaasa (0,92). Vana 0,55 tähendas, et
         48 px veo peale liikus pilt 26 px — sõrm läks, klaas jäi, ja
         see ongi see „raske" tunne. Päris 1,0 jätaks servakaardi näpust
         ette; 0,92 hoiab veo ja pöörde ühes tempos. */
      listRef.current.style.setProperty("--drag", `${d.dx * 0.92}px`);
    }
  }, []);
  const endDrag = useCallback(
    (_e) => {
      const d = drag.current;
      if (!d.on) return;
      drag.current = { on: false, x0: 0, dx: 0, moved: d.moved, pid: null };
      const list = listRef.current;
      if (list) {
        delete list.dataset.dragging;
        list.style.setProperty("--drag", "0px");
        if (d.moved && d.pid != null) {
          try {
            list.releasePointerCapture?.(d.pid);
          } catch {}
        }
      }
      if (d.moved) {
        /* Kui klaas käib näpuga kaasa, PEAB ta ka sinna jääma, kuhu näpp
           ta viis: kahe kaardi jagu vedu ja siis ühe kaardi võrra tagasi
           kargamine näeks katki. Seepärast on samme nii mitu, kui mitu
           kaardikohta sõrm läbis (lagi 3 — rohkem ei ole enam kerimine,
           vaid ülelend). Lävi 48 -> 26 px: 48 px oli poole ekraani jagu
           liigutust, mille peale ei juhtunud MIDAGI. */
        const cardW = list?.querySelector(".gc-item")?.offsetWidth || 0;
        const pitch = cardW > 0 ? cardW * 1.06 : 140;
        const hops = Math.max(1, Math.min(3, Math.round(Math.abs(d.dx) / pitch)));
        if (Math.abs(d.dx) > 26) step(d.dx < 0 ? 1 : -1, { count: hops, force: true });
        // Klikk pärast lohistust ei tohi avada
        window.setTimeout(() => {
          drag.current.moved = false;
        }, 0);
      }
    },
    [step]
  );

  /* Tellija 06.07: kaartide vaates kerivad kaarte KA klaviatuuri nooled
     ja hiirerullik ilma karusselli fookuseta — terve ekraani ulatuses.
     Aktiivne alles siis, kui käivitus on kaardid avanud (wrap pole inert)
     ja ükski modal/kaardi-leht ei kata; sammu lukk hoiab tempo. */
  /* Ühised väravad: kas ruum on üldse selles seisus, kus rullik ja nooled
     tohivad midagi liigutada. Kehtib NII karussellile (pöörab kaarti) kui
     lauale (vahetab rea fookust). */
  const roomInteractive = useCallback(() => {
    const root = navRef.current;
    if (!root) return false;
    const wrap = root.closest(".room-carousel-wrap");
    if (!wrap || wrap.inert) return false;
    const room = root.closest(".room");
    if (!room) return false;
    if (room.dataset.loginOpen === "1" || room.dataset.cardPage === "1") return false;
    // Ükski lahtiolev modal (ligipääsetavus, kontakt/paigalda) ei tohi
    // lasta rullikul/nooltel tagust karusselli pöörata (tellija 07.07).
    if (room.dataset.a11yOpen === "1" || room.dataset.infoOpen === "1") return false;
    if (document.documentElement.getAttribute("data-room-mode") === "panel") return false;
    /* Juhtpaneel elab ruumi ja main-kihi vahel eraldi kihis, et see oleks
       kasutatav ka töövaadetes. Seetõttu otsime seda dokumendist, mitte
       enam ainult .room elemendi seest. */
    const topbar = document.querySelector(".room-topbar");
    if (
      topbar &&
      (topbar.dataset.open === "1" ||
        topbar.matches?.(":hover") ||
        topbar.matches?.(":focus-within"))
    ) {
      return false;
    }
    return true;
  }, []);

  /* ↑/↓ liigutab laual KLAVIATUURI FOOKUST reast ritta. Varem liigutas ta
     rea esiletõstet; kui see 03.08 kadus, ei jäänud žestile mõtet, aga
     rea-kaupa liikumine ise on klaviatuuriga liikujale endiselt vajalik —
     seega sama nupp, aus uus tähendus: kursor astub järgmise rea esimesele
     kaardile.

     Suund on ekraaniga kooskõlas ja virn ei ole ringkäik: ülemiselt realt
     edasi vajutades jääb fookus paigale, mitte ei hüppa alla tagasi. */
  const stepZoneFocus = useCallback(
    (dir) => {
      const ids = zoneGroups.map((g) => g.id);
      if (!ids.length) return;
      const at = jumpZone ? ids.indexOf(jumpZone) : -1;
      /* Ilma eelmise sammuta haarab esimene vajutus selle serva, kust žest
         tuleb: üles liikudes alumise rea, alla liikudes ülemise. */
      const next =
        at < 0
          ? dir > 0
            ? 0
            : ids.length - 1
          : Math.min(ids.length - 1, Math.max(0, at + dir));
      jumpToZone(ids[next]);
    },
    [jumpToZone, jumpZone, zoneGroups]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) {
        return;
      }
      if (isDesk) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        if (!roomInteractive()) return;
        e.preventDefault();
        if (stepAllowed()) stepZoneFocus(e.key === "ArrowUp" ? 1 : -1);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!roomInteractive()) return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    const onWheel = (e) => {
      if (e.defaultPrevented) return;
      if (!roomInteractive()) return;
      /* LAUAL EI HAARA RULLIK ENAM MIDAGI. Ta liigutas rea esiletõstet;
         kui see 03.08 kadus, ei jäänud tal midagi liigutada — ja `wheel`,
         mis `preventDefault`-ib ega tee seejärel midagi, on halvem kui
         puuduv käsitleja: kerimine tundub katkisena. Klaviatuuri ↑/↓ jäi
         alles, sest fookuse liigutamine on päris tegu. */
      if (isDesk) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 12) return;
      e.preventDefault();
      step(d > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [isDesk, roomInteractive, step, stepZoneFocus]);

  const handleActivate = useCallback(
    (e, item, i) => {
      if (drag.current.moved) {
        e.preventDefault();
        return;
      }
      if (isDesk) {
        e.preventDefault();
        onSelect?.(item);
        return;
      }
      const pos = wrapPos(i, activeRef.current, n);
      if (pos !== 0 && e.detail > 0) {
        // Hiireklikk külgpaneelil pöörab selle enne keskele (brief §7)
        e.preventDefault();
        if (stepAllowed()) {
          setActive(i);
        }
        return;
      }
      e.preventDefault();
      onSelect?.(item);
    },
    [isDesk, n, onSelect]
  );

  /* Kolme kaardi vaates on alumine riba päris otsetee, mitte pelgalt
     asukohatäpp: valik avaneb kohe. Tagasi elab eraldi püsiva nupuna, et
     alamkomplektis ei peaks selle leidmiseks karusselli läbi kerima.
     LAUAL seda riba EI OLE: kui kõik kaardid on nagunii korraga väljas,
     ei ole 15-ikoonilist otseteed vaja — ja just see riba jooksis oma
     pillist välja ning rolli-lüliti alla (omanik 25.07). Selle asemel
     seisavad dokis tsooninimed, mida on alati 2–3 ja mis ei saa
     põhimõtteliselt üle ääre joosta. */
  const shortcutEntries = useMemo(
    () => items.map((item, index) => ({ item, index })),
    [items]
  );
  const handleShortcut = useCallback(
    (item) => {
      onSelect?.(item);
    },
    [onSelect]
  );

  /* Dokk on karussellis mõttekas alles mitme kaardi puhul; dokirežiimis
     on ta kogu navigatsioon (sh sulgemine) ja peab alati olemas olema. */
  const showDock = dockOnly || n > 1;
  const posLabel = useMemo(() => {
    const template = t("room.position");
    return template
      .replace("{current}", String(active + 1))
      .replace("{total}", String(n));
  }, [t, active, n]);

  const zoneLabel = useCallback(
    (id, field) => t(`room.zones.${id}.${field}`, ""),
    [t]
  );

  return (
    <nav
      className="gc"
      ref={navRef}
      data-visible={shown}
      data-desk={isDesk ? "1" : "0"}
      data-dock-only={dockOnly ? "1" : "0"}
      data-restoring={restoringPosition ? "1" : "0"}
      data-set-entry={isSetEntry ? "1" : "0"}
      /* --desk-cols peab elama SAMAL elemendil, kus --gc-w arvutatakse
         (.gc[data-desk="1"]): custom property asendatakse juba selle
         elemendi arvutatud väärtuses, seega lapsel antud arv jõuaks
         valemisse liiga hilja. */
      style={isDesk ? { "--desk-cols": deskCols } : undefined}
      aria-label={t("room.menu_label")}
      id="room-menu"
    >
      {!isDesk && !dockOnly ? (
        <IconButton
          layoutClassName="gc-arrow gc-arrow--left"
          aria-label={t("room.prev_panel")}
          onClick={() => navigate(-1)}
        >
          <ChevronIcon direction="left" strokeWidth={1.05} />
        </IconButton>
      ) : null}

      {dockOnly ? null : isDesk ? (
        /* ---------- Sügavuslaud ----------
           Astmed pöördjärjestuses (column-reverse): lähim aste ALL, doki
           juures, kaugem taga ülal — nii nagu laud, mille taga sa istud. */
        <div className="gc-desk" ref={deskRef}>
          {zoneGroups.map((group, d) => {
            return (
              <div
                key={group.id}
                className="gc-tier"
                data-zone={group.id}
                data-d={d}
                /* data-focus / data-dimmed on 03.08 KADUNUD: aste ei tõuse
                   ega tuhmu enam kellegi teise arvelt. Alles on ainult
                   `data-d` — puhkesügavus, mis kannab tähendust. */
                /* --abs toidab käivituse astakut (gc-ignite): esiaste
                   süttib esimesena, tagumine viimasena. */
                style={{ "--d": d, "--abs": d }}
              >
                {/* Püstise sildi pikkust mõõdetakse rea KÕRGUSES, seega
                    pikk nimi ("Поиск помощи", "Finding help") ulatub 1200 px
                    ekraanil kaardist kõrgemaks ja tikub naaberastme vahesse.
                    Sama vastus mis kaardisildil: pikk nimi saab väiksema
                    kirja, mitte kärbet. */}
                <span
                  className="gc-tier-name"
                  data-long={(zoneLabel(group.id, "name") || "").length > 9 ? "1" : "0"}
                  aria-hidden="true"
                >
                  {zoneLabel(group.id, "name")}
                </span>
                <ul
                  className="gc-tier-list"
                  data-zone-list={group.id}
                  aria-label={zoneLabel(group.id, "name") || undefined}
                >
                  {group.items.map((item) => (
                    <li key={item.key} className="gc-item" data-hidden="0">
                      <GlassCard
                        href={item.href}
                        label={item.label}
                        icon={item.icon || null}
                        longLabel={item.label.length > 13}
                        badge={item.badge || null}
                        badgeTone={item.badgeTone || null}
                        tabIndex={0}
                        {...(item.comingSoon
                          ? {
                              "data-coming-soon": "1",
                              "aria-disabled": "true",
                              title: item.comingSoonHint || undefined,
                            }
                          : {})}
                        onClick={(e) => handleActivate(e, item, 0)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul
          className="gc-list"
          ref={listRef}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {items.map((item, i) => {
            const pos = layout.pos[i] ?? wrapPos(i, active, n);
            const abs = Math.abs(pos);
            const isCenter = pos === 0;
            const isWarp = layout.warp[i] === true;
            /* Peidus kaardid PARGIVAD kohe serva taga (±posLimit sammu),
               mitte oma kaugel ringipositsioonil — sisenev kaart libiseb
               servast ühe sammu ega lenda üle rea; lahkuv libiseb serva
               taha ja hajub (tellija 06.07: "keritav, mitte lennuk"). */
            const posVis = Math.max(-posLimit, Math.min(posLimit, pos));
            const absVis = Math.min(abs, posLimit);
            return (
              <li
                key={item.key}
                className="gc-item"
                style={{
                  "--pos": posVis,
                  "--abs": absVis,
                  zIndex: 40 - abs * 10,
                }}
                data-center={isCenter ? "1" : "0"}
                data-hidden={abs > hideBeyond ? "1" : "0"}
                data-warp={isWarp ? "1" : "0"}
              >
                <GlassCard
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  href={item.href}
                  label={item.label}
                  icon={item.icon || null}
                  longLabel={item.label.length > 13}
                  badge={item.badge || null}
                  badgeTone={item.badgeTone || null}
                  tabIndex={isCenter ? 0 : -1}
                  aria-current={isCenter ? "true" : undefined}
                  {...(item.comingSoon
                    ? {
                        "data-coming-soon": "1",
                        "aria-disabled": "true",
                        title: item.comingSoonHint || undefined,
                      }
                    : {})}
                  onClick={(e) => handleActivate(e, item, i)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!isDesk && !dockOnly ? (
        <IconButton
          layoutClassName="gc-arrow gc-arrow--right"
          aria-label={t("room.next_panel")}
          onClick={() => navigate(1)}
        >
          <ChevronIcon direction="right" strokeWidth={1.05} />
        </IconButton>
      ) : null}

      {showDock ? (
        <div className="gc-shortcuts">
          <div className="gc-shortcut-menu" role="group" aria-label={t("room.menu_label")}>
            {backItem ? (
              <button
                type="button"
                className="gc-shortcut gc-shortcut--back"
                data-on="0"
                aria-label={backItem.label}
                onClick={() => handleShortcut(backItem)}
              >
                <span className="gc-shortcut-icon" aria-hidden="true">
                  {backItem.icon}
                </span>
                <span className="gc-shortcut-tooltip" aria-hidden="true">
                  {backItem.label}
                </span>
              </button>
            ) : null}
            {/* Eraldaja eraldab tagasi-noole SELLEST, mis tema järel tuleb.
                Kui järel ei tule midagi (kaardita leht, mille nime dokk ei
                tea), jäi ta üksinda rippuma — kriips ilma teise pooleta
                (omanik 29.07). Karussellis ja laual on rada alati olemas,
                dokis ainult siis, kui lehel on nimi või ⓘ. */}
            {backItem && (dockOnly ? Boolean(currentItem || infoItem) : true) ? (
              <span className="gc-shortcut-divider" aria-hidden="true" />
            ) : null}
            {dockOnly ? (
              /* Avatud lehel EI ole dokis õdede rida, vaid AINULT see, mis
                 lahti on: tagasi-nool + lehe nimi (omanik 26.07). Nimi
                 dokis tähendab, et lehel endal ei pea pealkirja olema.
                 Karussellis on nimi teadlikult peidus — seal muudaks ta
                 iga kerimisega doki laiust ja terve riba nihkuks. Siin
                 seda ohtu ei ole: avatud lehel on dokis üks kirje ja tema
                 laius ei muutu enne, kui leht ise vahetub. */
              currentItem || infoItem ? (
                <>
                  {currentItem ? (
                    <span className="gc-shortcut gc-shortcut--current" data-on="1" aria-current="page">
                      <span className="gc-shortcut-icon" aria-hidden="true">
                        {currentItem.icon || <span className="gc-shortcut-mark" />}
                      </span>
                      <span className="gc-shortcut-text">{currentItem.label}</span>
                    </span>
                  ) : null}
                  {/* Lehe ⓘ seisab lehe nime KÕRVAL, mitte akna nurgas
                      (omanik 26.07). Vajutus vahetab akna sisu info vastu;
                      teine vajutus toob lehe tagasi — sellepärast on ta
                      lüliti (aria-pressed), mitte link. */}
                  {infoItem ? (
                    <button
                      type="button"
                      className="gc-shortcut gc-shortcut--info"
                      data-on={infoItem.active ? "1" : "0"}
                      aria-pressed={infoItem.active ? "true" : "false"}
                      aria-label={infoItem.label}
                      onClick={() => handleShortcut(infoItem)}
                    >
                      <span className="gc-shortcut-icon" aria-hidden="true">
                        {infoItem.icon}
                      </span>
                      {/* Nimi elab vihjes, mitte nupu sees (omanik 26.07:
                          "sõna info võta ära"). Dokk on ikoonide riba —
                          ainus tekst temas on selle lehe nimi, mis lahti
                          on. Ekraanilugeja saab sama nime aria-label'ist. */}
                      <span className="gc-shortcut-tooltip" aria-hidden="true">
                        {infoItem.label}
                      </span>
                    </button>
                  ) : null}
                </>
              ) : null
            ) : isDesk ? (
              <div className="gc-zone-track">
                {zoneGroups.map((group) => {
                  /* Silt on nüüd HÜPPESILT, mitte lüliti. `aria-pressed`
                     kadus koos lülitiga: vajutus ei jäta enam midagi „sisse
                     lülitatuks" (laud ei muutu), vaid viib fookuse selle
                     astme esimesele kaardile. `aria-current` ütleb sedasama
                     ausalt — siin sa viimati käisid. */
                  const here = jumpZone === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className="gc-zone"
                      data-on={here ? "1" : "0"}
                      aria-current={here ? "true" : undefined}
                      onClick={() => jumpToZone(group.id)}
                    >
                      {zoneLabel(group.id, "name")}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="gc-shortcut-track" ref={shortcutTrackRef}>
                {shortcutEntries.map(({ item, index }) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="gc-shortcut"
                      data-on={isActive ? "1" : "0"}
                      aria-label={item.label}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => handleShortcut(item)}
                    >
                      <span className="gc-shortcut-icon" aria-hidden="true">
                        {item.icon || <span className="gc-shortcut-mark" />}
                      </span>
                      {/* Aktiivse otsetee nime siin EI OLE. Ta kasvas nupu
                          sisse ja muutis doki laiust, ja kuna dokk on
                          tsentreeritud, nihkus IGA kerimisega terve riba
                          (mõõdetud: 231 → 217 px, riba 8 px küljele;
                          omanik 25.07: "imelikult sisu hüppab"). Nimi elab
                          nagunii keskmisel KAARDIL suurelt, dokk on
                          asukohaviide. Hõljudes ütleb tooltip sedasama.
                          Jaamadokkides (a11f-/rgf-) tekst jääb: seal on
                          nupud ühesugused täpid ja nimi on ainus orientiir. */}
                      <span className="gc-shortcut-tooltip" aria-hidden="true">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Rollilüliti on ADMINI tööriist ja elab dokist LAHUS, ekraani
          nurgas (omanik 25.07: "tavakasutaja vaade on kõige tähtsam,
          rolli vahetus võib kuskil nurgas ka olla"). Doki sees dikteeris
          ta doki laiust ja jäi otseteeriba alla. */}
      {/* Rollilüliti kuulub kaardivaate juurde: avatud akna all ei ole
          mõtet vaadet vahetada, sest kaarte ei ole näha. */}
      {!dockOnly ? <RoleViewSwitcher placement="cards" onRoleChanged={onRoleChanged} /> : null}

      {!isDesk && !dockOnly ? (
        <p className="sr-only" aria-live="polite">
          {items[active]?.label} — {posLabel}
        </p>
      ) : null}
    </nav>
  );
}
