# Relatório semanal · Grupo Germânica

Página única, sem build e sem dependência. Abrir `index.html` no navegador já funciona.

Semana publicada: **21 a 27 de setembro de 2026** (SEM 39).

## Antes de validar, saiba disto

- **O bloco "Leitura da semana" é texto de exemplo.** Está marcado em vermelho na página. Quem escreve é o time de mídia; nada de análise, comparação com semana anterior ou projeção sai daqui sem ser escrito e revisado por gente.
- **Os números vêm do Supabase**, do mesmo recorte da planilha semanal que o time preenche à mão: Meta, varejo + lead ad, Harley somando conversa de WhatsApp, categoria "Novos" em GWM/RAM/Kia. Se o número aqui divergir da planilha, é bug — reporta.
- **"Vendas faturadas" é outro universo.** Conta pela data do faturamento, não pela semana em que o lead entrou. Por isso uma marca aparece com mais vendas do que leads vendidos no funil: parte veio de semanas anteriores.

## Onde mexer

Tudo vive em `index.html`. Os dados da semana estão na constante `DADOS`, no topo do `<script>` — uma linha por marca. O tema está no bloco `:root` do `<style>`; trocar as cores de lá troca a página inteira.

A página checa, ao carregar, se os quatro estados do funil somam o total do CRM de cada marca. Se não somarem, ela quebra de propósito em vez de desenhar uma barra errada.

## Ainda não existe

Gerador automático (hoje os dados são colados à mão a cada semana) e controle de acesso.
