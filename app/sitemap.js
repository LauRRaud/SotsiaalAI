export default function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://sotsiaal.ai").replace(/\/$/, "");
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
