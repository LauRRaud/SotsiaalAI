#!/usr/bin/env node
// The chat plan's release check (ADR-037). scripts/deploy-server.mjs runs it with the env files from the new release's
// checkout, before the main schema changes. It prints one line, never the plan's contents, and calls no provider.
//   prepare --release <rev> [--out-dir DIR]
//     current          the active plan matches this code: its configuration and the chat's pre-turn checks pass
//     renewed <file>   the plan was stale; its renewal for this code (chat-plan.js) passed the same checks and
//                      was written next to it, not yet active
//     unready <code>   the active plan cannot run for a reason this release did not cause (unreadable, not approved,
//                      or its index generation is no longer active): the release goes on and says so
//     disabled         no chat plan is configured
//     exit 1           the plan runs today, but no plan passes for this code: the release must not go live
//   activate --plan FILE [--rag-env FILE]   points rag.env at the renewed plan, keeping a copy of rag.env
//   ready                                  the configured plan can execute a turn on this code
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readPilotConfig } from '../lib/rag-v2/pilot/config.js';
import { activateChatPlan, approvedChatPlan, codeContract, preflightChatPlan, renewChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';

// Pre-turn failures meaning the active index moved away from the plan: then it could not run before this release either.
const INDEX_STATE = new Set(['active_index_mismatch', 'active_source_version_mismatch', 'no_active_search_generation']);
const code = error => typeof error?.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'plan_release_failed';
// The one result line is the only stdout; anything the checks log (the pre-turn warm-up) goes to stderr.
const result = process.stdout.write.bind(process.stdout);
for (const level of ['log', 'info', 'debug']) console[level] = (...args) => console.error(...args);
const done = line => { result(`${line}
`); process.exit(0); };
const failWith = name => { throw Object.assign(new Error(name), { code: name }); };
const readPlan = async file => JSON.parse(await fs.readFile(file, 'utf8'));
// The configuration check the chat runs for a turn (model, key, versions, implementation hash) on `file`.
async function executable(file, plan) {
  process.env.M4_PILOT_CONFIG = file;
  await readPilotConfig(plan.users[0], { purpose: 'execute' });
}

const [mode, ...rest] = process.argv.slice(2);
try {
  const { values } = parseArgs({ args: rest, options: { release: { type: 'string' }, 'out-dir': { type: 'string', default: '/etc/sotsiaalai' },
    plan: { type: 'string' }, 'rag-env': { type: 'string', default: '/etc/sotsiaalai/rag.env' } } });
  if (mode === 'prepare') {
    if (process.env.M4_PILOT_ENABLED !== '1' || !process.env.M4_PILOT_CONFIG) done('disabled');
    const activeFile = process.env.M4_PILOT_CONFIG;
    let plan; try { plan = await readPlan(activeFile); } catch { done('unready invalid_plan'); }
    if (!approvedChatPlan(plan)) done('unready unapproved_plan');
    const current = plan.implementationHash === (await codeContract()).implementationHash;
    const candidate = current ? plan : await renewChatPlan(plan, { release: values.release });
    try { await preflightChatPlan(candidate); }
    catch (error) { if (INDEX_STATE.has(code(error))) done(`unready ${code(error)}`); throw error; }
    // Same code as the running release: a configuration failure here is not caused by this release.
    if (current) { try { await executable(activeFile, plan); } catch (error) { done(`unready ${code(error)}`); } done('current'); }
    const file = path.join(values['out-dir'], `${candidate.id}.json`);
    await fs.writeFile(file, JSON.stringify(candidate, null, 2), { flag: 'wx', mode: 0o640 });
    await executable(file, candidate);
    done(`renewed ${file}`);
  } else if (mode === 'activate') {
    if (!values.plan) failWith('plan_release_usage');
    const plan = await readPlan(values.plan);
    if (!approvedChatPlan(plan)) failWith('unapproved_plan');
    done(await activateChatPlan({ ragEnv: values['rag-env'], file: values.plan, plan }));
  } else if (mode === 'ready') {
    if (process.env.M4_PILOT_ENABLED !== '1' || !process.env.M4_PILOT_CONFIG) failWith('pilot_disabled');
    const plan = await readPlan(process.env.M4_PILOT_CONFIG);
    await executable(process.env.M4_PILOT_CONFIG, plan);
    await preflightChatPlan(plan);
    done('ready');
  } else failWith('plan_release_usage');
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: code(error) }));
  process.exit(1);
}
