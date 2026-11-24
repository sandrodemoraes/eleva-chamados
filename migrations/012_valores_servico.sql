alter table chamados add column if not exists valor_minimo numeric(12,2) not null default 150;
alter table chamados add column if not exists horas_extra numeric(8,2);
alter table chamados add column if not exists valores_hora text not null default '{}';
alter table chamados add column if not exists deslocamento boolean not null default false;
alter table chamados add column if not exists deslocamento_km numeric(8,1);
alter table chamados add column if not exists deslocamento_valor numeric(12,2);
