import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=mkdtempSync(path.join(os.tmpdir(),'learnforge-transport-'));
const {requestCompletion,retryDelay,ModelServiceError}=await import('../server/model-transport.js');
const original=globalThis.fetch;
function job(maxCalls=3){return {id:crypto.randomUUID(),calls:0,tokens:0,maxCalls,maxTokens:1000,httpEvents:[],signal:new AbortController().signal,record(){return {id:this.id,calls:this.calls,httpEvents:this.httpEvents};}};}
const response=(status,retryAfter)=>({status,ok:status===200,headers:new Headers(retryAfter?{'retry-after':retryAfter}:{}),body:{cancel:async()=>{}},json:async()=>({ok:true})});
test('Retry-After seconds, HTTP-date and invalid values are parsed',()=>{assert.equal(retryDelay('12'),12000);assert.equal(retryDelay('invalid'),null);assert.equal(retryDelay('Thu, 22 Oct 2026 23:00:00 GMT',Date.parse('2026-10-22T22:59:30Z')),30000);});
test('explicit 503 can retry, accounting for every HTTP attempt',async()=>{process.env.MODEL_HTTP_RETRIES='1';process.env.MODEL_MIN_INTERVAL_MS='0';let n=0;globalThis.fetch=async()=>response(++n===1?503:200,'0');try{const j=job();assert.deepEqual(await requestCompletion(j,{}),{ok:true});assert.equal(j.calls,2);assert.deepEqual(j.httpEvents.map(e=>e.status),[503,200]);}finally{globalThis.fetch=original;}});
test('quota response with long Retry-After pauses without retrying',async()=>{process.env.MODEL_HTTP_RETRIES='1';globalThis.fetch=async()=>response(429,'120');try{const j=job();await assert.rejects(requestCompletion(j,{}),e=>e instanceof ModelServiceError&&e.status===429&&e.retryAfterMs===120000);assert.equal(j.calls,1);}finally{globalThis.fetch=original;}});
test('retry cannot exceed the model-call budget',async()=>{process.env.MODEL_HTTP_RETRIES='2';let n=0;globalThis.fetch=async()=>{n++;return response(503,'0');};try{const j=job(1);await assert.rejects(requestCompletion(j,{}),/预算/);assert.equal(n,1);}finally{globalThis.fetch=original;}});
test('unknown network outcomes are never replayed automatically',async()=>{let n=0;globalThis.fetch=async()=>{n++;throw TypeError('fetch failed');};try{await assert.rejects(requestCompletion(job(),{}),/fetch failed/);assert.equal(n,1);}finally{globalThis.fetch=original;}});
test('cancellation aborts throttled waiting before another HTTP request',async()=>{process.env.MODEL_MIN_INTERVAL_MS='60000';globalThis.fetch=async()=>response(200);try{const c=new AbortController(),j=job();j.signal=c.signal;const pending=requestCompletion(j,{});c.abort();await assert.rejects(pending);assert.equal(j.calls,0);}finally{globalThis.fetch=original;delete process.env.MODEL_MIN_INTERVAL_MS;delete process.env.MODEL_HTTP_RETRIES;}});
