"use strict";
// Testes do site fora do Claude, contra um Supabase de verdade rodando localmente (Postgres,
// autenticação, API e tempo real). Cada pessoa abre o site num navegador separado.
// O login do Google não existe no ambiente local: as contas de teste entram com senha pela API,
// e a sessão é colocada no navegador antes de abrir o site, como o Google faria.
// Se o Supabase local não estiver rodando (npx supabase start), os testes são pulados.
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {execSync}=require("node:child_process");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
let local=null;
try{
  const st=JSON.parse(execSync("npx supabase status -o json",{cwd:root,stdio:["ignore","pipe","ignore"],timeout:60000}).toString());
  if(st.API_URL&&st.ANON_KEY&&st.SERVICE_ROLE_KEY)local={url:st.API_URL,anon:st.ANON_KEY,servico:st.SERVICE_ROLE_KEY};
}catch(e){}
const pular=local?false:"Supabase local não está rodando (npx supabase start)";

let server,browser,baseUrl;
const rodada=Date.now().toString(36), SENHA="senha-de-teste-123";
const email=nome=>`${nome}-${rodada}@exemplo.com`;
const contas={}, abertas={};

async function api(caminho,{metodo="GET",corpo,chave}={}){
  const r=await fetch(local.url+caminho,{method:metodo,headers:{apikey:chave||local.servico,Authorization:"Bearer "+(chave||local.servico),"content-type":"application/json"},body:corpo&&JSON.stringify(corpo)});
  const t=await r.text();if(!r.ok)throw new Error(`${caminho}: ${r.status} ${t}`);return t?JSON.parse(t):null;
}
async function criarConta(nome){
  const u=await api("/auth/v1/admin/users",{metodo:"POST",corpo:{email:email(nome),password:SENHA,email_confirm:true,user_metadata:{full_name:nome[0].toUpperCase()+nome.slice(1)}}});
  contas[nome]={id:u.id,email:email(nome)};
}
async function abrir(nome){
  const sessao=nome&&await api("/auth/v1/token?grant_type=password",{metodo:"POST",chave:local.anon,corpo:{email:email(nome),password:SENHA}});
  const context=await browser.newContext({serviceWorkers:"block",locale:"pt-BR",viewport:{width:400,height:850}});
  const page=await context.newPage();
  page.on("pageerror",e=>console.error(`[${nome}]`,e.message));
  if(sessao)await page.addInitScript(s=>localStorage.setItem("sb-127-auth-token",s),JSON.stringify(sessao));
  await page.goto(baseUrl+"/site/index.html",{waitUntil:"domcontentloaded"});
  if(nome)abertas[nome]=page;
  return page;
}
// Espera a página estar recebendo as mudanças dos outros aparelhos antes de alguém gravar.
async function conectada(page){
  await page.waitForFunction(()=>window.DiarioSupabase&&window.DiarioSupabase.tempoReal==="SUBSCRIBED",null,{timeout:60000});   // o Supabase local recém-iniciado demora na primeira conexão
}
const refeicoesNoBanco=()=>api(`/rest/v1/refeicoes?select=refeicao,antes,comeu,criado_por&order=refeicao`);
async function registrar(page,refeicao,antes,comeu){
  await page.locator(`button[data-meal="${refeicao}"]`).click();
  await page.locator("#f-antes").fill(String(antes));
  await page.locator("#f-comeu").fill(comeu);
  await page.locator('#form button[type="submit"]').click();
  await page.locator("#form").waitFor({state:"detached"});
}
async function convidar(page,quem,papel){
  await page.locator('button[data-tab="resumo"]').click();
  await page.locator(".pessoas").waitFor();   // a lista carrega e redesenha o cartão; espera, como uma pessoa faria
  await page.locator("#convite-email").fill(email(quem));
  await page.locator("#convite-papel").selectOption(papel);
  await page.getByRole("button",{name:"Convidar"}).click();
  await page.locator("#acesso-msg").waitFor();
  assert.match(await page.locator("#acesso-msg").innerText(),/Convite feito/);
  await page.locator('button[data-tab="dia"]').click();
}

test.before(async()=>{
  if(pular)return;
  // Um diário por teste de ponta a ponta: começa do zero.
  await api("/rest/v1/diarios?id=not.is.null",{metodo:"DELETE"});
  for(const n of ["ana","bia","caio","davi"])await criarConta(n);
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://localhost").pathname;
    if(pathname==="/site/config.js"){   // aponta o site para o Supabase local
      res.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});
      res.end(`window.DIARIO_CONFIG=${JSON.stringify({supabaseUrl:local.url,supabaseAnonKey:local.anon})};`);return;
    }
    const file=path.resolve(root,pathname.replace(/^\//,""));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return}
      res.writeHead(200,{"content-type":file.endsWith(".js")?"text/javascript; charset=utf-8":"text/html; charset=utf-8"});res.end(data)});
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  baseUrl=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});

test("sem login, o site pede para entrar com o Google e não mostra registros",{skip:pular},async()=>{
  const page=await abrir(null);
  await page.getByRole("button",{name:"Entrar com Google"}).waitFor();
  assert.equal(await page.locator(".tabs").isHidden(),true);
  assert.equal(await page.locator("button[data-meal]").count(),0);
  await page.context().close();
});

test("a primeira pessoa cria o diário, registra, e a autoria vem do banco",{skip:pular},async()=>{
  const ana=await abrir("ana");
  await ana.getByText("Nenhum diário para esta conta").waitFor();
  await ana.getByRole("button",{name:"Criar um diário"}).click();
  await ana.locator('button[data-meal="cafe"]').waitFor();
  await registrar(ana,"cafe",110,"pão com queijo");
  const [cafe]=await refeicoesNoBanco();
  assert.equal(cafe.refeicao,"cafe");
  assert.equal(Number(cafe.antes),110);
  assert.equal(cafe.criado_por,contas.ana.id);
});

test("a cuidadora convidada entra, vê quem anotou e o registro dela aparece no aparelho da dona",{skip:pular},async()=>{
  const ana=abertas.ana;
  await convidar(ana,"bia","cuidador");
  const bia=await abrir("bia");
  await bia.locator('button[data-meal="cafe"]').filter({hasText:"pão com queijo"}).waitFor();
  await bia.locator('button[data-meal="cafe"] .por').filter({hasText:"Ana"}).waitFor();
  await conectada(ana);
  await registrar(bia,"almoco",140,"arroz e feijão");
  // sem recarregar a página da Ana
  await ana.locator('button[data-meal="almoco"]').filter({hasText:"arroz e feijão"}).waitFor({timeout:10000});
  assert.equal((await refeicoesNoBanco()).length,2);
});

test("o leitor vê o diário mas não consegue registrar",{skip:pular},async()=>{
  await convidar(abertas.ana,"caio","leitor");
  const caio=await abrir("caio");
  await caio.locator('button[data-meal="cafe"]').filter({hasText:"pão com queijo"}).waitFor();
  await caio.getByText("Você não tem permissão para registrar").waitFor();
  await caio.locator('button[data-meal="janta"]').click();
  assert.equal(await caio.locator('#form button[type="submit"]').isDisabled(),true);
});

test("quem não foi convidado não vê nenhum diário",{skip:pular},async()=>{
  const davi=await abrir("davi");
  await davi.getByText("Nenhum diário para esta conta").waitFor();
  assert.equal(await davi.locator("button[data-meal]").count(),0);
  await davi.context().close();
});

test("só o dono apaga tudo, e os outros aparelhos ficam vazios sem recarregar",{skip:pular},async()=>{
  const {ana,bia}=abertas;
  await bia.locator('button[data-tab="resumo"]').click();
  await bia.getByText("Privacidade e exclusão dos dados").click();
  await bia.getByText("Só quem criou o diário pode apagar todos os dados.").waitFor();
  await bia.locator('button[data-tab="dia"]').click();

  await ana.locator('button[data-tab="resumo"]').click();
  await ana.getByText("Privacidade e exclusão dos dados").click();
  await conectada(bia);
  await ana.locator("#erase-start").click();
  await ana.locator("#erase-word").fill("APAGAR");
  await ana.locator("#erase-confirm").click();
  await ana.getByText("Todos os dados foram apagados").waitFor();
  assert.equal((await refeicoesNoBanco()).length,0);
  await bia.locator('button[data-meal="cafe"]').filter({hasText:"Toque para registrar"}).waitFor({timeout:10000});
});
