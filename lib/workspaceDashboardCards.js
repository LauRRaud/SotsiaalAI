import { isServiceLogUiEnabled } from "@/lib/serviceLog/flags";
function text(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function withDisabled(card, hasPaidAccess, requiresPaid = false) {
  return {
    ...card,
    disabled: Boolean(requiresPaid && !hasPaidAccess)
  };
}

const WORKSPACE_DASHBOARD_BADGE_TYPES = new Set(["dot", "number", "attention"]);

const WORKSPACE_DASHBOARD_BADGE_ALIASES = Object.freeze({
  add_person: ["add_person", "rooms", "room", "invite", "invites"],
  document_drafting: ["document_drafting", "documentDrafting", "drafting"],
  documents: ["documents", "document"],
  help_offers: ["help_offers", "helpOffers"],
  help_requests: ["help_requests", "helpRequests"],
  journey: ["journey"],
  kovision: ["kovision", "covision"],
  materials: ["materials"],
  pre_inquiries: ["pre_inquiries", "preInquiries", "inquiries", "poordumised"],
  service_map: ["service_map", "serviceMap"],
  service_profile: ["service_profile", "serviceProfile"],
  wellbeing: ["wellbeing", "tooheaolu"],
  mentoring: ["mentoring", "mentorlus"]
});

function readBadgeInput(dashboardBadges, cardKey, role) {
  if (!dashboardBadges) return null;
  if (typeof dashboardBadges === "function") {
    return dashboardBadges({ cardKey, role });
  }
  if (typeof dashboardBadges !== "object") return null;

  const aliases = WORKSPACE_DASHBOARD_BADGE_ALIASES[cardKey] || [cardKey];
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(dashboardBadges, alias)) {
      return dashboardBadges[alias];
    }
  }
  return null;
}

function normalizeBadgeType(type, count) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "exclamation" || normalized === "warning" || normalized === "alert") {
    return "attention";
  }
  if (WORKSPACE_DASHBOARD_BADGE_TYPES.has(normalized)) return normalized;
  return Number.isFinite(count) && count > 0 ? "number" : "dot";
}

export function normalizeWorkspaceDashboardBadge(input) {
  if (input == null || input === false) return null;

  if (input === true) {
    return {
      type: "dot",
      value: "",
      label: "uus sündmus",
      tooltip: "Uus sündmus"
    };
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    const count = Math.floor(input);
    const value = count > 99 ? "99+" : String(count);
    return {
      type: "number",
      value,
      label: `${value} uut sündmust`,
      tooltip: `${value} uut sündmust`
    };
  }

  if (typeof input !== "object") return null;

  const count = Number(input.count ?? input.value);
  const type = normalizeBadgeType(input.type, count);
  if (type === "number" && (!Number.isFinite(count) || count <= 0)) return null;

  const value = type === "number"
    ? (Math.floor(count) > 99 ? "99+" : String(Math.floor(count)))
    : type === "attention"
      ? "!"
      : "";
  const label = input.ariaLabel || input.label || (
    type === "attention"
      ? "vajab tähelepanu"
      : type === "number"
        ? `${value} uut sündmust`
        : "uus sündmus"
  );
  const tooltip = input.tooltip || input.title || label;

  return {
    type,
    value,
    label,
    tooltip
  };
}

function withDashboardBadge(card, dashboardBadges, role) {
  const badge = normalizeWorkspaceDashboardBadge(readBadgeInput(dashboardBadges, card.key, role));
  return badge ? { ...card, badge } : card;
}

/* Eelnoutakse KÕIGILE töölaua kasutajatele, rollist sõltumata. Teenuspäevik
   lisatakse ainult siis, kui UI lipp on sees — muidu kulutaks iga kasutaja ühe
   päringu marsruudile, mis vastab `notFound()`-iga. */
export const WORKSPACE_ROUTE_PREFETCH_PATHS = Object.freeze([
  "/documents",
  "/dokreziim",
  "/eelpoordumised",
  "/teekond",
  "/kovisioon",
  "/materjalid",
  "/teenusekaart",
  "/teenuseprofiil",
  ...(isServiceLogUiEnabled() ? ["/teenuspaevik"] : []),
  "/tooheaolu"
]);

export function createWorkspaceDashboardRows({
  activeRole = "CLIENT",
  hasPaidAccess = false,
  t,
  navigateTo,
  openHelpPanel,
  openInvite,
  dashboardBadges = null
} = {}) {
  const role = String(activeRole || "CLIENT").trim().toUpperCase();
  const isClientView = role === "CLIENT";
  const isProviderView = role === "SERVICE_PROVIDER";
  const makeCard = (card, options = {}) => withDashboardBadge(
    withDisabled(card, hasPaidAccess, options.requiresPaid),
    dashboardBadges,
    role
  );

  const serviceMapCard = makeCard({
    key: "service_map",
    icon: "map",
    title: text(t, "chat.workspace.cards.service_map.title", "Teenusekaart"),
    meta: text(t, "chat.workspace.cards.service_map.meta", "Kaardivaade"),
    onClick: () => navigateTo?.("/teenusekaart"),
    route: "/teenusekaart"
  });

  const journeyCard = makeCard({
    key: "journey",
    icon: "journey",
    title: text(t, "chat.workspace.cards.journey.title", "Teekond"),
    meta: text(t, "chat.workspace.cards.journey.meta", "Teekonnakaart"),
    onClick: () => navigateTo?.("/teekond"),
    route: "/teekond"
  });

  const personalSearchCard = makeCard({
    key: "personal_search",
    icon: "journey",
    title: text(t, "personal_search.title", "Minu otsing"),
    meta: text(t, "personal_search.card_meta", "Minu tööobjektid"),
    onClick: () => navigateTo?.("/otsi"),
    route: "/otsi"
  });

  if (isProviderView) {
    return [
      [
        makeCard({
          key: "help_requests",
          icon: "help-request",
          title: text(t, "chat.workspace.cards.help_requests.title", "Abisoovid"),
          meta: text(t, "chat.workspace.cards.help_requests.meta", "Kuulutused"),
          onClick: () => openHelpPanel?.("help_requests")
        }),
        makeCard({
          key: "help_offers",
          icon: "help-offer",
          title: text(t, "chat.workspace.cards.help_offers.title", "Abipakkumised"),
          meta: text(t, "chat.workspace.cards.help_offers.meta", "Pakkumised"),
          onClick: () => openHelpPanel?.("help_offers")
        })
      ],
      [
        serviceMapCard,
        personalSearchCard,
        makeCard({
          key: "service_profile",
          icon: "service-profile",
          title: text(t, "chat.workspace.cards.service_profile.title", "Teenuseprofiil"),
          meta: text(t, "chat.workspace.cards.service_profile.meta", "Profiil"),
          onClick: () => navigateTo?.("/teenuseprofiil"),
          route: "/teenuseprofiil"
        }, { requiresPaid: true }),
        /* TEENUSPÄEVIK (leping 8.3). Lipu taga: ilma UI liputa kaarti EI OLE.
           Ilma selle kaardita oli pind olemas, aga kättesaamatu — sinna sai
           ainult URL-i käsitsi kirjutades. */
        ...(isServiceLogUiEnabled()
          ? [
              makeCard({
                key: "service_log",
                icon: "document",
                title: text(t, "service_log.meta.title", "Teenuspäevik"),
                meta: text(t, "service_log.card_meta", "Kirjed ja aruanded"),
                onClick: () => navigateTo?.("/teenuspaevik"),
                route: "/teenuspaevik"
              }, { requiresPaid: true })
            ]
          : [])
      ],
      [
        makeCard({
          key: "documents",
          icon: "document",
          title: text(t, "chat.workspace.cards.documents.title", "Dokumendid"),
          meta: text(t, "chat.workspace.cards.documents.meta", "Teek"),
          onClick: () => navigateTo?.("/documents"),
          route: "/documents"
        }, { requiresPaid: true }),
        makeCard({
          key: "document_drafting",
          icon: "compose",
          title: text(t, "chat.workspace.cards.document_drafting.title", "Koosta dokument"),
          meta: text(t, "chat.workspace.cards.document_drafting.meta", "Koostamise tooruum"),
          onClick: () => navigateTo?.("/dokreziim"),
          route: "/dokreziim"
        }, { requiresPaid: true })
      ],
      [
        makeCard({
          key: "pre_inquiries",
          icon: "mailbox",
          title: text(t, "chat.workspace.cards.pre_inquiries.title_staff", "Pöördumised"),
          meta: text(t, "chat.workspace.cards.pre_inquiries.meta_staff", "Saabunud ja saadetud"),
          onClick: () => navigateTo?.("/eelpoordumised"),
          route: "/eelpoordumised"
        }, { requiresPaid: true }),
        makeCard({
          key: "add_person",
          icon: "invite",
          title: text(t, "chat.workspace.cards.add_person.title", "Kutsu osaleja"),
          meta: text(t, "chat.workspace.cards.add_person.meta", "Kutsed"),
          onClick: openInvite
        }, { requiresPaid: true })
      ],
      [
        makeCard({
          key: "materials",
          icon: "materials",
          title: text(t, "chat.workspace.cards.materials.title", "Materjalid"),
          meta: text(t, "chat.workspace.cards.materials.meta", "Andmebaas"),
          onClick: () => navigateTo?.("/materjalid"),
          route: "/materjalid"
        }, { requiresPaid: true })
      ]
    ];
  }

  return [
    ...(isClientView
      ? [[journeyCard, serviceMapCard, personalSearchCard]]
      : []),
    ...(!isClientView ? [[personalSearchCard]] : []),
    [
      makeCard({
        key: "help_requests",
        icon: "help-request",
        title: text(t, "chat.workspace.cards.help_requests.title", "Abisoovid"),
        meta: text(t, "chat.workspace.cards.help_requests.meta", "Kuulutused"),
        onClick: () => openHelpPanel?.("help_requests")
      }),
      makeCard({
        key: "help_offers",
        icon: "help-offer",
        title: text(t, "chat.workspace.cards.help_offers.title", "Abipakkumised"),
        meta: text(t, "chat.workspace.cards.help_offers.meta", "Pakkumised"),
        onClick: () => openHelpPanel?.("help_offers")
      })
    ],
    ...(!isClientView
      ? [[
          makeCard({
            key: "documents",
            icon: "document",
            title: text(t, "chat.workspace.cards.documents.title", "Dokumendid"),
            meta: text(t, "chat.workspace.cards.documents.meta", "Teek"),
            onClick: () => navigateTo?.("/documents"),
            route: "/documents"
          }, { requiresPaid: true }),
          makeCard({
            key: "document_drafting",
            icon: "compose",
            title: text(t, "chat.workspace.cards.document_drafting.title", "Koosta dokument"),
            meta: text(t, "chat.workspace.cards.document_drafting.meta", "Koostamise tooruum"),
            onClick: () => navigateTo?.("/dokreziim"),
            route: "/dokreziim"
          }, { requiresPaid: true })
        ]]
      : []),
    [
      makeCard({
        key: "pre_inquiries",
        icon: isClientView ? "pre-inquiry" : "mailbox",
        title: isClientView
          ? text(t, "chat.workspace.cards.pre_inquiries.title_client", "Eelpöördumine")
          : text(t, "chat.workspace.cards.pre_inquiries.title_staff", "Pöördumised"),
        meta: isClientView
          ? text(t, "chat.workspace.cards.pre_inquiries.meta_client", "Pöördumise eelvaade")
          : text(t, "chat.workspace.cards.pre_inquiries.meta_staff", "Saabunud ja saadetud"),
        onClick: () => navigateTo?.("/eelpoordumised"),
        route: "/eelpoordumised"
      }, { requiresPaid: true }),
      isClientView
        ? makeCard({
            key: "document_drafting",
            icon: "compose",
            title: text(t, "chat.workspace.cards.document_drafting.title", "Koosta dokument"),
            meta: text(t, "chat.workspace.cards.document_drafting.meta", "Koostamise tooruum"),
            onClick: () => navigateTo?.("/dokreziim"),
            route: "/dokreziim"
          }, { requiresPaid: true })
        : makeCard({
            key: "add_person",
            icon: "invite",
            title: text(t, "chat.workspace.cards.add_person.title", "Kutsu osaleja"),
            meta: text(t, "chat.workspace.cards.add_person.meta", "Kutsed"),
            onClick: openInvite
          }, { requiresPaid: true })
    ],
    ...(isClientView
      ? [[
          makeCard({
            key: "add_person",
            icon: "invite",
            title: text(t, "chat.workspace.cards.add_person.title", "Kutsu osaleja"),
            meta: text(t, "chat.workspace.cards.add_person.meta", "Kutsed"),
            onClick: openInvite
          }, { requiresPaid: true })
        ]]
      : [
          [
            makeCard({
              key: "kovision",
              icon: "room",
              title: text(t, "chat.workspace.cards.kovision.title", "Kovisioon"),
              meta: text(t, "chat.workspace.cards.kovision.meta", "Ruumid"),
              onClick: () => navigateTo?.("/kovisioon"),
              route: "/kovisioon"
            }, { requiresPaid: true }),
            makeCard({
              key: "wellbeing",
              icon: "wellbeing",
              title: text(t, "chat.workspace.cards.wellbeing.title", "Tööheaolu"),
              meta: text(t, "chat.workspace.cards.wellbeing.meta", "Koormus ja tugi"),
              description: text(
                t,
                "chat.workspace.cards.wellbeing.description",
                "Märka töökoormust, vaata ülevaateid ning hoia fookuses taastumine, piirid ja tööprotsessid."
              ),
              onClick: () => navigateTo?.("/tooheaolu"),
              route: "/tooheaolu"
            }, { requiresPaid: true })
          ],
          [
            makeCard({
              key: "materials",
              icon: "materials",
              title: text(t, "chat.workspace.cards.materials.title", "Materjalid"),
              meta: text(t, "chat.workspace.cards.materials.meta", "Andmebaas"),
              onClick: () => navigateTo?.("/materjalid"),
              route: "/materjalid"
            }, { requiresPaid: true }),
            serviceMapCard
          ],
          [
            makeCard({
              key: "mentoring",
              icon: "invite",
              title: text(t, "chat.workspace.cards.mentoring.title", "Mentorlus"),
              meta: text(t, "chat.workspace.cards.mentoring.meta", "Mentor ja mentee"),
              description: text(
                t,
                "chat.workspace.cards.mentoring.description",
                "Leia mentor või ole ise mentor: taotlus, kokkulepe, kohtumised ja kokkuvõtted ühes kohas."
              ),
              onClick: () => navigateTo?.("/mentorlus"),
              route: "/mentorlus"
            }, { requiresPaid: true })
          ]
        ])
  ];
}
