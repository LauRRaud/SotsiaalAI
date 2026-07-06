export const WELLBEING_INFO_ID = "wellbeing";

export const WELLBEING_TOOL_INFO_IDS = Object.freeze({
  "quick-check": "wellbeing_quick_check",
  overview: "wellbeing_overview",
  "hard-case": "wellbeing_hard_case",
  "workplace-violence": "wellbeing_workplace_violence",
  recovery: "wellbeing_recovery",
  "work-boundaries": "wellbeing_work_boundaries",
  interruptions: "wellbeing_interruptions",
  "work-processes": "wellbeing_work_processes",
  "role-boundaries": "wellbeing_role_boundaries",
  "starter-support": "wellbeing_starter_support"
});

export const wellbeingTools = Object.freeze([
  {
    id: "quick-check",
    slug: "kiirkontroll",
    title: "Kiirkontroll",
    description: "Lühike töökoormuse ja taastumise kontroll.",
    icon: "ClipboardList",
    infoId: WELLBEING_TOOL_INFO_IDS["quick-check"],
    route: "/tooheaolu/kiirkontroll"
  },
  {
    id: "overview",
    slug: "ulevaade",
    title: "Ülevaade",
    description: "Nädala ja kuu tööheaolu trendid, koormustegurid ja mustrid.",
    icon: "ChartNoAxesCombined",
    infoId: WELLBEING_TOOL_INFO_IDS.overview,
    route: "/tooheaolu/ulevaade"
  },
  {
    id: "hard-case",
    slug: "raske-juhtum",
    title: "Raske juhtum",
    description: "Töövoog pärast rasket või emotsionaalselt koormavat juhtumit.",
    icon: "MessageCircleWarning",
    infoId: WELLBEING_TOOL_INFO_IDS["hard-case"],
    route: "/tooheaolu/raske-juhtum"
  },
  {
    id: "workplace-violence",
    slug: "toovagivald",
    title: "Töövägivald",
    description: "Töövoog ähvarduse, agressiooni, solvamise, jälitamise või füüsilise ohu korral.",
    icon: "OctagonAlert",
    infoId: WELLBEING_TOOL_INFO_IDS["workplace-violence"],
    route: "/tooheaolu/toovagivald"
  },
  {
    id: "recovery",
    slug: "taastumine",
    title: "Taastumine",
    description: "Pauside, taastumisaja ja jõuvarude taastamise töövoog.",
    icon: "Handshake",
    infoId: WELLBEING_TOOL_INFO_IDS.recovery,
    route: "/tooheaolu/taastumine"
  },
  {
    id: "work-boundaries",
    slug: "toopiirid",
    title: "Tööpiirid",
    description: "Tööaja, kättesaadavuse, pauside, taastumisaja ja katkestuste kokkulepped.",
    icon: "CalendarClock",
    infoId: WELLBEING_TOOL_INFO_IDS["work-boundaries"],
    route: "/tooheaolu/toopiirid"
  },
  {
    id: "interruptions",
    slug: "katkestused",
    title: "Katkestused",
    description: "Katkestuste, ümberlülitumise ja töörahu korduvmustri märkamine.",
    icon: "MessageSquare",
    infoId: WELLBEING_TOOL_INFO_IDS.interruptions,
    route: "/tooheaolu/katkestused"
  },
  {
    id: "work-processes",
    slug: "tooprotsessid",
    title: "Tööprotsessid",
    description: "“Mis võtab aja ära?” audit: dokumenteerimine, dubleerimine, katkestused ja korduvtegevused.",
    icon: "Workflow",
    infoId: WELLBEING_TOOL_INFO_IDS["work-processes"],
    route: "/tooheaolu/tooprotsessid"
  },
  {
    id: "role-boundaries",
    slug: "rollipiirid",
    title: "Rollipiirid",
    description: "Rolli, vastutuse, ootuste ja koostööpiiride selgemaks sõnastamine.",
    icon: "BadgeCheck",
    infoId: WELLBEING_TOOL_INFO_IDS["role-boundaries"],
    route: "/tooheaolu/rollipiirid"
  },
  {
    id: "starter-support",
    slug: "alustaja-tugi",
    title: "Alustaja tugi",
    description: "“Esimesed 100 päeva” juhis, mentori küsimused ja alustava spetsialisti töötoe plaan.",
    icon: "BookOpenCheck",
    infoId: WELLBEING_TOOL_INFO_IDS["starter-support"],
    route: "/tooheaolu/alustaja-tugi"
  }
]);

export function getWellbeingToolBySlug(slug) {
  const normalized = String(slug || "").trim();
  return wellbeingTools.find((tool) => tool.slug === normalized) || null;
}

export function getWellbeingToolByRoute(route) {
  const normalized = String(route || "").trim();
  return wellbeingTools.find((tool) => tool.route === normalized) || null;
}

export function canUseWellbeingRole(role, admin = false) {
  if (admin) return true;
  return String(role || "").trim().toUpperCase() === "SOCIAL_WORKER";
}
