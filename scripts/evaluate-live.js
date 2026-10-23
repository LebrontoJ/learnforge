// Real model evaluation. Snapshots and initial artifacts survive quota pauses.
import {readFileSync,mkdirSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
if(!process.env.API_KEY||!process.env.MODEL)throw Error('请在 .env 配置 API_KEY 和 MODEL；不会降级成夹具生成。');
process.env.PROVIDER='openai';
const e2e=process.argv.includes('--e2e'),mode=e2e?'e2e':'model';
if(e2e&&!process.env.SEARCH_API_KEY)throw Error('真实搜索评测需要 SEARCH_API_KEY；当前命令不会假装已完成真实搜索。');
const dir=path.resolve(`artifacts/${mode}-evaluation`),checkpoint=path.join(dir,'checkpoint.json');
mkdirSync(dir,{recursive:true});
process.env.DATA_DIR=path.join(dir,'data');process.env.PREVIEW_PORT=process.env.EVAL_PREVIEW_PORT||'3344';
const {put,saveCode,get}=await import('../server/store.js');
const {collectSources}=await import('../server/sources.js');
const {generateSpec,generateArtifact,generateOutline,modelName,contract}=await import('../server/model.js');
const {fixtureOutline}=await import('../server/fixtures.js');
const {createPreview}=await import('../server/preview.js');
const {validate}=await import('../server/validate.js');
const allCases=JSON.parse(readFileSync('eval/cases.json','utf8')).filter(c=>!c.persistent);
const limitIndex=process.argv.indexOf('--limit');
const limit=limitIndex<0?allCases.length:Number(process.argv[limitIndex+1]);
if(!Number.isInteger(limit)||limit<1||limit>allCases.length)throw Error('--limit 超出案例范围');
const cases=allCases.slice(0,limit);
const fingerprint=createHash('sha256').update(JSON.stringify({mode,cases,model:modelName,base:process.env.MODEL_BASE_URL,contract,oracle:readFileSync('eval/reference.js','utf8')})).digest('hex');
const resume=process.argv.includes('--resume')&&existsSync(checkpoint);
const previous=resume?JSON.parse(readFileSync(checkpoint,'utf8')):null;
if(previous&&previous.fingerprint!==fingerprint)throw Error('模型、案例或检查版本已变化；不能混入旧批次，请去掉 --resume 新建批次。');
if(!resume&&existsSync(checkpoint)){
  const old=JSON.parse(readFileSync(checkpoint,'utf8'));
  writeFileSync(path.join(dir,`checkpoint-${old.runId||Date.now()}.json`),JSON.stringify(old,null,2));
}
const run=previous||{runId:crypto.randomUUID(),createdAt:new Date().toISOString(),mode,model:modelName,fingerprint,planned:cases.length,results:[]};
function persist(){run.updatedAt=new Date().toISOString();writeFileSync(checkpoint+'.tmp',JSON.stringify(run,null,2));renameSync(checkpoint+'.tmp',checkpoint);}
const server=createPreview().listen(Number(process.env.PREVIEW_PORT),'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
let interrupted=false,currentController;
const interrupt=()=>{interrupted=true;currentController?.abort();};
process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
const topics={binary:'二分查找',lru:'精确 LRU 缓存淘汰',rate:'等间隔 Counter 重置感知平均增量（不包含 Prometheus 外推）',event:'浏览器同步代码、微任务与定时器',plain:'HTTP 缓存的核心概念'};
try{
  run.status='running';delete run.pauseReason;persist();
  for(const c of cases){
    let result=run.results.find(r=>r.caseId===c.id);
    if(result&&['completed','failed'].includes(result.status))continue;
    if(interrupted)break;
    if(!result){result={caseId:c.id,family:c.family,versions:[],model:modelName,mode,calls:0,tokens:0,schemaErrors:[],httpEvents:[],activeMs:0,status:'queued'};run.results.push(result);}
    const controller=new AbortController();currentController=controller;const started=Date.now();
    const timer=setTimeout(()=>controller.abort(),Number(process.env.JOB_TIMEOUT_MS||300000));
    const job={id:result.jobId||crypto.randomUUID(),calls:result.calls,tokens:result.tokens,schemaErrors:result.schemaErrors,httpEvents:result.httpEvents,
      maxCalls:Number(process.env.MAX_MODEL_CALLS||8),maxTokens:Number(process.env.MAX_TOKENS||60000),signal:controller.signal,
      record(){result.calls=this.calls;result.tokens=this.tokens;result.actualModel=this.actualModel;result.schemaErrors=this.schemaErrors;result.httpEvents=this.httpEvents;persist();const {signal,record,...r}=this;return r;}
    };
    result.jobId=job.id;result.status='running';delete result.error;persist();
    try{
      let space=result.spaceId?get(result.spaceId,'space'):null;
      if(!space){space=put('space',{topic:c.unsupported?'Kubernetes 真实集群执行（不支持，仅解释）':topics[c.family],family:c.family,
        goal:'理解概念、例子与边界；'+(c.scenario?.name||'概念讲解')+(c.family==='plain'?'；本章仅生成普通讲稿，不执行后端或真实集群。':`；必须包含 ${c.family} 交互演示，能逐步观察及修改输入参数。`),
        background:'有基础编程经验',depth:'入门',version:'固定评测规格 v1',references:[]});result.spaceId=space.id;persist();}
      let sources;
      if(result.sourceSnapshotIds)sources=result.sourceSnapshotIds.map(id=>get(id,'source')).filter(Boolean);
      else{sources=c.missing?[]:await collectSources(space,controller.signal,{fixed:!e2e});result.sourceSnapshotIds=sources.map(s=>s.id);result.sourceReadCount=sources.filter(s=>s.status==='read').length;result.sourceFailureCount=sources.filter(s=>['failed','missing'].includes(s.status)).length;persist();}
      result.stage='specification';persist();
      if(!result.outline){result.outline=e2e?await generateOutline(job,space,sources):fixtureOutline(space);persist();}
      if(!result.spec){const t=Date.now();result.spec=await generateSpec(job,space,result.outline.chapters[0],sources);result.specificationMs=Date.now()-t;persist();}
      const spec=result.spec;
      if(c.family!=='plain'&&(spec.family!==c.family||!spec.interaction.enabled))throw Error('规格没有覆盖预期交互族，独立案例判为失败');
      const maxRepairs=Math.min(2,Number(process.env.MAX_REPAIRS||2));
      for(;;){
        if(controller.signal.aborted)throw Error('案例超时或用户中断');
        let last=result.versions.at(-1),v=last?get(last.versionId,'version'):null;
        if(!v||last.report&&!last.report.passed&&result.versions.length<=maxRepairs){
          result.stage=v?'repair':'generation';if(v)result.repairAttempted=true;persist();
          const before=Date.now();const artifact=await generateArtifact(job,spec,v?{previous:v,evidence:last.report}:{});
          v=put('version',{...artifact,spec,spaceId:space.id,jobId:job.id,lessonId:c.id,parentVersionId:v?.id,number:result.versions.length+1,sourceIds:sources.map(s=>s.id),provider:'openai',model:job.actualModel||modelName});
          saveCode(v);last={versionId:v.id,generationMs:Date.now()-before,calls:job.calls,tokens:job.tokens};result.versions.push(last);persist();
        }
        if(!last.report){result.stage='validation';persist();last.report=await validate(v,{signal:controller.signal,scenario:c.scenario});v.validationId=last.report.id;put('version',v);persist();}
        if(last.report.passed){result.status='completed';break;}
        if(result.versions.length-1>=maxRepairs){result.status='completed';result.stopReason='达到两轮修复上限，保留失败';break;}
        if(job.calls>=job.maxCalls||job.tokens>=job.maxTokens){result.status='completed';result.stopReason='达到调用或 Token 预算上限，部分交付';break;}
      }
      console.log(`${run.results.filter(r=>['completed','failed'].includes(r.status)).length}/${cases.length} ${c.id}: A=${result.versions[0]?.report?.passed} B=${result.versions.at(-1)?.report?.passed} calls=${job.calls}`);
    }catch(e){
      result.error=String(e.message).replaceAll(process.env.API_KEY,'[redacted]');result.httpStatus=e.status||null;
      if([429,503,401,403].includes(e.status)||interrupted){result.status='paused';run.status=interrupted?'interrupted':e.status===429?'paused_quota':e.status===503?'paused_provider':'blocked_credentials';run.pauseReason=result.error;}
      else if(e.name==='TypeError'&&/fetch/i.test(e.message)){result.status='paused';run.status='paused_network';run.pauseReason='网络请求结果未知，需显式 --resume；未知请求费用不计为零';}
      else{result.status='failed';console.log(`${c.id}: FAILED ${result.error.slice(0,180)}`);}
    }finally{clearTimeout(timer);result.calls=job.calls;result.tokens=job.tokens;result.schemaErrors=job.schemaErrors;result.httpEvents=job.httpEvents;result.activeMs+=Date.now()-started;result.cost=null;persist();}
    if(result.status==='paused')break;
  }
  if(run.status==='running')run.status=interrupted?'interrupted':'completed';
  persist();
  const finished=run.results.filter(r=>['completed','failed'].includes(r.status));
  const withArtifacts=finished.filter(r=>r.versions[0]?.report);
  const eligible=finished.filter(r=>r.family!=='plain');
  const repaired=withArtifacts.filter(r=>r.repairAttempted||r.versions.length>1||r.stage==='repair');
  const ratio=(n,d)=>({passed:n,total:d,percent:d?Number((n/d*100).toFixed(1)):null});
  const q=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.ceil(a.length*p)-1]:null;
  const summary={runId:run.runId,status:run.status,mode,configuredModel:modelName,planned:cases.length,finished:finished.length,failedBeforeArtifact:finished.filter(r=>!r.versions.length).length,httpRejects:run.results.reduce((s,r)=>s+r.httpEvents.filter(e=>e.status!==200).length,0),paused:run.results.filter(r=>r.status==='paused').length,
    runtimeA:ratio(withArtifacts.filter(r=>r.versions[0].report.layers.runtime.status==='passed').length,finished.length),
    behaviorA:ratio(eligible.filter(r=>r.versions[0]?.report?.layers.behavior.status==='passed').length,eligible.length),
    behaviorB:ratio(eligible.filter(r=>r.versions.at(-1)?.report?.layers.behavior.status==='passed').length,eligible.length),
    conditionalRepair:ratio(repaired.filter(r=>r.versions.at(-1).report?.passed).length,repaired.length),
    regression:ratio(repaired.filter(r=>r.versions[0].report.steps.some(s=>s.passed&&r.versions.at(-1).report?.steps.some(t=>s.name===t.name&&!t.passed))).length,repaired.length),
    semantic:ratio(eligible.filter(r=>r.versions.at(-1)?.report?.layers.semantic.status==='passed').length,eligible.length),
    firstGenerationMedianMs:q(withArtifacts.map(r=>r.versions[0].generationMs),.5),firstGenerationP95Ms:q(withArtifacts.map(r=>r.versions[0].generationMs),.95),
    totalActiveMedianMs:q(finished.map(r=>r.activeMs),.5),totalActiveP95Ms:q(finished.map(r=>r.activeMs),.95),
    calls:run.results.reduce((s,r)=>s+r.calls,0),tokens:run.results.reduce((s,r)=>s+r.tokens,0),cost:null};
  writeFileSync(path.join(dir,'results.json'),JSON.stringify({summary,run},null,2));
  const fmt=r=>`${r.passed}/${r.total}${r.total?` (${r.percent}%)`:''}`;
  writeFileSync(`docs/evaluation-${mode}.md`,`# ${mode} 真实模型验收\n\n时间：${new Intl.DateTimeFormat('zh-CN',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'long'}).format(new Date())}（America/New_York）；模型：${modelName}；批次：${run.runId}。\n\n状态 **${run.status}**，完成 ${finished.length}/${cases.length} 案例。${run.pauseReason||''}\n\n${e2e?'使用真实搜索和正文读取。':'固定开发者资料摘要与初始大纲，真实模型生成教学规格、HTML 与修复代码；不冒充实时检索，也不代表真实大纲生成 UI 已验收。'}A 和 B 使用同一教学规格和同一份初始产物，最多两轮反馈修复。限流暂停时保留规格、初始代码、验证与用量；未运行案例不计为通过或失败。\n\n|指标|结果|\n|---|---|\n|首次运行|${fmt(summary.runtimeA)}|\n|失败 HTTP 尝试|${summary.httpRejects}|\n|未形成初始产物|${summary.failedBeforeArtifact}|\n|首次行为|${fmt(summary.behaviorA)}|\n|最终行为|${fmt(summary.behaviorB)}|\n|条件修复成功|${fmt(summary.conditionalRepair)}|\n|修复回归|${fmt(summary.regression)}|\n|独立语义规则|${fmt(summary.semantic)}|\n|首版代码生成 中位/P95|${summary.firstGenerationMedianMs}/${summary.firstGenerationP95Ms} ms|\n|案例活跃耗时 中位/P95|${summary.totalActiveMedianMs}/${summary.totalActiveP95Ms} ms|\n|HTTP 调用尝试 / 已报告 Token|${summary.calls} / ${summary.tokens}|\n|费用|未知；本地无法确认账号是否处于供应商 Free tier|\n\n## 案例\n\n${run.results.map(r=>`- ${r.caseId}: ${r.status}; A=${r.versions[0]?.report?.passed??'无产物'} / B=${r.versions.at(-1)?.report?.passed??'无产物'}; ${r.calls} 次调用；${r.error||r.stopReason||''}`).join('\n')}\n\n## 限制\n\n报告的技术规则只覆盖对应简化演示，不能代表全部讲稿语义。人工引用支持抽样 0 条，未完成独立人工审查；无盲测保留集。小样本 P95 不代表服务容量。耗时包含节流、有限重试及浏览器检查，不包含批次暂停期间的等待。全部代码、快照、步骤与截图在 ${path.relative(process.cwd(),dir)}。\n\n继续本批：npm run ${e2e?'eval:e2e':'eval:live'} -- --resume。去掉 --resume 开启新批次（旧产物保留）。\n`);
  console.log(JSON.stringify(summary,null,2));
  if(run.status!=='completed')process.exitCode=2;
}finally{currentController=null;process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);server.close();}
