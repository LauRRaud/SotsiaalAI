import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.workspace || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/toolaud",
    title: meta.title || "Töölaud | SotsiaalAI",
    description: meta.description || ""
  });
}

/**
 * /toolaud = töölaua kaardimenüü PÄRIS marsruudina (omanik 21.07: "nt
 * /toolaud ja mujal lehtedel ka route, aga seda ei soovi, et lehe
 * vahetusega ekraan vilgub").
 *
 * Nähtav vaade elab püsivas RoomStage-karussellis (root-layout) — see leht
 * on ainult marsruudi-marker + sr-only sisu ekraanilugejale ja robotitele.
 * Nii ei remonteeri marsruudivahetus ruumi ega vilguta ekraani: RoomStage
 * loeb pathname'i ja vahetab AINULT kaardikomplekti.
 *
 * Rollipõhine kaardiloend elab RoomStage'is (workspaceItems) — seda siin ei
 * dubleerita, sest komplekt sõltub vaate-rollist (admini S/P/T-lüliti).
 */
export default async function ToolaudPage() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const title = messages?.nav?.workspace || "Töölaud";
  const description = messages?.meta?.workspace?.description || "";

  return (
    <div className="room-static-copy">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
