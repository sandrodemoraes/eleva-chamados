create table if not exists produtos (
  id text primary key,
  chamado_id text not null references chamados(id) on delete cascade,
  texto text not null default '',
  imagem_base64 text not null default '',
  criado_em timestamptz not null default now(),
  criado_por text not null default '',
  criado_por_nome text not null default ''
);
create index if not exists produtos_chamado_idx on produtos (chamado_id, criado_em);
