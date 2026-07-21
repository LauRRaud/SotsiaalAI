import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

function readCopy(messages) {
  return {
    title: messages?.chat?.workspace?.cards?.kovision?.title || "Kovisioon",
    description: messages?.meta?.workspace?.description || ""
  };
}

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const copy = readCopy(getMessagesSync(locale));
  return buildLocalizedMetadata({
    locale,
    pathname: "/toolaud/kovisioon",
    title: `${copy.title} | SotsiaalAI`,
    description: copy.description
  });
}

/**
 * /toolaud/kovisioon = töölaua kovisiooni-KAARDIMENÜÜ marsruudina (omanik
 * 21.07, sama otsus mis tööheaolul).
 *
 * NB: see EI ole kovisiooni tööruum — see elab endiselt /kovisioon peal
 * (app/kovisioon/page.jsx). Siin on ainult menüü: Kovisiooni ruum,
 * Teemaseemned, Lõpetatud juhtumid, Parimad praktikad.
 *
 * Nähtav vaade elab püsivas RoomStage-karussellis (root-layout) — see leht on
 * ainult marsruudi-marker + sr-only sisu ekraanilugejale ja robotitele.
 */
export default async function ToolaudKovisioonPage() {
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
