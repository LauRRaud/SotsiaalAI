import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSources } from "../../components/chat/utils/sources.js";

test("normalizeSources exposes canonical and official URL aliases as clickable url", () => {
  const canonical = normalizeSources([
    {
      title: "Koduteenus",
      url_canonical: "https://www.kuusalu.ee/koduteenus"
    },
    {
      title: "Koduteenus",
      officialUrl: "https://www.kuusalu.ee/toiming/koduteenus"
    },
    {
      title: "Astangu Kutserehabilitatsiooni Keskus",
      official_website: "https://www.astangu.ee"
    },
    {
      title: "Organisatsioon",
      metadata: {
        officialWebsite: "https://example.test/organization"
      }
    }
  ]);

  assert.equal(canonical[0].url, "https://www.kuusalu.ee/koduteenus");
  assert.equal(canonical[1].url, "https://www.kuusalu.ee/toiming/koduteenus");
  assert.equal(canonical[2].url, "https://www.astangu.ee");
  assert.equal(canonical[3].url, "https://example.test/organization");
});
