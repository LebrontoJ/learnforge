import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=mkdtempSync(path.join(os.tmpdir(),'learnforge-security-'));
const {put}=await import('../server/store.js');const {createPreview}=await import('../server/preview.js');
const server=createPreview().listen(3244,'127.0.0.1'),browser=await chromium.launch({headless:true});
const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',()=>{});
const visit=async code=>{const v=put('version',{html:`<h1>Security probe</h1><pre id="output"></pre><script>${code}</script>`});await page.goto('http://127.0.0.1:3244/render/'+v.id);await page.waitForFunction(()=>document.body.dataset.runtimeBusy==='false');return v;};
try{await visit(`let escaped;try{escaped=document.querySelector.constructor('return typeof fetch')()}catch(e){escaped='blocked'}document.querySelector('#output').textContent=JSON.stringify({fetch:typeof fetch,storage:typeof localStorage,location:typeof location,postMessage:typeof postMessage,documentEscape:typeof document.querySelector('#output').ownerDocument,escaped});`);const result=JSON.parse(await page.locator('#output').textContent());for(const key of ['fetch','storage','location','postMessage','documentEscape'])assert.equal(result[key],'undefined',key);assert.ok(['undefined','blocked'].includes(result.escaped));
await visit('while(true){}');assert.match(await page.locator('body').getAttribute('data-runtime-error'),/超时/);assert.equal(await page.locator('h1').textContent(),'Security probe');
await visit(`document.querySelector('#output').textContent='after-timeout';`);assert.equal(await page.locator('#output').textContent(),'after-timeout');console.log('SES authority confinement, Function-constructor escape denial, Worker termination and recovery passed.');}finally{await context.close();await browser.close();server.close();}
