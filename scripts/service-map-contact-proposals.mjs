// The proposal layer of the contact register (ADR-073). Reading writes nothing and prints counts and page addresses
// only; names go to the --out file, which must stay outside the repository.
//
//   node scripts/service-map-contact-proposals.mjs [--pages <file>] [--out <file>] [--record]
//       reads the official pages and says what the register would have to change
//   node scripts/service-map-contact-proposals.mjs --apply <reviewed --out file> --approved-by <who> [--also 15,37] [--except 12,45] [--hold 7,8] [--pages <file>] [--yes]
//       reads again and applies the reviewed proposals the pages still give; without --yes it only says what it would do.
//       Proposals without an owner-only flag are approved unless named in --except; flagged ones only when named in
//       --also; --hold leaves a proposal for later. Whatever else the list holds is recorded as turned down.
//   node scripts/service-map-contact-proposals.mjs --revert <batch id> [--keys <key,key>] [--yes]
//       takes a batch back: old values return, added rows are hidden
//
// --pages: { "<register page address>": ["<its successor>"] } for pages the front-page search does not find.
import fs from "node:fs/promises";
import {
  applyContactProposals,
  readContactProposals,
  recordContactProposalRead,
  revertContactProposals
} from "../lib/admin/rag/contactRegistry/proposalService.js";
import { reviewedDecision } from "../lib/admin/rag/contactRegistry/proposals.js";
import { prisma } from "../lib/prisma.js";

const LOG = "[service-map:contacts:proposals]";

function valueAfterFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const hasFlag = name => process.argv.includes(name);
const listAfterFlag = name => valueAfterFlag(name).split(",").map(item => item.trim()).filter(Boolean);

async function read() {
  const pagesFile = valueAfterFlag("--pages");
  const candidatePages = pagesFile ? JSON.parse(await fs.readFile(pagesFile, "utf8")) : {};
  const result = await readContactProposals({ prisma, candidatePages });
  console.info(`${LOG} ${JSON.stringify(result.counts)}`);
  for (const page of result.pages.filter(item => item.state !== "read")) {
    console.info(`${LOG} ${page.state}: ${page.url} (${page.rows} rows)${page.state === "moved" ? ` -> ${page.movedTo.join(" + ")}, names ${page.found} of ${page.rows}; new people ${page.newPeople}` : `, ${page.status || page.error}`}`);
  }
  // A page that answers and names none of its rows may have moved to an address the front page does not link to.
  for (const page of result.pages.filter(item => item.state === "read" && item.rows >= 2 && item.tally.not_on_page === item.rows)) {
    console.info(`${LOG} names none of its rows: ${page.url} (${page.rows} rows)`);
  }
  const flags = {};
  for (const proposal of result.proposals) for (const flag of proposal.flags) flags[flag] = (flags[flag] || 0) + 1;
  console.info(`${LOG} flags: ${JSON.stringify(flags)}`);
  return result;
}

async function main() {
  const revertBatch = valueAfterFlag("--revert");
  if (revertBatch) {
    if (!hasFlag("--yes")) { console.info(`${LOG} would take back batch ${revertBatch}; add --yes to do it`); return; }
    const keys = listAfterFlag("--keys");
    const result = await revertContactProposals({ prisma, batchId: revertBatch, keys: keys.length ? keys : null });
    console.info(`${LOG} batch ${result.batchId}: restored ${result.restored}, hidden ${result.hidden}, skipped ${result.skipped.length}`);
    return;
  }

  const result = await read();
  const outFile = valueAfterFlag("--out");
  if (outFile) {
    const numbered = result.proposals.map((proposal, index) => ({ no: index + 1, ...proposal }));
    await fs.writeFile(outFile, JSON.stringify({ readAt: result.readAt, counts: result.counts, pages: result.pages, proposals: numbered }, null, 1), { flag: "wx" });
    console.info(`${LOG} wrote ${numbered.length} proposals to ${outFile}`);
  }

  const reviewedFile = valueAfterFlag("--apply");
  if (!reviewedFile) {
    if (hasFlag("--record")) {
      const state = await recordContactProposalRead({ prisma, proposals: result.proposals, readAt: result.readAt, counts: result.counts });
      console.info(`${LOG} read recorded: ${Object.keys(state.reads).length} proposals, ${Object.values(state.reads).filter(item => item.count >= 2).length} given by two reads`);
    }
    return;
  }

  const approvedBy = valueAfterFlag("--approved-by");
  if (!approvedBy) throw new Error("--apply needs --approved-by");
  const reviewed = JSON.parse(await fs.readFile(reviewedFile, "utf8")).proposals;
  const decision = reviewedDecision(reviewed, { also: listAfterFlag("--also"), except: listAfterFlag("--except"), hold: listAfterFlag("--hold") });
  const approved = new Set(decision.approve);
  const rejected = Object.fromEntries(decision.reject.map(signature => [signature, { at: result.readAt, reason: "owner", by: approvedBy }]));
  // Only what the reviewed list and today's pages both give: a page or a row that changed since the review waits.
  const proposals = result.proposals.filter(proposal => approved.has(proposal.signature));
  const kinds = { rows: proposals.filter(proposal => proposal.kind === "row").length, people: proposals.filter(proposal => proposal.kind === "person").length };
  console.info(`${LOG} reviewed ${reviewed.length}: approved ${decision.approve.length}, held ${decision.hold.length}, turned down ${decision.reject.length}; still given by the pages ${proposals.length} (${kinds.rows} rows, ${kinds.people} new people)`);
  if (!hasFlag("--yes")) { console.info(`${LOG} nothing written; add --yes to apply`); return; }
  const applied = await applyContactProposals({ prisma, proposals, basis: "owner_approval", approvedBy });
  console.info(`${LOG} batch ${applied.batchId}: updated ${applied.updated}, created ${applied.created}, skipped ${applied.skipped.length}`);
  for (const item of applied.skipped) console.info(`${LOG} skipped ${item.key}: ${item.reason}`);
  if (decision.reject.length) {
    const left = result.proposals.filter(proposal => !approved.has(proposal.signature));
    await recordContactProposalRead({ prisma, proposals: left, readAt: result.readAt, rejected });
    console.info(`${LOG} recorded ${decision.reject.length} proposals as turned down`);
  }
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  console.error(`${LOG} failed`, error);
  exitCode = 1;
} finally {
  await prisma.$disconnect();
}
process.exit(exitCode);
