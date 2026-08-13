import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PRIVACY_VERSION } from "../../lib/legalDocuments.js";
import { RETENTION_MONTHS, WARNING_DAYS } from "../../lib/casework/retention.js";

const ROOT = new URL("../../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

async function messages(locale) {
  return JSON.parse(await read(`messages/${locale}.json`));
}

test("confirmed casework retention policy is identical in code and all user notices", async () => {
  assert.equal(RETENTION_MONTHS, 12);
  assert.equal(WARNING_DAYS, 30);

  const catalogues = await Promise.all(["et", "en", "ru"].map(messages));
  const retentionTerms = [
    { months: /12 kalendrikuu(?:d)?/u, warning: /30 päeva/u, transfer: /üleandmi/u },
    { months: /12(?:-| )calendar(?:-| )month(?:s)?/u, warning: /30 days/u, transfer: /transfer/u },
    { months: /12 календарных месяцев/u, warning: /30 дней/u, transfer: /передач/u }
  ];

  for (const [index, catalogue] of catalogues.entries()) {
    const { months, warning, transfer } = retentionTerms[index];
    assert.match(catalogue.casework.draft.purge_due_at, months);
    assert.match(catalogue.casework.draft.purge_due_at, transfer);
    assert.match(catalogue.casework.page.archive_clock_warning, months);

    const privacy = catalogue.privacy.section7.body;
    assert.match(privacy, /CaseWork/u);
    assert.match(privacy, months);
    assert.match(privacy, warning);
    assert.match(privacy, transfer);
  }
});

test("organisation contract allows only a shorter casework retention period", async () => {
  const [contract, implementationContract] = await Promise.all([
    read("docs/internal/raamlepingV1.md"),
    read("docs/platvormi arendus/jta-v1-arendusleping.md")
  ]);

  assert.match(contract, /CaseWorkAssist/u);
  assert.match(contract, /12 kalendrikuud pärast arhiveerimist/u);
  assert.match(contract, /30 päeva enne kustutamist/u);
  assert.match(contract, /üleantud mustandi sisu[^\n]+12 kalendrikuud pärast üleandmist/u);
  assert.match(contract, /ainult lühema säilitustähtaja/u);
  assert.doesNotMatch(contract, /CaseWorkAssist[^\n]+pikema säilitustähtaja/u);
  assert.match(implementationContract, /`OWNER_DECISION` \(13\.08\)/u);
  assert.doesNotMatch(implementationContract, /kinnitada õigusabiga enne aktiveerimist/u);
});

test("substantive casework privacy notice has a distinct acceptance version", () => {
  assert.notEqual(PRIVACY_VERSION, "2026-08-13");
});

test("managed timer remains hourly, persistent, locked and release-controlled", async () => {
  const [timer, service, runbook] = await Promise.all([
    read("deploy/systemd/sotsiaalai-casework-retention.timer"),
    read("deploy/systemd/sotsiaalai-casework-retention.service"),
    read("deploy/systemd/README.md")
  ]);

  assert.match(timer, /^OnCalendar=hourly$/mu);
  assert.match(timer, /^Persistent=true$/mu);
  assert.match(service, /flock\s+-n/u);
  assert.match(service, /^TimeoutStartSec=900$/mu);
  assert.match(runbook, /kuivjooks/u);
  assert.match(runbook, /systemctl enable --now sotsiaalai-casework-retention\.timer/u);
  assert.match(runbook, /casework:retention:smoke/u);
});
