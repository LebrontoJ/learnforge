import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const files=['server','scripts','eval','tests','public'].flatMap(dir=>readdirSync(dir).filter(f=>f.endsWith('.js')).map(f=>`${dir}/${f}`));
for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){console.error(f,r.stderr);process.exitCode=1;}}
if(!process.exitCode)console.log(`${files.length} JavaScript files passed syntax checks`);
