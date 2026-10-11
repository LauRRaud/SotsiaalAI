// ADR-134 (10.10.2026), the free first step: how many of the chat's municipal contacts have left the answers because
// their register row is no longer the row the export read (ADR-085: the contacts are a snapshot, and a contact whose
// row changed stays out until the next export by hand). Counts only, so that the size of the fault is known before
// anything is redesigned. The rules are in lib/rag-v2/adapters/contact-drift.js.
//
// Read-only: it reads the contact documents of the active index generation and their register rows, asks the chat's
// own gate about each (municipalDirectoryAdapter.authorizeContact) and prints one JSON object. It writes no file and
// no database row, keeps no verified-read marks, calls no model and no embedding service, and prints no name, phone,
// e-mail, page address, row id or other free text: numbers, the first eight characters of the generation, the time of
// the reading and the ids of municipalities the register itself holds (a region of the index that is not one of them
// is counted under 'other', never printed).
//
// One output path lies outside this script. Prisma's database adapter (@prisma/adapter-pg) hands every query with its
// arguments (row ids, municipality slugs, source ids; no name and no phone) to Prisma's debug channel, and that prints
// them on stderr when the environment sets DEBUG to a name that covers it (prisma:*, *). The script clears DEBUG for
// its own process before it loads the client, so a DEBUG in the env file or the shell does not reach this run. Do not
// get around that to look into a failed run: the failure's code is all the run may say. The export script
// (rag-v2-contact-export.mjs) has no such guard.
//
// Run on the server, in the running release's directory, with that release's env file and the node source loader every
// server script of this repository is run with (the NODE line of scripts/rag-v2-corpus-run.sh):
//   A=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend)
//   ENVF=$(systemctl show -p EnvironmentFiles --value sotsiaalai-frontend | cut -d' ' -f1)
//   cd $A && sudo -n node --env-file=$ENVF --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-contact-drift.mjs --database-url-env DATABASE_URL
// The run needs both connections: RAG_V2_POSTGRES_URL (the index) and the application database under the name given
// with --database-url-env (the default name is the export script's own, RAG_CONTACT_EXPORT_DATABASE_URL). What the
// repository shows about the release env file: scripts/deploy-release-host.mjs writes it from
// /etc/sotsiaalai/frontend.env and /etc/sotsiaalai/rag.env and makes it the unit's only EnvironmentFile; the running
// app reads its register from DATABASE_URL (lib/prisma.js), the chat opens its index with RAG_V2_POSTGRES_URL
// (lib/rag-v2/pilot/retrieval.js), and the chat's gate is handed that same register client
// (lib/chat/m4PilotServer.js). So a release whose chat answers has both in that file, and --database-url-env
// DATABASE_URL reads the very register the gate reads. What the repository cannot show is a systemd drop-in that sets
// one of them outside the env file: the service would have it and this command would not, and the run refuses with
// contact_drift_index_required or contact_drift_database_required.
//   --next-export  also what an export made now would hold: the counts of today's prepareRegisterContactExport with the
//                  bound list read from the index (the export script reads it from the store's version folders, which
//                  are packed away on the server). It reads every verified row twice more; not timed on the server.
//   --tenant       the index tenant (default sotsiaalai-corpus)
//
// Reading the result. contacts_in_index = shown_as_exported + drifted + not_bound.contacts, and drifted =
// row_changed.contacts + row_gone_or_not_verified.contacts; the classes under each are explained where they are
// declared (DRIFT_CLASSES). shown_today is what the gate releases now. municipalities.drifted gives, for each
// municipality that has any, only the number of its drifted contacts. One run is one moment: an edited row waits in
// not_verified_now until the weekly check (Sunday 02:23 UTC) confirms it and then moves to its class under
// row_changed, so a run before that check and one after it show a week's drift. A contact with ADR-017's binding is
// never in that drift: once the gate no longer releases it, it is binding_version_1 whatever became of its row.
// rows_with_two_documents and rows_with_two_shown_documents count a register row with more than one contact document
// (shown twice: the same person twice in an answer). A document is its row's by a valid binding or, for a package
// contact without one, by its source id; not_bound.no_binding_row_unknown is how many unbound documents the two counts
// could not place, and a document with an invalid binding is placed with no row.
//
// It refuses, with { ok: false, code } on stderr and exit 1, whenever it cannot tell: no connection name or value; the
// generated register client not in the directory (contact_drift_generated_client_missing: not a release's directory,
// or prisma generate has not run); an index address that is not the server's local one (local_postgres_required); no
// active generation; an index whose directory does not name record kinds (contact_index_directory_unsupported); no
// contact check record of the current version in the register (contact_drift_check_record_missing: another database
// behind the name, or the check's version changed and it has not run since; counted, every contact would read as
// waiting for the weekly check); a check record that confirms no row now (contact_drift_check_confirms_none: the chat
// shows no contact at all, which is no drift); a register that holds none of the bound rows
// (contact_drift_register_mismatch: another database behind the name); a contact whose class and the gate's decision
// disagree (contact_drift_decision_mismatch: the register was written during the run, so run it again; if it repeats,
// the gate's rule has changed and this count has not).
// A failure of a driver or of the runtime prints one word of a closed list and, as "reading", which of the two it was
// on ("index": RAG_V2_POSTGRES_URL; "register": the connection named by --database-url-env), never the error's own
// code or text: contact_drift_module_missing (node_modules), contact_drift_connection_refused,
// contact_drift_host_unknown, contact_drift_connection_timeout, contact_drift_connection_closed,
// contact_drift_login_refused, contact_drift_database_missing, contact_drift_tls_refused,
// contact_drift_permission_refused, contact_drift_schema_mismatch (a table or column the client asks for is not
// there), contact_drift_statement_timeout, contact_drift_pool_timeout, contact_drift_out_of_resources,
// contact_drift_query_invalid; anything else contact_drift_failed.
import { access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fail } from '../lib/rag-v2/contracts.js';
import { contactDriftCount, driftFailure, silenceDriverDebug } from '../lib/rag-v2/adapters/contact-drift.js';

let db, postgres, reading = null;
try {
  let values;
  // An option the script does not have is a refusal with its own code, not a failed run.
  try { ({ values } = parseArgs({ options: { tenant: { type: 'string', default: 'sotsiaalai-corpus' }, 'database-url-env': { type: 'string', default: 'RAG_CONTACT_EXPORT_DATABASE_URL' },
    'next-export': { type: 'boolean', default: false }, help: { type: 'boolean' } } })); } catch { fail('invalid_contact_drift_cli'); }
  if (values.help) {
    console.log('node --env-file=<release env> --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-contact-drift.mjs --database-url-env DATABASE_URL [--next-export] [--tenant sotsiaalai-corpus]');
    console.log('Requires RAG_V2_POSTGRES_URL (the index) and the application database under the named variable (default RAG_CONTACT_EXPORT_DATABASE_URL).');
    console.log('Reads the indexed contact documents and their register rows; prints counts only. No write, no model call.');
  } else {
    if (!/^[A-Z][A-Z0-9_]*$/.test(values['database-url-env'])) fail('invalid_contact_drift_cli');
    const connectionString = process.env[values['database-url-env']];
    if (!connectionString) fail('contact_drift_database_required');
    if (!process.env.RAG_V2_POSTGRES_URL) fail('contact_drift_index_required');
    // Node's own debug channel is read when the process starts and cannot be cleared from here: with NODE_DEBUG=stream it
    // prints the first bytes of every chunk a stream carries, a database row among them. So the run refuses (verification
    // of 10.10.2026).
    if (process.env.NODE_DEBUG) fail('contact_drift_node_debug_set');
    // The generated register client is not in the repository (git-ignored; the release archive holds it). Its absence
    // gets its own code, apart from every other module Node cannot find (review of 10.10.2026).
    await access(new URL('../generated/prisma/client.ts', import.meta.url)).catch(() => fail('contact_drift_generated_client_missing'));
    // Before the register client is loaded: its adapter's debug channel reads DEBUG once, at load, and would print each
    // query's row ids on stderr (review of 10.10.2026; see the header).
    silenceDriverDebug();
    // Loaded only now: a refusal above needs neither a database client nor the generated register client.
    const [{ PostgresCatalog }, { PrismaClient }, { PrismaPg }] = await Promise.all([import('../lib/rag-v2/search/postgres.js'), import('../generated/prisma/client.ts'), import('@prisma/adapter-pg')]);
    postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
    // An idle connection's error is an event, not a rejection: it is reported like every other failure, by its code.
    postgres.pool.on('error', error => { console.error(JSON.stringify(driftFailure(error, 'index'))); process.exitCode = 1; });
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [] });
    console.log(JSON.stringify({ ...await contactDriftCount({ catalog: postgres, db, tenant: values.tenant, nextExport: values['next-export'], reading: side => { reading = side; } }),
      registry_writes: 0, model_calls: 0 }));
  }
} catch (error) {
  console.error(JSON.stringify(driftFailure(error, reading)));
  process.exitCode = 1;
} finally { await db?.$disconnect().catch(() => 0); await postgres?.close().catch(() => 0); }
