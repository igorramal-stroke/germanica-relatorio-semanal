// GET /dados.json → a semana mais recente de relatorio_germanica_semanal.
//
// A tabela só abre pra service_role (RLS sem policy, anon revogado): a chave anon é pública e
// isto é número de negócio do cliente. Esta função é a única porta. Se um dia a página precisar
// de senha ou token, é aqui que entra, sem mexer no banco.
//
// Quem grava a tabela: relatorio_germanica_gerar(), chamada toda segunda pelo Apps Script da
// planilha semanal (power law/sql/2026-10-14-relatorio-germanica-semanal.sql).
//
// Secrets do projeto no Cloudflare (Settings > Variables and Secrets), mesmos nomes do Apps Script:
//   SUPABASE_URL               https://<projeto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service role (secret, nunca em arquivo)

export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ erro: "configuração ausente" }, 500);
  }

  const url = env.SUPABASE_URL + "/rest/v1/relatorio_germanica_semanal"
    + "?select=semana_ini,semana_fim,gerado_em,dados&order=semana_ini.desc&limit=1";
  let r;
  try {
    r = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  } catch {
    // Supabase fora do ar: sem isto o Cloudflare devolve página HTML de erro e a página quebra
    // tentando ler JSON, em vez de mostrar o aviso.
    return json({ erro: "fonte de dados fora do ar" }, 502);
  }

  // O corpo de erro do Supabase não vai pra página pública: pode citar tabela, coluna, policy.
  if (!r.ok) return json({ erro: "fonte de dados indisponível (" + r.status + ")" }, 502);

  let linhas;
  try {
    linhas = await r.json();
  } catch {
    // 200 com HTML (gateway/proxy no meio do caminho): aviso limpo em vez de "Unexpected token <".
    return json({ erro: "resposta inválida da fonte de dados" }, 502);
  }
  const [semana] = linhas;
  if (!semana) return json({ erro: "nenhuma semana gerada ainda" }, 404);

  // 5 min: a tabela muda uma vez por semana, mas não deixa o navegador segurar dado velho por
  // horas depois de uma regeração manual.
  return json(semana, 200, "public, max-age=300");
}

function json(corpo, status, cache) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache || "no-store",
    },
  });
}
