(function(root, factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.GlicemiaLogic=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function has(v){return v!==null&&v!==undefined&&v!==""}
  function parseNum(v){v=String(v??"").trim().replace(",",".");if(v==="")return null;const n=Number(v);return Number.isFinite(n)?n:NaN}
  function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
  function percentil(v,p){
    if(!v.length)return null;
    const s=v.slice().sort((a,b)=>a-b),i=(s.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);
    return s[lo]+(s[hi]-s[lo])*(i-lo);
  }
  function desvio(v){if(v.length<2)return null;const m=avg(v);return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))}
  function distrib(v){return v.length?{n:v.length,min:Math.min(...v),p25:percentil(v,.25),med:percentil(v,.5),p75:percentil(v,.75),max:Math.max(...v)}:null}

  const PARADAS=new Set("com sem de da do das dos e ou um uma uns umas no na nos nas em ao aos para por pouco pouca muito muita meio meia mais menos copo copos prato pratos pedaco pedacos colher colheres fatia fatias xicara xicaras unidade unidades".split(" "));
  function palavras(t){
    return new Set(String(t||"").toLowerCase().replace(/(ães|ões|ãos)(?![a-zà-ú])/g,"ão").normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z]+/)
      .filter(w=>w.length>=3&&!PARADAS.has(w)).map(w=>w.length>3&&w.endsWith("s")?w.slice(0,-1):w));
  }

  function isoTime(iso,hhmm){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!/^\d{2}:\d{2}$/.test(hhmm||""))return null;
    const [y,m,d]=iso.split("-").map(Number),[h,min]=hhmm.split(":").map(Number);
    const value=new Date(y,m-1,d,h,min,0,0).getTime();
    return Number.isFinite(value)?value:null;
  }

  function reminderDue(iso,meal){
    if(!meal)return null;
    const start=meal.refeicaoHora?isoTime(iso,meal.refeicaoHora):(+meal.antesEm||null);
    return start?start+2*3600e3:null;
  }

  function recordChanged(current,baseline){
    return (+((current&&current.atualizadoEm)||0))!== (+(baseline||0));
  }

  async function optimisticCommit(apply,rollback,save){
    apply();
    try{await save();return true}
    catch(error){rollback();throw error}
  }

  function recordMap(value){
    if(Array.isArray(value)){
      const out={};value.forEach(item=>{if(item&&item.id)out[item.id]=item});return out;
    }
    return Object.assign({},value||{});
  }

  function mergeRecordMaps(current,incoming){
    const a=recordMap(current),b=recordMap(incoming),out=Object.assign({},a);
    Object.entries(b).forEach(([key,value])=>{
      // Registro apagado na cópia chega como null: restaurar nunca apaga o que existe aqui.
      if(!value)return;
      const old=a[key];
      if(!old||(+value.atualizadoEm||0)>(+old.atualizadoEm||0))out[key]=value;
    });
    return out;
  }

  // Mesmos registros (ignorando os apagados, que ficam null) nos dois mapas.
  function sameRecords(a,b){
    const x=recordMap(a),y=recordMap(b),kx=Object.keys(x).filter(k=>x[k]),ky=Object.keys(y).filter(k=>y[k]);
    return kx.length===ky.length&&kx.every(k=>JSON.stringify(x[k])===JSON.stringify(y[k]));
  }

  function mergeDayRecords(current,incoming){
    if(!current)return incoming;
    if(!incoming)return current;
    const incomingIsNewer=(+incoming.atualizadoEm||0)>(+current.atualizadoEm||0);
    const out=incomingIsNewer?Object.assign({},current,incoming):Object.assign({},incoming,current);
    out.data=current.data||incoming.data;
    out.refeicoes=mergeRecordMaps(current.refeicoes,incoming.refeicoes);
    out.hipos=mergeRecordMaps(current.hipos,incoming.hipos);
    out.extras=mergeRecordMaps(current.extras,incoming.extras);
    out.atualizadoEm=Math.max(+current.atualizadoEm||0,+incoming.atualizadoEm||0);
    // Se a cópia não acrescentou nem mudou nenhum registro, devolve o dia como estava. Assim o plano de
    // restauração consegue dizer "nada a restaurar" e nenhum documento é regravado à toa.
    if(["refeicoes","hipos","extras"].every(k=>sameRecords(out[k],current[k])))return current;
    return out;
  }

  function withClearedFields(previous,next){
    if(!next)return next;
    const out=Object.assign({},next);
    Object.keys(previous||{}).forEach(key=>{if(!(key in out))out[key]=null});
    return out;
  }

  function sensorCoverage(readings,days,expectedPerDay=96){
    if(!days||days<1||!expectedPerDay)return 0;
    return Math.min(100,Math.max(0,readings/(days*expectedPerDay)*100));
  }

  function validIsoDate(iso){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||""))return false;
    const [y,m,d]=iso.split("-").map(Number),date=new Date(y,m-1,d);
    return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;
  }

  function validBackupDay(day){
    if(!day||typeof day!=="object"||Array.isArray(day))return false;
    const records=value=>(Array.isArray(value)?value:Object.values(value||{})).filter(Boolean);
    const finite=value=>value==null||value===""||(typeof value==="number"&&Number.isFinite(value)&&value>=0);
    const text=value=>value==null||typeof value==="string";
    const textList=value=>value==null||(Array.isArray(value)&&value.length<=100&&value.every(x=>typeof x==="string"));
    const common=record=>record&&typeof record==="object"&&!Array.isArray(record)&&finite(record.criadoEm)&&finite(record.atualizadoEm);
    const meals=records(day.refeicoes).every(m=>common(m)&&[m.antes,m.depois,m.insulina,m.carbo,m.antesEm].every(finite)
      &&[m.antesHora,m.refeicaoHora,m.depoisHora,m.local,m.comeu,m.obs].every(text)&&textList(m.tags)&&textList(m.fotos));
    const hipos=records(day.hipos).every(h=>common(h)&&[h.valor,h.nova].every(finite)
      &&[h.id,h.hora,h.situacao,h.tratamento,h.novaHora,h.obs].every(text)&&textList(h.sintomas));
    const extras=records(day.extras).every(x=>common(x)&&finite(x.valor)&&[x.id,x.hora,x.momento,x.obs].every(text));
    return meals&&hipos&&extras&&finite(day.atualizadoEm);
  }

  function mergeSensor(atual,novos){
    const m=new Map();
    if(atual)(atual.min||[]).forEach((min,i)=>m.set(min*10+((atual.tipo||[])[i]||0),{min,mg:atual.mg[i],tipo:(atual.tipo||[])[i]||0}));
    const values=novos instanceof Map?[...novos.values()]:novos||[];
    values.forEach(p=>m.set(p.min*10+(p.tipo||0),{min:+p.min,mg:+p.mg,tipo:+p.tipo||0}));
    const a=[...m.values()].filter(p=>Number.isFinite(p.min)&&Number.isFinite(p.mg)).sort((x,y)=>x.min-y.min||x.tipo-y.tipo);
    return {min:a.map(x=>x.min),mg:a.map(x=>x.mg),tipo:a.map(x=>x.tipo)};
  }

  return {has,parseNum,avg,percentil,desvio,distrib,palavras,isoTime,reminderDue,recordChanged,optimisticCommit,mergeDayRecords,withClearedFields,sensorCoverage,validIsoDate,validBackupDay,mergeSensor};
});
