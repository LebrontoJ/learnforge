// Independent oracles: never imported by the generator/repair adapter.
export function searchReference(a,t){return a.indexOf(t);}
export function lruReference(keys,capacity){const timestamps=new Map();keys.forEach((k,i)=>{timestamps.set(k,i);if(timestamps.size>capacity){const oldest=[...timestamps].sort((a,b)=>a[1]-b[1])[0];timestamps.delete(oldest[0]);}});return [...timestamps].sort((a,b)=>a[1]-b[1]).map(x=>x[0]);}
export function rateReference(a,interval){if(interval<=0)return {error:true};if(a.length<2)return {rate:null};return {rate:a.slice(1).map((n,i)=>n<a[i]?n:n-a[i]).reduce((s,n)=>s+n,0)/((a.length-1)*interval)};}
export function casesFor(family){return ({
binary:[{name:'二分：命中',data:'1,3,5,7,9',parameter:'7',expected:{found:3}},{name:'二分：不存在',data:'1,3,5',parameter:'4',expected:{found:-1}},{name:'二分：空数组',data:'',parameter:'2',expected:{found:-1}},{name:'二分：首元素',data:'1',parameter:'1',expected:{found:0}},{name:'二分：无序输入拒绝',data:'3,1',parameter:'1',expected:{error:true}}],
lru:[{name:'LRU：命中改变淘汰顺序',data:'A,B,A,C',parameter:'2',expected:{cache:lruReference(['A','B','A','C'],2)}},{name:'LRU：零容量',data:'A,B',parameter:'0',expected:{cache:[]}},{name:'LRU：重复命中',data:'A,A,A',parameter:'2',expected:{cache:['A']}},{name:'LRU：空序列',data:'',parameter:'2',expected:{cache:[]}},{name:'LRU：负容量拒绝',data:'A',parameter:'-1',expected:{error:true}}],
rate:[{name:'Counter：正常递增',data:'0,10,20',parameter:'5',expected:rateReference([0,10,20],5)},{name:'Counter：重置',data:'10,2,6',parameter:'2',expected:rateReference([10,2,6],2)},{name:'Counter：零间隔拒绝',data:'1,2',parameter:'0',expected:{error:true}},{name:'Counter：单样本',data:'1',parameter:'5',expected:{rate:null}},{name:'Counter：不增长',data:'4,4',parameter:'2',expected:{rate:0}}],
event:[{name:'事件循环：同步、微任务、定时器',data:'',parameter:'0',expected:{order:['sync','microtask','timer']}}]
})[family]||[];}
