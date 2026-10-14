# Relatório semanal · Grupo Germânica

Página única, sem build e sem dependência. Abrir `index.html` no navegador já funciona.
Publicada em https://igorramal-stroke.github.io/germanica-relatorio-semanal/

## Atualizar toda segunda

1. Em `dados_semana.sql`, troque as duas datas de `params` (segunda e domingo da semana fechada).
2. Rode no SQL Editor do Supabase. Leva cerca de 1 minuto.
3. Cole o JSON devolvido no lugar do array `DADOS` em `index.html`.
4. No mesmo bloco, ajuste `SEMANA` (as mesmas datas + o dia da consulta).
5. Abra a página: se ela carregar sem erro, os números fecham (ver abaixo). Commit e push.

Datas, escala do gráfico, notas do rodapé e lista de marcas sem venda saem desse bloco.
O bloco "Leitura da semana" é texto de exemplo e continua sendo escrito pelo time.

## O que entra

- **Mídia:** só Meta. Varejo com "lead ad" no nome, campanhas "move brasil", e Harley somando
  conversa de WhatsApp.
- **CRM, 9 marcas da planilha semanal do cliente:** mesmo recorte da planilha que o time
  preenchia à mão. Se divergir dela, é bug — reporta.
- **CRM, BMW, BMW Motorrad e MINI** (desde a SEM 41, a pedido do time): só leads de campanha
  com "stroke" no nome. Essas equipes também recebem lead ad que não é nosso.
- **Fora:** Lexus (os leads das nossas campanhas não chegam ao CRM como lead ad, entram como
  "Site"; a taxa sairia 0%) e Leapmotor.

## Antes de validar

- **"Vendas faturadas" é outro universo.** Conta pela data do faturamento, não pela semana em
  que o lead entrou.
- **Os números da semana continuam se mexendo** depois que ela fecha: o vendedor segue
  atendendo e a nota entra com atraso. O rodapé carimba o dia da consulta.
- A página confere, ao carregar, se os dois eixos do funil (status e etapa) somam o total do CRM
  de cada marca. Se não somarem, ela quebra de propósito em vez de desenhar uma barra errada.

## Ainda não existe

Atualização automática (hoje alguém roda a consulta toda segunda) e controle de acesso.
