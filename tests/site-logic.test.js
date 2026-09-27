"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const L=require("../site/logic.js");

test("números aceitam vírgula e preservam zero",()=>{
  assert.equal(L.parseNum("4,5"),4.5);
  assert.equal(L.parseNum("0"),0);
  assert.equal(L.parseNum(""),null);
  assert.ok(Number.isNaN(L.parseNum("quatro")));
});

test("percentis e desvio usam as definições esperadas",()=>{
  assert.equal(L.percentil([100,120,140,160],.5),130);
  assert.deepEqual(L.distrib([100,120,140,160]),{n:4,min:100,p25:115,med:130,p75:145,max:160});
  assert.equal(Math.round(L.desvio([100,120,140,160])*100)/100,25.82);
});

test("comparação de alimentos ignora acentos e plurais simples",()=>{
  assert.deepEqual([...L.palavras("Pães com ovos")].sort(),["ovo","pao"]);
});

test("horário explícito vira instante local do dia correto",()=>{
  const t=L.isoTime("2026-09-27","08:15");
  const d=new Date(t);
  assert.equal(d.getFullYear(),2026);assert.equal(d.getMonth(),8);assert.equal(d.getDate(),27);
  assert.equal(d.getHours(),8);assert.equal(d.getMinutes(),15);
});

test("lembrete de duas horas usa o início da refeição",()=>{
  const due=L.reminderDue("2026-09-27",{refeicaoHora:"12:00",antesEm:L.isoTime("2026-09-27","11:30")});
  const d=new Date(due);
  assert.equal(d.getHours(),14);assert.equal(d.getMinutes(),0);
});

test("lembrete antigo continua usando a medição anterior como alternativa",()=>{
  const before=L.isoTime("2026-09-27","11:30");
  assert.equal(L.reminderDue("2026-09-27",{antesEm:before}),before+2*3600e3);
});

test("edição concorrente é detectada pela versão do registro",()=>{
  assert.equal(L.recordChanged({atualizadoEm:20},10),true);
  assert.equal(L.recordChanged({atualizadoEm:10},10),false);
  assert.equal(L.recordChanged(null,10),true);
  assert.equal(L.recordChanged(null,0),false);
  assert.equal(L.recordChanged({atualizadoEm:5},10),true);
});

test("salvamento otimista mantém a alteração quando funciona",async()=>{
  let value="antigo";
  await L.optimisticCommit(()=>{value="novo"},()=>{value="antigo"},async()=>{});
  assert.equal(value,"novo");
});

test("salvamento otimista restaura o estado quando falha",async()=>{
  let value="antigo";
  await assert.rejects(
    L.optimisticCommit(()=>{value="novo"},()=>{value="antigo"},async()=>{throw new Error("sem rede")}),
    /sem rede/
  );
  assert.equal(value,"antigo");
});

test("restauração combina registros do mesmo dia sem apagar os atuais",()=>{
  const atual={data:"2026-09-27",atualizadoEm:200,refeicoes:{almoco:{comeu:"arroz",atualizadoEm:200}},hipos:{},extras:{}};
  const copia={data:"2026-09-27",atualizadoEm:300,refeicoes:{janta:{comeu:"sopa",atualizadoEm:300}},hipos:{},extras:{}};
  const result=L.mergeDayRecords(atual,copia);
  assert.equal(result.refeicoes.almoco.comeu,"arroz");
  assert.equal(result.refeicoes.janta.comeu,"sopa");
});

test("restauração conserva a versão mais recente de cada registro",()=>{
  const atual={atualizadoEm:300,refeicoes:{almoco:{comeu:"atual",atualizadoEm:300}}};
  const copia={atualizadoEm:200,refeicoes:{almoco:{comeu:"antigo",atualizadoEm:200}}};
  assert.equal(L.mergeDayRecords(atual,copia).refeicoes.almoco.comeu,"atual");
});

test("campos apagados são enviados como nulos na sincronização",()=>{
  const previous={antes:100,carbo:45,obs:"comeu tudo",fotos:["foto-1"]};
  const next={antes:105};
  assert.deepEqual(L.withClearedFields(previous,next),{antes:105,carbo:null,obs:null,fotos:null});
});

test("leituras do sensor são unidas sem duplicar",()=>{
  const a={min:[60,75],mg:[100,110],tipo:[0,0]};
  const b=new Map([[600,{min:60,mg:105,tipo:0}],[901,{min:90,mg:130,tipo:1}]]);
  assert.deepEqual(L.mergeSensor(a,b),{min:[60,75,90],mg:[105,110,130],tipo:[0,0,1]});
});
