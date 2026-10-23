// Export only the dedicated evaluation workspace, never the personal app DB.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const root=path.resolve('artifacts/model-evaluation');
const data=JSON.parse(readFileSync(path.join(root,'results.json'),'utf8'));
const db=new DatabaseSync(path.join(root,'data/learnforge.sqlite'),{readOnly:true});
const destination=path.resolve('docs/model-evidence');mkdirSync(destination,{recursive:true});
const read=id=>{const r=db.prepare('SELECT body FROM records WHERE id=?').get(id);return r?JSON.parse(r.body):null;};
const safeWrite=(file,text)=>{if(process.env.API_KEY&&text.includes(process.env.API_KEY))throw Error('导出包含密钥，已拒绝');writeFileSync(file,text);};
safeWrite(path.join(destination,'results.json'),JSON.stringify(data,null,2));
let screenshotsCopied=false;
for(const r of data.run.results){
  if(!/^[a-zA-Z0-9_-]+$/.test(r.caseId))throw Error('非法案例路径');
  const folder=path.join(destination,r.caseId);mkdirSync(folder,{recursive:true});
  if(r.spec)safeWrite(path.join(folder,'spec.json'),JSON.stringify(r.spec,null,2));
  safeWrite(path.join(folder,'sources.json'),JSON.stringify((r.sourceSnapshotIds||[]).map(read).filter(Boolean),null,2));
  for(const [i,v]of r.versions.entries()){
    const stored=read(v.versionId);if(stored)safeWrite(path.join(folder,`v${i+1}.html`),stored.html);
    if(v.report)safeWrite(path.join(folder,`v${i+1}-validation.json`),JSON.stringify(v.report,null,2));
  }
  if(!screenshotsCopied&&r.versions.length>1&&r.versions.at(-1).report?.passed){
    for(const [label,v]of [['initial',r.versions[0]],['repaired',r.versions.at(-1)]])for(const size of ['desktop','mobile']){
      const file=path.join(root,'data/artifacts',v.versionId,size+'.png');if(existsSync(file))copyFileSync(file,path.join(folder,`${label}-${size}.png`));
    }
    screenshotsCopied=true;
  }
}
safeWrite(path.join(destination,'README.md'),`# 真实模型验收证据\n\n模型：${data.summary.configuredModel}；批次状态：${data.summary.status}；完成 ${data.summary.finished}/${data.summary.planned}。\n\n每个案例保留教学规格、原始模型 HTML、修复 HTML 与独立浏览器报告。截图选取一个实际修复成功案例的首版和最终版。详细指标见 ../evaluation-model.md。\n\n固定资料模型评测，不代表真实搜索已验收；暂停案例与未运行案例不当作通过。\n`);
console.log(`Exported ${data.run.results.length} attempted cases to docs/model-evidence; no API key exported.`);db.close();
