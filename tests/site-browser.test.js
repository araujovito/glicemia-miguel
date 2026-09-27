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
    const relative=pathname==="/"?"site/index.html":pathname.replace(/^\//,"");
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
