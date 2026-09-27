"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
let server,browser,baseUrl;

test.before(async()=>{
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://localhost").pathname;
    const relative=pathname==="/"||pathname==="/site/"?"site/index.html":pathname.replace(/^\//,"");
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404).end();return}
      res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream"});res.end(data);
    });
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  baseUrl=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});
});

test.after(async()=>{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
});

test("demonstração navega, pagina e permanece somente leitura",async()=>{
  const context=await browser.newContext({serviceWorkers:"block",locale:"pt-BR"});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(baseUrl+"/site/index.html?demo=1",{waitUntil:"domcontentloaded"});

  await assert.doesNotReject(()=>page.getByRole("heading",{name:"Glicemia · Exemplo"}).waitFor());
  assert.match(await page.locator("#banner").innerText(),/Nada será salvo/);
  assert.equal(await page.locator("button[data-meal]").count(),6);
  assert.equal((await page.locator("body").innerText()).includes("Ã"),false);

  await page.locator('button[data-tab="historico"]').click();
  assert.match(await page.locator("#view").innerText(),/12 dias com registro/);
  const pagination=page.locator('nav[aria-label="Páginas do histórico"]');
  assert.match(await pagination.innerText(),/Página 1 de 2/);
  assert.equal(await page.locator(".list section.card").count(),7);
  await page.locator('button[data-hwindow="7"]').click();
  assert.equal(await page.locator(".list section.card").count(),7);
  assert.equal(await pagination.count(),0);

  await page.locator('button[data-tab="resumo"]').click();
  assert.equal(await page.locator("#rep-nome").isDisabled(),true);
  assert.match(await page.locator("#view").innerText(),/Nome ilustrativo no modo demonstração/);
  assert.match(await page.locator("#view").innerText(),/50%\s*do tempo com leitura/);

  await page.locator('button[data-tab="dia"]').click();
  await page.locator('button[data-meal="cafe"]').click();
  assert.equal(await page.locator('#form button[type="submit"]').isDisabled(),true);
  assert.equal(errors.length,0,errors.join("\n"));
  await context.close();
});

test("registro local continua disponível depois de recarregar",async()=>{
  const context=await browser.newContext({serviceWorkers:"block",locale:"pt-BR"});
  const page=await context.newPage();
  await page.goto(baseUrl+"/site/index.html",{waitUntil:"domcontentloaded"});
  await page.locator('button[data-meal="cafe"]').click();
  await page.locator("#f-antes").fill("123");
  await page.locator("#f-comeu").fill("Banana e leite");
  await page.locator("#form").evaluate(form=>form.requestSubmit());
  await page.locator("#form").waitFor({state:"detached"});

  await page.reload({waitUntil:"domcontentloaded"});
  const breakfast=page.locator('button[data-meal="cafe"]');
  await assert.doesNotReject(()=>breakfast.waitFor());
  assert.match(await breakfast.innerText(),/123/);
  assert.match(await breakfast.innerText(),/Banana e leite/);
  await context.close();
});

test("falha de armazenamento mantém o formulário preenchido",async()=>{
  const context=await browser.newContext({serviceWorkers:"block",locale:"pt-BR"});
  await context.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="diario-glicemia-v1")throw new DOMException("armazenamento indisponível","QuotaExceededError");
      return original.call(this,key,value);
    };
  });
  const page=await context.newPage();
  await page.goto(baseUrl+"/site/index.html",{waitUntil:"domcontentloaded"});
  await page.locator('button[data-meal="cafe"]').click();
  await page.locator("#f-antes").fill("117");
  await page.locator("#f-comeu").fill("Pão e queijo");
  await page.locator("#form").evaluate(form=>form.requestSubmit());

  await page.locator("#form").waitFor({state:"visible"});
  assert.equal(await page.locator("#f-antes").inputValue(),"117");
  assert.equal(await page.locator("#f-comeu").inputValue(),"Pão e queijo");
  assert.match(await page.locator("#toast").innerText(),/Não foi possível salvar/);
  await context.close();
});

test("modo offline guarda somente a estrutura pública do site",{timeout:15000},async()=>{
  const context=await browser.newContext({serviceWorkers:"allow",locale:"pt-BR"});
  const page=await context.newPage();
  await page.goto(baseUrl+"/site/index.html",{waitUntil:"networkidle"});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload({waitUntil:"networkidle"});
  await page.evaluate(()=>Promise.all([fetch("/_blob/foto-privada"),fetch("/site/_blob/foto-privada")]).catch(()=>null));

  const cached=await page.evaluate(async()=>{
    const keys=await caches.keys(),app=keys.find(key=>key.startsWith("diario-glicemia-"));
    if(!app)return [];
    return (await caches.open(app).then(cache=>cache.keys())).map(request=>new URL(request.url).pathname).sort();
  });
  assert.deepEqual(cached,["/site/","/site/icon.svg","/site/index.html","/site/logic.js","/site/manifest.webmanifest"]);
  assert.equal(cached.some(item=>item.includes("_blob")),false);

  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await assert.doesNotReject(()=>page.getByRole("heading",{name:"Diário de Glicemia"}).waitFor());
  await context.setOffline(false);
  await context.close();
});
