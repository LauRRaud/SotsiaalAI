/**
 * Liikmete osa (`/org/<id>/liikmed`) reeglid ilma joonistamiseta: loendi rida,
 * avatud liikme read ja vaated, mis õigusi saab anda ja mis tegevused on lubatud.
 *
 * SIIN EI OLE JA EI TOHI TULLA: „viimati aktiivne", kasutuskordi, vestluste
 * arvu, tootlikkust ega ühtegi privaatset kirjet (arenduskava §7.4). Server ei
 * saada neid välju; need funktsioonid ei tohi neid ka tuletada.
 *
 * Leht (`../OrgMembersClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./MembersViews.jsx`) joonistavad. Test: `tests/org-members-views.test.mjs`.
 */

import { ORGANIZATION_CAPABILITIES, requiredModulesForCapability } from "@/lib/org/constants";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Liikme nimi; nimeta liikme puhul ON e-post nimi. */
export function memberName(member) {
  return [text(member?.person?.firstName), text(member?.person?.lastName)].filter(Boolean).join(" ") || text(member?.person?.email);
}

/** Kas liikmel on nimi (siis näidatakse e-posti eraldi real, mitte nime asemel). */
export function hasOwnName(member) {
  return Boolean(text(member?.person?.firstName) || text(member?.person?.lastName));
}

/** Üksuste nimed, põhiüksus ees. */
function unitNames(member) {
  const units = Array.isArray(member?.units) ? member.units : [];
  return [...units].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))).map((unit) => text(unit.name)).filter(Boolean);
}

/**
 * Loendi rida: nimi, selle all ametinimetus (või koha liik), üksused ja esimene
 * õigus (koos märkega, kui neid on rohkem). Seis on märgina ainult siis, kui
 * liikmesus EI ole aktiivne.
 */
export function memberRow(member, { t }) {
  const status = String(member?.status || "").toUpperCase();
  const rights = (Array.isArray(member?.capabilities) ? member.capabilities : []).map((grant) => t(`org.capability.${grant.capability}`));
  const parts = [
    text(member?.jobTitle) || (member?.seatRole ? t(`org.seatRole.${member.seatRole}`) : ""),
    unitNames(member).join(", "),
    rights.length > 1 ? t("org.members.rights_more", { name: rights[0], count: rights.length - 1 }) : rights[0] || ""
  ].filter(Boolean);
  return {
    id: String(member?.membershipId || ""),
    title: memberName(member),
    sub: parts.join(" · "),
    chip: status && status !== "ACTIVE" ? t(`org.membershipStatus.${status}`) : "",
    attention: status === "SUSPENDED"
  };
}

/** Avatud liikme read: e-post (kui nimi on olemas), koht, ametinimetus, seis ja üksused. */
export function memberFacts(member, { t }) {
  const units = Array.isArray(member?.units) ? member.units : [];
  const status = String(member?.status || "").toUpperCase();
  return [
    { key: "email", label: t("org.members.email"), value: hasOwnName(member) ? text(member?.person?.email) : "" },
    { key: "seat", label: t("org.join.seat"), value: member?.seatRole ? t(`org.seatRole.${member.seatRole}`) : "" },
    { key: "jobTitle", label: t("org.join.job_title"), value: text(member?.jobTitle) },
    { key: "status", label: t("org.members.status"), value: status ? t(`org.membershipStatus.${status}`) : "" },
    {
      key: "units",
      label: t("org.members.units"),
      value: units.length
        ? [...units]
            .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))
            .map((unit) => (unit.isPrimary && units.length > 1 ? t("org.desk.place.primary_unit", { name: unit.name }) : unit.name))
            .join(", ")
        : t("org.members.units_none"),
      quiet: !units.length
    }
  ].filter((row) => row.value);
}

/** Liikme põhiüksuse ID või tühi sõne. */
export function primaryUnitId(member) {
  return String((Array.isArray(member?.units) ? member.units : []).find((unit) => unit?.isPrimary)?.id || "");
}

/**
 * Liikme õigused nimedega. Üksusega piiratud õigusel on sulgudes üksuse nimi
 * (organisatsiooni üksuste loendist) või sõna „üksus".
 */
export function heldRights(member, units, { t }) {
  const byId = new Map((Array.isArray(units) ? units : []).map((unit) => [unit.id, unit.name]));
  return (Array.isArray(member?.capabilities) ? member.capabilities : []).map((grant) => {
    const name = t(`org.capability.${grant.capability}`);
    const scoped = grant.scopeType === "UNIT";
    return { id: String(grant.id), capability: grant.capability, label: scoped ? `${name} (${text(byId.get(grant.scopeUnitId)) || t("org.scope.UNIT")})` : name };
  });
}

/**
 * Mida sellele liikmele veel anda saab: kogu asutuse skoobis õigused, mida tal
 * ei ole ja mille moodul on aktiivne. Moodulita õigus ei avaks ühtegi vaadet ja
 * jääks loendisse segadust tekitama. Üksusega piiratud õigus käib kutse
 * rollimalli kaudu.
 */
export function grantableFor(member, activeModules = []) {
  const modules = new Set(activeModules || []);
  const held = new Set(
    (Array.isArray(member?.capabilities) ? member.capabilities : []).filter((item) => item.scopeType !== "UNIT").map((item) => item.capability)
  );
  return ORGANIZATION_CAPABILITIES.filter(
    (capability) => !held.has(capability) && requiredModulesForCapability(capability).every((key) => modules.has(key))
  );
}

/**
 * Kas selle õiguse andmine küsib teist vajutust. Omaniku õigus küsib: uus
 * omanik saab muuta kõiki õigusi ja seadeid ning organisatsiooni arhiveerida.
 * Teised õigused antakse ühe vajutusega (need saab kohe tagasi võtta).
 */
export function grantNeedsConfirm(capability) {
  return capability === "ORG_OWNER";
}

/**
 * Mis tegevused on selle liikmega lubatud. Kirjutuskaitstud organisatsioonis
 * (mustand, peatatud) ei ole ühtegi; õigusi annab ja võtab ära ainult omanik
 * ning õiguse saab anda ainult aktiivsele liikmele.
 */
export function memberActions(member, { writable = true, canGrant = false, units = [], activeModules = [] } = {}) {
  const status = String(member?.status || "").toUpperCase();
  const open = Boolean(writable);
  return {
    suspend: open && status === "ACTIVE",
    reactivate: open && status === "SUSPENDED",
    end: open && status !== "ENDED",
    setUnit: open && (Array.isArray(units) ? units.length : 0) > 0,
    revoke: open && Boolean(canGrant),
    grant: open && Boolean(canGrant) && status === "ACTIVE" ? grantableFor(member, activeModules) : []
  };
}

/**
 * Avatud liikme vaated lahtritena. „Üksus" on olemas ainult siis, kui põhiüksust
 * saab määrata; „Õigused" on alati (lugemiseks kõigile, kes lehte näevad).
 */
export function memberTabs(actions) {
  return ["member", ...(actions?.setUnit ? ["unit"] : []), "rights"];
}

/** Kui valitud vaadet (enam) ei ole, on ees liikme vaade. */
export function shownTab(tabs, wanted) {
  return (tabs || []).includes(wanted) ? wanted : "member";
}
