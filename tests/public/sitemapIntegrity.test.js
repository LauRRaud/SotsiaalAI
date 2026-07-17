import assert from "node:assert/strict";
import test from "node:test";

import sitemap from "@/app/sitemap";

const SITE_URL = "https://sitemap-integrity.example";
const CANONICAL_PATHS = [
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

test("AVALIK-P1S sitemap contains each locale-neutral canonical URL exactly once", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = `${SITE_URL}/`;

  try {
    const entries = sitemap();
    const urls = entries.map(entry => entry.url);
    const expectedUrls = CANONICAL_PATHS.map(pathname => `${SITE_URL}${pathname === "/" ? "" : pathname}`);

    assert.equal(entries.length, 10);
    assert.deepEqual(urls, expectedUrls);
    assert.equal(new Set(urls).size, urls.length);
    assert.equal(urls.filter(url => url === `${SITE_URL}/meist`).length, 1);
    assert.equal(urls.some(url => /\/(?:et|en|ru)(?:\/|$)/.test(url)), false);
    assert.equal(entries.some(entry => "alternates" in entry), false);

    for (const entry of entries) {
      const pathname = new URL(entry.url).pathname || "/";
      assert.equal(entry.changeFrequency, pathname === "/" ? "daily" : "weekly");
      assert.equal(entry.priority, pathname === "/" ? 1.0 : 0.7);
      assert.match(entry.lastModified, /^\d{4}-\d{2}-\d{2}T/);
    }
  } finally {
    if (previousSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
    }
  }
});
