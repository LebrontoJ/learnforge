// This file and reference.js are developer-owned. Generated content cannot edit them.
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {casesFor} from '../eval/reference.js';
const cfg=JSON.parse(readFileSync(process.argv[2],'utf8'));
const started=Date.now(),report={layers:{},steps:[],errors:[],screenshots:[],browser:'',durationMs:0};
let browser;
try{
browser=await chromium.launch({headless:true,args:['--site-per-process']});report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
await context.route('**/*',r=>r.request().isNavigationRequest()&&r.request().url()===cfg.url?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(1600);page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());
await page.goto(cfg.url,{timeout:7000,waitUntil:'load'});await page.locator('body').waitFor();await page.waitForFunction(()=>document.body.dataset.runtimeBusy==='false',{},{timeout:3500});await page.waitForTimeout(30);
report.layers.runtime={status:report.errors.length?'failed':'passed',errors:[...report.errors]};
const check=async(name,fn)=>{try{await fn();report.steps.push({name,passed:true});return true;}catch(e){report.steps.push({name,passed:false,error:e.message.slice(0,800)});return false;}};
const settle=()=>page.waitForFunction(()=>document.body.dataset.runtimeBusy==='false');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
if(cfg.interactive){
const behavior=[];
behavior.push(await check('执行按钮产生可见状态变化',async()=>{const out=page.getByTestId('output');const before=await out.textContent();await page.getByTestId('run').click();await settle();const after=await out.textContent();assert(before!==after,'点击执行后状态未变化');JSON.parse(after);}));
behavior.push(await check('重置恢复初始状态',async()=>{await page.getByTestId('reset').click();await settle();assert(JSON.parse(await page.getByTestId('output').textContent()).ready===true,'重置未回到 ready');}));
behavior.push(await check('单步按钮产生中间状态',async()=>{const before=await page.getByTestId('output').textContent();await page.getByTestId('step').click();await settle();assert(before!==await page.getByTestId('output').textContent(),'单步无效');}));
report.layers.behavior={status:behavior.every(Boolean)?'passed':'failed'};
const cases=cfg.scenario?[cfg.scenario]:casesFor(cfg.family);const results=[];
for(const c of cases)results.push(await check(c.name,async()=>{await page.getByTestId('data').fill(c.data);await page.getByTestId('parameter').fill(c.parameter);await page.getByTestId('run').click();await settle();const state=JSON.parse(await page.getByTestId('output').textContent());for(const [key,expected]of Object.entries(c.expected)){if(key==='error'){assert(typeof state.error==='string'&&state.error.length>0,'应显示输入错误');continue;}assert(JSON.stringify(state[key])===JSON.stringify(expected),`独立断言 ${key}：预期 ${JSON.stringify(expected)}，实际 ${JSON.stringify(state[key])}`);}}));
report.layers.semantic={status:cases.length?(results.every(Boolean)?'passed':'failed'):'not_verified',note:cases.length?'固定独立参考规则，仅验证该演示规则':'开放主题语义未自动验证'};
}else{report.layers.behavior={status:'not_applicable'};report.layers.semantic={status:'not_verified',note:'普通讲稿技术内容需人工审查'};}
const layouts=[];
for(const [name,width,height]of [['desktop',1280,850],['mobile',375,812]]){await page.setViewportSize({width,height});layouts.push(await check(`${name} 标题可见且无横向溢出`,async()=>{assert(await page.locator('h1').first().isVisible(),'主标题不可见');const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.length}));assert(sizes.scroll<=sizes.width+2,'页面明显横向溢出');assert(sizes.text>80,'正文不足');}));await page.screenshot({path:`${cfg.outputDir}/${name}.png`,fullPage:false,timeout:2500});report.screenshots.push(`${name}.png`);}
report.layers.presentation={status:layouts.every(Boolean)?'passed':'failed'};
// Opaque sandbox storage must throw. A real cross-origin fetch must be blocked.
const isolation=await page.evaluate(async()=>{let storage=false,network=false;try{localStorage.getItem('learnforge-secret');}catch{storage=true;}try{await fetch('https://example.com/forbidden',{signal:AbortSignal.timeout(800)});}catch{network=true;}return {storage,network};});report.isolation=isolation;
if(!isolation.storage||!isolation.network){report.layers.runtime.status='failed';report.errors.push('隔离检查失败');}
}catch(e){report.errors.push(e.message.slice(0,1200));report.layers.runtime={status:'failed',errors:[...report.errors]};}
finally{if(report.errors.length){report.layers.runtime={status:'failed',errors:[...report.errors]};}if(browser)await browser.close();for(const k of ['behavior','semantic','presentation'])report.layers[k]||={status:'not_run'};report.durationMs=Date.now()-started;process.stdout.write(JSON.stringify(report));}
