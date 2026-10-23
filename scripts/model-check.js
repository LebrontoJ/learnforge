// Minimal credential/compatibility check; never logs headers, key or raw errors.
import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.MODEL_BASE_URL||'').replace(/\/$/,'');
if(!process.env.API_KEY||!process.env.MODEL||!base)throw Error('缺少 API_KEY、MODEL 或 MODEL_BASE_URL');
const started=Date.now();
const listModels=process.argv.includes('--models');
const response=await fetch(base+(listModels?'/models':'/chat/completions'),{method:listModels?'GET':'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:'Bearer '+process.env.API_KEY,'Content-Type':'application/json'},body:listModels?undefined:JSON.stringify({model:process.env.MODEL,messages:[{role:'user',content:'Return exactly this JSON object: {"ok":true}'}],response_format:{type:'json_object'},max_tokens:64})});
const report={date:new Date().toISOString(),configuredModel:process.env.MODEL,status:response.status,elapsedMs:Date.now()-started,passed:false};
if(response.ok){const data=await response.json();if(listModels){report.models=(data.data||[]).map(m=>m.id).filter(id=>/flash/i.test(id));report.passed=true;}else{report.actualModel=data.model;report.usage=data.usage||null;try{report.passed=JSON.parse(data.choices?.[0]?.message?.content||'').ok===true;}catch{}report.finishReason=data.choices?.[0]?.finish_reason;}}else{report.retryAfter=response.headers.get('retry-after');report.contentType=response.headers.get('content-type');const raw=(await response.text()).replaceAll(process.env.API_KEY,'[redacted]');let data={};try{data=JSON.parse(raw);}catch{}report.providerCode=data.error?.status||data.error?.code||null;report.safeError=String(data.error?.message||raw).slice(0,500);}
mkdirSync('artifacts/preflight',{recursive:true});writeFileSync('artifacts/preflight/model-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
