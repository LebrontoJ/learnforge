import {setTimeout as delay} from 'node:timers/promises';
import {put} from './store.js';

export class ModelServiceError extends Error {
  constructor(status,retryAfterMs=null){super(`模型服务 HTTP ${status}（响应正文与密钥未写入日志）`);this.status=status;this.retryAfterMs=retryAfterMs;this.name='ModelServiceError';}
}
export function retryDelay(value,now=Date.now()){
  if(!value)return null;
  const seconds=Number(value);
  const ms=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
  return Number.isFinite(ms)?Math.max(0,ms):null;
}
let lastStart=0;
function guard(job){if(job.signal.aborted)throw Error('任务已取消或超时');if(job.calls>=job.maxCalls||job.tokens>=job.maxTokens)throw Error('模型调用或 Token 预算已达到上限');}
export async function requestCompletion(job,body){
  const interval=Number(process.env.MODEL_MIN_INTERVAL_MS||0);
  const retries=Math.min(2,Math.max(0,Number(process.env.MODEL_HTTP_RETRIES||0)));
  job.httpEvents||=[];
  for(let attempt=0;attempt<=retries;attempt++){
    guard(job);
    const wait=Math.max(0,lastStart+interval-Date.now());
    if(wait)await delay(wait,undefined,{signal:job.signal});
    guard(job);lastStart=Date.now();job.calls++;put('job',job.record());
    const response=await fetch(`${(process.env.MODEL_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{
      method:'POST',signal:job.signal,
      headers:{Authorization:`Bearer ${process.env.API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const retryAfterMs=retryDelay(response.headers.get('retry-after'));
    job.httpEvents.push({status:response.status,attempt:attempt+1,at:new Date().toISOString(),retryAfterMs});
    put('job',job.record());
    if(response.ok)return response.json();
    await response.body?.cancel();
    // Retry only explicit rejected HTTP requests, never unknown network outcomes.
    if([429,503].includes(response.status)&&attempt<retries&&(retryAfterMs===null||retryAfterMs<=30000)){
      await delay(retryAfterMs??5000,undefined,{signal:job.signal});
      continue;
    }
    throw new ModelServiceError(response.status,retryAfterMs);
  }
}
