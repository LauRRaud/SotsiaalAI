"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

/**
 * TeemaseemnedPage — Teemaseemnete leht + uue seemne loomisvaade.
 * Spetsifikatsioon: Kovisioon/teemaseeme-professionaalne-funktsioon.md (v1.1).
 *
 * Teemaseeme on kovisioonist ERALDI funktsioon: siin pole sessioonikroomi
 * (Paus, sessiooniroll). Loodud seemned kanduvad kovisiooni ruumi alla
 * (1. etapi "Tänane juhtum" = valitud seemne üldistatud kaart).
 *
 * Nuppude loogika (tellija lukustatud reeglid): iga nupp loogikaga;
 * disabled nupp ütleb põhjuse; midagi pole jagatud enne omaniku
 * teadlikku tegevust (§5.6); olulisus/kontekst/liik algolekus valimata
 * (§33.5); kiire seemne saab luua ilma ettevalmistuseta (§8.1).
 */

/* Loomisvaate viis sammu (§8.1). Etapp 0 (sobivuskontroll) ei ole
   stepperi samm — see on värav enne sammu 1. */
const CREATE_STEPS = [
  "Kiire seeme",
  "Professionaalne ettevalmistus",
  "Võrgustik ja senine töö",
  "Fookus ja soovitud muutus",
  "Eelvaade, jagamine ja töövorm"
];

/* Juhtumi kontekst (§9.2 v1.1 — edukogemus EI ole kontekst) */
const CONTEXTS = [
  { key: "adult", label: "Täisealise inimese klienditöö" },
  { key: "child", label: "Lapse või noore klienditöö" },
  { key: "family", label: "Pere või leibkond" },
  { key: "couple", label: "Paari või lähisuhte kontekst" },
  { key: "network", label: "Võrgustiku või koostöö juhtum" },
  { key: "other", label: "Muu professionaalne olukord", sub: "roll, meetod, koostöö, eetiline pinge või juhtimine" }
];

/* Juhtumi liik (§9.3) */
const KINDS = [
  { key: "current", label: "Aktuaalne väljakutse" },
  { key: "success", label: "Edukogemus" },
  { key: "past", label: "Minevikus toimunud keeruline olukord" },
  { key: "future", label: "Tulevikueesmärk" }
];

/* Soovitud tugi (§9.5 kaanon). Stabiilne võti + kuvatav ET-silt: server salvestab
   AINULT võtme (whitelist), klient kuvab sildi. */
const SUPPORT_OPTIONS = [
  { key: "understanding", label: "Olukorra parem mõistmine" },
  { key: "perspectives", label: "Uued vaatenurgad" },
  { key: "role", label: "Oma rolli mõtestamine" },
  { key: "boundaries", label: "Professionaalsete piiride selgitamine" },
  { key: "network", label: "Võrgustikutöö analüüs" },
  { key: "method", label: "Kasutatud meetodi refleksioon" },
  { key: "ethics", label: "Eetilise dilemma uurimine" },
  { key: "paths", label: "Võimalike teede loomine" },
  { key: "next_step", label: "Järgmise sammu leidmine" },
  { key: "success_learning", label: "Edukogemusest õppimine" },
  { key: "other", label: "Muu" }
];

/* Serveri whitelistidele vastavad key -> ET-silt kaardid (kuvamiseks). */
const CONTEXT_LABEL = Object.fromEntries(CONTEXTS.map((c) => [c.key, c.label]));
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));
const SUPPORT_LABEL = Object.fromEntries(SUPPORT_OPTIONS.map((s) => [s.key, s.label]));

/* Etapp 0 sobivuskontrolli lahendus -> serveri safetyGate whitelist-võti. */
const GATE_TO_KEY = {
  ei: "no_immediate_risk",
  teadmata: "risk_unknown",
  "sekkumine-kaivitatud": "intervention_started",
  "risk-hinnatud": "risk_assessed"
};
const KEY_TO_GATE = Object.fromEntries(Object.entries(GATE_TO_KEY).map(([gate, key]) => [key, gate]));

/* Privaatse ettevalmistuse moodulid (§33.3 — valikuline, ainult omanikule) */
const PRIVATE_MODULES = [
  "Täielik juhtumikirjeldus",
  "Eluvaldkonnad ning inimese ja spetsialisti vaated",
  "Võrgustik ja osapooled",
  "Senised tegevused ja kasutatud meetodid",
  "Minu tunded ja tähelepanekud",
  "Võimalik tööfookus",
  "Riskid ja tundlikud andmed"
];

const STATUS_LABELS = {
  mustand: "Mustand",
  ootel: "Ootel",
  valitud: "Tänaseks valitud",
  toos: "Töös",
  jarelvaates: "Järelvaates",
  suletud: "Suletud"
};

/* A6.1: päris seemned laaditakse serverist (GET /api/topic-seeds) ja on ainult
   omanikule nähtavad. Varasem DEMO_SEEDS näidismassiiv on eemaldatud — ükski
   demo-kaart ei tohi esineda päris kasutajaandmena. */

const FILTERS = [
  { key: "koik", label: "Kõik" },
  { key: "ootel", label: "Ootel" },
  { key: "valitud", label: "Tänaseks valitud" },
  { key: "jarelvaates", label: "Järelvaates" },
  { key: "minu", label: "Minu seemned" }
];

const CARD_NUDGE = 14;
const CARD_NUDGE_LARGE = 48;
const CARD_MIN_WIDTH = 288;
const CARD_MIN_HEIGHT = 360;
const CARD_MAX_WIDTH = 760;
const CARD_MAX_HEIGHT = 720;
const CARD_RESIZE_STEP = 16;
const CARD_RESIZE_STEP_LARGE = 48;

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function TeemaseemnedPage({ owner = null }) {
  const { locale, t } = useI18n();
  const ownerName = owner?.name || "";
  const ownerTitle = owner?.title || "";

  const [view, setView] = useState("list"); // list | create | prep
  const [seeds, setSeeds] = useState([]); // päris omaniku seemned serverist
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictScope, setConflictScope] = useState(null); // edit | share | null
  const [filter, setFilter] = useState("koik");
  const [notice, setNotice] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailSeed, setDetailSeed] = useState(null); // omaniku külmutatud kaardi vaade
  const [shareSeed, setShareSeed] = useState(null); // omaniku jagamiskiht
  const [shareConfirmed, setShareConfirmed] = useState(false); // „ei sisalda tuvastajaid" kinnitus
  const [cardOffsets, setCardOffsets] = useState({});
  const [cardSizes, setCardSizes] = useState({});
  const [movingSeedId, setMovingSeedId] = useState(null);
  const [resizingSeedId, setResizingSeedId] = useState(null);
  const [frontSeedId, setFrontSeedId] = useState(null);
  const [layoutNotice, setLayoutNotice] = useState("");
  const spatialBoundsRef = useRef(null);
  const cardRefs = useRef(new Map());
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const dataVersionRef = useRef(0);

  /* Server TopicSeed -> ruumilise kaardi kuju. Kõik seemned on omaniku enda omad;
     DB-staatus DRAFT/WAITING -> ajaloolised kliendisildid mustand/ootel. */
  const toCardSeed = useCallback((seed) => {
    if (!seed) return null;
    const frozenSnapshot =
      seed.status === "WAITING" &&
      seed.sharedCardSnapshot &&
      typeof seed.sharedCardSnapshot === "object" &&
      !Array.isArray(seed.sharedCardSnapshot)
        ? seed.sharedCardSnapshot
        : null;
    // WAITING is defined by its frozen card. Never silently fall back to mutable
    // top-level fields if a persisted row is corrupt or missing its snapshot.
    const displaySeed = seed.status === "WAITING" ? frozenSnapshot || {} : seed;
    const requestedSupport = Array.isArray(seed.requestedSupport) ? seed.requestedSupport : [];
    const displaySupport = Array.isArray(displaySeed.requestedSupport) ? displaySeed.requestedSupport : [];
    const supportLabels = displaySupport.map((key) => SUPPORT_LABEL[key] || key);
    return {
      id: seed.id,
      title: displaySeed.title || readText(t, "topic_seeds.ui.untitled", "(Pealkirjata mustand)"),
      owner: ownerName,
      mine: true,
      context: CONTEXT_LABEL[displaySeed.contextType] || readText(t, "topic_seeds.ui.missing_value", "—"),
      kind: KIND_LABEL[displaySeed.caseType] || readText(t, "topic_seeds.ui.missing_value", "—"),
      whyNow: displaySeed.whyNow || readText(t, "topic_seeds.ui.missing_value", "—"),
      support: supportLabels.length
        ? supportLabels
        : [readText(t, "topic_seeds.ui.missing_value", "—")],
      importance: displaySeed.importance ?? null,
      status: seed.status === "WAITING" ? "ootel" : "mustand",
      serverStatus: seed.status,
      meta:
        seed.status === "WAITING"
          ? readText(t, "topic_seeds.ui.waiting_meta", "Kinnitatud järjekorda")
          : readText(t, "topic_seeds.ui.draft_meta", "Loodud"),
      updatedAt: seed.updatedAt || null,
      contextType: seed.contextType ?? null,
      caseType: seed.caseType ?? null,
      rawWhyNow: seed.whyNow ?? "",
      requestedSupport,
      safetyGate: seed.safetyGate ?? null,
      rawTitle: seed.title ?? "",
      isComplete: Boolean(
        seed.title &&
          seed.contextType &&
          seed.caseType &&
          seed.whyNow &&
          requestedSupport.length &&
          seed.importance != null &&
          seed.safetyGate
      ),
      sharedCardSnapshot: frozenSnapshot
    };
  }, [ownerName, t]);

  /* Laadi omaniku päris seemned serverist. Demoandmeid ei kuvata kunagi. */
  useEffect(() => {
    let active = true;
    const versionAtStart = dataVersionRef.current;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/topic-seeds", {
          headers: { Accept: "application/json", "x-ui-locale": locale }
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && Array.isArray(payload?.seeds)) {
          if (dataVersionRef.current === versionAtStart) {
            setSeeds(payload.seeds.map(toCardSeed).filter(Boolean));
          }
        } else {
          setError(resolveApiMessage({
            payload,
            t,
            fallbackKey: "topic_seeds.errors.load_failed",
            fallbackText: "Teemaseemneid ei saanud laadida."
          }));
        }
      } catch {
        if (active) setError(readText(t, "topic_seeds.errors.load_failed", "Teemaseemneid ei saanud laadida."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [locale, toCardSeed, t]);

  /* --- Loomisvaate olek (§33.5: ausad algolekud — kõik valimata) --- */
  const [gate, setGate] = useState(null); // etapp 0 vastus
  const [gateResolved, setGateResolved] = useState(false); // värav läbitud
  const [title, setTitle] = useState("");
  const [contextKey, setContextKey] = useState(null);
  const [kindKey, setKindKey] = useState(null);
  const [whyNow, setWhyNow] = useState("");
  const [support, setSupport] = useState([]);
  const [importance, setImportance] = useState(null);
  const [continuePrep, setContinuePrep] = useState(false);
  const [editingSeedId, setEditingSeedId] = useState(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState(null);

  const contextLabel = CONTEXTS.find((c) => c.key === contextKey)?.label || null;
  const kindLabel = KINDS.find((k) => k.key === kindKey)?.label || null;

  /* Kohustuslikud väljad (§9) — mitteaktiivne nupp ütleb põhjuse */
  const missing = useMemo(() => {
    const out = [];
    if (!title.trim()) out.push("pealkiri");
    if (!contextKey) out.push("juhtumi kontekst");
    if (!kindKey) out.push("juhtumi liik");
    if (!whyNow.trim()) out.push("miks praegu");
    if (!support.length) out.push("vähemalt üks soovitud toe liik");
    if (importance == null) out.push("olulisus");
    return out;
  }, [title, contextKey, kindKey, whyNow, support, importance]);

  const gateBlocked = gate === "jah-ei-oota";
  const canCreate = gateResolved && !gateBlocked && missing.length === 0;

  function resetCreate() {
    setGate(null);
    setGateResolved(false);
    setTitle("");
    setContextKey(null);
    setKindKey(null);
    setWhyNow("");
    setSupport([]);
    setImportance(null);
    setContinuePrep(false);
    setEditingSeedId(null);
    setEditingUpdatedAt(null);
  }

  function openCreate() {
    resetCreate();
    setNotice("");
    setError("");
    setConflictScope(null);
    setView("create");
  }

  function openEdit(seed) {
    if (!seed || seed.status !== "mustand") return;
    const restoredGate = KEY_TO_GATE[seed.safetyGate] || null;
    setEditingSeedId(seed.id);
    setEditingUpdatedAt(seed.updatedAt || null);
    setGate(restoredGate);
    setGateResolved(Boolean(restoredGate));
    setTitle(seed.rawTitle || "");
    setContextKey(seed.contextType || null);
    setKindKey(seed.caseType || null);
    setWhyNow(seed.rawWhyNow || "");
    setSupport(Array.isArray(seed.requestedSupport) ? seed.requestedSupport : []);
    setImportance(seed.importance ?? null);
    setContinuePrep(false);
    setNotice("");
    setError("");
    setConflictScope(null);
    setView("create");
  }

  // Create/save payload from the form state. The server validates these keys and
  // ALWAYS stores status DRAFT — the client can never mint WAITING here.
  function buildCreatePayload(complete) {
    return {
      complete,
      title: title.trim(),
      contextType: contextKey,
      caseType: kindKey,
      whyNow: whyNow.trim(),
      requestedSupport: support,
      importance,
      safetyGate: gate ? GATE_TO_KEY[gate] || null : null
    };
  }

  async function submitSeed({ complete }) {
    if (saving) return null;
    const isEditing = Boolean(editingSeedId);
    setSaving(true);
    setError("");
    setConflictScope(null);
    try {
      const response = await fetch(
        isEditing ? `/api/topic-seeds/${encodeURIComponent(editingSeedId)}` : "/api/topic-seeds",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale },
          body: JSON.stringify({
            ...buildCreatePayload(complete),
            ...(isEditing ? { expectedUpdatedAt: editingUpdatedAt } : {})
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.seed) {
        if (response.status === 409) setConflictScope("edit");
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "topic_seeds.errors.save_failed",
          fallbackText: "Teemaseemet ei saanud salvestada. Proovi uuesti."
        }));
        return null;
      }
      // Server response (not a local id) defines the seed's id/status.
      dataVersionRef.current += 1;
      const card = toCardSeed(payload.seed);
      setSeeds((prev) => [card, ...prev.filter((s) => s.id !== card.id)]);
      setEditingSeedId(card.id);
      setEditingUpdatedAt(card.updatedAt);
      return card;
    } catch {
      setError(readText(t, "topic_seeds.errors.save_failed", "Teemaseemet ei saanud salvestada. Proovi uuesti."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  function reloadAfterConflict() {
    window.location.reload();
  }

  function conflictAction(scope) {
    if (conflictScope !== scope) return null;
    return (
      <div className="ts-actions-btns">
        <p className="ts-reason">
          {readText(t, "topic_seeds.ui.conflict_help", "Laadi leht uuesti, et jätkata värske versiooniga.")}
        </p>
        <button type="button" data-variant onClick={reloadAfterConflict}>
          {readText(t, "topic_seeds.ui.reload", "Laadi leht uuesti")}
        </button>
      </div>
    );
  }

  async function saveDraft() {
    const card = await submitSeed({ complete: false });
    if (!card) return; // network/server error already surfaced; no misleading success
    setNotice(readText(t, "topic_seeds.notices.draft_saved", "Mustand salvestatud. See on nähtav ainult sulle."));
    setView("list");
    setFilter("minu");
  }

  async function createSeed() {
    if (!canCreate) return;
    const card = await submitSeed({ complete: true });
    if (!card) return;
    if (continuePrep) {
      setView("prep");
      setNotice("");
    } else {
      setNotice(readText(
        t,
        editingSeedId ? "topic_seeds.notices.updated" : "topic_seeds.notices.created",
        editingSeedId
          ? "Teemaseemne muudatused on salvestatud."
          : "Teemaseeme on loodud ja praegu ainult sulle nähtav. Jagamiseks vali kaardil „Lisa kovisioonijärjekorda”."
      ));
      setView("list");
      setFilter("minu");
    }
  }

  /* Omaniku teadlik, versioonikindel jagamine (§7.4): DRAFT -> WAITING + külmutatud
     hetktõmmis. Nõuab „ei sisalda tuvastajaid" kinnitust ja saadab
     expectedUpdatedAt fingerprint'i. WAITING EI tee seemet veel teistele nähtavaks. */
  async function confirmShare() {
    if (!shareSeed || saving || !shareConfirmed) return;
    setSaving(true);
    setError("");
    setConflictScope(null);
    try {
      const response = await fetch(`/api/topic-seeds/${encodeURIComponent(shareSeed.id)}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale },
        body: JSON.stringify({ expectedUpdatedAt: shareSeed.updatedAt || null, confirmedNoIdentifiers: true })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.seed) {
        // No misleading WAITING on failure (incl. a 409 version conflict).
        if (response.status === 409) setConflictScope("share");
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "topic_seeds.errors.request_failed",
          fallbackText: "Teemaseemne toiming ebaõnnestus. Proovi uuesti."
        }));
        return;
      }
      dataVersionRef.current += 1;
      const card = toCardSeed(payload.seed);
      setSeeds((prev) => prev.map((s) => (s.id === card.id ? card : s)));
      setShareSeed(null);
      setShareConfirmed(false);
      setNotice(readText(t, "topic_seeds.notices.queued", "Üldistus on kinnitatud ja külmutatud. Praegu pole see veel teistele nähtav — grupinähtavus tekib hilisemas Kovisiooni sidumises."));
    } catch {
      setError(readText(t, "topic_seeds.errors.request_failed", "Teemaseemne toiming ebaõnnestus. Proovi uuesti."));
    } finally {
      setSaving(false);
    }
  }

  const visibleSeeds = useMemo(() => {
    if (filter === "minu") return seeds.filter((s) => s.mine);
    if (filter === "koik") return seeds;
    return seeds.filter((s) => s.status === filter);
  }, [seeds, filter]);

  const counts = useMemo(() => {
    const c = { koik: seeds.length, minu: seeds.filter((s) => s.mine).length };
    for (const f of ["ootel", "valitud", "jarelvaates"]) c[f] = seeds.filter((s) => s.status === f).length;
    return c;
  }, [seeds]);

  const hasAdjustedCards = useMemo(
    () =>
      Object.values(cardOffsets).some((offset) => offset.x !== 0 || offset.y !== 0) ||
      Object.keys(cardSizes).length > 0,
    [cardOffsets, cardSizes]
  );

  function getCardOffset(seedId) {
    return cardOffsets[seedId] || { x: 0, y: 0 };
  }

  function getCardSize(seedId) {
    return cardSizes[seedId] || null;
  }

  function getCardBounds(cardElement, currentOffset) {
    const spatialBoundsElement = spatialBoundsRef.current;
    if (!spatialBoundsElement || !cardElement) return null;

    const spatialBoundsRect = spatialBoundsElement.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    const baseLeft = cardRect.left - currentOffset.x;
    const baseTop = cardRect.top - currentOffset.y;
    const inset = 6;

    return {
      minX: spatialBoundsRect.left + inset - baseLeft,
      maxX: spatialBoundsRect.right - inset - (baseLeft + cardRect.width),
      minY: spatialBoundsRect.top + inset - baseTop,
      maxY: spatialBoundsRect.bottom - inset - (baseTop + cardRect.height)
    };
  }

  function constrainCardOffset(offset, bounds) {
    if (!bounds) return offset;
    return {
      x: Math.round(clampNumber(offset.x, bounds.minX, bounds.maxX)),
      y: Math.round(clampNumber(offset.y, bounds.minY, bounds.maxY))
    };
  }

  function applyCardOffset(element, offset) {
    if (!element) return;
    element.style.setProperty("--ts-drag-x", `${offset.x}px`);
    element.style.setProperty("--ts-drag-y", `${offset.y}px`);
  }

  function getCardResizeBounds(cardElement) {
    const spatialBoundsElement = spatialBoundsRef.current;
    if (!spatialBoundsElement || !cardElement) return null;

    const spatialBoundsRect = spatialBoundsElement.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    const inset = 6;

    return {
      minWidth: CARD_MIN_WIDTH,
      maxWidth: Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, spatialBoundsRect.right - cardRect.left - inset)),
      minHeight: CARD_MIN_HEIGHT,
      maxHeight: Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, spatialBoundsRect.bottom - cardRect.top - inset))
    };
  }

  function constrainCardSize(size, bounds) {
    if (!bounds) return size;
    return {
      width: Math.round(clampNumber(size.width, bounds.minWidth, bounds.maxWidth)),
      height: Math.round(clampNumber(size.height, bounds.minHeight, bounds.maxHeight))
    };
  }

  function applyCardSize(element, size) {
    if (!element) return;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
  }

  function beginCardDrag(event, seed) {
    if (event.button !== 0) return;

    const cardElement = cardRefs.current.get(seed.id);
    if (!cardElement) return;

    const initialOffset = getCardOffset(seed.id);
    const bounds = getCardBounds(cardElement, initialOffset);
    dragRef.current = {
      seed,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialOffset,
      latestOffset: initialOffset,
      bounds,
      cardElement
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setFrontSeedId(seed.id);
    setMovingSeedId(seed.id);
    setLayoutNotice(`Liigutan kaarti „${seed.title}”.`);
  }

  function moveCardDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextOffset = constrainCardOffset(
      {
        x: drag.initialOffset.x + event.clientX - drag.startX,
        y: drag.initialOffset.y + event.clientY - drag.startY
      },
      drag.bounds
    );

    drag.latestOffset = nextOffset;
    applyCardOffset(drag.cardElement, nextOffset);
  }

  function endCardDrag(event, { cancelled = false } = {}) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const finalOffset = cancelled ? drag.initialOffset : drag.latestOffset;
    applyCardOffset(drag.cardElement, finalOffset);
    if (!cancelled) {
      setCardOffsets((previous) => ({ ...previous, [drag.seed.id]: finalOffset }));
      setLayoutNotice(
        `Kaart „${drag.seed.title}” paigutatud: ${finalOffset.x}px külgsuunas ja ${finalOffset.y}px vertikaalselt.`
      );
    } else {
      setLayoutNotice(`Kaardi „${drag.seed.title}” liigutamine katkestati.`);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setMovingSeedId(null);
  }

  function nudgeCard(event, seed) {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];

    if (event.key === "Home") {
      event.preventDefault();
      setFrontSeedId(seed.id);
      setCardOffsets((previous) => ({ ...previous, [seed.id]: { x: 0, y: 0 } }));
      setLayoutNotice(`Kaart „${seed.title}” on tagasi algses kohas.`);
      return;
    }

    if (!direction) return;
    event.preventDefault();
    setFrontSeedId(seed.id);

    const currentOffset = getCardOffset(seed.id);
    const cardElement = cardRefs.current.get(seed.id);
    const bounds = getCardBounds(cardElement, currentOffset);
    const step = event.shiftKey ? CARD_NUDGE_LARGE : CARD_NUDGE;
    const nextOffset = constrainCardOffset(
      {
        x: currentOffset.x + direction[0] * step,
        y: currentOffset.y + direction[1] * step
      },
      bounds
    );

    setCardOffsets((previous) => ({ ...previous, [seed.id]: nextOffset }));
    setLayoutNotice(`Kaart „${seed.title}” liigutatud nooleklahviga.`);
  }

  function beginCardResize(event, seed) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const cardElement = cardRefs.current.get(seed.id);
    if (!cardElement) return;

    const cardRect = cardElement.getBoundingClientRect();
    const initialSize = getCardSize(seed.id) || {
      width: cardRect.width,
      height: cardRect.height
    };
    const bounds = getCardResizeBounds(cardElement);

    resizeRef.current = {
      seed,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialSize,
      latestSize: initialSize,
      bounds,
      cardElement
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setFrontSeedId(seed.id);
    setResizingSeedId(seed.id);
    setLayoutNotice(`Muudan kaardi „${seed.title}” suurust.`);
  }

  function resizeCard(event) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const nextSize = constrainCardSize(
      {
        width: resize.initialSize.width + event.clientX - resize.startX,
        height: resize.initialSize.height + event.clientY - resize.startY
      },
      resize.bounds
    );

    resize.latestSize = nextSize;
    applyCardSize(resize.cardElement, nextSize);
  }

  function endCardResize(event, { cancelled = false } = {}) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const finalSize = cancelled ? resize.initialSize : resize.latestSize;
    applyCardSize(resize.cardElement, finalSize);
    if (!cancelled) {
      setCardSizes((previous) => ({ ...previous, [resize.seed.id]: finalSize }));
      setLayoutNotice(`Kaardi „${resize.seed.title}” suurus on ${finalSize.width} × ${finalSize.height} pikslit.`);
    } else {
      setLayoutNotice(`Kaardi „${resize.seed.title}” suuruse muutmine katkestati.`);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizingSeedId(null);
  }

  function resizeCardWithKeyboard(event, seed) {
    if (event.key === "Home") {
      event.preventDefault();
      setFrontSeedId(seed.id);
      setCardSizes((previous) => {
        const next = { ...previous };
        delete next[seed.id];
        return next;
      });
      setLayoutNotice(`Kaardi „${seed.title}” algne suurus on taastatud.`);
      return;
    }

    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];
    if (!direction) return;
    event.preventDefault();

    const cardElement = cardRefs.current.get(seed.id);
    if (!cardElement) return;
    const cardRect = cardElement.getBoundingClientRect();
    const currentSize = getCardSize(seed.id) || { width: cardRect.width, height: cardRect.height };
    const bounds = getCardResizeBounds(cardElement);
    const step = event.shiftKey ? CARD_RESIZE_STEP_LARGE : CARD_RESIZE_STEP;
    const nextSize = constrainCardSize(
      {
        width: currentSize.width + direction[0] * step,
        height: currentSize.height + direction[1] * step
      },
      bounds
    );

    setFrontSeedId(seed.id);
    setCardSizes((previous) => ({ ...previous, [seed.id]: nextSize }));
    setLayoutNotice(`Kaardi „${seed.title}” suurust muudeti nooleklahviga.`);
  }

  function resetCardLayout() {
    setCardOffsets({});
    setCardSizes({});
    setFrontSeedId(null);
    setLayoutNotice("Kõik kaardid on tagasi algses paigutuses.");
  }

  /* ---------- Ühised tükid ---------- */

  const topBar = (
    <header className="ts-top">
      <div className="ts-brand">
        <button type="button" className="ts-exit" title="Tagasi ruumi" onClick={() => window.history.back()}>
          ← Välju
        </button>
        <div>
          <p className="ts-brand-name">Teemaseemned</p>
          <p className="ts-brand-sub">Juhtumi märkamisest kovisioonini</p>
        </div>
      </div>
      <nav className="ts-nav" aria-label="Kovisiooni funktsioonid">
        <Link className="ts-nav-link" href="/kovisioon">
          Kovisiooni ruum
        </Link>
        <span className="ts-nav-link" aria-current="page" data-active="1">
          Teemaseemned
        </span>
        <Link className="ts-nav-link" href="/parimad-praktikad">
          {readText(t, "room.kovision_practices_card", "Parimad praktikad")}
        </Link>
      </nav>
      <div className="ts-tools">
        <button type="button" data-variant aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
          Abi
        </button>
        {ownerName ? (
          <div className="ts-user">
            <span className="ts-user-name">{ownerName}</span>
            {ownerTitle ? <span className="ts-user-title">{ownerTitle}</span> : null}
          </div>
        ) : null}
      </div>
    </header>
  );

  /* §3 piiriselgitus — nähtav loomisvaates ja abikihis */
  const boundaryNote = (
    <p className="ts-boundary">
      Teemaseemne kaardistus aitab professionaalset olukorda mõtestada. See ei asenda seadusest tulenevat
      hindamist, ametlikku juhtumiplaani ega riskihindamist.
    </p>
  );

  function seedCard(seed, { actions = true } = {}) {
    const movable = actions;
    const offset = movable ? getCardOffset(seed.id) : { x: 0, y: 0 };
    const size = movable ? getCardSize(seed.id) : null;
    const positioned = offset.x !== 0 || offset.y !== 0;

    return (
      <article
        key={seed.id}
        ref={
          movable
            ? (element) => {
                if (element) cardRefs.current.set(seed.id, element);
                else cardRefs.current.delete(seed.id);
              }
            : undefined
        }
        className="ts-card"
        data-status={seed.status}
        data-moving={movingSeedId === seed.id ? "true" : undefined}
        data-resizing={resizingSeedId === seed.id ? "true" : undefined}
        data-front={frontSeedId === seed.id ? "true" : undefined}
        data-positioned={positioned ? "true" : undefined}
        style={
          movable
            ? {
                "--ts-drag-x": `${offset.x}px`,
                "--ts-drag-y": `${offset.y}px`,
                ...(size ? { width: `${size.width}px`, height: `${size.height}px` } : {})
              }
            : undefined
        }
      >
        <header className="ts-card-head">
          <div className="ts-card-heading">
            {movable ? (
              <button
                type="button"
                className="ts-drag-handle"
                aria-label={`Liiguta kaarti „${seed.title}”`}
                aria-describedby="ts-move-instructions"
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home"
                title="Lohista kaarti. Nooleklahvid liigutavad, Home taastab kaardi."
                onPointerDown={(event) => beginCardDrag(event, seed)}
                onPointerMove={moveCardDrag}
                onPointerUp={(event) => endCardDrag(event)}
                onPointerCancel={(event) => endCardDrag(event, { cancelled: true })}
                onKeyDown={(event) => nudgeCard(event, seed)}
              >
                <svg aria-hidden="true" viewBox="0 0 18 24" focusable="false">
                  <circle cx="6" cy="6" r="1.6" />
                  <circle cx="12" cy="6" r="1.6" />
                  <circle cx="6" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="6" cy="18" r="1.6" />
                  <circle cx="12" cy="18" r="1.6" />
                </svg>
              </button>
            ) : null}
            <h3 className="ts-card-title">{seed.title}</h3>
          </div>
          <span className="ts-status" data-status={seed.status}>
            {STATUS_LABELS[seed.status]}
          </span>
        </header>
        <p className="ts-card-meta">
          {seed.context} · {seed.kind}
        </p>
        <dl className="ts-card-rows">
          <div>
            <dt>Miks praegu</dt>
            <dd>{seed.whyNow}</dd>
          </div>
          <div>
            <dt>Soovin</dt>
            <dd>{seed.support.join(" · ")}</dd>
          </div>
          <div>
            <dt>Olulisus</dt>
            <dd>{seed.importance == null ? "Valimata" : `${seed.importance}/10`}</dd>
          </div>
        </dl>
        <footer className="ts-card-foot">
          <span className="ts-card-owner">
            {seed.owner}
            {seed.mine ? " (sina)" : ""}
          </span>
          <span className="ts-card-wait">{seed.meta}</span>
        </footer>
        {actions ? (
          <div className="ts-card-actions">
            {seed.mine && seed.status === "mustand" ? (
              <>
                <button
                  type="button"
                  data-variant
                  className="ts-acc"
                  disabled={!seed.isComplete}
                  aria-describedby={!seed.isComplete ? `ts-incomplete-${seed.id}` : undefined}
                  onClick={() => {
                    if (!seed.isComplete) return;
                    setError("");
                    setConflictScope(null);
                    setShareConfirmed(false);
                    setShareSeed(seed);
                  }}
                >
                  {readText(t, "topic_seeds.ui.queue_action", "Lisa kovisioonijärjekorda")}
                </button>
                <button type="button" data-variant onClick={() => openEdit(seed)}>
                  {readText(t, "topic_seeds.ui.edit_quick", "Ava või muuda kiiret seemet")}
                </button>
                <button type="button" data-variant onClick={() => setView("prep")}>
                  Jätka ettevalmistust
                </button>
                {!seed.isComplete ? (
                  <p id={`ts-incomplete-${seed.id}`} className="ts-reason">
                    {readText(
                      t,
                      "topic_seeds.ui.complete_before_queue",
                      "Täida kiire seemne kohustuslikud väljad enne järjekorda lisamist."
                    )}
                  </p>
                ) : null}
              </>
            ) : (
              <button type="button" data-variant onClick={() => setDetailSeed(seed)}>
                {readText(t, "topic_seeds.detail.view_action", "Vaata kinnitatud kaarti")}
              </button>
            )}
          </div>
        ) : null}
        {movable ? (
          <button
            type="button"
            className="ts-resize-handle"
            aria-label={`Muuda kaardi „${seed.title}” suurust`}
            aria-describedby="ts-resize-instructions"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home"
            title="Tiri kaardi suuruse muutmiseks. Nooleklahvid muudavad mõõtu, Home taastab suuruse."
            onPointerDown={(event) => beginCardResize(event, seed)}
            onPointerMove={resizeCard}
            onPointerUp={(event) => endCardResize(event)}
            onPointerCancel={(event) => endCardResize(event, { cancelled: true })}
            onKeyDown={(event) => resizeCardWithKeyboard(event, seed)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M9 19 19 9M14 19l5-5M19 19h.01" />
            </svg>
          </button>
        ) : null}
      </article>
    );
  }

  /* ---------- Vaade: loend (§26) ---------- */

  const listView = (
    <section ref={spatialBoundsRef} className="ts-shell ts-spatial-canvas" aria-label="Teemaseemnete leht">
      {topBar}
      <section className="ts-context-panel" aria-label="Teemaseemnete ülevaade ja tööriistad">
        <div className="ts-list-head">
          <div>
            <h1 className="ts-h1">Teemaseemned</h1>
            <p className="ts-intro">
              {readText(
                t,
                "topic_seeds.list_intro",
                "Professionaalsed tööseemned: märka teema, valmista privaatselt ette ja kinnita üldistatud kaart kovisioonijärjekorda. Seeme jääb ainult sulle, kuni Kovisiooni grupinähtavus on ehitatud."
              )}
            </p>
          </div>
          <button type="button" data-variant className="ts-acc" disabled={loading} onClick={openCreate}>
            {readText(t, "topic_seeds.ui.new_seed", "Uus teemaseeme")}
          </button>
        </div>

        {notice ? (
          <p className="ts-notice" role="status">
            {notice}
          </p>
        ) : null}

        {error ? (
          <div className="ts-notice" role="alert" data-tone="error">
            <p>{error}</p>
            {!loading && seeds.length === 0 ? (
              <button type="button" data-variant onClick={reloadAfterConflict}>
                {readText(t, "topic_seeds.ui.reload", "Laadi leht uuesti")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          className="ts-filters"
          role="group"
          aria-label={readText(t, "topic_seeds.ui.filters_aria", "Teemaseemnete filtrid")}
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="ts-filter"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ts-filter-count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ts-spatial-tools">
          <p id="ts-move-instructions" className="ts-spatial-hint">
            Haara kaardi ülanurgast liigutamiseks või paremast alanurgast suuruse muutmiseks. Nooleklahvid
            muudavad täpselt, Shift + nool suurema sammu.
          </p>
          <span id="ts-resize-instructions" className="ts-sr-status">
            Paremas alanurgas olevat pidet tirides muudad kaardi laiust ja kõrgust.
          </span>
          {hasAdjustedCards ? (
            <button type="button" className="ts-layout-reset" onClick={resetCardLayout}>
              Taasta paigutus
            </button>
          ) : null}
          <span className="ts-sr-status" role="status" aria-live="polite">
            {layoutNotice}
          </span>
        </div>
      </section>

      {loading ? (
        <p className="ts-empty" role="status">
          {readText(t, "topic_seeds.ui.loading", "Laadin sinu teemaseemneid…")}
        </p>
      ) : error && seeds.length === 0 ? null : visibleSeeds.length ? (
        <div className="ts-grid">{visibleSeeds.map((s) => seedCard(s))}</div>
      ) : (
        <p className="ts-empty">
          {filter === "minu"
            ? readText(
                t,
                "topic_seeds.ui.empty_mine",
                "Sul ei ole veel ühtegi teemaseemet. Alusta nupuga „Uus teemaseeme”."
              )
            : readText(t, "topic_seeds.ui.empty_filter", "Selle filtri all ei ole praegu ühtegi seemet.")}
        </p>
      )}
    </section>
  );

  /* ---------- Vaade: loomine (etapp 0 + samm 1) ---------- */

  const gateChip =
    gateResolved && !gateBlocked ? (
      <div className="ts-gate-chip">
        <span>
          Sobivuskontroll:{" "}
          {gate === "ei"
            ? "vahetut ohtu ei ole"
            : gate === "teadmata"
              ? "oht ei ole teada — uuenda, kui olukord täpsustub"
              : "risk on hinnatud, refleksioon võib jätkuda"}
        </span>
        <button
          type="button"
          data-variant
          onClick={() => {
            setGate(null);
            setGateResolved(false);
          }}
        >
          Muuda
        </button>
      </div>
    ) : null;

  const gateBlock = !gateResolved ? (
    <section className="ts-gate" aria-label="Sobivuse ja turvalisuse kontroll">
      {gate !== "jah" && gate !== "voimalik" ? (
        <>
          <h2 className="ts-gate-q">Kas olukorras võib olla vahetu oht või kohese sekkumise vajadus?</h2>
          <div className="ts-gate-opts">
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("ei");
                setGateResolved(true);
              }}
            >
              Ei
            </button>
            <button type="button" data-variant onClick={() => setGate("voimalik")}>
              Võimalik, vajab kontrollimist
            </button>
            <button type="button" data-variant onClick={() => setGate("jah")}>
              Jah
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("teadmata");
                setGateResolved(true);
              }}
            >
              Ei ole teada
            </button>
          </div>
        </>
      ) : (
        <div className="ts-gate-warn">
          <h2 className="ts-gate-q">Kovisioon ega Teemaseeme ei asenda kiireloomulist sekkumist.</h2>
          <p className="ts-gate-sub">Kinnita, kas vajalikud vahetud toimingud on tehtud.</p>
          <div className="ts-gate-opts">
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("sekkumine-kaivitatud");
                setGateResolved(true);
              }}
            >
              Vajalik sekkumine on käivitatud
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("jah-ei-oota");
                setGateResolved(true);
              }}
            >
              Juhtum ei saa oodata
            </button>
            <button
              type="button"
              data-variant
              onClick={() => {
                setGate("risk-hinnatud");
                setGateResolved(true);
              }}
            >
              Risk on hinnatud ning professionaalne refleksioon võib jätkuda
            </button>
            <button type="button" data-variant disabled={saving} onClick={saveDraft}>
              {readText(t, "topic_seeds.ui.save_and_exit", "Salvestan mustandi ja väljun")}
            </button>
          </div>
        </div>
      )}
    </section>
  ) : gateBlocked ? (
    <section className="ts-gate ts-gate-stop" aria-label="Kiireloomulisuse piir">
      <h2 className="ts-gate-q">Tegele kõigepealt kohese sekkumisega.</h2>
      <p className="ts-gate-sub">
        See juhtum ei saa oodata — kovisioon ei ole kiireloomulise sekkumise töövorm. Teemaseemne saad luua
        hiljem, kui vahetu tegevus on käivitatud.
      </p>
      <div className="ts-gate-opts">
        <button
          type="button"
          data-variant
          onClick={() => {
            setGate(null);
            setGateResolved(false);
          }}
        >
          Muuda vastust
        </button>
        <button type="button" data-variant onClick={() => setView("list")}>
          Tagasi Teemaseemnete lehele
        </button>
      </div>
    </section>
  ) : null;

  const previewColumn = (
    <aside className="ts-side">
      <section className="ts-preview" aria-label="Külmutatava kaardi eelvaade">
        <header className="ts-side-head">
          <h2 className="ts-side-title">{readText(t, "topic_seeds.preview.title", "Külmutatava kaardi eelvaade")}</h2>
          <span className="ts-status" data-status="mustand">
            Pole veel jagatud
          </span>
        </header>
        <p className="ts-side-sub">
          {readText(t, "topic_seeds.preview.sub", "Seemnekaart sellisena, nagu see kovisioonijärjekorda külmutatakse.")}
        </p>
        {seedCard(
          {
            id: "eelvaade",
            title: title.trim() || "—",
            owner: ownerName,
            mine: true,
            context: contextLabel || "—",
            kind: kindLabel || "—",
            whyNow: whyNow.trim() || "—",
            support: support.length ? support.map((key) => SUPPORT_LABEL[key] || key) : ["—"],
            importance,
            status: "mustand",
            meta: "Eelvaade"
          },
          { actions: false }
        )}
      </section>

      <section className="ts-private" aria-label="Valikuline privaatne ettevalmistus">
        <header className="ts-side-head">
          <h2 className="ts-side-title">
            <svg className="ts-lock" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            Valikuline privaatne ettevalmistus
          </h2>
        </header>
        <p className="ts-side-sub">
          Võid hiljem lisada ainult vajaliku. Jääb ainult sulle, kuni ise otsustad teisiti.
        </p>
        <ul className="ts-private-list">
          {PRIVATE_MODULES.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      {boundaryNote}
    </aside>
  );

  const createView = (
    <section
      className="ts-shell ts-create"
      aria-label={readText(
        t,
        editingSeedId ? "topic_seeds.ui.edit_view_aria" : "topic_seeds.ui.create_view_aria",
        editingSeedId ? "Teemaseemne muutmine" : "Uue teemaseemne loomine"
      )}
    >
      {/* Loomisvaates EI OLE platvorminavi ega sessioonikroomi (§33.2 +
          lõuendireegel: kõik mahub ekraanile) — tagasi-nupp ja Abi on käes */}
      <div className="ts-create-head">
        <div className="ts-create-intro">
          <button type="button" className="ts-back" onClick={() => setView("list")}>
            ← Tagasi Teemaseemnete lehele
          </button>
          <h1 className="ts-h1">
            {readText(
              t,
              editingSeedId ? "topic_seeds.ui.edit_heading" : "topic_seeds.ui.create_heading",
              editingSeedId ? "Muuda kiiret seemet" : "Uus teemaseeme"
            )}
          </h1>
          <p className="ts-intro">
            Loo lühike ja üldistatud kirjeldus teemast — privaatne täiendamine on hiljem valikuline.
          </p>
        </div>
        <ol className="ts-rail" aria-label="Teemaseemne loomise sammud">
          {CREATE_STEPS.map((s, i) => (
            <li
              key={s}
              className="ts-step"
              data-state={i === 0 ? "active" : "todo"}
              aria-current={i === 0 ? "step" : undefined}
              title={i > 0 ? "Avaneb pärast kiire seemne loomist" : undefined}
            >
              <span className="ts-step-dot">{i + 1}</span>
              <span className="ts-step-label">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" data-variant aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
          Abi
        </button>
      </div>

      {gateChip}
      {gateBlock}

      {error ? (
        <div
          className="ts-notice"
          role="alert"
          data-tone="error"
          aria-label={readText(t, "topic_seeds.ui.create_error_aria", "Teemaseemne salvestamise viga")}
        >
          <p>{error}</p>
          {conflictAction("edit")}
        </div>
      ) : null}

      <div className="ts-create-main">
        <form
          className="ts-form"
          onSubmit={(e) => {
            e.preventDefault();
            createSeed();
          }}
        >
          <fieldset className="ts-fieldset" disabled={!gateResolved || gateBlocked}>
            {!gateResolved ? (
              <p className="ts-fieldset-note">Vasta kõigepealt sobivuse ja turvalisuse kontrollile.</p>
            ) : null}

            <div className="ts-field">
              <label className="ts-label" htmlFor="ts-title">
                1. Pealkiri
              </label>
              <p className="ts-hint">Üldistatud, ilma nime või muu tuvastava detailita.</p>
              <input
                id="ts-title"
                className="ts-input"
                type="text"
                maxLength={80}
                value={title}
                placeholder="Lühike ja üldistatud pealkiri teemast"
                onChange={(e) => setTitle(e.target.value)}
              />
              <span className="ts-count">{title.length} / 80</span>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-ctx-label">
                2. Juhtumi kontekst
              </span>
              <p className="ts-hint">Millises professionaalses olukorras see teema asub?</p>
              <div className="ts-choice-grid" role="group" aria-labelledby="ts-ctx-label">
                {CONTEXTS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="ts-choice"
                    aria-pressed={contextKey === c.key}
                    onClick={() => setContextKey(c.key)}
                  >
                    <span>{c.label}</span>
                    {c.sub ? <span className="ts-choice-sub">{c.sub}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-kind-label">
                3. Juhtumi liik
              </span>
              <p className="ts-hint">Millise töölaadiga on tegemist?</p>
              <div className="ts-choice-grid" role="group" aria-labelledby="ts-kind-label">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    className="ts-choice"
                    aria-pressed={kindKey === k.key}
                    onClick={() => setKindKey(k.key)}
                  >
                    <span>{k.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <label className="ts-label" htmlFor="ts-why">
                4. Miks see on praegu oluline?
              </label>
              <p className="ts-hint">Üks kuni kolm üldistatud lauset.</p>
              <textarea
                id="ts-why"
                className="ts-input ts-textarea"
                maxLength={300}
                rows={2}
                value={whyNow}
                placeholder="Kirjuta 1–3 lauset…"
                onChange={(e) => setWhyNow(e.target.value)}
              />
              <span className="ts-count">{whyNow.length} / 300</span>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-sup-label">
                5. Millist tuge soovid kovisioonigrupilt?
              </span>
              <p className="ts-hint">Vali üks või mitu.</p>
              <div className="ts-chips" role="group" aria-labelledby="ts-sup-label">
                {SUPPORT_OPTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="ts-chip"
                    aria-pressed={support.includes(s.key)}
                    onClick={() =>
                      setSupport((prev) => (prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key]))
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label" id="ts-imp-label">
                6. Kui oluline see teema sulle praegu on?
              </span>
              <p className="ts-hint">
                1 — mitte oluline · 10 — väga oluline. Praegu:{" "}
                <strong>{importance == null ? "Valimata" : `${importance}/10`}</strong>
              </p>
              <div className="ts-scale" role="group" aria-labelledby="ts-imp-label">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="ts-scale-btn"
                    aria-pressed={importance === n}
                    onClick={() => setImportance(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="ts-actions">
            <label className="ts-toggle">
              <input
                type="checkbox"
                checked={continuePrep}
                disabled={!gateResolved || gateBlocked}
                onChange={(e) => setContinuePrep(e.target.checked)}
              />
              <span>Pärast loomist jätkan privaatse ettevalmistusega</span>
            </label>
            <div className="ts-actions-btns">
              <button
                type="button"
                data-variant
                disabled={!gateResolved || gateBlocked || saving}
                onClick={saveDraft}
              >
                {saving
                  ? readText(t, "topic_seeds.ui.saving", "Salvestan…")
                  : readText(t, "topic_seeds.ui.save_draft", "Salvesta mustand")}
              </button>
              <button type="submit" data-variant="primary" className="ts-acc" disabled={!canCreate || saving}>
                {saving
                  ? readText(t, "topic_seeds.ui.saving", "Salvestan…")
                  : readText(
                      t,
                      editingSeedId ? "topic_seeds.ui.save_changes" : "topic_seeds.ui.create_action",
                      editingSeedId ? "Salvesta muudatused" : "Loo Teemaseeme"
                    )}
              </button>
            </div>
            {gateResolved && !gateBlocked && missing.length ? (
              <p className="ts-reason">Enne loomist täida: {missing.join(", ")}.</p>
            ) : null}
          </div>
        </form>

        {previewColumn}
      </div>
    </section>
  );

  /* ---------- Vaade: privaatne ettevalmistus (järgmine ehitusjärk) ---------- */

  const prepView = (
    <section className="ts-shell ts-create" aria-label="Privaatne professionaalne ettevalmistus">
      <div className="ts-create-head">
        <div className="ts-create-intro">
          <button type="button" className="ts-back" onClick={() => setView("list")}>
            ← Tagasi Teemaseemnete lehele
          </button>
          <h1 className="ts-h1">Privaatne professionaalne ettevalmistus</h1>
        </div>
        <ol className="ts-rail" aria-label="Teemaseemne loomise sammud">
          {CREATE_STEPS.map((s, i) => (
            <li key={s} className="ts-step" data-state={i === 0 ? "done" : i === 1 ? "active" : "todo"}>
              <span className="ts-step-dot">{i + 1}</span>
              <span className="ts-step-label">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="ts-intro">
        Kiire seeme on loodud ja nähtav ainult sulle. Ettevalmistuse moodulid (eluvaldkonnad, vaated,
        võrgustik, senine töö, fookus) on järgmises ehitusjärgus — praegu saad seemne jagada
        kovisioonijärjekorda Teemaseemnete lehelt.
      </p>
      <ul className="ts-private-list ts-prep-list">
        {PRIVATE_MODULES.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <div className="ts-actions-btns">
        <button
          type="button"
          data-variant="primary"
          className="ts-acc"
          onClick={() => {
            setNotice("Seeme ootab sind Teemaseemnete lehel filtri „Minu seemned” all.");
            setView("list");
            setFilter("minu");
          }}
        >
          Tagasi Teemaseemnete lehele
        </button>
      </div>
      {boundaryNote}
    </section>
  );

  /* ---------- Kihid ---------- */

  const helpLayer = helpOpen ? (
    <div className="ts-layer" role="dialog" aria-modal="true" aria-label="Abi">
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">Mis on Teemaseeme?</h2>
          <button type="button" data-variant onClick={() => setHelpOpen(false)}>
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          Teemaseeme on privaatne professionaalne tööseeme: märkad teema, lood lühikese üldistatud kaardi
          ja soovi korral valmistad juhtumit privaatselt ette. Kovisiooni liigub ainult sinu teadlikult
          jagatud üldistus — mitte detailne juhtumilugu.
        </p>
        {boundaryNote}
      </div>
    </div>
  ) : null;

  const detailLayer = detailSeed ? (
    <div
      className="ts-layer"
      role="dialog"
      aria-modal="true"
      aria-label={readText(t, "topic_seeds.ui.detail_dialog_aria", "Kinnitatud seemnekaart")}
    >
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">{readText(t, "topic_seeds.detail.title", "Kinnitatud seemnekaart")}</h2>
          <button type="button" data-variant onClick={() => setDetailSeed(null)}>
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          {readText(t, "topic_seeds.detail.sub", "See on sinu külmutatud üldistus. Praegu pole see veel teistele nähtav.")}
        </p>
        {seedCard(detailSeed, { actions: false })}
      </div>
    </div>
  ) : null;

  const shareLayer = shareSeed ? (
    <div
      className="ts-layer"
      role="dialog"
      aria-modal="true"
      aria-label={readText(t, "topic_seeds.ui.share_dialog_aria", "Järjekorda lisamise kinnitamine")}
    >
      <div className="ts-layer-card">
        <header className="ts-layer-head">
          <h2 className="ts-side-title">{readText(t, "topic_seeds.share.title", "Kinnita külmutatav üldistus")}</h2>
          <button
            type="button"
            data-variant
            onClick={() => {
              setShareSeed(null);
              setShareConfirmed(false);
              setError("");
              setConflictScope(null);
            }}
          >
            Sulge
          </button>
        </header>
        <p className="ts-side-sub">
          {readText(t, "topic_seeds.share.sub", "Kinnitamisel külmutatakse see seemnekaart kovisioonijärjekorra jaoks. Privaatne ettevalmistus jääb jagamata.")}
        </p>
        <p className="ts-side-sub">
          {readText(t, "topic_seeds.share.not_shared_note", "Kinnitamine ei jaga seemet veel teiste kasutajatega — grupinähtavus lisandub hiljem.")}
        </p>
        {seedCard(shareSeed, { actions: false })}
        {error ? (
          <div
            className="ts-notice"
            role="alert"
            data-tone="error"
            aria-label={readText(t, "topic_seeds.ui.share_error_aria", "Järjekorda lisamise viga")}
          >
            <p>{error}</p>
            {conflictAction("share")}
          </div>
        ) : null}
        <label className="ts-toggle">
          <input
            type="checkbox"
            checked={shareConfirmed}
            onChange={(e) => setShareConfirmed(e.target.checked)}
          />
          <span>
            {readText(t, "topic_seeds.share.confirm_no_identifiers", "Kinnitan, et see kaart ei sisalda nime, isikukoodi, täpset aadressi ega muud otsest tuvastajat.")}
          </span>
        </label>
        <div className="ts-actions-btns">
          <button
            type="button"
            data-variant="primary"
            className="ts-acc"
            disabled={!shareConfirmed || saving}
            onClick={confirmShare}
          >
            {readText(t, "topic_seeds.share.confirm_action", "Kinnitan üldistuse ja lisan ootejärjekorda")}
          </button>
          <button
            type="button"
            data-variant
            onClick={() => {
              setShareSeed(null);
              setShareConfirmed(false);
              setError("");
              setConflictScope(null);
            }}
          >
            {readText(t, "topic_seeds.share.keep_private", "Jäta praegu ainult endale")}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="ts-page">
      {view === "list" ? listView : view === "create" ? createView : prepView}
      {helpLayer}
      {detailLayer}
      {shareLayer}
    </div>
  );
}
