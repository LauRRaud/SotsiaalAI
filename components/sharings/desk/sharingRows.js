/**
 * „Minu jagamised": laua osad, read ja avatud kirje sisu ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Kuni read sündisid lehe JSX-is, ei saanud testida, mida rida
 * näitab: seisu sõna pandi kokku serveri koodist (`my_sharings.status.${kood}`)
 * ja kood, millel kataloogis sõna ei olnud (suletud või tühistatud abikirje,
 * parandatud või suletud toeavaldus), jõudis ekraanile toore võtme või koodina.
 * Siin on puhtad funktsioonid; leht (`../MySharingsPage.jsx`) hoiab andmeid ja
 * päringuid ning vaated (`./SharingsViews.jsx`) ainult joonistavad.
 *
 * SEISU SÕNA TULEB LOENDIST. Iga kood, mida server võib saata, on siin
 * nimeliselt kirjas koos oma sõna võtmega. Koodi, mida loendis ei ole, ei
 * trükita: tühi märk on parem kui sisemine kood ekraanil.
 *
 * KES NÄEB, KUST TULI, KUI KAUA KEHTIB. Need kolm fakti (`facts`) on lehe
 * tuum ja nende sõnastus on sama mis enne: siin ei ole ühtegi fakti ümber
 * sõnastatud ega ära jäetud. Avatava osa real seisab „kes näeb" kohe pealkirja
 * all ja kõik kolm on avatud kirjes; osas, mille kirjet ei avata, on kõik kolm
 * real endal.
 *
 * VÕTMED ON VÄLJA KIRJUTATUD (mitte kokku liidetud), et test saaks kontrollida
 * iga teksti olemasolu kolmes keeles (`tests/my-sharings-views.test.mjs`).
 */

import { WORKER_FRAMEWORK_KEY } from "@/lib/frameworkAcceptances";

/**
 * Osade järjekord laual. Otsust ootavad ettepanekud on esimesed (need on
 * ainsad read, mis nõuavad inimeselt tegutsemist), nende järel vastust ootav
 * kiireloomuline abipalve; edasi see, mida inimene on ise saatnud.
 * Peab katma kõik serveri osad (`SHARING_SECTION_KEYS`): seda hoiab test.
 */
export const SECTION_ORDER = Object.freeze([
  "networkShares",
  "urgentRequests",
  "preInquiries",
  "rooms",
  "invites",
  "helpListings",
  "mentoringPreparations",
  "outgoingNetworkShares",
  "wellbeingSupportShares",
  "serviceReportShares",
  "roomSummaries",
  "privateRecords"
]);

/** Osa nimi, lühinimi kiirmenüü jaoks, selgitus ja tühjuse lause. */
export const SECTION_TEXTS = Object.freeze({
  networkShares: {
    title: "my_sharings.sections.network_shares",
    short: "my_sharings.views.short.network_shares",
    help: "my_sharings.section_help.network_shares",
    empty: "my_sharings.empty.network_shares"
  },
  urgentRequests: {
    title: "my_sharings.sections.urgent_requests",
    short: "my_sharings.views.short.urgent_requests",
    help: "my_sharings.section_help.urgent_requests",
    empty: "my_sharings.empty.urgent_requests"
  },
  preInquiries: {
    title: "my_sharings.sections.pre_inquiries",
    short: "my_sharings.views.short.pre_inquiries",
    help: "my_sharings.section_help.pre_inquiries",
    empty: "my_sharings.empty.pre_inquiries"
  },
  rooms: {
    title: "my_sharings.sections.rooms",
    short: "my_sharings.views.short.rooms",
    help: "my_sharings.section_help.rooms",
    empty: "my_sharings.empty.rooms"
  },
  invites: {
    title: "my_sharings.sections.invites",
    short: "my_sharings.views.short.invites",
    help: "my_sharings.section_help.invites",
    empty: "my_sharings.empty.invites"
  },
  helpListings: {
    title: "my_sharings.sections.help",
    short: "my_sharings.views.short.help",
    help: "my_sharings.section_help.help",
    empty: "my_sharings.empty.help"
  },
  mentoringPreparations: {
    title: "my_sharings.mentoring.section_title",
    short: "my_sharings.views.short.mentoring",
    help: "my_sharings.mentoring.section_help",
    empty: "my_sharings.mentoring.empty"
  },
  outgoingNetworkShares: {
    title: "my_sharings.sections.outgoing_network_shares",
    short: "my_sharings.views.short.outgoing_network_shares",
    help: "my_sharings.section_help.outgoing_network_shares",
    empty: "my_sharings.empty.outgoing_network_shares"
  },
  wellbeingSupportShares: {
    title: "my_sharings.sections.wellbeing_support_shares",
    short: "my_sharings.views.short.wellbeing_support_shares",
    help: "my_sharings.section_help.wellbeing_support_shares",
    empty: "my_sharings.empty.wellbeing_support_shares"
  },
  serviceReportShares: {
    title: "my_sharings.sections.service_report_shares",
    short: "my_sharings.views.short.service_report_shares",
    help: "my_sharings.section_help.service_report_shares",
    empty: "my_sharings.empty.service_report_shares"
  },
  roomSummaries: {
    title: "my_sharings.sections.room_summaries",
    short: "my_sharings.views.short.room_summaries",
    help: "my_sharings.section_help.room_summaries",
    empty: "my_sharings.empty.room_summaries"
  },
  privateRecords: {
    title: "my_sharings.sections.private_records",
    short: "my_sharings.views.short.private_records",
    help: "my_sharings.section_help.private_records",
    empty: "my_sharings.empty.private_records"
  }
});

/**
 * Osad, mille rida avaneb: avatud kirjes on pikk tekst või tegevus (otsus,
 * tagasivõtt, parandus, lahkumine). Ülejäänud osade kirjega ei saa siin midagi
 * teha, seepärast on nende kolm fakti real endal ja avada ei ole midagi.
 */
export const OPENING_SECTIONS = Object.freeze([
  "networkShares",
  "urgentRequests",
  "preInquiries",
  "rooms",
  "invites",
  "mentoringPreparations"
]);

export const opensItems = (section) => OPENING_SECTIONS.includes(section);

/** Osa jäi serveris laadimata (`SHARING_SECTION_STATUS`, lib/mySharings.js). */
export const UNAVAILABLE_STATUSES = Object.freeze(["UNAVAILABLE", "TIMEOUT"]);

export const isUnavailable = (status) => UNAVAILABLE_STATUSES.includes(String(status || ""));

/** Kood → sõna võti ja märgi toon. Toonita sõna on vaikne märk. */
export const STATE_WORDS = Object.freeze({
  /* Saadetud eelpöördumine: tagasivõtt ja parandus tulevad kirje väljadelt
     (`preInquiryState`), ülejäänu on `PreInquiryStatus`. Mustandit ja alla
     laaditud pöördumist saadetute hulka ei tule; kui tuleb, jääb märk tühjaks. */
  preInquiry: Object.freeze({
    SENT: { key: "my_sharings.status.sent" },
    READY: { key: "my_sharings.status.ready", tone: "ok" },
    ARCHIVED: { key: "my_sharings.status.archived" },
    RECALLED: { key: "my_sharings.status.recalled" },
    SUPERSEDED: { key: "my_sharings.status.superseded" }
  }),
  /* Server annab siia ainult kehtivad kutsed (`PENDING_PAYMENT`, `SENT`). */
  invite: Object.freeze({
    PENDING_PAYMENT: { key: "my_sharings.status.pending_payment", tone: "wait" },
    SENT: { key: "my_sharings.status.sent" }
  }),
  /* `HelpRecordStatus` ilma mustandita (mustandit server siia ei anna). */
  help: Object.freeze({
    OPEN: { key: "my_sharings.status.open", tone: "ok" },
    MATCHED: { key: "my_sharings.status.matched", tone: "ok" },
    CLOSED: { key: "my_sharings.status.closed" },
    CANCELLED: { key: "my_sharings.status.cancelled" },
    ARCHIVED: { key: "my_sharings.status.archived" }
  }),
  /* Ettepanek MINU kohta: sõnastus on inimese enda vaatest („keeldusid"). */
  incomingShare: Object.freeze({
    DRAFT: { key: "my_sharings.share_status.DRAFT" },
    AWAITING_CLIENT: { key: "my_sharings.share_status.AWAITING_CLIENT", tone: "wait" },
    CONFIRMED: { key: "my_sharings.share_status.CONFIRMED", tone: "ok" },
    DECLINED: { key: "my_sharings.share_status.DECLINED" },
    SENT: { key: "my_sharings.share_status.SENT" },
    OPENED: { key: "my_sharings.share_status.OPENED" },
    RESPONDED: { key: "my_sharings.share_status.RESPONDED" },
    RECALLED: { key: "my_sharings.share_status.RECALLED" },
    ENDED: { key: "my_sharings.share_status.ENDED" }
  }),
  /* Jagamine, mille MINA töötajana saatsin: sama seis töötaja vaatest („ootab
     kliendi otsust"). Varem kasutas see osa inimese enda vaate sõnu ja töötaja
     luges oma saadetud jagamise kohta „ootab sinu otsust". */
  outgoingShare: Object.freeze({
    DRAFT: { key: "network_share.status.DRAFT" },
    AWAITING_CLIENT: { key: "network_share.status.AWAITING_CLIENT", tone: "wait" },
    CONFIRMED: { key: "network_share.status.CONFIRMED", tone: "ok" },
    DECLINED: { key: "network_share.status.DECLINED" },
    SENT: { key: "network_share.status.SENT" },
    OPENED: { key: "network_share.status.OPENED" },
    RESPONDED: { key: "network_share.status.RESPONDED" },
    RECALLED: { key: "network_share.status.RECALLED" },
    ENDED: { key: "network_share.status.ENDED" }
  }),
  /* `UrgentRequestStatus`: sõnad on abipalve enda sõnastikust, et sama seis
     ei loeks kahel lehel kaht eri asja. */
  urgent: Object.freeze({
    SENT: { key: "urgent.status.SENT", tone: "wait" },
    READ: { key: "urgent.status.READ", tone: "wait" },
    TAKEN: { key: "urgent.status.TAKEN", tone: "ok" },
    DECLINED: { key: "urgent.status.DECLINED", tone: "risk" },
    RESOLVED: { key: "urgent.status.RESOLVED", tone: "ok" },
    EXPIRED: { key: "urgent.status.EXPIRED", tone: "risk" },
    RECALLED: { key: "urgent.status.RECALLED" }
  }),
  /* `WellbeingSupportShareStatus`: sõnad on toeavalduse enda sõnastikust. */
  supportShare: Object.freeze({
    SENT: { key: "org.supportShareStatus.SENT" },
    OPENED: { key: "org.supportShareStatus.OPENED" },
    RECALLED: { key: "org.supportShareStatus.RECALLED" },
    CORRECTED: { key: "org.supportShareStatus.CORRECTED" },
    CLOSED: { key: "org.supportShareStatus.CLOSED" }
  }),
  /* `ServiceReportShareStatus` ilma ettevalmistuseta (seda server siia ei anna). */
  reportShare: Object.freeze({
    SENT: { key: "my_sharings.share_status.SENT" },
    OPENED: { key: "my_sharings.share_status.OPENED" },
    RECALLED: { key: "my_sharings.share_status.RECALLED" }
  }),
  /* Mentorluse ettevalmistuse seis tuleb kirje kuupäevadest (`mentoringState`). */
  mentoring: Object.freeze({
    RECALLED: { key: "my_sharings.mentoring.recalled" },
    OPENED: { key: "my_sharings.mentoring.opened", tone: "ok" },
    SHARED: { key: "my_sharings.mentoring.shared" },
    PRIVATE: { key: "my_sharings.mentoring.private" }
  }),
  /* `RoomRole`: moderaator on siin liige (omanik on ainus, kes ei saa lahkuda). */
  roomRole: Object.freeze({
    OWNER: { key: "my_sharings.labels.room_owner" },
    MODERATOR: { key: "my_sharings.labels.room_member" },
    MEMBER: { key: "my_sharings.labels.room_member" }
  }),
  helpKind: Object.freeze({
    REQUEST: { key: "my_sharings.labels.request" },
    OFFER: { key: "my_sharings.labels.offer" }
  }),
  /* `HELP_MAP_VISIBILITY` (lib/help/mapEntries.js): abikirje tegelik nähtavus kaardil. */
  helpMap: Object.freeze({
    PUBLIC: { key: "my_sharings.ownership.help_map_public" },
    HIDDEN: { key: "my_sharings.ownership.help_map_hidden" },
    REVIEW: { key: "my_sharings.ownership.help_map_review" },
    EXPIRED: { key: "my_sharings.ownership.help_map_expired" },
    MISSING: { key: "my_sharings.ownership.help_map_missing" },
    OUT_OF_SYNC: { key: "my_sharings.ownership.help_map_out_of_sync" }
  })
});

/**
 * Seisu sõna ja toon. Tundmatu kood annab tühja teksti, mitte toore koodi.
 * Tõlkija tagastab puuduva sõna asemel võtme enda: ka seda ei trükita.
 *
 * @param {keyof typeof STATE_WORDS} kind
 * @param {unknown} code serveri kood (nt `AWAITING_CLIENT`)
 * @param {(key: string, vars?: object) => string} t
 * @returns {{ text: string, tone: string }}
 */
export function stateWord(kind, code, t) {
  const entry = STATE_WORDS[kind]?.[String(code || "").toUpperCase()];
  if (!entry) return { text: "", tone: "quiet" };
  const text = t(entry.key);
  return { text: typeof text === "string" && text !== entry.key ? text : "", tone: entry.tone || "quiet" };
}

/** Saadetud eelpöördumise seis: tagasivõtt ja parandus on kirje väljadel, mitte olekus. */
export function preInquiryState(item) {
  if (item?.recalledAt) return "RECALLED";
  if (item?.supersededById) return "SUPERSEDED";
  return String(item?.status || "SENT").toUpperCase();
}

/** Mentorluse ettevalmistuse seis kuupäevadest: tagasi võetud, avatud, jagatud või privaatne. */
export function mentoringState(item) {
  if (item?.recalledAt) return "RECALLED";
  if (item?.openedAt) return "OPENED";
  if (item?.sharedAt) return "SHARED";
  return "PRIVATE";
}

/** Pika teksti algus reale: tühikud kokku, lõpp kärbitud. Terve tekst on avatud kirjes. */
export function excerpt(value, max = 120) {
  const flat = String(value || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

const text = (value) => String(value || "").trim();

/**
 * Üks kirje reana. Iga osa haru ütleb, mis on pealkiri, mis seis, mis aeg ja
 * mis on kolm fakti. `sub` on avatava osa real pealkirja all: „kes näeb" või
 * (ettepaneku ja abipalve puhul, kus kõik read kannavad sama pealkirja) see,
 * mille järgi rida ära tunda.
 *
 * `formatDate` annab kuupäeva koos kellaajaga, `formatDay` ainult kuupäeva
 * (väljale, mis on andmebaasis kuupäev), `formatMonth` kuu sõnaga.
 *
 * @returns {{
 *   key: string, id: string, title: string, sub: string, kind: string,
 *   chip: string, tone: string, time: string,
 *   facts: { visibility: string, origin: string, validity: string } | null,
 *   attention: boolean
 * } | null}
 */
export function sharingRow(section, item, { t, formatDate, formatMonth, formatDay = formatDate }) {
  const unknownRecipient = () => t("my_sharings.labels.unknown_recipient");
  const base = { key: String(item?.id || ""), id: String(item?.id || ""), sub: "", kind: "", chip: "", tone: "quiet", time: "", facts: null, attention: false };

  switch (section) {
    /* Ettepanek jagada MINU kohta. Otsust ootav rida kannab oma märki ja
       tõstab osa laual esile. Kõik read kannavad sama pealkirja, seepärast on
       real kaasamise põhjus. */
    case "networkShares": {
      const waiting = Boolean(item.awaitingDecision);
      const word = waiting
        ? { text: t("my_sharings.labels.awaiting_your_decision"), tone: "wait" }
        : stateWord("incomingShare", item.status, t);
      return {
        ...base,
        title: t("my_sharings.labels.share_incoming"),
        sub: excerpt(item.purpose),
        chip: word.text,
        tone: word.tone,
        attention: waiting
      };
    }

    case "urgentRequests": {
      const word = stateWord("urgent", item.status, t);
      return {
        ...base,
        title: t("my_sharings.labels.urgent_request"),
        sub: excerpt(item.situationVerbatim),
        chip: word.text,
        tone: word.tone,
        time: formatDate(item.sentAt)
      };
    }

    case "preInquiries": {
      const recipient = text(item.recipientLabel) || unknownRecipient();
      const word = stateWord("preInquiry", preInquiryState(item), t);
      const visibility = t(
        item.deliveryChannel === "EXTERNAL_EMAIL" ? "my_sharings.ownership.external_email" : "my_sharings.ownership.shared_with",
        { name: recipient }
      );
      return {
        ...base,
        title: text(item.topic) || recipient,
        sub: visibility,
        chip: word.text,
        tone: word.tone,
        time: formatDate(item.sentAt),
        facts: { visibility, origin: t("my_sharings.ownership.you_sent"), validity: preInquiryValidity(item, { t, formatDate }) }
      };
    }

    case "rooms": {
      const word = stateWord("roomRole", item.role === "OWNER" ? "OWNER" : "MEMBER", t);
      const visibility = t("my_sharings.ownership.room_members");
      return {
        ...base,
        /* Nimeta ruum ei tohi kanda osa enda nime („Aktiivsed ruumid"). */
        title: text(item.title) || t("my_sharings.views.untitled_room"),
        sub: visibility,
        chip: word.text,
        facts: {
          visibility,
          origin: t("my_sharings.ownership.you_joined"),
          validity: t(item.canLeave ? "my_sharings.ownership.active" : "my_sharings.ownership.owner")
        }
      };
    }

    case "invites": {
      const word = stateWord("invite", item.status, t);
      const visibility = t("my_sharings.ownership.invite_recipient", { name: item.inviteeEmail });
      const validity = t("my_sharings.ownership.expires", { date: formatDate(item.expiresAt) });
      return {
        ...base,
        title: text(item.roomTitle) || text(item.inviteeEmail),
        sub: visibility,
        chip: word.text,
        tone: word.tone,
        /* Kuupäev üksi ei ütleks, et see on aegumine: real on sama lause mis faktis. */
        time: validity,
        facts: { visibility, origin: t("my_sharings.ownership.you_invited"), validity }
      };
    }

    case "helpListings": {
      const kind = stateWord("helpKind", item.kind, t).text;
      const word = stateWord("help", item.status, t);
      /* Puuduv kaardiseis loeb nagu enne: „vajab parandamist; ei ole avalik". */
      const mapWord = stateWord("helpMap", item.mapVisibility || "OUT_OF_SYNC", t).text || t("my_sharings.ownership.help_map_out_of_sync");
      return {
        ...base,
        /* Abisoovil ja -pakkumisel võib olla sama id: võti kannab liiki. */
        key: `${item.kind}:${item.id}`,
        title: text(item.title) || kind || t("my_sharings.sections.help"),
        /* Pealkirjata kirjel on liik juba pealkirjas: märgina seda ei korrata. */
        kind: text(item.title) ? kind : "",
        chip: word.text,
        tone: word.tone,
        facts: {
          visibility: mapWord,
          origin: t("my_sharings.ownership.you_submitted_help"),
          validity: item.expiresAt
            ? t("my_sharings.ownership.expires", { date: formatDate(item.expiresAt) })
            : t("my_sharings.ownership.no_expiry")
        }
      };
    }

    case "mentoringPreparations": {
      const word = stateWord("mentoring", mentoringState(item), t);
      const visibility = t(item.sharedAt && !item.recalledAt ? "my_sharings.mentoring.visible_to_mentor" : "my_sharings.ownership.private_record");
      return {
        ...base,
        title: t("my_sharings.mentoring.item_title"),
        sub: visibility,
        chip: word.text,
        tone: word.tone,
        time: formatDate(item.createdAt),
        facts: {
          visibility,
          origin: t("my_sharings.mentoring.origin"),
          validity: item.sharedAt ? t("my_sharings.mentoring.shared_at", { date: formatDate(item.sharedAt) }) : t("my_sharings.ownership.active")
        }
      };
    }

    case "outgoingNetworkShares": {
      const recipient = text(item.recipientLabel) || unknownRecipient();
      const word = stateWord("outgoingShare", item.status, t);
      return {
        ...base,
        title: recipient,
        chip: word.text,
        tone: word.tone,
        facts: {
          /* See rida ei avane, seega käib saaja lugemiste kokkuvõte siia: kes näeb ja kas ta on vaadanud. */
          visibility: [t("my_sharings.ownership.shared_with", { name: recipient }), ...viewTrailNote(item, { t, formatDay })].join(". "),
          origin: t("my_sharings.ownership.you_sent"),
          /* Kaasamise lõpp on kuupäev, mitte kellaaeg. */
          validity: item.participationEndsOn
            ? t("my_sharings.ownership.expires", { date: formatDay(item.participationEndsOn) })
            : t("my_sharings.ownership.active")
        }
      };
    }

    case "wellbeingSupportShares": {
      const recipient = text(item.recipientLabel) || text(item.organizationName) || unknownRecipient();
      const word = stateWord("supportShare", item.status, t);
      return {
        ...base,
        title: recipient,
        chip: word.text,
        tone: word.tone,
        facts: {
          visibility: t("my_sharings.ownership.shared_with", { name: recipient }),
          origin: t("my_sharings.ownership.you_sent"),
          validity: item.closedAt ? t("my_sharings.ownership.closed", { date: formatDate(item.closedAt) }) : t("my_sharings.ownership.active")
        }
      };
    }

    case "serviceReportShares": {
      const recipient = text(item.recipientLabel) || unknownRecipient();
      const word = stateWord("reportShare", item.status, t);
      return {
        ...base,
        title: recipient,
        chip: word.text,
        tone: word.tone,
        /* Aruande kuu sõnaga („september 2026"), mitte kujul 2026-09. */
        time: formatMonth(item.month),
        facts: {
          /* See rida ei avane, seega käib saaja lugemiste kokkuvõte siia, nagu töötaja saadetud jagamisel. */
          visibility: [t("my_sharings.ownership.shared_with", { name: recipient }), ...viewTrailNote(item, { t, formatDay })].join(". "),
          origin: t("my_sharings.ownership.you_sent"),
          validity: item.recalledAt ? t("my_sharings.ownership.recalled", { date: formatDate(item.recalledAt) }) : t("my_sharings.ownership.active")
        }
      };
    }

    case "roomSummaries":
      return {
        ...base,
        title: text(item.title) || text(item.roomTitle) || t("my_sharings.sections.room_summaries"),
        time: formatDate(item.sharedAt),
        facts: {
          visibility: t("my_sharings.ownership.room_members"),
          origin: t("my_sharings.ownership.you_sent"),
          validity: t("my_sharings.ownership.active")
        }
      };

    /* Privaatne kirje: raamistiku kinnitus või jagamata mentorluse ettevalmistus.
       Raamistiku sisemist võtit (`WORKER_DATA_PROCESSING`) ei trükita: tuntud
       raamistikul on nimi, tundmatu on „privaatne kirje". */
    case "privateRecords": {
      const framework = item.privateType === "FRAMEWORK_ACCEPTANCE";
      const mentoringNote = item.privateType === "MENTORING_PREPARATION";
      return {
        ...base,
        /* Kahe eri tabeli kirjel võib olla sama id: võti kannab liiki. */
        key: `${item.privateType}:${item.id}`,
        title: framework && item.frameworkKey === WORKER_FRAMEWORK_KEY
          ? t("auth.register.worker_framework_title")
          : mentoringNote
            ? t("my_sharings.mentoring.item_title")
            : t("my_sharings.labels.private_record"),
        chip: mentoringNote ? stateWord("mentoring", "PRIVATE", t).text : "",
        time: framework && text(item.frameworkVersion) ? t("my_sharings.labels.version", { version: text(item.frameworkVersion) }) : "",
        facts: {
          visibility: t("my_sharings.ownership.private_record"),
          origin: t("my_sharings.ownership.you_confirmed"),
          validity: t("my_sharings.ownership.accepted", { date: formatDate(item.createdAt) })
        }
      };
    }

    default:
      return null;
  }
}

/**
 * „Kes on vaadanud": adressaadi lugemiste kokkuvõte. Server annab välja `views`
 * (`{ days, lastDay }`) ainult siis, kui vaatamisi on; ilma selleta lauset ei ole. Tekst on
 * lõpupunktita, sest töötaja real on see fakti osa; avatud kirje märkuses lisatakse punkt.
 */
export function viewTrailNote(item, { t, formatDay }) {
  const days = Number(item?.views?.days);
  const lastDay = item?.views?.lastDay;
  if (!Number.isInteger(days) || days < 1 || !lastDay) return [];
  return [
    days === 1
      ? t("my_sharings.ownership.viewed_one_day", { date: formatDay(lastDay) })
      : t("my_sharings.ownership.viewed_days", { days, date: formatDay(lastDay) })
  ];
}

/** Saadetud eelpöördumise kehtivus: tagasi võetud, parandatud, väline kiri, avatud või veel tagasivõetav. */
export function preInquiryValidity(item, { t, formatDate }) {
  if (item.recalledAt) return t("my_sharings.ownership.recalled", { date: formatDate(item.recalledAt) });
  if (item.supersededById) return t("my_sharings.ownership.superseded");
  if (item.deliveryChannel === "EXTERNAL_EMAIL") return t("my_sharings.ownership.external_final");
  if (item.openedAt) return t("my_sharings.ownership.opened", { date: formatDate(item.openedAt) });
  return t("my_sharings.ownership.until_recall");
}

/** Osa read. Tundmatu osa ja vigane loend annavad tühja loendi. */
export function sharingRows(section, items, context) {
  return (Array.isArray(items) ? items : []).map((item) => sharingRow(section, item, context)).filter(Boolean);
}

const NO_ACTIONS = Object.freeze({
  decide: false,
  recallUrgent: false,
  recall: false,
  correct: false,
  leave: false,
  revoke: false,
  mentoringRecall: false,
  relationId: ""
});

/**
 * Avatud kirje: rida ja lisaks see, mis tegi vana kaardi kõrgeks.
 *
 * - `lead`: lause vaate ülaservas (ettepanekul: kes mida küsib ja et otsustad sina).
 * - `text`: jagatav tekst tervikuna (ettepaneku kokkuvõte, abipalve sõnastus).
 *   Inimene otsustab just selle teksti põhjal, seepärast on see vaates esimene.
 * - `details`: sildiga laused (miks kaasatakse, mida jagatakse ja mida mitte).
 * - `notes`: märkused, mis peavad tegevuse kõrval näha olema.
 * - `hint`: millal tagasivõtt võimalik on (seisab nupu kõrval, kuni nuppu ei ole vajutatud).
 * - `can`: mida selle kirjega teha saab. See on ainult nupu nähtavus: loa
 *   otsustab server iga päringu juures uuesti.
 */
export function sharingSheet(section, item, context) {
  const row = sharingRow(section, item, context);
  if (!row) return null;
  const { t, formatDate, formatDay = formatDate } = context;
  const sheet = { ...row, lead: "", text: "", details: [], notes: [], hint: "", can: NO_ACTIONS };
  const detail = (key, label, value) => (text(value) ? [{ key, label, value: text(value) }] : []);

  switch (section) {
    case "networkShares":
      return {
        ...sheet,
        /* Otsuse juures peab olema näha, kes mida küsib ja et otsus on inimese
           enda oma: sama lause, mis seisab osa loendi kohal. */
        lead: t("my_sharings.section_help.network_shares"),
        text: text(item.summaryText),
        details: [
          ...detail("purpose", t("my_sharings.labels.share_purpose"), item.purpose),
          /* Jagamispiir eristab nõusolekut blankokäest: see on alati näha. */
          ...detail("boundary", t("my_sharings.labels.share_boundary"), item.sharingBoundary),
          /* Kaasamise lõpp on kuupäev (andmebaasis ilma kellaajata): kellaaega ei näidata. */
          ...detail("ends", t("my_sharings.labels.share_ends"), formatDay(item.participationEndsOn))
        ],
        notes: viewTrailNote(item, { t, formatDay }).map((line) => `${line}.`),
        can: { ...NO_ACTIONS, decide: Boolean(item.awaitingDecision) }
      };

    case "urgentRequests":
      return {
        ...sheet,
        text: text(item.situationVerbatim),
        details: [
          ...detail("reading", t("urgent.desk.reading_time"), item.readingTimePromise),
          /* Keeldumise põhjus on nähtav tekst: ilma selleta oleks „ei jõutud" ainult uks, mis kinni käis. */
          ...detail("decline", t("my_sharings.labels.urgent_decline_reason"), item.declineReason)
        ],
        hint: item.canRecall ? t("urgent.sent.recall_hint") : "",
        can: { ...NO_ACTIONS, recallUrgent: Boolean(item.canRecall) }
      };

    case "preInquiries":
      return {
        ...sheet,
        notes: [...viewTrailNote(item, { t, formatDay }).map((line) => `${line}.`), t("my_sharings.notice.memory")],
        can: { ...NO_ACTIONS, recall: Boolean(item.canRecall), correct: Boolean(item.canCorrect) }
      };

    case "rooms":
      return { ...sheet, can: { ...NO_ACTIONS, leave: Boolean(item.canLeave) } };

    case "invites":
      /* Aegumine on avatud kirjes faktina („Kehtivus"): märkide real seda ei korrata. */
      return { ...sheet, time: "", can: { ...NO_ACTIONS, revoke: Boolean(item.canRevoke) } };

    case "mentoringPreparations": {
      const relationId = text(item.relationId);
      /* Suhte viiteta ei saa tagasivõttu saata (päring käib suhte kaudu): seda
         öeldakse välja ainult siis, kui tagasivõtt muidu võimalik oleks. */
      const stranded = !relationId && item.sharedAt && !item.recalledAt && !item.openedAt;
      return {
        ...sheet,
        notes: stranded ? [t("my_sharings.mentoring.action_unavailable")] : [],
        can: { ...NO_ACTIONS, mentoringRecall: Boolean(relationId && item.canRecall), relationId }
      };
    }

    default:
      return sheet;
  }
}

/**
 * Laua osad („Kõik jagamised"): mida iga osa plaat ütleb.
 *
 * Plaat ütleb SÕNADEGA, mis seal ootab: esimene rida (ja „ja teised", kui neid
 * on veel) või põhjus, miks osa on tühi (kirjeid ei ole, laadimine ei
 * õnnestunud või võttis liiga kaua). Ridade arvu plaadil ei ole.
 *
 * Osa, kus ootab inimese enda otsus, kannab märget `flag` („Ootab sinu
 * otsust") ja plaat näitab otsust ootavat rida, ka siis, kui see ei ole
 * loendis esimene. Märge on sõna ja raam, mitte ainult värv.
 *
 * @param {{ t: Function, sections: Record<string, { rows?: object[], status?: string }> }} input
 */
export function sharingParts({ t, sections }) {
  const more = t("my_sharings.views.more");
  return SECTION_ORDER.map((key) => {
    const texts = SECTION_TEXTS[key];
    const rows = Array.isArray(sections?.[key]?.rows) ? sections[key].rows : [];
    const status = String(sections?.[key]?.status || "");
    const waiting = rows.find((row) => row.attention) || null;
    const first = waiting || rows[0] || null;

    let summary = t(texts.empty);
    if (status === "TIMEOUT") summary = t("my_sharings.views.tile_timeout");
    else if (isUnavailable(status)) summary = t("my_sharings.views.tile_unavailable");
    else if (first) {
      /* Seis on pealkirja järel sulgudes („Koduteenus (Saadetud) ja teised").
         Otsust ootava rea seis on juba märkes: seda plaadil ei korrata. */
      const head = first.chip && !waiting ? `${first.title} (${first.chip})` : first.title;
      summary = rows.length > 1 ? `${head} ${more}` : head;
    }

    return {
      key,
      label: t(texts.title),
      short: t(texts.short),
      /* Hele serv = siin ootab sinu otsus; tavaline = osas on kirjeid; tuhm = tühi. */
      state: waiting ? "done" : rows.length && !isUnavailable(status) ? "partial" : "empty",
      summary,
      flag: waiting ? t("my_sharings.labels.awaiting_your_decision") : "",
      attention: Boolean(waiting),
      /* Loend võib olla pikk: selle järgi ühist kõrgust ei võeta. */
      free: true
    };
  });
}

/**
 * Lehe tasemel lause laua kohal: otsust ootav ettepanek või „midagi ei ole".
 * Kui mõni osa jäi laadimata, ei saa väita, et jagamisi ei ole.
 *
 * @returns {{ key: "attention" | "empty", text: string } | null}
 */
export function deskLead({ t, parts, sections }) {
  if (parts.some((part) => part.attention)) return { key: "attention", text: t("my_sharings.views.attention") };
  const anyUnavailable = SECTION_ORDER.some((key) => isUnavailable(sections?.[key]?.status));
  const allEmpty = SECTION_ORDER.every((key) => !(sections?.[key]?.rows || []).length);
  return allEmpty && !anyUnavailable ? { key: "empty", text: t("my_sharings.empty_all") } : null;
}

/**
 * Teist vajutust küsivad tegevused: nupu sõnad enne ja pärast esimest vajutust,
 * tagajärg, mis seisab nupu kõrval, ja teade pärast õnnestumist.
 *
 * Neli esimest küsisid varem kinnitust eraldi aknas; tagajärje lause on sama.
 * Abipalve tagasivõtt ja ettepaneku otsus läksid varem teele ühe vajutusega.
 */
export const CONFIRMED_ACTIONS = Object.freeze({
  recall: {
    label: "my_sharings.actions.recall",
    armed: "my_sharings.views.confirm.recall",
    consequence: "my_sharings.confirm.recall",
    done: "my_sharings.notice.recalled"
  },
  revoke: {
    label: "my_sharings.actions.revoke_invite",
    armed: "my_sharings.views.confirm.revoke",
    consequence: "my_sharings.confirm.revoke",
    done: "my_sharings.notice.invite_revoked"
  },
  leave: {
    label: "my_sharings.actions.leave_room",
    armed: "my_sharings.views.confirm.leave",
    consequence: "my_sharings.confirm.leave",
    done: "my_sharings.notice.room_left"
  },
  mentoringRecall: {
    label: "my_sharings.actions.recall",
    armed: "my_sharings.views.confirm.recall",
    consequence: "my_sharings.confirm.mentoringRecall",
    done: "my_sharings.notice.mentoring_recalled"
  },
  urgentRecall: {
    label: "urgent.sent.recall",
    armed: "my_sharings.views.confirm.recall",
    consequence: "my_sharings.views.consequence.urgent_recall",
    done: "my_sharings.notice.urgent_recalled"
  },
  shareConfirm: {
    label: "my_sharings.actions.confirm_share",
    armed: "my_sharings.views.confirm.share_confirm",
    consequence: "my_sharings.views.consequence.share_confirm",
    done: "my_sharings.notice.share_confirmed"
  },
  shareDecline: {
    label: "my_sharings.actions.decline_share",
    armed: "my_sharings.views.confirm.share_decline",
    consequence: "my_sharings.views.consequence.share_decline",
    done: "my_sharings.notice.share_declined"
  }
});

/**
 * Ettepaneku otsuse veakood → lause. Server vastab koodiga
 * (`network_share.content_changed`); lehel on sõnad ainult nendele koodidele,
 * mida inimene siin näha võib. Tundmatu kood annab tühja teksti ja leht näitab
 * siis üldist lauset, mitte koodi.
 */
export const SHARE_ERROR_KEYS = Object.freeze({
  content_changed: "my_sharings.share_errors.content_changed",
  content_hash_required: "my_sharings.share_errors.content_hash_required",
  not_awaiting_client: "my_sharings.share_errors.not_awaiting_client",
  concurrent_change: "my_sharings.share_errors.concurrent_change",
  forbidden: "my_sharings.share_errors.forbidden",
  not_found: "my_sharings.share_errors.not_found",
  invalid_decision: "my_sharings.share_errors.invalid_decision"
});

export function shareErrorText(code, t) {
  const raw = typeof code === "string" ? code.trim() : "";
  if (!raw.startsWith("network_share.")) return "";
  const key = SHARE_ERROR_KEYS[raw.slice("network_share.".length)];
  if (!key) return "";
  const sentence = t(key);
  return typeof sentence === "string" && sentence !== key ? sentence : "";
}

/**
 * Paranduse eelkontroll: sama, mida server nõuab (olukorra kirjeldus ja
 * pöördumise tekst on kohustuslikud), samade lausetega. Nii ei lähe tühi
 * parandus teele ainult selleks, et server selle tagasi lükkaks.
 *
 * @returns {string} veateate võti või tühi string
 */
export function correctionProblem(correction) {
  if (!text(correction?.situation)) return "pre_inquiries.errors.situation_required";
  if (!text(correction?.text)) return "pre_inquiries.errors.correction_required";
  return "";
}

/** Paranduse väljade pikkused: samad, mis vanal vormil. */
export const CORRECTION_LIMITS = Object.freeze({ topic: 1000, situation: 12000, text: 12000 });
