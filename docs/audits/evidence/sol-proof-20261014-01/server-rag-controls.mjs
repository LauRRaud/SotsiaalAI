import fs from 'node:fs';import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const validity=await import(pathToFileURL(root+'/lib/rag-v2/search/legal-validity.js'));
const contracts=await import(pathToFileURL(root+'/lib/rag-v2/pilot/contracts.js'));
const provisions=await import(pathToFileURL(root+'/lib/rag-v2/pilot/provision-check.js'));
const record={runId:'sol-proof-20261014-01',serverRelease:root.split('/').at(-1),startedAt:new Date().toISOString(),checks:[],newPaidCalls:false,limits:['Deterministic synthetic fixtures against current server modules; no model answer or corpus retrieval is claimed.']};
const check=(id,variant,ok,actual)=>record.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:'CURRENT_FIXTURE',entrypoint:'server component function',actual});
const date='2026-10-14';
const fixtures=[
 ['current',{from:'2026-01-01',to:null,open_end:true},'in_force'],
 ['future',{from:'2026-11-01',to:null,open_end:true},'not_yet_in_force'],
 ['expired',{from:'2025-01-01',to:'2025-12-31',open_end:false},'expired'],
 ['unknown',{from:'2026-01-01',to:null,open_end:false},'unknown_validity']
];
for(const[id,data,expected]of fixtures){const actual=validity.validityState(data,date);check('RAG-04',id,actual===expected,{expected,actual,syntheticDates:true});}
const answer=(refs,text='Sünteetiline allikaga seotud fakt.')=>({kind:'grounded',blocks:[{text,factual:true,refs}],limitations:[],clarification:null});
for(const[id,value,shouldAccept]of [['allowed_ref',answer(['S1']),true],['missing_ref',answer([]),false],['unknown_ref',answer(['S9']),false]]){
 let accepted=false,error=null;try{contracts.validateAnswer(value,['S1']);accepted=true;}catch(e){error={code:e.code,status:e.status};}
 check('RAG-09',id,accepted===shouldAccept,{accepted,error,expectedAcceptance:shouldAccept});
}
for(const[id,value]of [['unsupported',{kind:'unsupported',blocks:[],limitations:['Sünteetilises paketis vajalik info puudub.'],clarification:null}],['clarification',{kind:'clarification',blocks:[],limitations:[],clarification:'Millise omavalitsuse kohta küsid?'}]]){
 let accepted=false,error=null;try{contracts.validateAnswer(value,['S1']);accepted=true;}catch(e){error={code:e.code,status:e.status};}
 check('RAG-08',id,accepted,{accepted,error});
}
let acceptedWrongClaim=false;
try{contracts.validateAnswer(answer(['S1'],'Sünteetiline valeväide: toetuse summa on 999999 eurot.'),['S1']);acceptedWrongClaim=true;}catch{}
record.observations=[{case_id:'RAG-09',variant_id:'semantic_support_boundary',syntheticFalseClaimAcceptedByStructuralValidator:acceptedWrongClaim,meaning:'Reference existence validation alone does not check entailment. This is not a sampled model answer.'},{case_id:'RAG-09',variant_id:'provision_gate_policy',refusedKinds:[...provisions.REFUSED_KINDS],meaning:'The provision check is audit-only in the observed configuration.'}];
record.finishedAt=new Date().toISOString();fs.writeFileSync('server-rag-controls.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
