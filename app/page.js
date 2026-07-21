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
/* T10 E6: avalik Organization JSON-LD — ainult avalikud, staatilised andmed
   (samad, mis avalehe kontaktimodaalis). Ei sisalda env-väärtusi. */
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SotsiaalAI",
  legalName: "SotsiaalAI OÜ",
  url: "https://sotsiaal.ai",
  logo: "https://sotsiaal.ai/og/sotsiaalai-share.png",
  email: "info@sotsiaal.ai"
};

export default async function HomeRoot() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const room = messages?.room || {};
  const walkCopy = [
    ["walk_1"],
    ["walk_2a", "walk_2b"],
    ["walk_3a", "walk_3b"],
    ["walk_4a", "walk_4b"],
    ["walk_5a", "walk_5b"],
    ["walk_6"],
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
      />
      <div className="room-static-copy">
        <h1>{room.loading_line || "SotsiaalAI"}</h1>
        {walkCopy.map((keys) => (
          <p key={keys.join("-")}>
            {keys.map((key) => room[key]).filter(Boolean).join(" ")}
          </p>
        ))}
      </div>
      <div className="room-scroll-spacer" aria-hidden="true" />
    </>
  );
}
