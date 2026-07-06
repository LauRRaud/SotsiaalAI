import { cookies } from "next/headers";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.home || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/",
    // Keep the home document title short because some screen readers
    // announce repeated title updates during the initial page load.
    title: "SotsiaalAI",
    description: meta.description || ""
  });
}

/**
 * Avaleht = hämarikuruum. Visuaal (kaadrid, karussell, tekstipeatused)
 * renderdub püsivas RoomStage-komponendis (root-layout); siin on ainult
 * kerimisruum saabumiskõnnile ning staatiline sisu ekraanilugejale,
 * otsimootorile ja liikumise vähendajale.
 */
export default async function HomeRoot() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const room = messages?.room || {};

  return (
    <>
      <div className="room-static-copy">
        <h1>{room.loading_line || "SotsiaalAI"}</h1>
        <p>{room.walk_1 || ""}</p>
        <p>
          {[room.walk_3a, room.walk_3b].filter(Boolean).join(" ")}
        </p>
        <p>
          {[room.walk_5a, room.walk_5b].filter(Boolean).join(" ")}
        </p>
      </div>
      <div className="room-scroll-spacer" aria-hidden="true" />
    </>
  );
}
