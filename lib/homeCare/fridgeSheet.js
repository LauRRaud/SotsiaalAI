/**
 * KODUTEENUS K5-g — külmkapileht (kava II.6.8).
 *
 * Kliendi koju käiv leht: kes ja mis päeval tuleb, mida koos teeme, kuhu helistada.
 * Lehe koostab hooldusjuht või kliendi meeskonna liige kliendi kehtivast käigumustrist ja
 * hoolduskavast; põhjusega avaja lehte ei koosta. Midagi ei salvestata: leht on väljavõte
 * sellest, mida koostaja kliendi lehel niigi näeb. Telefoninumbri annab koostaja kaasa
 * (asutuse number, kuhu klient helistab); seda ei hoita.
 */

import prisma from "@/lib/prisma";

import { badRequest, forbidden } from "../org/errors.js";

import { assertHomeCareContext, organizationTimeZone, requireClientAccess } from "./access.js";
import { loadActivePlanWithin } from "./carePlans.js";
import { HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { renderFridgeSheetHtml } from "./fridgeSheetDocument.js";
import { phoneHref } from "./phone.js";
import { loadSlotsWithin } from "./slots.js";
import { asObject, normalizeId, normalizeLine } from "./validation.js";

const PHONE_PATTERN = /^[0-9+() -]+$/;

/** Päev kujul PP.KK.AAAA lehe jaluse jaoks. */
function dayLabel(day) {
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

export async function getFridgeSheet(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const phone = normalizeLine(asObject(input).phone, HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) || null;
  if (phone && (!PHONE_PATTERN.test(phone) || !phoneHref(phone))) throw badRequest("home_care.errors.referral_phone_invalid");

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    const today = todayText(now, organizationTimeZone(context));
    const slots = await loadSlotsWithin(tx, id, today);
    const plan = await loadActivePlanWithin(tx, id);
    return {
      html: renderFridgeSheetHtml({
        clientName: access.client.displayName,
        organizationName: context.organization.displayName || "",
        visits: slots.map((slot) => ({ weekday: slot.weekday, startMinute: slot.startMinute, plannedMinutes: slot.plannedMinutes, workerName: slot.worker?.name || null })),
        activities: (plan?.lines || []).map((line) => line.activityName).filter(Boolean),
        phone,
        validFrom: dayLabel(today),
        locale: context.organization.defaultLocale || "et"
      })
    };
  });
}
