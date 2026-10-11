/**
 * Avatud organisatsiooni osad: mis osad on olemas ja kes neid näeb.
 *
 * ÜKS TÕDE. Sama loendit kasutavad organisatsiooni laud (`./desk`), osa kest
 * (`./OrgPart.jsx`) ja vana lingirida (`./OrgNav.jsx`, mida kannavad veel
 * koduteenuse lehed). Enne oli loend ainult `OrgNav`-i sees.
 *
 * REEGEL (arenduskava §7.3): „Vaated, mille moodul pole aktiivne, ei ilmu
 * navigatsiooni ja route failib serveris suletult." Sama kehtib õiguse kohta:
 * liige, kellel ei ole `MEMBER_ADMIN`-it, ei näe liikmete osa.
 *
 * See on MUGAVUS, mitte turvapiir: iga osa on oma marsruut, mis kontrollib
 * õigust serveris ise uuesti. Osa peitmine üksi ei kaitse midagi.
 */

/**
 * Osad vana lingirea järjekorras. `path` on tee organisatsiooni all
 * (`/org/<id>` + path), `navKey` on sildi võti (`org.nav.<navKey>`).
 *
 * Miks mõni osa EI nõua õigust:
 *  - `inbox` sõltub MOODULIST, mitte õigusest: määratud töötajal ei ole
 *    `INBOX_COORDINATOR`-it, aga ta peab oma tööd nägema. Loend on serveris
 *    skoobitud: õiguseta liige näeb tühja lauda, mitte võõrast tööd.
 *  - `support` on IGA liikme oma: toeavaldus on töötaja õigus, mitte
 *    funktsioon, mida organisatsioon lubab.
 *  - `service_reports`: õigus näha tuleb SAATMISEST, mitte rollist.
 *  - `dispatch`: õigus otsustab SISU (tühi tahvel ilma õiguseta), mitte lingi
 *    olemasolu.
 *  - `home_care` sõltub MOODULIST: hooldajal ei ole ühtegi õigust, aga ta peab
 *    oma kliente nägema. Loend on serveris skoobitud.
 */
export const ORG_PARTS = Object.freeze([
  Object.freeze({ key: "overview", path: "" }),
  Object.freeze({ key: "structure", path: "/struktuur" }),
  Object.freeze({ key: "inbox", path: "/vastuvott", requiresModule: "KOV_INTAKE" }),
  Object.freeze({ key: "funding", path: "/arveldus", requires: "BILLING_MANAGER" }),
  Object.freeze({ key: "support", path: "/tugi" }),
  Object.freeze({ key: "service_reports", path: "/aruanded" }),
  Object.freeze({ key: "dispatch", path: "/graafik" }),
  Object.freeze({ key: "home_care", path: "/koduteenus", requiresModule: "HOME_CARE" }),
  Object.freeze({ key: "profile", path: "/teenusprofiil", requires: "SERVICE_PROFILE_EDITOR", requiresModule: "SERVICE_DELIVERY" }),
  Object.freeze({ key: "members", path: "/liikmed", requires: "MEMBER_ADMIN" }),
  Object.freeze({ key: "invites", path: "/kutsed", requires: "MEMBER_ADMIN" }),
  Object.freeze({ key: "audit", path: "/audit", requires: "AUDIT_VIEWER" }),
  Object.freeze({ key: "settings", path: "/seaded", requires: "ORG_OWNER" })
]);

/**
 * Osad, mida see liige näeb: `[{ key, href }]` vana lingirea järjekorras.
 * `capabilities` on õiguste read (`[{ capability }]`), `activeModules` moodulite võtmed.
 */
export function visibleOrgParts(organizationId, { capabilities = [], activeModules = [] } = {}) {
  const granted = new Set((capabilities || []).map((grant) => grant?.capability));
  const modules = new Set(activeModules || []);
  return ORG_PARTS.filter(
    (part) => (!part.requires || granted.has(part.requires)) && (!part.requiresModule || modules.has(part.requiresModule))
  ).map((part) => ({ key: part.key, href: `/org/${organizationId}${part.path}` }));
}
