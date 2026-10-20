import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// The topic seed privacy preflight (lib/topicSeeds.js assessTopicSeedPrivacy) with ordinary professional sentences
// that name an institution or start with two capitalised words, next to real direct identifiers. No database.
const root = process.argv[2];
const {assessTopicSeedPrivacy} = await import(pathToFileURL(root + '/lib/topicSeeds.js'));
const cases = [
  ['institution_tootukassa', 'Koostöö Eesti Töötukassaga digiabi juhtumis', 'Ebaselge, kes võrgustikus vastutab.', 'none'],
  ['institution_city_government', 'Tartu Linnavalitsus ja koduteenuse piirid', 'Rollid on ebaselged.', 'none'],
  ['institution_hospital', 'Pärnu Haigla väljakirjutamise järel', 'Kodune tugi puudub.', 'none'],
  ['phrase_kliendi_olukord', 'koostöö piirid', 'kliendi olukord ja võrgustiku rollid on ebaselged.', 'none'],
  ['phrase_juhtumi_kirjeldus', 'juhtumi kirjeldus jääb privaatseks', 'üldistatud teema.', 'none'],
  ['real_case_number', 'koostöö', 'juhtumi nr 2026-0457 järgi', 'CASE_NUMBER'],
  ['lowercase_control', 'koostöö piirid digiabi juhtumis', 'rollid on ebaselged.', 'none'],
  ['ui_seed_text_after_edit', 'koostöö piirid digiabi juhtumis (sünteetiline katse)', 'sünteetiline katse: üldistatud olukord, kus kliendi digiabi vajadus ja võrgustiku rollid on ebaselged.', 'none'],
  ['real_name', 'Mari Maasikas ja koostöö', 'Rollid on ebaselged.', 'PERSON_NAME'],
  ['email', 'koostöö', 'kirjuta mari@example.invalid', 'EMAIL'],
  ['personal_code', 'koostöö', 'isikukood 39001010000 on lisatud', 'PERSONAL_CODE']
];
const checks = cases.map(([id, title, whyNow, expect]) => {
  const r = assessTopicSeedPrivacy({title, whyNow});
  const ok = expect === 'none' ? r.direct.length === 0 : r.direct.includes(expect);
  return {case_id: 'DATA-02', variant_id: 'topic_seed_privacy_' + id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_FIXTURE',
    entrypoint: 'assessTopicSeedPrivacy of lib/topicSeeds.js', actual: {direct: r.direct, indirect: r.indirect, expected: expect === 'none' ? 'no direct identifier' : expect}};
});
const rec = {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20', environment: 'local Node run of the current code; synthetic sentences only',
  checks, rules: ['PERSON_NAME = any two consecutive capitalised words of three or more letters (lib/topicSeeds.js:175)', 'CASE_NUMBER = juhtumi/toimiku/menetluse/kliendi followed by any token of five or more letters or digits, case-insensitive (lib/topicSeeds.js:172)'], newPaidCalls: false};
fs.writeFileSync('local-topicseed-privacy.json', JSON.stringify(rec, null, 2) + '\n');
console.log(JSON.stringify(checks.map(c => c.variant_id.replace('topic_seed_privacy_', '') + ':' + c.status + ':' + c.actual.direct.join('+'))));
