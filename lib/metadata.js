import { localizePath, LOCALES, DEFAULT_LOCALE } from "./localizePath.js";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sotsiaal.ai";
function toAbsolute(pathname = "/") {
  return new URL(pathname, SITE_URL).toString();
}
function buildLocalizedAlternates(pathname = "/", locale = DEFAULT_LOCALE) {
  const languages = {};
  for (const loc of LOCALES) {
    languages[loc] = toAbsolute(localizePath(pathname, loc));
  }
  return {
    canonical: toAbsolute(localizePath(pathname, locale)),
    languages
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
      ...openGraph
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...twitter
    }
  };
}
