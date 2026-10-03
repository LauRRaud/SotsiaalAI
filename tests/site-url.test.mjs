import test from "node:test";
import assert from "node:assert/strict";
import { getPublicSiteUrl } from "../lib/siteUrl.js";
import sitemap from "../app/sitemap.js";
import robots from "../app/robots.js";

test("primary website URLs use sotsiaal.pro and preserve explicit preview origins", async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    for (const [configured, expected] of [
      [undefined, "https://sotsiaal.pro"],
      ["https://sotsiaal.pro/", "https://sotsiaal.pro"],
      ["http://localhost:3000/", "http://localhost:3000"]
    ]) {
      if (configured === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = configured;
      assert.equal(getPublicSiteUrl(), expected);
      const { buildLocalizedMetadata } = await import(`../lib/metadata.js?site=${encodeURIComponent(expected)}`);
      const metadata = buildLocalizedMetadata({ pathname: "/kasutusjuhend", locale: "et" });
      assert.equal(metadata.alternates.canonical, `${expected}/kasutusjuhend`);
      assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
      assert.equal(metadata.metadataBase.origin, expected);
      const entries = sitemap();
      assert.ok(entries.length > 1);
      assert.ok(entries.every(entry => new URL(entry.url).origin === expected));
      assert.equal(robots().sitemap, `${expected}/sitemap.xml`);
      assert.equal(robots().host, expected);
      assert.ok(robots().rules[0].disallow.includes("/admin"));
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
