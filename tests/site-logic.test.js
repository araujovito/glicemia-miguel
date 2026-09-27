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

test("edição concorrente é detectada pela versão do registro",()=>{
  assert.equal(L.recordChanged({atualizadoEm:20},10),true);
  assert.equal(L.recordChanged({atualizadoEm:10},10),false);
});

test("leituras do sensor são unidas sem duplicar",()=>{
  const a={min:[60,75],mg:[100,110],tipo:[0,0]};
  const b=new Map([[600,{min:60,mg:105,tipo:0}],[901,{min:90,mg:130,tipo:1}]]);
  assert.deepEqual(L.mergeSensor(a,b),{min:[60,75,90],mg:[105,110,130],tipo:[0,0,1]});
});
