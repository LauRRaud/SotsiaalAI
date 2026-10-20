import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(dir,'../sotsiaal-pro-toenduskatsete-kataloog-2026-10-14.json')));
const files=['server-baseline.json','server-company-and-lifecycle.json','server-rag-controls.json','server-org-boundaries.json','server-http-flow.json','server-http-questionnaires.json','server-browser.json','server-http-lifecycle.json','server-intake-setup.json','server-intake-flow.json','server-intake-resume.json','server-safety-mail.json','server-external-mail.json','server-browser-external.json','server-journey-lifecycle.json','server-wellbeing-privacy.json'];
files.push('server-homecare-flow.json','server-homecare-browser.json');
files.push('server-service-report.json','server-service-browser.json','server-rag-outbound.json','server-manual-star.json');
files.push('server-covision-flow.json','server-supervision-flow.json','server-mentoring-flow.json','server-pilot-crisis.json','server-provider-inquiry.json');
files.push('server-browser-compose.json','server-browser-admin-view.json','server-jobs-and-deadline.json','local-run-manifest-20261020.json','local-rag-dialogue-places.json','local-rag-source-injection.json','local-data04-deletion.json','server-browser-role-walkthrough.json');
const variants=[];
for(const file of files){const p=path.join(dir,file);if(fs.existsSync(p)){const data=JSON.parse(fs.readFileSync(p));for(const v of data.checks||[])variants.push({...v,evidence_file:file,serverRelease:data.serverRelease});}}
const result={run_id:'sol-proof-20261014-01',updated_at:new Date().toISOString(),phase:'stopped at owner quota request; evidence checkpoint saved',catalog_cases:catalog.cases.length,whole_catalog_completed:false,observed_variants:variants.length,passed_variants:variants.filter(v=>v.status==='PASS').length,failed_variants:variants.filter(v=>v.status==='FAIL').length,blocked_variants:variants.filter(v=>v.status==='BLOCKED').length,server_fixture_variants:variants.filter(v=>v.evidence_mode==='CURRENT_FIXTURE').length,case_progress:catalog.cases.map(c=>{const vv=variants.filter(v=>v.case_id===c.id);return {case_id:c.id,status:vv.some(v=>v.status==='FAIL')?'FAIL':'NOT_RUN',whole_case_complete:false,observed_variants:vv.length,passed_variants:vv.filter(v=>v.status==='PASS').length,failed_variants:vv.filter(v=>v.status==='FAIL').length,blocked_variants:vv.filter(v=>v.status==='BLOCKED').length,remaining_scope:'See catalog and report: runtime variants do not replace complete UI paths, human assessments or external confirmations.'};}),variants};
fs.writeFileSync(path.join(dir,'case-progress.json'),JSON.stringify(result,null,2)+'\n');
const reportPath=path.join(dir,'../../sotsiaal-pro-toenduskatsete-tulemused-sol-proof-20261014-01.md');
if(fs.existsSync(reportPath)){
 const line=`**Jooksev koond:** ${result.observed_variants} salvestatud kontrollvarianti: ${result.passed_variants} PASS, ${result.failed_variants} FAIL, ${result.blocked_variants} katserakise takistuse vaatlust. Terve 52 juhtumi kavand pole lõpetatud.`;
 let report=fs.readFileSync(reportPath,'utf8');
 report=/^\*\*Jooksev koond:\*\*.*$/m.test(report)?report.replace(/^\*\*Jooksev koond:\*\*.*$/m,line):report.replace('\n\nKäivituskavand:','\n\n'+line+'\n\nKäivituskavand:');
 fs.writeFileSync(reportPath,report);
}
console.log(JSON.stringify({observed:result.observed_variants,pass:result.passed_variants,fail:result.failed_variants,blocked:result.blocked_variants}));
