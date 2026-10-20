// GET /dados.json[?semana=AAAA-MM-DD] → uma semana de relatorio_germanica_semanal.
//
// Sem parâmetro: a semana mais recente. Com `semana` (segunda-feira): aquela semana.
// Devolve também a semana anterior (comparativo da página) e a lista de semanas disponíveis
// (seletor). As imagens dos criativos saem do bucket público `creatives`; o banco guarda só o
// caminho e a URL é montada aqui.
//
// A tabela só abre pra service_role (RLS sem policy, anon revogado): a chave anon é pública e
// isto é número de negócio do cliente. Esta função é a única porta. Se um dia a página precisar
// de senha ou token, é aqui que entra, sem mexer no banco.
//
// Quem grava a tabela: relatorio_germanica_gerar(), chamada toda segunda pelo Apps Script da
// planilha semanal (power law/sql/2026-10-20-relatorio-germanica-criativos.sql, repo da Stroke).
//
// Secrets do projeto no Cloudflare (Settings > Variables and Secrets), mesmos nomes do Apps Script:
//   SUPABASE_URL               https://<projeto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service role (secret, nunca em arquivo)

export async function onRequestGet({ env, request }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ erro: "configuração ausente" }, 500);
  }

  const pedida = new URL(request.url).searchParams.get("semana");
  if (pedida && !/^\d{4}-\d{2}-\d{2}$/.test(pedida)) return json({ erro: "semana inválida" }, 400);

  const base = env.SUPABASE_URL + "/rest/v1/relatorio_germanica_semanal";
  const ler = (consulta) => buscar(base + consulta, env.SUPABASE_SERVICE_ROLE_KEY);

  // ponytail: a lista inteira de semanas a cada acesso; ~52 linhas pequenas por ano. Paginar se
  // um dia passar de alguns anos de histórico.
  const semanas = await ler("?select=semana_ini,semana_fim&order=semana_ini.desc");
  if (semanas.erro) return json({ erro: semanas.erro }, 502);
  if (!semanas.length) return json({ erro: "nenhuma semana gerada ainda" }, 404);

  const alvo = pedida ? semanas.find((s) => s.semana_ini === pedida) : semanas[0];
  if (!alvo) return json({ erro: "semana não encontrada" }, 404);
  const anterior = menosSete(alvo.semana_ini);

  const linhas = await ler("?select=semana_ini,semana_fim,gerado_em,dados,criativos"
    + "&semana_ini=in.(" + alvo.semana_ini + "," + anterior + ")");
  if (linhas.erro) return json({ erro: linhas.erro }, 502);

  const atual = linhas.find((l) => l.semana_ini === alvo.semana_ini);
  const antes = linhas.find((l) => l.semana_ini === anterior);
  if (!atual) return json({ erro: "semana não encontrada" }, 404);

  const publico = env.SUPABASE_URL + "/storage/v1/object/public/creatives/";
  const criativos = atual.criativos || { lista: [] };
  criativos.lista = (criativos.lista || []).map((c) => ({ ...c, imagem: c.imagem ? publico + c.imagem : null }));

  // 5 min: a tabela muda uma vez por semana, mas não deixa o navegador segurar dado velho por
  // horas depois de uma regeração manual.
  return json({
    semana_ini: atual.semana_ini,
    semana_fim: atual.semana_fim,
    gerado_em: atual.gerado_em,
    dados: atual.dados,
    criativos,
    anterior: antes ? { semana_ini: antes.semana_ini, dados: antes.dados } : null,
    semanas,
  }, 200, "public, max-age=300");
}

// Devolve o JSON ou {erro}. O corpo de erro do Supabase não vai pra página pública: pode citar
// tabela, coluna, policy.
async function buscar(url, chave) {
  let r;
  try {
    r = await fetch(url, { headers: { apikey: chave, Authorization: "Bearer " + chave } });
  } catch {
    // Supabase fora do ar: sem isto o Cloudflare devolve página HTML de erro e a página quebra
    // tentando ler JSON, em vez de mostrar o aviso.
    return { erro: "fonte de dados fora do ar" };
  }
  if (!r.ok) return { erro: "fonte de dados indisponível (" + r.status + ")" };
  try {
    return await r.json();
  } catch {
    // 200 com HTML (gateway/proxy no meio do caminho): aviso limpo em vez de "Unexpected token <".
    return { erro: "resposta inválida da fonte de dados" };
  }
}

// "2026-10-12" → "2026-10-05". Meio-dia UTC pra não escorregar de dia em nenhum fuso.
function menosSete(iso) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
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
