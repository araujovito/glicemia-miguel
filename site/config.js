// Banco usado quando o site roda fora do Claude.
// Com os dois campos vazios, o diário funciona só neste navegador (modo local).
// Para usar o Supabase, preencha com a URL do projeto e a chave pública (anon ou publishable).
// A chave pública pode ficar no site: quem protege os dados são as regras de acesso do banco
// (supabase/migrations). Nunca coloque aqui a chave secreta (service_role / secret).
window.DIARIO_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
