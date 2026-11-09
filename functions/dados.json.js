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

  // Todas as semanas, com os números (sem os criativos, que são pesados): servem o seletor, o
  // comparativo com a anterior e o histórico semana a semana numa leitura só.
  // ponytail: ~52 linhas por ano, ~3 KB cada. Paginar se um dia passar de alguns anos.
  const todas = await ler("?select=semana_ini,semana_fim,gerado_em,dados&order=semana_ini.desc");
  if (todas.erro) return json({ erro: todas.erro }, 502);
  if (!todas.length) return json({ erro: "nenhuma semana gerada ainda" }, 404);

  const atual = pedida ? todas.find((s) => s.semana_ini === pedida) : todas[0];
  if (!atual) return json({ erro: "semana não encontrada" }, 404);
  const antes = todas.find((s) => s.semana_ini === menosSete(atual.semana_ini));

  const cri = await ler("?select=criativos&semana_ini=eq." + atual.semana_ini);
  if (cri.erro) return json({ erro: cri.erro }, 502);

  const publico = env.SUPABASE_URL + "/storage/v1/object/public/creatives/";
  const criativos = (cri[0] && cri[0].criativos) || { lista: [] };
  criativos.lista = (criativos.lista || []).map((c) => ({ ...c, imagem: c.imagem ? publico + c.imagem : null }));

  // Histórico no formato da planilha antiga do cliente: uma linha por semana, da mais antiga
  // pra mais recente. Só o que a tabela mostra; qualificados = motivo 2, 3 ou 4 (contato feito,
  // negociação, visita), a definição oficial da planilha.
  const historico = todas.slice().reverse().map((s) => ({
    semana_ini: s.semana_ini,
    semana_fim: s.semana_fim,
    marcas: s.dados.map((d) => ({
      curto: d.curto, inv: d.inv, midia: d.midia, crm: d.crm,
      qualif: d.falou + d.negoc + d.visita, vendas: d.vendas, fat: d.fat,
    })),
  }));
  const semanas = todas.map((s) => ({ semana_ini: s.semana_ini, semana_fim: s.semana_fim }));

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
    historico,
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
