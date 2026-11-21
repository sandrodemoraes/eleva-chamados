create table if not exists fotos (
  id text primary key,
  chamado_id text not null references chamados(id) on delete cascade,
  tipo text not null default 'antes',
  imagem_base64 text not null,
  legenda text not null default '',
  latitude double precision,
  longitude double precision,
  tirada_em timestamptz not null default now(),
  criado_por text not null default '',
  criado_por_nome text not null default ''
);
create index if not exists fotos_chamado_idx on fotos (chamado_id, tirada_em);

alter table chamados add column if not exists assinatura_base64 text not null default '';
alter table chamados add column if not exists assinado_nome text not null default '';
alter table chamados add column if not exists assinado_em timestamptz;
alter table chamados add column if not exists checklist text not null default '{}';

create index if not exists chamados_cliente_idx on chamados (lower(trim(cliente)));
create index if not exists chamados_status_idx on chamados (status, criado_em desc);

create table if not exists push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  nome text not null default '',
  criado_por text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists app_config (
  chave text primary key,
  valor text not null
);
