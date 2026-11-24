alter table usuarios add column if not exists sessao_versao integer not null default 1;

create table if not exists limites (
  chave text primary key,
  contagem integer not null,
  zera_em bigint not null
);
