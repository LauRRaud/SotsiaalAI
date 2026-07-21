import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

function readCopy(messages) {
  return {
    title: messages?.chat?.workspace?.cards?.wellbeing?.title || "Tööheaolu",
    description: messages?.meta?.workspace?.description || ""
  };
}

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const copy = readCopy(getMessagesSync(locale));
  return buildLocalizedMetadata({
    locale,
    pathname: "/toolaud/tooheaolu",
    title: `${copy.title} | SotsiaalAI`,
    description: copy.description
  });
}

/**
 * /toolaud/tooheaolu = töölaua tööheaolu-KAARDIMENÜÜ marsruudina (omanik
 * 21.07: "tööheaolu lehel ei ole ka /tööheaolu näha").
 *
 * NB: see EI ole tööheaolu tööruum — see elab endiselt /tooheaolu peal
 * (app/tooheaolu/page.jsx). Siin on ainult kaardimenüü, mis viib
 * tööriistadeni; seepärast elab ta töölaua ALL, mitte /tooheaolu peal.
 *
 * Nähtav vaade elab püsivas RoomStage-karussellis (root-layout) — see leht on
 * ainult marsruudi-marker + sr-only sisu ekraanilugejale ja robotitele.
 */
export default async function ToolaudTooheaoluPage() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const copy = readCopy(getMessagesSync(locale));

  return (
    <div className="room-static-copy">
      <h1>{copy.title}</h1>
      {copy.description ? <p>{copy.description}</p> : null}
    </div>
  );
}
