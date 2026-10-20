# Relatório semanal · Grupo Germânica

Página que o cliente abre toda segunda: mídia Meta × CRM, marca a marca.
Cloudflare Pages, conta da empresa, projeto `relatorio-germanica`.

```
public/                   o que vai pro ar (index.html + logo). Só esta pasta é publicada.
functions/dados.json.js   /dados.json: lê a semana mais recente no Supabase com a service role
```

O repositório no GitHub é só o código. O site não é servido de lá.

## Como se atualiza sozinho

1. **Segunda, 06:30 de Brasília** — o pg_cron do próprio Supabase (job `relatorio_germanica_semanal`)
   chama `relatorio_germanica_gerar()`. Não depende de máquina, conta Google nem Apps Script.
2. A função calcula a última semana fechada e grava uma linha em `relatorio_germanica_semanal`.
   Ela se recusa a gravar semana sem lead nenhum (coleta parada), semana em andamento ou semana
   em que os eixos do funil não fecham o total do CRM. Falha fica em `cron.job_run_details`.
3. A página busca `/dados.json`, que devolve a linha mais recente. Não precisa publicar de novo:
   muda o dado, a página é a mesma.

SQL: `power law/sql/2026-10-14-relatorio-germanica-semanal.sql` (tabela) e
`power law/sql/2026-10-20-relatorio-germanica-criativos.sql` (função atual, criativos, agendamento), no repo da Stroke.

**Regerar uma semana na mão** (corrigiu dado, entrou venda atrasada), no SQL Editor do Supabase:

```sql
select relatorio_germanica_gerar('2026-10-12');   -- segunda da semana; só semana já fechada
```

Leva cerca de 1 minuto. Sobrescreve a semana com o número do momento.

## Publicar mudança na página (só quando o código muda, não toda semana)

De dentro de `relatorio-germanica/` (a pasta `functions/` tem que estar onde o comando roda):

```bash
npx wrangler pages deploy public --project-name relatorio-germanica --branch main
```

Secrets do projeto no Cloudflare (Settings > Variables and Secrets): `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`. Nunca em arquivo. Secret novo só vale a partir do próximo deploy.

Teste local: configurações `relatorio-germanica-mock` + `relatorio-germanica` no
`.claude/launch.json` (Supabase falso respondendo uma semana fixa).

## O que entra

- **Mídia:** só Meta. Varejo com "lead ad" no nome, campanhas "move brasil", e Harley somando
  conversa de WhatsApp.
- **CRM, 9 marcas da planilha semanal do cliente:** mesmo recorte da planilha que o time
  preenchia à mão. Se divergir dela, é bug.
- **CRM, BMW, BMW Motorrad e MINI** (desde a SEM 41, a pedido do time): só leads de campanha
  com "stroke" no nome. Essas equipes também recebem lead ad que não é nosso.
- **Fora:** Lexus (os leads das nossas campanhas não chegam ao CRM como lead ad, entram como
  "Site"; a taxa sairia 0%), Leapmotor, e Baic até ter campanha.

## Antes de validar

- **"Vendas faturadas" é outro universo.** Conta pela data do faturamento, não pela semana em
  que o lead entrou.
- **Os números da semana continuam se mexendo** depois que ela fecha. A página mostra a foto de
  segunda de manhã; o rodapé carimba quando foi gerada.
- A página confere, ao carregar, se os dois eixos do funil (status e etapa) somam o total do CRM
  de cada marca. Se não somarem, ela quebra de propósito em vez de desenhar uma barra errada.
- O bloco "Leitura da semana" está escondido: é texto de exemplo até o time escrever.

## Ainda não existe

Controle de acesso (a página é pública pra quem tiver o link) e domínio próprio (o DNS do
stroke.ag fica na Dyn, fora do Cloudflare: precisa de um CNAME criado por quem cuida do DNS).
