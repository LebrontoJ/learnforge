import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,renameSync,existsSync,rmSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {id} from './schema.js';
export const root=path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(root,{recursive:true}); mkdirSync(path.join(root,'artifacts'),{recursive:true});
const db=new DatabaseSync(path.join(root,'learnforge.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS records_kind ON records(kind);');
export function put(kind,value){value.id ||= id();value.updatedAt=new Date().toISOString();db.prepare('INSERT INTO records VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(value.id,kind,JSON.stringify(value));return value;}
export function get(key,kind){const r=db.prepare('SELECT kind,body FROM records WHERE id=?').get(key);return r&&(!kind||kind===r.kind)?JSON.parse(r.body):null;}
export function list(kind){return db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r=>JSON.parse(r.body));}
export function remove(key){db.prepare('DELETE FROM records WHERE id=?').run(key);}
export function artifactFile(versionId,name){if(!/^[a-zA-Z0-9_-]+$/.test(versionId)||!['desktop.png','mobile.png','code.html','worker.json'].includes(name))throw Error('Invalid artifact path');const d=path.join(root,'artifacts',versionId);mkdirSync(d,{recursive:true});return path.join(d,name);}
export function saveCode(v){const target=artifactFile(v.id,'code.html');writeFileSync(target+'.tmp',v.html);renameSync(target+'.tmp',target);}
export function deleteSpace(spaceId){const ids=new Set([spaceId]);for(const kind of ['outline','lesson','version','job'])for(const r of list(kind))if(r.spaceId===spaceId){ids.add(r.id);if(kind==='version')rmSync(path.join(root,'artifacts',r.id),{recursive:true,force:true});}for(const kind of ['validation','source'])for(const r of list(kind))if(ids.has(r.versionId)||r.spaceId===spaceId)ids.add(r.id);for(const key of ids)remove(key);}
export function pruneArtifacts(){const cutoff=Date.now()-Number(process.env.RETENTION_DAYS||30)*86400000;for(const d of readdirSync(path.join(root,'artifacts'))){const p=path.join(root,'artifacts',d);if(statSync(p).mtimeMs<cutoff)rmSync(p,{recursive:true,force:true});}for(const r of list('validation'))if(Date.parse(r.updatedAt)<cutoff&&!r.traceExpired){r.steps=[];r.errors=[];r.screenshots=[];r.traceExpired=true;put('validation',r);}for(const j of list('job'))if(Date.parse(j.finishedAt||j.updatedAt)<cutoff&&!j.traceExpired){j.events=[];j.repairs=j.repairs.map(r=>({...r,evidence:[],errors:[]}));j.traceExpired=true;put('job',j);}for(const s of list('source'))if(Date.parse(s.updatedAt)<cutoff){s.text='';s.snapshotExpired=true;put('source',s);}}
export function codeExists(v){return existsSync(artifactFile(v,'code.html'));}
