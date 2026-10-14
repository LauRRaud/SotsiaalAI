import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(dir,'../sotsiaal-pro-toenduskatsete-kataloog-2026-10-14.json')));
const files=['server-baseline.json','server-company-and-lifecycle.json','server-rag-controls.json','server-org-boundaries.json','server-http-flow.json','server-http-questionnaires.json','server-browser.json','server-http-lifecycle.json'];
const variants=[];
for(const file of files){const p=path.join(dir,file);if(fs.existsSync(p)){const data=JSON.parse(fs.readFileSync(p));for(const v of data.checks||[])variants.push({...v,evidence_file:file,serverRelease:data.serverRelease});}}
const result={run_id:'sol-proof-20261014-01',updated_at:new Date().toISOString(),phase:'server HTTPS and browser controls in progress; owner-authorized three-account exception',catalog_cases:catalog.cases.length,whole_catalog_completed:false,observed_variants:variants.length,passed_variants:variants.filter(v=>v.status==='PASS').length,failed_variants:variants.filter(v=>v.status==='FAIL').length,blocked_variants:variants.filter(v=>v.status==='BLOCKED').length,server_fixture_variants:variants.filter(v=>v.evidence_mode==='CURRENT_FIXTURE').length,case_progress:catalog.cases.map(c=>{const vv=variants.filter(v=>v.case_id===c.id);return {case_id:c.id,status:vv.some(v=>v.status==='FAIL')?'FAIL':'NOT_RUN',whole_case_complete:false,observed_variants:vv.length,passed_variants:vv.filter(v=>v.status==='PASS').length,failed_variants:vv.filter(v=>v.status==='FAIL').length,blocked_variants:vv.filter(v=>v.status==='BLOCKED').length,remaining_scope:'See catalog and report: runtime variants do not replace complete UI paths, human assessments or external confirmations.'};}),variants};
fs.writeFileSync(path.join(dir,'case-progress.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({observed:result.observed_variants,pass:result.passed_variants,fail:result.failed_variants,blocked:result.blocked_variants}));
