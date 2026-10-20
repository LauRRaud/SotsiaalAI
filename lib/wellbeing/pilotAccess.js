import { prisma as defaultPrisma } from "../prisma.js";
import { normalizeWellbeingAnalysisUnit } from "./aggregate.js";
import { assertNoFreeFormPeriod, closedWellbeingQuarters, resolveWellbeingPeriod } from "./periodGrid.js";
import { LEGACY_SNAPSHOT_SCOPE_KEY } from "./pilotSnapshots.js";
import {
  claimWellbeingPilotViewer,
  serializeWellbeingPilotAccessScope
} from "./pilotScopes.js";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminSession(session) {
  const role = String(session?.user?.role || "").toUpperCase();
  return Boolean(session?.user?.isAdmin) || role === "ADMIN";
}

async function resolveSessionEmail(session, prisma) {
  const sessionEmail = normalizeEmail(session?.user?.email);
  if (sessionEmail) return sessionEmail;

  const userId = String(session?.user?.id || "").trim();
  if (!userId) return "";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  return normalizeEmail(user?.email);
}

function accessError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

/* `viewerOr === null` = kõik aktiivsed piloodid (admin). Vaataja korral on
   tühi `viewerOr` teadlikult „mitte ühtegi", mitte „kõik". */
async function findActivePilotScopes({ prisma, viewerOr, now, claimFor = null }) {
  if (!prisma?.wellbeingPilotScope?.findMany) return [];
  if (viewerOr !== null && viewerOr.length === 0) return [];

  try {
    const scopes = await prisma.wellbeingPilotScope.findMany({
      where: {
        active: true,
        ...(viewerOr === null ? {} : { viewers: { some: { OR: viewerOr } } }),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      include: { viewers: true },
      orderBy: [{ updatedAt: "desc" }]
    });

    if (claimFor?.userId && claimFor?.email) {
      for (const scope of scopes) {
        const invite = (scope.viewers || []).find(
          (viewer) => !viewer.claimedAt && normalizeEmail(viewer.email) === claimFor.email
        );
        if (!invite) continue;
        /* Lugemisrada ei tohi sidumise pärast kukkuda: halvimal juhul jääb rida
           kutseks ja proovitakse järgmisel korral uuesti. */
        await claimWellbeingPilotViewer(invite.id, claimFor.userId, { prisma }).catch((error) => {
          console.error("[wellbeing] pilot viewer claim failed", {
            viewerId: invite.id,
            message: error?.message
          });
        });
      }
    }

    return scopes.map(serializeWellbeingPilotAccessScope);
  } catch (error) {
    if (error?.code === "P2021" || error?.code === "P2022") return [];
    throw error;
  }
}

/* SOL-WB-12: e-post sobitub AINULT lunastamata kutsel. Seotud rida (`claimedAt`)
   kuulub konkreetsele kontole, ja kui see konto kustutatakse, ei tohi samale
   aadressile hiljem loodud uus konto tema vaadet pärida — vana leping tegi
   täpselt seda, sest `userId` läks `SetNull`-iga tühjaks ja e-post jäi
   sobituma. */
function viewerMatchers(session, email) {
  const viewerOr = [];
  const userId = String(session?.user?.id || "").trim();
  if (userId) viewerOr.push({ userId });
  if (email) viewerOr.push({ email, claimedAt: null });
  return viewerOr;
}

export async function resolveWellbeingPilotAccess(session, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const env = options.env || process.env;

  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
      allowedRoleGroups: []
    };
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

  /* SOL-WB-01: ka admin saab piloodi VALIDA, ja siis kehtib talle sama piir.
     Varem oli `pilotId` admini käes puhas dekoratsioon — ta jõudis vastuse
     metaandmetesse, aga ei piiranud valimit, seega platvormiülene koond kandis
     ühe KOV-i piloodi nime. Loend ise ei ole uus info: `/api/admin/wellbeing/pilots`
     annab admin'ile kõik skoobid niikuinii. */
  if (isAdminSession(session)) {
    return {
      ok: true,
      status: 200,
      isAdmin: true,
      allowedRoleGroups: [],
      pilotScopes: await findActivePilotScopes({ prisma, viewerOr: null, now })
    };
  }

  const email = await resolveSessionEmail(session, prisma);
  const pilotScopes = await findActivePilotScopes({
    prisma,
    viewerOr: viewerMatchers(session, email),
    now,
    /* Kutse seotakse esimesel kasutamisel — vt `claimWellbeingPilotViewer`.
       Tõrge siin ei tohi ligipääsu katkestada. */
    claimFor: { userId: String(session?.user?.id || "").trim(), email }
  });
  if (pilotScopes.length > 0) {
    return {
      ok: true,
      status: 200,
      isAdmin: false,
      allowedRoleGroups: unique(pilotScopes.flatMap((scope) => scope.roleGroups || [])),
      pilotScopes
    };
  }

  const allowedEmails = splitCsv(env.WELLBEING_PILOT_VIEWER_EMAILS).map(normalizeEmail);
  if (!email || !allowedEmails.includes(email)) {
    return {
      ok: false,
      status: 403,
      message: "wellbeing.pilot.forbidden",
      allowedRoleGroups: []
    };
  }

  const allowedRoleGroups = splitCsv(env.WELLBEING_PILOT_ROLE_GROUPS);
  if (allowedRoleGroups.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "wellbeing.pilot.role_group_missing",
      allowedRoleGroups: []
    };
  }

  return {
    ok: true,
    status: 200,
    isAdmin: false,
    allowedRoleGroups,
    pilotScopes: []
  };
}

/**
 * SOL-WB-01: piloodi skoop peab jõudma ANDMEPÄRINGUSSE, mitte ainult vastuse
 * metaandmetesse.
 *
 * FAIL-CLOSED. Kui skoop ütleb „organisatsioon", aga `organizationId` on tühi,
 * ei ole tema piir teostatav — ja teostamata piir tähendaks platvormiülest
 * valimit ühe asutuse nime all, mis on täpselt see leid. Seepärast 403, mitte
 * vaikne laiendus. `role_group` on ainus tüüp, millel piiri EI OLE, ja see on
 * seadistuse teadlik valik, mitte puudujääk.
 */
function scopeBoundary(scope = {}) {
  const scopeType = String(scope.scopeType || "role_group").trim();
  const organizationId = String(scope.organizationId || "").trim() || null;
  const municipalityId = String(scope.municipalityId || "").trim() || null;

  if (scopeType === "organization") {
    if (!organizationId) throw accessError("wellbeing.pilot.scope_incomplete", 403);
    return { organizationId, municipalityId: null };
  }
  if (scopeType === "municipality") {
    if (!municipalityId) throw accessError("wellbeing.pilot.scope_incomplete", 403);
    return { organizationId: null, municipalityId };
  }
  return { organizationId: null, municipalityId: null };
}

/* Koondi kaitse (arendusettepanek ptk 8.22–8.23): piloodi vaade ei anna kahte
   päringut, mille vahe annaks väikese rühma tagasi.

   - Töövoo filter: „kõik töövood“ miinus teised töövood on täpselt ülejäänud
     töövoo lahtrid, ka siis, kui seda kasutas üks inimene ja tema enda päring
     on summutatud. Töövoogude arvud ja kõik tegurid on aruandes niigi olemas.
   - Ühik `record`: „kõik kirjed“ miinus „viimane kirje inimese kohta“ on mitu
     korda vastanute varasemad kirjed; kui neid on üks, on see tema.
   - Periood: kuu, kvartal, aasta ja „kõik“ on sisestikku (kvartal miinus kuu)
     ja elav periood muutub päevast päeva. Seepärast ainult lõppenud kvartal,
     mis arvutatakse üks kord ja külmutatakse (`pilotSnapshots.js`).

   Reeglid kehtivad piloodi vaatele, ka adminile, kes piloodi valis: piir tuleb
   skoobist, mitte kutsuja rollist. Admini platvormivaade (ühegi piloodita) jääb
   elavaks. Vaikset ignoreerimist ei ole: keelatud valik annab 403, mitte
   teistsuguse vastuse sama nime all. Perioodi puudumine tähendab viimast
   lõppenud kvartalit. */
function resolvePilotViewSlices(filters, now) {
  if (String(filters.workflowType || "").trim()) {
    throw accessError("wellbeing.pilot.workflow_filter_forbidden", 403);
  }
  const unit = String(filters.analysisUnit || "").trim();
  if (unit && normalizeWellbeingAnalysisUnit(unit) !== "latest_per_person") {
    throw accessError("wellbeing.pilot.analysis_unit_forbidden", 403);
  }
  const selection = String(filters.periodKind || "").trim()
    ? filters
    : closedWellbeingQuarters(now, 1)[0];
  if (String(selection.periodKind).trim().toLowerCase() !== "quarter") {
    throw accessError("wellbeing.pilot.period_closed_quarter_only", 403);
  }
  const period = resolveWellbeingPeriod(selection);
  if (period.periodEnd.getTime() > now.getTime()) {
    throw accessError("wellbeing.pilot.period_closed_quarter_only", 403);
  }
  return {
    periodKind: period.periodKind,
    periodLabel: period.label,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    workflowType: null,
    analysisUnit: "latest_per_person",
    periodYear: Number(selection.periodYear),
    periodQuarter: Number(selection.periodIndex)
  };
}

/* Mõõdiku tase on silt; piloodi vaates tuleb ta skoobist, et külmutatud
   aruanne ei sõltuks sellest, kes ta esimesena avas. */
function scopeAggregationLevel(scopeType) {
  if (scopeType === "organization" || scopeType === "municipality") return scopeType;
  return "role_group";
}

function pilotViewFilters({ slices, roleGroup, boundary, aggregationLevel, snapshot, extra = {} }) {
  const { periodYear, periodQuarter, ...periodFilters } = slices;
  return {
    ...extra,
    roleGroup,
    ...periodFilters,
    ...boundary,
    aggregationLevel,
    snapshot: { ...snapshot, roleGroup, periodYear, periodQuarter }
  };
}

export function resolveWellbeingPilotAggregateFilters(filters = {}, access = {}, { now = new Date() } = {}) {
  if (!access?.ok) {
    throw accessError(access?.message || "wellbeing.pilot.forbidden", access?.status || 403);
  }

  /* SOL-WB-06: periood tuleb fikseeritud võrgust, mitte vabalt nihutatavast
     kuupäevapaarist. Vaba piir oli differencing-rünnaku eeldus: kaks piisavalt
     suurt päringut, mille ajapiir erineb ühe inimese võrra, annavad lahutamisel
     selle inimese signaalid. Vana kliendi vabad kuupäevad lükatakse tagasi,
     mitte ei ümardata vaikselt. */
  assertNoFreeFormPeriod(filters);
  const pilotId = String(filters.pilotId || "").trim();
  const roleGroup = String(filters.roleGroup || "").trim();

  const pilotScopes = Array.isArray(access.pilotScopes) ? access.pilotScopes : [];
  /* Vaataja seotakse piloodiga alati (esimene, kui ta ise ei valinud); admin
     ainult siis, kui ta piloodi VALIS. Valitud piloot maksab mõlemale
     ühtemoodi — piir tuleb skoobist, mitte kutsuja rollist. */
  const selectedScope = pilotId
    ? pilotScopes.find((scope) => scope.id === pilotId)
    : (access.isAdmin ? null : pilotScopes[0]);

  if (pilotId && !selectedScope) {
    throw accessError("wellbeing.pilot.scope_forbidden", 403);
  }

  if (selectedScope) {
    const allowedRoleGroups = Array.isArray(selectedScope.roleGroups) ? selectedScope.roleGroups : [];
    if (allowedRoleGroups.length === 0) {
      throw accessError("wellbeing.pilot.role_group_missing", 403);
    }

    const requestedRoleGroup = roleGroup || allowedRoleGroups[0];
    if (!allowedRoleGroups.includes(requestedRoleGroup)) {
      throw accessError("wellbeing.pilot.role_group_forbidden", 403);
    }

    return pilotViewFilters({
      slices: resolvePilotViewSlices(filters, now),
      roleGroup: requestedRoleGroup,
      boundary: scopeBoundary(selectedScope),
      aggregationLevel: scopeAggregationLevel(String(selectedScope.scopeType || "role_group").trim()),
      snapshot: { scopeKey: selectedScope.id, pilotScopeId: selectedScope.id },
      extra: { pilotId: selectedScope.id, minimumGroupSize: selectedScope.minimumGroupSize }
    });
  }

  if (access.isAdmin) {
    const period = resolveWellbeingPeriod(filters);
    /* Platvormiülene vaade on admini oma, elav ja ta ei kanna ühegi piloodi nime. */
    return {
      roleGroup,
      workflowType: String(filters.workflowType || "").trim() || null,
      periodKind: period.periodKind,
      periodLabel: period.label,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      /* SOL-WB-04: ühik peab siia nimeliselt jõudma — muidu oleks päringu
         parameeter kadunud vaikselt. Tundmatu väärtus viskab 400. */
      analysisUnit: normalizeWellbeingAnalysisUnit(filters.analysisUnit),
      aggregationLevel: String(filters.aggregationLevel || "role_group").trim() || "role_group",
      organizationId: null,
      municipalityId: null
    };
  }

  const allowedRoleGroups = Array.isArray(access.allowedRoleGroups) ? access.allowedRoleGroups : [];
  if (allowedRoleGroups.length === 0) {
    throw accessError("wellbeing.pilot.role_group_missing", 403);
  }

  const requestedRoleGroup = roleGroup || allowedRoleGroups[0];
  if (!allowedRoleGroups.includes(requestedRoleGroup)) {
    throw accessError("wellbeing.pilot.role_group_forbidden", 403);
  }

  /* Pärandrada (`WELLBEING_PILOT_VIEWER_EMAILS`): rollirühm on operaatori
     seadistus ja organisatsioonipiiri tal ei ole — sama teadlik valik nagu
     `role_group` tüüpi skoobil. Nullid on kirjas selleks, et vastus ütleks
     seda välja, mitte ei jätaks vaikimisi lahtiseks. Piloodi vaate reeglid
     kehtivad ka siin. */
  return pilotViewFilters({
    slices: resolvePilotViewSlices(filters, now),
    roleGroup: requestedRoleGroup,
    boundary: { organizationId: null, municipalityId: null },
    aggregationLevel: "role_group",
    snapshot: { scopeKey: LEGACY_SNAPSHOT_SCOPE_KEY, pilotScopeId: null }
  });
}
