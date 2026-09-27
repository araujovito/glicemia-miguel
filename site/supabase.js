/* Diário de Glicemia fora do Claude: liga o site a um projeto Supabase (Postgres) com login Google.

   Oferece ao index.html a mesma interface do banco do Claude (doc, collection, onSnapshot, set, update,
   delete) e da identidade (id, isOwner, can, profiles). Assim o resto do site não precisa saber onde os
   dados estão. Cada dia vai e volta como um objeto JSON, e as funções gravar_dia e ler_dias do banco
   (supabase/migrations) traduzem esse objeto para as tabelas refeicoes, hipos e extras.

   Os outros aparelhos ficam em dia pelo tempo real do Supabase: toda gravação atualiza a linha do dia na
   tabela `dias`, e cada aparelho recarrega o dia que mudou. */
(function(){
  "use strict";

  // Erros de permissão viram o código que o site já trata como "sem permissão para salvar".
  function erro(e){
    if(e&&(e.code==="invalid_argument"||e.code==="unavailable"))return e;
    if(e&&(e.code==="42501"||e.code==="PGRST301"||e.status===401||e.status===403))return {code:"invalid_argument",message:e.message};
    return {code:"unavailable",message:e&&e.message||String(e)};
  }
  async function rpc(c,nome,args){const {data,error}=await c.rpc(nome,args);if(error)throw erro(error);return data}
  async function tabela(consulta){const {data,error}=await consulta;if(error)throw erro(error);return data}
  function snapDoc(id,v){return {id,exists:v!=null,data:()=>v}}
  function snapCol(mapa){const docs=[...mapa].map(([id,v])=>snapDoc(id,v));return {docs,size:docs.length,empty:!docs.length}}

  function iniciar(cfg){
    if(!window.supabase||!window.supabase.createClient)throw new Error("A biblioteca do Supabase não carregou.");
    const c=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
    });
    return {
      client:c,
      async sessao(){const {data,error}=await c.auth.getSession();if(error)throw erro(error);return data.session},
      entrarComGoogle(){return c.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}})},
      async sair(){await c.auth.signOut()},
      // Aceita convites pendentes para o e-mail da conta e devolve os diários a que ela tem acesso.
      meusDiarios(){return rpc(c,"entrar",{})},
      criarDiario(nome){return rpc(c,"criar_diario",{p_nome_crianca:nome||""})},
      abrir(diario,uid){return abrir(c,diario,uid)}
    };
  }

  function abrir(c,diario,uid){
    const id=diario.diario_id, papel=diario.papel;
    let dias=new Map(), sensor=new Map(), conf={nome:"",plano:""}, apagadoEm=null;
    const ouvintes={dias:new Set(),sensor:new Set(),crianca:new Set(),plano:new Set()};
    let carga=null, canal=null;

    // Avisa o site só quando o dado mudou de fato: cada aviso redesenha a tela, e uma recarga sem novidade
    // (ao reconectar, ao voltar para a aba) não deve apagar o que a pessoa está digitando.
    // Quem começa a ouvir agora (so) recebe o estado atual de qualquer jeito.
    const ultimo={};
    function emitir(q,so){
      const atual=q==="dias"?[...dias]:q==="sensor"?[...sensor]:q==="crianca"?conf.nome:conf.plano;
      const chave=JSON.stringify(atual);
      if(!so){if(ultimo[q]===chave)return;ultimo[q]=chave}
      let s;
      if(q==="dias")s=snapCol(dias);
      else if(q==="sensor")s=snapCol(sensor);
      else if(q==="crianca")s=snapDoc("crianca",conf.nome?{nome:conf.nome}:null);
      else s=snapDoc("plano",conf.plano?{texto:conf.plano}:null);
      (so?[so]:ouvintes[q]).forEach(o=>{try{o.next(s)}catch(e){console.error(e)}});
    }
    const emitirTudo=()=>["dias","sensor","crianca","plano"].forEach(emitir);

    async function carregarTudo(){
      const [d,s,cfg]=await Promise.all([
        rpc(c,"ler_dias",{p_diario:id}),
        rpc(c,"ler_sensor",{p_diario:id}),
        tabela(c.from("diarios").select("nome_crianca,plano,apagado_em").eq("id",id).single())
      ]);
      dias=new Map(d.map(r=>[r.data,r.dia]));
      sensor=new Map(s.map(r=>[r.data,r.doc]));
      conf={nome:cfg.nome_crianca||"",plano:cfg.plano||""};apagadoEm=cfg.apagado_em;
      emitirTudo();
    }
    async function carregarDia(data){
      const r=await rpc(c,"ler_dias",{p_diario:id,p_data:data});
      if(r.length)dias.set(data,r[0].dia);else dias.delete(data);
      emitir("dias");
    }
    async function carregarSensor(){
      const s=await rpc(c,"ler_sensor",{p_diario:id});
      sensor=new Map(s.map(r=>[r.data,r.doc]));emitir("sensor");
    }

    // Mudanças vindas de outros aparelhos chegam em rajadas (uma importação do sensor, uma restauração):
    // junta tudo por um instante e recarrega só o necessário.
    let pendentes=new Set(), timer=null;
    function agendar(o){
      pendentes.add(o);clearTimeout(timer);
      timer=setTimeout(async()=>{
        const p=pendentes;pendentes=new Set();
        const diasP=[...p].filter(x=>x.startsWith("dia:")).map(x=>x.slice(4));
        try{
          if(p.has("tudo")||diasP.length>10)await carregarTudo();
          else{
            for(const d of diasP)await carregarDia(d);
            if(p.has("sensor"))await carregarSensor();
          }
        }catch(e){console.warn("Não foi possível atualizar com as mudanças de outro aparelho",e)}
      },250);
    }
    function ligarTempoReal(){
      const f=(tabelaNome,coluna)=>({event:"*",schema:"public",table:tabelaNome,filter:coluna+"=eq."+id});
      canal=c.channel("diario-"+id)
        .on("postgres_changes",f("dias","diario_id"),p=>{const d=(p.new&&p.new.data)||(p.old&&p.old.data);agendar(d?"dia:"+d:"tudo")})
        .on("postgres_changes",f("sensor_dias","diario_id"),()=>agendar("sensor"))
        .on("postgres_changes",f("diarios","id"),p=>{
          const n=p.new||{};
          if(n.apagado_em&&n.apagado_em!==apagadoEm){agendar("tudo");return}
          if(typeof n.nome_crianca==="string"&&n.nome_crianca!==conf.nome){conf.nome=n.nome_crianca;emitir("crianca")}
          if(typeof n.plano==="string"&&n.plano!==conf.plano){conf.plano=n.plano;emitir("plano")}
        })
        // Toda vez que a conexão fica pronta, recarrega tudo: na primeira vez, cobre o que mudou entre a carga
        // inicial e a conexão; depois, o que se perdeu enquanto o celular esteve fora do ar (eventos não são reenviados).
        .subscribe(status=>{
          window.DiarioSupabase.tempoReal=status;   // "SUBSCRIBED" quando conectado; usado nos testes
          if(status==="SUBSCRIBED")agendar("tudo");
        });
      // Celular bloqueado ou aba em segundo plano podem perder eventos sem desconectar: ao voltar, recarrega.
      document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")agendar("tudo")});
    }
    function garantirCarga(){
      if(!carga)carga=carregarTudo().then(()=>{if(!canal)ligarTempoReal()},e=>{carga=null;throw e});
      return carga;
    }
    function ouvir(q,next,falha){
      const o={next};ouvintes[q].add(o);
      garantirCarga().then(()=>emitir(q,o),e=>{if(falha)falha(erro(e))});
      return ()=>ouvintes[q].delete(o);
    }

    async function atualizarDiario(campos){
      const r=await tabela(c.from("diarios").update(campos).eq("id",id).select("id"));
      if(!r.length)throw {code:"invalid_argument"};   // a política recusou em silêncio: sem permissão
    }
    function docConfig(q,coluna,campo){
      const salvar=async v=>{await atualizarDiario({[coluna]:v});conf[q==="crianca"?"nome":"plano"]=v;emitir(q)};
      return {
        set:v=>salvar((v&&v[campo])||""),
        delete:()=>salvar(""),
        onSnapshot:(next,falha)=>ouvir(q,next,falha)
      };
    }

    const db={
      doc(caminho){
        const [col,chave]=caminho.split("/");
        if(col==="dias")return {
          id:chave,
          // update: grava só os registros enviados (os outros do dia ficam). set: o dia passa a ser exatamente este.
          async update(delta){await rpc(c,"gravar_dia",{p_diario:id,p_data:chave,p_dia:delta,p_substituir:false});await carregarDia(chave)},
          async set(corpo){await rpc(c,"gravar_dia",{p_diario:id,p_data:chave,p_dia:corpo,p_substituir:true});await carregarDia(chave)},
          async delete(){await rpc(c,"gravar_dia",{p_diario:id,p_data:chave,p_dia:{},p_substituir:true});await carregarDia(chave)}
        };
        if(col==="sensor")return {
          id:chave,
          async set(d){await rpc(c,"gravar_sensor",{p_diario:id,p_data:chave,p_doc:d});sensor.set(chave,Object.assign({},d,{data:chave}));emitir("sensor")},
          async delete(){await tabela(c.from("sensor_dias").delete().eq("diario_id",id).eq("data",chave));sensor.delete(chave);emitir("sensor")}
        };
        if(caminho==="config/crianca")return docConfig("crianca","nome_crianca","nome");
        if(caminho==="config/plano")return docConfig("plano","plano","texto");
        throw new Error("Caminho desconhecido no banco: "+caminho);
      },
      collection(nome){
        if(nome!=="dias"&&nome!=="sensor")throw new Error("Coleção desconhecida no banco: "+nome);
        return {onSnapshot:(next,falha)=>ouvir(nome,next,falha)};
      },
      // "Apagar todos os dados" numa chamada só; o banco confere que quem pede é o dono.
      async apagarTudo(){
        await rpc(c,"apagar_tudo",{p_diario:id});
        dias=new Map();sensor=new Map();conf={nome:"",plano:""};emitirTudo();
      }
    };

    // Nomes para "anotado por": vêm da lista de membros do diário (nome da conta Google).
    let perfis=null;
    async function carregarPerfis(){
      const ms=await tabela(c.from("membros").select("user_id,nome,email").eq("diario_id",id));
      perfis=new Map(ms.map(m=>[m.user_id,m.nome||m.email.split("@")[0]]));
    }
    const user={
      id:async()=>uid,
      isOwner:async()=>papel==="dono",
      can:async p=>p==="data.write"?(papel==="dono"||papel==="cuidador"):null,
      async profiles(ids){
        ids=[].concat(ids);
        if(!perfis||ids.some(i=>!perfis.has(i)))await carregarPerfis().catch(()=>{perfis=perfis||new Map()});
        return Object.fromEntries(ids.map(i=>[i,perfis.has(i)?{id:i,name:perfis.get(i),isMe:i===uid}:null]));
      }
    };

    // Quem tem acesso e convites. Só o dono vê os convites, convida e remove (o banco garante isso).
    const acesso={
      papel,
      async listar(){
        const membros=await tabela(c.from("membros").select("user_id,nome,email,papel").eq("diario_id",id).order("entrou_em"));
        const convites=papel==="dono"?await tabela(c.from("convites").select("email,papel").eq("diario_id",id).order("criado_em")):[];
        perfis=new Map(membros.map(m=>[m.user_id,m.nome||m.email.split("@")[0]]));
        return {membros:membros.map(m=>Object.assign({eu:m.user_id===uid},m)),convites};
      },
      async convidar(email,papelNovo){
        await tabela(c.from("convites").upsert({diario_id:id,email:String(email).trim().toLowerCase(),papel:papelNovo,convidado_por:uid}));
      },
      async cancelarConvite(email){await tabela(c.from("convites").delete().eq("diario_id",id).eq("email",email))},
      async remover(userId){
        const r=await tabela(c.from("membros").delete().eq("diario_id",id).eq("user_id",userId).select("user_id"));
        if(!r.length)throw {code:"invalid_argument"};
      }
    };

    return {db,user,acesso};
  }

  window.DiarioSupabase={iniciar,tempoReal:null};
})();
