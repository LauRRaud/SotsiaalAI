import { localizePath, DEFAULT_LOCALE } from "./localizePath.js";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sotsiaal.ai";

/* T10 E6: staatiline bränditud jagamispilt (tekstita peale SotsiaalAI nime,
   et ET/EN/RU ei läheks pildis vastuollu). */
const SHARE_IMAGE = {
  url: "/og/sotsiaalai-share.png",
  width: 1200,
  height: 630,
  alt: "SotsiaalAI"
};
function toAbsolute(pathname = "/") {
  return new URL(pathname, SITE_URL).toString();
}
function buildLocalizedAlternates(pathname = "/", locale = DEFAULT_LOCALE) {
  /* Keelevalik on küpsisepõhine ja localizePath lokaadineutraalne — kolm
     identset hreflang-URL-i olid sisutühjad. Kuni URL-lokaadi otsust pole,
     hreflang-alternatiive EI lisata (T10 lukustatud valik); alles jääb
     canonical. */
  return {
    canonical: toAbsolute(localizePath(pathname, locale))
  };
}
export function buildLocalizedMetadata({
  locale = DEFAULT_LOCALE,
  pathname = "/",
  title,
  description,
  openGraph = {},
  twitter = {},
  metadataBase = SITE_URL
}) {
  const alternates = buildLocalizedAlternates(pathname, locale);
  const url = alternates.canonical;
  return {
    title,
    description,
    metadataBase: new URL(metadataBase),
    alternates,
    openGraph: {
      title,
      description,
      url,
      siteName: "SotsiaalAI",
      type: "website",
      images: [SHARE_IMAGE],
      ...openGraph
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE.url],
      ...twitter
    }
  };
}
