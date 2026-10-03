import { DEFAULT_LOCALE, LOCALES } from "@/lib/localizePath";
import { getPublicSiteUrl } from "@/lib/siteUrl";

export default function robots() {
  const base = getPublicSiteUrl();
  const privatePaths = [
    "/profiil",
    "/vestlus",
    "/tellimus",
    "/uuenda-epost",
    "/uuenda-pin",
    "/rooms",
    "/ruum",
    "/join",
    "/admin"
  ];
  const localizedPrivatePaths = LOCALES.filter(
    (locale) => locale !== DEFAULT_LOCALE
  ).flatMap((locale) => privatePaths.map((pathname) => `/${locale}${pathname}`));
  const disallow = Array.from(new Set([...privatePaths, ...localizedPrivatePaths]));

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
