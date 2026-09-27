"use strict";
// Testes do site no modo compartilhado (Artifact do Claude): várias pessoas, um banco só.
// O banco é simulado no Node com as regras do real: set substitui, update mescla objetos
// e exige que o documento exista, e toda gravação chega a todos os aparelhos abertos.
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
let server,browser,baseUrl;

// ---------- banco simulado ----------
const store=new Map(), pages=[];
let segurar=false;   // segura a entrega das gravações, para simular dois aparelhos salvando ao mesmo tempo
const clone=o=>JSON.parse(JSON.stringify(o));
function mescla(a,b){
  for(const [k,v] of Object.entries(b)){
    if(v&&typeof v==="object"&&!Array.isArray(v)&&a[k]&&typeof a[k]==="object"&&!Array.isArray(a[k]))mescla(a[k],v);
    else a[k]=clone(v);
  }
}
async function entrega(){
  if(segurar)return;
  const docs=Object.fromEntries(store);
  for(const p of pages)await p.evaluate(d=>window.__entrega&&window.__entrega(d),docs).catch(()=>{});
}
const CLAUDE_SIMULADO=`(()=>{
  let docs={};const ouvintes=[];
  window.__entrega=d=>{docs=d;ouvintes.forEach(f=>f())};
  const snap=(id,v)=>({id,exists:v!==undefined,data:()=>v,metadata:{}});
  const op=(nome,...a)=>window.__op(nome,a).then(r=>{if(r&&r.erro)throw {code:r.erro};return r});
  const db={
    doc(p){const id=p.split("/").pop();return{id,path:p,get:async()=>snap(id,docs[p]),set:d=>op("set",p,d),update:d=>op("update",p,d),delete:()=>op("delete",p),
      onSnapshot(f){const g=()=>f(snap(id,docs[p]));ouvintes.push(g);setTimeout(g,0);return()=>{}}}},
    collection(c){return{onSnapshot(f){const g=()=>{const ds=Object.keys(docs).filter(k=>k.startsWith(c+"/")).map(k=>snap(k.slice(c.length+1),docs[k]));f({docs:ds,size:ds.length,empty:!ds.length})};ouvintes.push(g);setTimeout(g,0);return()=>{}}}}
  };
  const user={isOwner:async()=>window.__dono,id:async()=>window.__uid,can:async n=>n==="data.write"?window.__podeEscrever:null,
    me:async()=>({id:window.__uid,name:"",isOwner:window.__dono,canEdit:false,avatarUrl:"",color:"#888",email:null}),
    profiles:async ids=>Object.fromEntries([].concat(ids).map(i=>[i,{id:i,name:i==="u_ana"?"Ana":"João",avatarUrl:"",color:"#888",email:null,isMe:i===window.__uid,guest:false}]))};
  const assets={upload:async()=>({id:"a1",url:"",sizeBytes:0,contentType:"image/jpeg"}),delete:async()=>{},list:async()=>({assets:[],usage:{}})};
  const downloads={save:async()=>({status:"saved"})};
  const caps={db,user,assets,downloads};
  window.claude={use:n=>new Promise(r=>setTimeout(()=>r(caps[n]||null),20))};
})();`;

async function abrir({uid,dono=false,podeEscrever=true,somenteLeitura=false}){
  const context=await browser.newContext({serviceWorkers:"block",locale:"pt-BR",viewport:{width:400,height:850}});
  const page=await context.newPage();
  await page.exposeFunction("__op",async(nome,a)=>{
    if(somenteLeitura&&nome!=="get")return {erro:"invalid_argument"};
    if(nome==="set"){store.set(a[0],clone(a[1]));await entrega();return null}
    if(nome==="update"){if(!store.has(a[0]))return {erro:"invalid_argument"};mescla(store.get(a[0]),a[1]);await entrega();return null}
    if(nome==="delete"){store.delete(a[0]);await entrega();return null}
  });
  await page.addInitScript(`window.__uid=${JSON.stringify(uid)};window.__dono=${dono};window.__podeEscrever=${podeEscrever};`+CLAUDE_SIMULADO);
  await page.goto(baseUrl+"/site/index.html",{waitUntil:"domcontentloaded"});
  pages.push(page);await entrega();
  await page.locator('button[data-meal="cafe"]').waitFor();
  return page;
}
const hoje=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
async function registrar(page,refeicao,campos){
  await page.locator(`button[data-meal="${refeicao}"]`).click();
  for(const [id,v] of Object.entries(campos))await page.locator("#"+id).fill(v);
}
const salvar=page=>page.locator("#form").evaluate(f=>f.requestSubmit());

test.before(async()=>{
  server=http.createServer((req,res)=>{
    const file=path.resolve(root,new URL(req.url,"http://localhost").pathname.replace(/^\//,""));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return}
      res.writeHead(200,{"content-type":file.endsWith(".js")?"text/javascript; charset=utf-8":"text/html; charset=utf-8"});res.end(data)});
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  baseUrl=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});
test.beforeEach(()=>{store.clear();pages.length=0;segurar=false});

test("duas pessoas salvando refeições diferentes no mesmo dia não apagam uma à outra",async()=>{
  const ana=await abrir({uid:"u_ana"}),joao=await abrir({uid:"u_joao"});
  segurar=true;   // nenhum dos dois vê a gravação do outro antes de salvar
  await registrar(ana,"cafe",{"f-antes":"101"});
  await registrar(joao,"almoco",{"f-antes":"202"});
  await salvar(ana);await salvar(joao);
  await ana.locator("#form").waitFor({state:"detached"});await joao.locator("#form").waitFor({state:"detached"});
  segurar=false;await entrega();
  const dia=store.get("dias/"+hoje());
  assert.equal(dia.refeicoes.cafe.antes,101);
  assert.equal(dia.refeicoes.almoco.antes,202);
  assert.equal(dia.refeicoes.cafe.criadoPor,"u_ana");
  assert.equal(dia.refeicoes.almoco.criadoPor,"u_joao");
});

test("apagar um campo remove o valor do banco (update não o mantém)",async()=>{
  const ana=await abrir({uid:"u_ana"});
  await registrar(ana,"cafe",{"f-antes":"110","f-obs":"comeu tudo"});await salvar(ana);
  await ana.locator("#form").waitFor({state:"detached"});
  await registrar(ana,"cafe",{"f-obs":""});await salvar(ana);
  await ana.locator("#form").waitFor({state:"detached"});
  const cafe=store.get("dias/"+hoje()).refeicoes.cafe;
  assert.equal(cafe.antes,110);
  assert.ok(cafe.obs==null,"a observação apagada não pode voltar");
});

test("quem não pode escrever vê o aviso ao abrir e não consegue salvar",async()=>{
  const medico=await abrir({uid:"u_joao",podeEscrever:false,somenteLeitura:true});
  assert.match(await medico.locator("#banner").innerText(),/não tem permissão para registrar/);
  await medico.locator('button[data-meal="cafe"]').click();
  assert.equal(await medico.locator('#form button[type="submit"]').isDisabled(),true);
});

test("só o dono do diário compartilhado pode apagar todos os dados",async()=>{
  store.set("dias/2026-09-20",{refeicoes:{cafe:{antes:100}}});
  const escola=await abrir({uid:"u_joao"});
  await escola.locator('button[data-tab="resumo"]').click();
  await escola.getByText("Privacidade e exclusão dos dados").click();
  assert.equal(await escola.locator("#erase-start").count(),0);
  assert.match(await escola.locator("#view").innerText(),/Só quem criou o diário pode apagar/);
  const dono=await abrir({uid:"u_ana",dono:true});
  await dono.locator('button[data-tab="resumo"]').click();
  await dono.getByText("Privacidade e exclusão dos dados").click();
  await dono.locator("#erase-start").click();
  await dono.locator("#erase-word").fill("APAGAR");
  await dono.locator("#erase-confirm").click();
  await dono.getByText("Todos os dados foram apagados").waitFor();
  assert.equal(store.has("dias/2026-09-20"),false);
});

test("restaurar cópia com refeição apagada funciona, e a segunda vez não há nada a restaurar",async()=>{
  store.set("dias/2026-09-20",{data:"2026-09-20",atualizadoEm:5,refeicoes:{cafe:{antes:100,criadoEm:5,atualizadoEm:5}}});
  const copia={formato:"diario-glicemia-backup",versao:1,exportadoEm:"2026-09-25T12:00:00Z",nome:"",plano:"",fotos:{},
    dias:{"2026-09-20":{data:"2026-09-20",atualizadoEm:9,refeicoes:{cafe:null,almoco:{antes:120,criadoEm:9,atualizadoEm:9}}}}};
  const arquivo=path.join(require("node:os").tmpdir(),"copia-teste-glicemia.json");
  fs.writeFileSync(arquivo,JSON.stringify(copia));
  const dono=await abrir({uid:"u_ana",dono:true});
  await dono.locator('button[data-tab="resumo"]').click();
  await dono.locator("#bk-file").setInputFiles(arquivo);
  await dono.locator("#bk-restore").click();
  await dono.getByText(/Cópia restaurada/).waitFor();
  const dia=store.get("dias/2026-09-20");
  assert.equal(dia.refeicoes.cafe.antes,100,"a refeição atual não pode ser apagada pela cópia");
  assert.equal(dia.refeicoes.almoco.antes,120);
  await dono.locator("#bk-file").setInputFiles(arquivo);
  assert.match(await dono.locator(".confirm").innerText(),/Nada a restaurar/);
  fs.unlinkSync(arquivo);
});

test("cópia antiga com fotos é restaurada sem as referências às fotos",async()=>{
  const copia={formato:"diario-glicemia-backup",versao:1,exportadoEm:"2026-09-25T12:00:00Z",nome:"",plano:"",
    fotos:{"foto-velha":"data:image/jpeg;base64,AAAA"},
    dias:{"2026-09-21":{data:"2026-09-21",atualizadoEm:9,refeicoes:{jantar:{antes:130,fotos:["foto-velha"],criadoEm:9,atualizadoEm:9}}}}};
  const arquivo=path.join(require("node:os").tmpdir(),"copia-antiga-glicemia.json");
  fs.writeFileSync(arquivo,JSON.stringify(copia));
  const dono=await abrir({uid:"u_ana",dono:true});
  await dono.locator('button[data-tab="resumo"]').click();
  await dono.locator("#bk-file").setInputFiles(arquivo);
  await dono.locator("#bk-restore").click();
  await dono.getByText(/Cópia restaurada/).waitFor();
  const jantar=store.get("dias/2026-09-21").refeicoes.jantar;
  assert.equal(jantar.antes,130);
  assert.equal("fotos" in jantar,false);
  fs.unlinkSync(arquivo);
});
