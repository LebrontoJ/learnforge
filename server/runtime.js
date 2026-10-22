function startRuntime(config) {
  // Trusted host: generated code is data sent into a terminable worker.
  const nodes=[...document.querySelectorAll('[data-lf-node]')];
  const send=status=>parent.postMessage({type:'learnforge.preview',token:config.token,versionId:config.versionId,status},'*');
  const worker=new Worker(URL.createObjectURL(new Blob([config.workerSource],{type:'application/javascript'})));
  let watchdog,dead=false,sequence=0;
  const fail=message=>{if(dead)return;dead=true;clearTimeout(watchdog);worker.terminate();document.body.dataset.runtimeBusy='false';document.body.dataset.runtimeError=String(message);send('error');setTimeout(()=>{throw Error(String(message));},0);};
  const arm=()=>{document.body.dataset.runtimeBusy='true';sequence++;clearTimeout(watchdog);watchdog=setTimeout(()=>fail('教学脚本超时，Worker 已终止'),1500);};
  worker.onerror=e=>{e.preventDefault();fail(e.message);};
  worker.onmessage=e=>{const m=e.data;if(!m||typeof m!=='object')return;if(m.type==='ready'){clearTimeout(watchdog);document.body.dataset.runtimeBusy='false';send('ready');return;}if(m.type==='done'){if(m.sequence===sequence){clearTimeout(watchdog);document.body.dataset.runtimeBusy='false';}return;}if(m.type==='error'){fail(m.message);return;}if(m.type==='set'&&Number.isInteger(m.id)&&nodes[m.id]){const el=nodes[m.id];if(['textContent','value','disabled'].includes(m.key)&&['string','boolean','number'].includes(typeof m.value))el[m.key]=m.value;}};
  const snapshot=()=>nodes.map((el,i)=>({i,tag:el.tagName.toLowerCase(),id:el.id,classes:el.className,attributes:{'data-testid':el.getAttribute('data-testid')},value:el.value||'',textContent:el.textContent||'',disabled:!!el.disabled}));
  for(const type of ['click','input','change'])document.body.addEventListener(type,e=>{const el=e.target.closest('[data-lf-node]');if(!el||dead)return;arm();worker.postMessage({type:'event',sequence,event:type,id:Number(el.dataset.lfNode),values:snapshot().map(n=>({i:n.i,value:n.value}))});});
  arm();worker.postMessage({type:'init',nodes:snapshot(),code:config.code});
}
