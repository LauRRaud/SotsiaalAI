const ASSISTIVE_DEVICE_RULES = Object.freeze([
  {
    code: "ROLLATOR",
    name: "rollaator",
    patterns: [/rollaator/iu],
    relatedNeedTags: ["liikumisabivahend", "kukkumisriski vähendamine"]
  },
  {
    code: "WHEELCHAIR",
    name: "ratastool",
    patterns: [/ratastool/iu],
    relatedNeedTags: ["liikumisabivahend", "ligipääsetavus"]
  },
  {
    code: "SHOWER_CHAIR",
    name: "dušitool",
    patterns: [/dušitool|dusitool|dušš|duss|pesemistool/iu],
    relatedNeedTags: ["pesemise abivahend", "igapäevatoimingute tugi"]
  },
  {
    code: "HEARING_AID",
    name: "kuuldeaparaat",
    patterns: [/kuuldeaparaat|kuuldeaparaadi|kuulmisabivahend|kuulmine/iu],
    relatedNeedTags: ["kuulmise abivahend", "suhtlemise tugi"]
  },
  {
    code: "GLASSES",
    name: "prillid",
    patterns: [/prillid|nägemisabivahend|nagemisabivahend|nägemine|nagemine/iu],
    relatedNeedTags: ["nägemise abivahend", "suhtlemise tugi"]
  },
  {
    code: "MEDICINE_DISPENSER",
    name: "ravimidosaator",
    patterns: [/ravimidosaator|ravimi dosaator|ravimite meeldetulet/iu],
    relatedNeedTags: ["ravimite võtmise tugi", "igapäevatoimingute tugi"]
  },
  {
    code: "ALARM_BUTTON",
    name: "häirenupp",
    patterns: [/häirenupp|hairenupp|turvanupp|kukkumisandur|häireseade|haireseade/iu],
    relatedNeedTags: ["turvalisuse tugi", "kukkumisriski vähendamine"]
  },
  {
    code: "HOME_ADAPTATION",
    name: "kodukohandus",
    patterns: [/kodukohandus|kodu kohandus|trepp|trepid|kaldtee|käsipuu|kasipuu|lävepakk|lavepakk/iu],
    relatedNeedTags: ["kodukohandus", "ligipääsetavus"]
  },
  {
    code: "MOBILITY_SUPPORT_DEVICE",
    name: "liikumisabivahend",
    patterns: [/liikumisraskus|liikumisabi|kodust väljumine|kodust valjumine|kukkumisrisk|ei pääse liikuma|ei paase liikuma/iu],
    relatedNeedTags: ["liikumisabivahend", "ligipääsetavus"]
  },
  {
    code: "DAILY_LIVING_DEVICE",
    name: "toimetuleku abivahend",
    patterns: [/abivahend|pesemine|tualetis käimine|tualetis kaimine|riietumine|igapäevatoiming|igapaevatoiming/iu],
    relatedNeedTags: ["igapäevatoimingute tugi", "toimetuleku abivahend"]
  }
]);

const STATUS_RULES = Object.freeze([
  ["NOT_WORKING", /ei tööta|ei toota|katki|rikkis|ei sobi|valutab|hõõrub|hoorub/iu],
  ["NOT_USED", /ei kasuta|keeldub kasutamast|seisab kasutamata/iu],
  ["EXISTING", /olemas|kasutab|on rollaator|on ratastool|on kuuldeaparaat|on prillid/iu],
  ["NEEDED", /vajab|vajan|tarvis|oleks vaja|hankida|taotleda|uut abivahendit|uut/iu]
]);

function cleanText(value = "", limit = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeList(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || item?.name || ""))
    .map((item) => cleanText(item, 160))
    .filter(Boolean);
}

function contextObject(journey = {}) {
  return journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
}

function joinedJourneyText(journey = {}) {
  const context = contextObject(journey);
  return [
    journey.title,
    journey.summary,
    ...(journey.domains || []),
    ...(journey.missingInfo || []),
    ...(journey.riskSignals || []),
    ...normalizeList(journey.suggestedActions),
    ...normalizeList(context.needTags),
    ...normalizeList(context.keywords),
    ...normalizeList(context.lifeDomains)
  ].join(" ");
}

function patternMatches(pattern, text) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return Array.from(text.matchAll(new RegExp(pattern.source, flags)));
}

function clauseRanges(text = "") {
  const separators = /[.!?;]+|,\s*(?:aga|kuid|ent|but|while|но|а)\s+/giu;
  const ranges = [];
  let start = 0;
  for (const match of text.matchAll(separators)) {
    if (match.index > start) ranges.push([start, match.index]);
    start = match.index + match[0].length;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges.length ? ranges : [[0, text.length]];
}

function localEvidenceForRule(text, rule) {
  const mentions = rule.patterns.flatMap((pattern) => patternMatches(pattern, text));
  if (!mentions.length) return null;
  const ranges = clauseRanges(text);
  let best = null;

  for (const mention of mentions) {
    const mentionIndex = Number(mention.index) || 0;
    const range = ranges.find(([start, end]) => mentionIndex >= start && mentionIndex <= end)
      || [Math.max(0, mentionIndex - 120), Math.min(text.length, mentionIndex + 120)];
    const [start, end] = range;
    const clause = cleanText(text.slice(start, end), 300);
    const localMention = Math.max(0, mentionIndex - start);

    for (const [status, pattern] of STATUS_RULES) {
      for (const statusMatch of patternMatches(pattern, clause)) {
        const statusIndex = Number(statusMatch.index) || 0;
        const distance = Math.abs(statusIndex - localMention);
        if (distance > 120 || (best && best.distance <= distance)) continue;
        best = { status, distance, clause };
      }
    }
    if (!best) best = { status: "UNSURE", distance: Number.POSITIVE_INFINITY, clause };
  }

  return best;
}

function inferSupportNeed(text = "") {
  if (/taotlus|taotleda|vorm|avaldus|dokument/iu.test(text)) {
    return "Võib vajada abi abivahendi taotlemisel või dokumentide täitmisel.";
  }
  if (/transport|toomine|koju tuua|paigald/iu.test(text)) {
    return "Võib vajada praktilist abi abivahendi transpordi või paigaldamisega.";
  }
  if (/ei tööta|ei toota|katki|rikkis|ei sobi|ei kasuta/iu.test(text)) {
    return "Võib vajada abivahendi sobivuse, kasutamise või hoolduse täpsustamist.";
  }
  return "Võib vajada abivahendi või kodukohanduse võimaluste täpsustamist.";
}

export function normalizeAssistiveDeviceItems(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const name = cleanText(item.name || item.title || "", 120);
      if (!name) return null;
      return {
        id: cleanText(item.id || `assistive-device-${index + 1}`, 80),
        name,
        status: cleanText(item.status || "UNSURE", 40).toUpperCase(),
        useContext: cleanText(item.useContext || "UNKNOWN", 40).toUpperCase(),
        issue: cleanText(item.issue || "", 300),
        supportNeed: cleanText(item.supportNeed || "", 300),
        relatedNeedTags: normalizeList(item.relatedNeedTags),
        relatedLifeDomains: normalizeList(item.relatedLifeDomains),
        relatedDocuments: normalizeList(item.relatedDocuments),
        suggestedActions: normalizeList(item.suggestedActions)
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export function inferAssistiveDevicesFromJourney(journey = {}) {
  const text = joinedJourneyText(journey);
  const lower = text.toLocaleLowerCase("et");
  const devices = [];

  for (const rule of ASSISTIVE_DEVICE_RULES) {
    const evidence = localEvidenceForRule(lower, rule);
    if (!evidence) continue;
    const localText = evidence.clause || "";
    devices.push({
      id: `assistive-${rule.code.toLowerCase()}`,
      name: rule.name,
      status: evidence.status,
      useContext: /kodust|õues|oues|väljas|valjas|transport|teenuseosutaja/iu.test(localText)
        ? "OUTSIDE"
        : /kodus|vannituba|trepp|trepid|tualet|pesemine/iu.test(localText)
          ? "HOME"
          : "UNKNOWN",
      issue: cleanText(localText, 300),
      supportNeed: inferSupportNeed(localText),
      relatedNeedTags: rule.relatedNeedTags,
      relatedLifeDomains: ["füüsiline tervis", "igapäevaelu toimingud", "elukeskkond"],
      relatedDocuments: [],
      suggestedActions: [
        "Ava Teenusekaart abivahendi või kodukohanduse kontaktide leidmiseks",
        "Vajadusel koosta eelpöördumine",
        "Lisa olemasolev otsus, hinnang või abivahendiga seotud dokument"
      ]
    });
    if (devices.length >= 4) break;
  }

  return devices;
}

export function buildAssistiveDevicesHandoff(journey = {}) {
  const context = contextObject(journey);
  const existing = normalizeAssistiveDeviceItems(context.assistiveDevices);
  const inferred = existing.length ? existing : inferAssistiveDevicesFromJourney(journey);
  const devices = normalizeAssistiveDeviceItems(inferred);
  const first = devices[0] || null;
  return {
    hasAssistiveDeviceNeed: devices.length > 0,
    devices,
    primaryDeviceName: first?.name || "",
    keyword: first?.relatedNeedTags?.[0] || first?.name || "abivahend",
    relatedNeedTags: Array.from(new Set(devices.flatMap((item) => item.relatedNeedTags || []))),
    relatedLifeDomains: Array.from(new Set(devices.flatMap((item) => item.relatedLifeDomains || []))),
    relatedServiceCategories: [
      "Puue, rehabilitatsioon ja abivahendid",
      "Kodune abi ja hooldus",
      "Transport ja liikumisabi",
      "Nõustamine ja juhendamine",
      "KOV sotsiaalteenus"
    ]
  };
}

export function hasAssistiveDeviceSignal(journey = {}) {
  return buildAssistiveDevicesHandoff(journey).hasAssistiveDeviceNeed;
}

export function formatAssistiveDevicesForPreInquiry(devices = []) {
  const normalized = normalizeAssistiveDeviceItems(devices);
  if (!normalized.length) return "";
  return normalized
    .map((item) => {
      const parts = [
        item.name,
        item.status && item.status !== "UNSURE" ? `seis: ${item.status}` : "",
        item.supportNeed
      ].filter(Boolean);
      return `- ${parts.join("; ")}`;
    })
    .join("\n");
}
