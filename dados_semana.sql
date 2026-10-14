-- Gera o array DADOS do index.html para uma semana (segunda a domingo).
--
-- Uso: troque as duas datas em `params`, rode no SQL Editor do Supabase e cole o JSON devolvido
-- no lugar do array DADOS. Depois ajuste o objeto SEMANA no index.html (mesmas datas + dia da
-- consulta). JSON é JS válido, cola direto.
--
-- Leva por volta de 1 minuto. Pelo conector MCP costuma estourar o limite de 60s do cliente: aí
-- rode os CTEs `midia`, `crm` e `vendas` como consultas separadas, uma de cada vez, e cancele
-- (pg_cancel_backend) o que ficar rodando órfão antes de disparar a próxima.
--
-- Lê as tabelas/views de origem direto, sem matview: não grava nada no banco.
--
-- MARCAS
--   As 9 da planilha semanal do cliente seguem a régua dela (crm_germanica_lead_relatorio, ver
--   power law/sql/2026-08-24-crm-funil-germanica.sql): varejo + canal lead_ad, Harley soma
--   WhatsApp, GWM/RAM/Kia só categoria "Novos". Reproduzida aqui, ver o CTE `lead`.
--
--   BMW, BMW Motorrad e MINI entraram a pedido do time em 14/10, quando a Stroke começou a rodar
--   lead ad de varejo nelas. A classificação do CRM deixa a marca delas NULA, então a marca sai da
--   `equipe`. E só contam leads de campanha com "stroke" no nome: essas equipes também recebem
--   lead ad que NÃO é nosso (campanhas "[Leads][Formulário] Oferta mês", 149 leads no Motorrad e
--   72 na BMW na SEM 41). Sem esse filtro a chegada ao CRM dava 250%.
--
--   Lexus fica FORA: nenhum lead das nossas campanhas chega ao CRM como lead ad (entram como
--   "Site"), então a taxa sairia 0% por problema de integração, não de atendimento.
--   Leapmotor fica fora: o time não pediu, e o CRM mostra 60 leads "stroke" contra 35 na mídia.
--
-- Dois eixos por marca, cada um somando `crm` (o index.html confere ao carregar):
--   status: agend/pend/perd/vend
--   etapa:  nada/tent/falou/negoc/visita  (ponto MAIS AVANÇADO do motivo do agendamento)
-- `vendas`/`fat` contam pela data de faturamento, não pela semana de entrada do lead.

set local statement_timeout = '240s';

with params as (
  select date '2026-10-05' as ini, date '2026-10-11' as fim
),
nomes(marca, curto, brand) as (values
  ('GWM Germânica',             'GWM',             'GWM'),
  ('Omoda Jaecoo Germânica',    'Omoda Jaecoo',    'Omoda Jaecoo'),
  ('Germânica Volkswagen',      'Volkswagen',      'Volkswagen'),
  ('Toyota Nipônica',           'Toyota Nipônica', null),
  ('Jeep Germânica',            'Jeep',            'Jeep'),
  ('Germânica Kia',             'Kia',             'Kia'),
  ('Germânica RAM',             'RAM',             'RAM'),
  ('Escandinávia Volvo',        'Volvo',           'Volvo'),
  ('Tennessee Harley-Davidson', 'Harley-Davidson', 'Harley-Davidson'),
  ('Germânica BMW',             'BMW',             'BMW'),
  ('Germânica BMW Motorrad',    'BMW Motorrad',    'BMW Motorrad'),
  ('Germânica MINI',            'MINI',            'MINI')
),
midia as (
  select coalesce(n.marca, case when a.brand is null and a.account_name ilike '%toyota%' then 'Toyota Nipônica' end) as marca,
         sum(d.spend) as inv,
         sum(d.leads + case when a.brand = 'Harley-Davidson' then coalesce(d.conversas, 0) else 0 end) as midia
  from daily_metrics d
  join ad_accounts a on a.id = d.ad_account_id
  join clients c on c.id = a.client_id and c.slug = 'germanica'
  left join nomes n on n.brand = a.brand
  cross join params p
  where a.platform = 'meta'
    and d.date between p.ini and p.fim
    and ((d.business_type = 'varejo' and d.campaign_name ilike '%lead ad%')
         or d.campaign_name ilike '%move brasil%'
         or (a.brand = 'Harley-Davidson' and d.business_type = 'varejo'))
  group by 1
),
-- Um lead por linha, atributos do evento mais recente. Uma varredura só dos eventos (~1 GB de
-- jsonb): passar pela view e juntar a etapa por fora varre duas vezes e estoura os 60s do MCP.
-- Conferido em 14/10: mesmo crm por marca que crm_germanica_lead_relatorio nas 9 marcas antigas.
-- Se a view mudar de filtro, este bloco tem que mudar junto.
lead as (
  select coalesce(marca, case when equipe ilike '%motorrad%' then 'Germânica BMW Motorrad'
                              when equipe ilike '%bmw%'      then 'Germânica BMW'
                              when equipe ilike '%mini%'     then 'Germânica MINI' end) as marca_rel,
         *
  from (
    select c.marca, c.equipe, c.frente, c.canal, c.categoria, c.campanha, c.status as status_atual,
           max(c.lead_criado_em) over w as lead_criado_em,
           bool_or(c.m = 'tentativa de contato')       over w as tentou,
           bool_or(c.m = 'primeiro contato realizado') over w as falou,
           bool_or(c.m = 'em negociação')              over w as negociou,
           bool_or(c.m = 'visita showroom')            over w as visitou,
           max(case when c.venda_realizada then c.venda_faturada_em end) over w as venda_faturada_em,
           max(case when c.venda_realizada then c.venda_valor end)       over w as venda_valor,
           row_number() over (partition by c.lead_id order by c.received_at desc) as rn
    from (select *, lower(regexp_replace(coalesce(motivo, ''), '^\s*\d+\s*-\s*', '')) as m
          from crm_germanica_classificado) c
    window w as (partition by c.lead_id)
  ) t
  where rn = 1 and frente = 'varejo'
    and (
      -- as 9 marcas da planilha: régua de crm_germanica_lead_relatorio
      (marca is not null
       and (canal = 'lead_ad' or (canal = 'whatsapp' and marca = 'Tennessee Harley-Davidson'))
       and (marca not in ('GWM Germânica', 'Germânica RAM', 'Germânica Kia') or categoria ilike 'novos'))
      or
      -- BMW, Motorrad, MINI: marca pela equipe, só campanha nossa
      (marca is null and campanha ilike '%stroke%'
       and (equipe ilike '%motorrad%' or equipe ilike '%bmw%' or equipe ilike '%mini%'))
    )
),
crm as (
  select marca_rel as marca,
         count(*) as crm,
         count(*) filter (where status_atual = 'scheduled')          as agend,
         count(*) filter (where status_atual = 'pending')            as pend,
         count(*) filter (where status_atual = 'sale_not_performed') as perd,
         count(*) filter (where status_atual = 'sale_performed')     as vend,
         count(*) filter (where not (tentou or falou or negociou or visitou))   as nada,
         count(*) filter (where tentou and not (falou or negociou or visitou))  as tent,
         count(*) filter (where falou and not (negociou or visitou))            as falou,
         count(*) filter (where negociou and not visitou)                       as negoc,
         count(*) filter (where visitou)                                        as visita
  from lead, params p
  where lead_criado_em::date between p.ini and p.fim
  group by 1
),
vendas as (
  select marca_rel as marca, count(*) as vendas, coalesce(sum(venda_valor), 0) as fat
  from lead, params p
  where venda_faturada_em::date between p.ini and p.fim
  group by 1
)
select jsonb_pretty(jsonb_agg(jsonb_build_object(
         'marca', n.marca, 'curto', n.curto,
         'inv', round(coalesce(m.inv, 0)::numeric, 2), 'midia', coalesce(m.midia, 0),
         'crm', coalesce(c.crm, 0),
         'agend', coalesce(c.agend, 0), 'pend', coalesce(c.pend, 0),
         'perd', coalesce(c.perd, 0), 'vend', coalesce(c.vend, 0),
         'nada', coalesce(c.nada, 0), 'tent', coalesce(c.tent, 0), 'falou', coalesce(c.falou, 0),
         'negoc', coalesce(c.negoc, 0), 'visita', coalesce(c.visita, 0),
         'vendas', coalesce(v.vendas, 0), 'fat', round(coalesce(v.fat, 0)::numeric, 2)
       ) order by coalesce(m.inv, 0) desc)) as dados
from nomes n
left join midia  m on m.marca = n.marca
left join crm    c on c.marca = n.marca
left join vendas v on v.marca = n.marca;
