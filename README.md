# Relatório semanal · Grupo Germânica

Página que o cliente abre toda segunda: mídia Meta × CRM, marca a marca. Cloudflare Pages
(conta da empresa) + uma Pages Function que lê o Supabase.

```
public/            o que vai pro ar (index.html + logo). Só esta pasta é publicada.
functions/api/     /api/dados: lê a semana mais recente com a service role
```

## Como se atualiza sozinho

1. **Segunda, 6h** — o acionador do Apps Script da planilha semanal
   (`docs/apps-script/germanica-planilha-semanal.gs`, função `preencherSemanaPassada`) preenche
   a planilha e chama `relatorio_germanica_gerar()` no Supabase.
2. A função calcula a última semana fechada e grava uma linha em `relatorio_germanica_semanal`.
   Ela se recusa a gravar semana sem lead nenhum (coleta parada) ou em que os eixos do funil
   não fecham o total do CRM; aí o acionador falha e o Google manda e-mail.
3. A página chama `/api/dados`, que devolve a linha mais recente. Não precisa publicar de novo:
   muda o dado, a página é a mesma.

SQL da tabela e da função: `power law/sql/2026-10-14-relatorio-germanica-semanal.sql`.

**Regerar uma semana na mão** (corrigiu dado, entrou venda atrasada), no SQL Editor:

```sql
select relatorio_germanica_gerar('2026-10-05');   -- segunda da semana
```

Leva cerca de 1 minuto. Sobrescreve a semana com o número do momento.

## Publicar mudança na página (não é toda semana, só quando o código muda)

```bash
npx wrangler pages deploy public --project-name germanica-relatorio-semanal --branch main
```

Rodar de dentro de `relatorio-germanica/`: a pasta `functions/` tem que estar onde o comando roda.
Secrets do projeto no Cloudflare (Settings > Variables and Secrets): `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`. Nunca em arquivo.

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
  "Site"; a taxa sairia 0%) e Leapmotor.

## Antes de validar

- **"Vendas faturadas" é outro universo.** Conta pela data do faturamento, não pela semana em
  que o lead entrou.
- **Os números da semana continuam se mexendo** depois que ela fecha. A página mostra a foto de
  segunda de manhã; o rodapé carimba quando foi gerada.
- A página confere, ao carregar, se os dois eixos do funil (status e etapa) somam o total do CRM
  de cada marca. Se não somarem, ela quebra de propósito em vez de desenhar uma barra errada.
- O bloco "Leitura da semana" é texto de exemplo.

## Ainda não existe

Controle de acesso: a página é pública pra quem tiver o link.
