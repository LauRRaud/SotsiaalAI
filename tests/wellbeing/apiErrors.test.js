import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  isWellbeingDomainError,
  wellbeingErrorBody,
  WELLBEING_UNEXPECTED_ERROR
} from "../../lib/wellbeing/apiErrors.js";

/* Päris Prisma vea kuju, koos selle tekstiga, mida ta tegelikult kannab:
   tabelinimi, veerunimi ja väärtus. Just see jõudis varem kasutajani. */
function prismaLikeError() {
  const error = new Error(
    'Invalid `prisma.wellbeingRecord.create()` invocation in /app/lib/wellbeing/records.js:125\n'
    + 'Unknown argument `scopeRoleGroup`. Available options: ownerUserId, standardizedFields. '
    + 'Failed value: "SOCIAL_WORKER" for user ai.specialist.a@sotsiaalai.test'
  );
  error.code = "P2009";
  error.clientVersion = "7.8.0";
  return error;
}

test("an unexpected error gives a fixed key and a correlation id, never its own text", () => {
  const error = prismaLikeError();
  const { body, status, correlationId } = wellbeingErrorBody(error);

  assert.equal(status, 500);
  assert.equal(body.message, WELLBEING_UNEXPECTED_ERROR);
  assert.equal(body.ok, false);
  assert.match(body.correlationId, /^wb_[a-z0-9]+_[a-z0-9]+$/u);
  assert.equal(correlationId, body.correlationId);

  const serialized = JSON.stringify(body);
  for (const leak of ["prisma", "wellbeingRecord", "scopeRoleGroup", "P2009", "sotsiaalai.test", "records.js"]) {
    assert.equal(serialized.includes(leak), false, `vastus lekitab: ${leak}`);
  }
});

test("a real domain error keeps its key, its status and its details", () => {
  const error = new Error("wellbeing.errors.invalid_standardized_fields");
  error.status = 400;
  error.details = { missing: ["workloadLevel"] };

  const { body, status, correlationId } = wellbeingErrorBody(error);
  assert.equal(status, 400);
  assert.equal(correlationId, null);
  assert.deepEqual(body, {
    ok: false,
    message: "wellbeing.errors.invalid_standardized_fields",
    details: { missing: ["workloadLevel"] }
  });
});

/* Kõige tähtsam piir: 4xx staatus ÜKSI ei ole luba. Mõni teek viskab
   `status: 400` koos inimloetava tekstiga ja vana rada oleks selle välja
   andnud. */
test("a foreign error wearing a 4xx status still does not get to speak", () => {
  const error = new Error("Bad Request: column \"ownerUserId\" violates not-null constraint");
  error.status = 400;
  error.details = { table: "WellbeingRecord" };

  const { body, status } = wellbeingErrorBody(error);
  assert.equal(status, 500);
  assert.equal(body.message, WELLBEING_UNEXPECTED_ERROR);
  assert.equal("details" in body, false, "detailid on sama otsuse teine pool");
});

test("the domain-error test accepts keys and refuses prose", () => {
  const domain = (message, status) => Object.assign(new Error(message), { status });

  assert.equal(isWellbeingDomainError(domain("wellbeing.errors.record_missing", 404)), true);
  assert.equal(isWellbeingDomainError(domain("wellbeing.pilot.scope_incomplete", 403)), true);
  assert.equal(isWellbeingDomainError(domain("api.common.unauthorized", 401)), true);

  assert.equal(isWellbeingDomainError(domain("wellbeing.errors.record_missing", 500)), false);
  assert.equal(isWellbeingDomainError(domain("Something broke", 400)), false);
  assert.equal(isWellbeingDomainError(domain("wellbeing errors record", 400)), false);
  assert.equal(isWellbeingDomainError(domain("Prisma.WellbeingRecord.create", 400)), false);
  assert.equal(isWellbeingDomainError(domain("noDotHere", 400)), false);
  assert.equal(isWellbeingDomainError(new Error("wellbeing.errors.record_missing")), false);
});

/* Kriteerium ütleb „KÕIGIS jagatud route-mustrites". Käitumise tõendab ülal
   olev veasüst; siin tõendatakse KATE — et ükski marsruut ei ole värava kõrvalt
   mööda läinud. Ilma selleta kehtiks parandus ainult nendes failides, mida ma
   juhtusin avama. */
function routeFiles(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === "route.js") out.push(full);
  }
  return out;
}

test("no wellbeing route puts a raw error message into its response", () => {
  const files = [
    ...routeFiles(path.join(process.cwd(), "app", "api", "wellbeing")),
    ...routeFiles(path.join(process.cwd(), "app", "api", "admin", "wellbeing"))
  ];
  assert.ok(files.length >= 20, `marsruute leiti ainult ${files.length}`);

  const offenders = files.filter((file) => {
    const source = readFileSync(file, "utf8");
    return /message:\s*error\?\.message|errorJson\(error\?\.message/u.test(source);
  });

  assert.deepEqual(
    offenders.map((file) => path.relative(process.cwd(), file)),
    [],
    "need marsruudid annavad erindi enda teksti kasutajale"
  );
});
