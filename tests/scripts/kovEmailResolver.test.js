import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeCloudflareEmail,
  decodeRot13ProtectedEmail,
  extractCloudflareEmails,
  extractProtectedEmails,
  findQueueEmailFields,
  isProblemEmail,
  parseSelection,
  resolveEmailFromHtml
} from "../../scripts/lib/kov-email-resolver.mjs";

test("decodes Cloudflare protected email values", () => {
  assert.equal(
    decodeCloudflareEmail("2a4b5c4f045e45454743444d6a5e4b585e5f044f4f"),
    "ave.tooming@tartu.ee"
  );
});

test("decodes WordPress ROT13 protected email attributes", () => {
  assert.equal(
    decodeRot13ProtectedEmail("znnevxn.xvgf[at]yhhawn.rr"),
    "maarika.kits@luunja.ee"
  );
});

test("extracts Cloudflare emails with nearby readable context", () => {
  const html = `
    <p><strong>Ave Tooming</strong><br>
    tel 736 1331<br>
    <span class="__cf_email__" data-cfemail="2a4b5c4f045e45454743444d6a5e4b585e5f044f4f">[email&#160;protected]</span>
    </p>
  `;

  const [email] = extractCloudflareEmails(html);

  assert.equal(email.email, "ave.tooming@tartu.ee");
  assert.match(email.context, /Ave Tooming/);
  assert.match(email.context, /736 1331/);
});

test("extracts JavaScript protected emails with nearby context", () => {
  const html = `
    <p id="maarika-kits">Maarika Kits</p>
    <a data-enc-email="znnevxn.xvgf[at]yhhawn.rr">
      <script>document.getElementById("x").innerHTML = decodeURIComponent("%6d%61%61%72%69%6b%61%2e%6b%69%74%73%40%6c%75%75%6e%6a%61%2e%65%65");</script>
    </a>
    <a href="tel:53769818">5376 9818</a>
  `;

  const emails = extractProtectedEmails(html);

  assert.equal(emails.some(candidate => candidate.email === "maarika.kits@luunja.ee"), true);
  assert.equal(emails.some(candidate => /Maarika Kits/.test(candidate.context)), true);
});

test("identifies null and protected placeholder email values", () => {
  assert.equal(isProblemEmail(null), true);
  assert.equal(isProblemEmail(""), true);
  assert.equal(isProblemEmail("[email protected]"), true);
  assert.equal(isProblemEmail("*protected email*"), true);
  assert.equal(isProblemEmail("info@jarvavald.ee*protected email*"), true);
  assert.equal(isProblemEmail("info@example.ee"), false);
});

test("resolves a contact email from same official HTML context", () => {
  const html = `
    <p><strong>Ave Tooming</strong><br>
    tel 736 1331; 5919 6630<br>
    <a href="/cdn-cgi/l/email-protection#90b5a2a0b5a2a0b5a2a0b5a2a0f1e6f5bee4fffffdf9fef7d0e4f1e2e4e5bef5f5">
      <span class="__cf_email__" data-cfemail="2a4b5c4f045e45454743444d6a5e4b585e5f044f4f">[email&#160;protected]</span>
    </a>
    </p>
  `;

  const result = resolveEmailFromHtml({
    html,
    name: "Ave Tooming",
    phone: "+372 736 1331; +372 5919 6630"
  });

  assert.equal(result.email, "ave.tooming@tartu.ee");
  assert.equal(result.confidence, "high");
  assert.equal(result.reasons.includes("name_context"), true);
  assert.equal(result.reasons.includes("phone_context"), true);
});

test("parses comma separated indices and ranges", () => {
  assert.deepEqual(parseSelection("1-3,5,8-9"), new Set([1, 2, 3, 5, 8, 9]));
  assert.deepEqual(parseSelection(""), null);
});

test("finds queue rows that need email or emailToFill values", () => {
  const rows = findQueueEmailFields([
    {
      slug: "tartu-linn",
      name: "Ave Tooming",
      phone: "+372 736 1331",
      email: null,
      officialUrl: "https://www.tartu.ee/et/hoolduskoordinaatorid"
    },
    {
      slug: "tartu-linn",
      name: "Aigi Puusepp",
      phone: "+372 5886 0369",
      emailToFill: "",
      officialUrl: "https://www.tartu.ee/et/hoolduskoordinaatorid"
    },
    {
      slug: "tartu-linn",
      name: "Merle Pahk",
      email: "merle.pahk@tartu.ee",
      officialUrl: "https://www.tartu.ee/et/hoolduskoordinaatorid"
    }
  ], { file: "queue.json" });

  assert.deepEqual(rows.map(row => row.updateField), ["email", "emailToFill"]);
  assert.deepEqual(rows.map(row => row.itemIndex), [0, 1]);
});
