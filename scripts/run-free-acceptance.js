// Bounded same-batch continuation for explicit provider 503 only.
// Does not replay unknown network outcomes, change providers, or reset budgets.
import {spawn} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const file='artifacts/model-evaluation/checkpoint.json',started=Date.now();
let noProgress=0,previousFinished=-1,runningChild=null,expired=false,completed=false;
const watchdog=setTimeout(()=>{expired=true;runningChild?.kill('SIGINT');},20*60*1000);
for(let n=0;n<60;n++){
  if(expired||Date.now()-started>20*60*1000){console.log('Reached 20 minute execution bound; checkpoint retained.');break;}
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--env-file-if-exists=.env','scripts/evaluate-live.js','--resume'],{stdio:'inherit'});runningChild=child;child.on('error',reject);child.on('exit',code=>{runningChild=null;resolve(code);});});
  if(!existsSync(file)){process.exitCode=code||1;break;}
  const run=JSON.parse(readFileSync(file,'utf8'));
  const finished=run.results.filter(r=>['completed','failed'].includes(r.status)).length;
  if(run.status==='completed'){completed=true;console.log(`Completed fixed batch ${finished}/${run.planned}; inspect failures in report.`);break;}
  if(run.status!=='paused_provider'){console.log(`Stopped at ${run.status}; explicit action required. No paid fallback.`);process.exitCode=2;break;}
  noProgress=finished===previousFinished?noProgress+1:0;previousFinished=finished;
  if(noProgress>=3){console.log('Three resumptions without case progress; checkpoint retained.');process.exitCode=2;break;}
  console.log(`Provider 503; preserving ${finished}/${run.planned}, resume in 10 seconds within original budgets.`);
  await delay(10000);
}

clearTimeout(watchdog);if(!completed)process.exitCode=2;
