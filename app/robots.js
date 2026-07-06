import { DEFAULT_LOCALE, LOCALES } from "@/lib/localizePath";

export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://sotsiaal.ai";
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
