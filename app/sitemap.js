import { getPublicSiteUrl } from "@/lib/siteUrl";

export default function sitemap() {
  const base = getPublicSiteUrl();
  const now = new Date().toISOString();
  const paths = [
    "/",
    "/taasta-parool",
    "/kasutusjuhend",
    "/tooalase-kasutuse-raamistik",
    "/hinnastus",
    "/voimalused",
    "/autorilt",
    "/kasutustingimused",
    "/privaatsustingimused",
    "/meist"
  ];

  return paths.map(pathname => {
    return {
      url: `${base}${pathname === "/" ? "" : pathname}`,
      lastModified: now,
      changeFrequency: pathname === "/" ? "daily" : "weekly",
      priority: pathname === "/" ? 1.0 : 0.7
    };
  });
}
