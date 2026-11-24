create table if not exists usuarios (
  id text primary key,
  nome text not null unique,
  senha_hash text not null default '',
  papel text not null check (papel in ('campo', 'escritorio'))
);

insert into usuarios (id, nome, papel) values
  ('sandro-de-moraes', 'Sandro de Moraes', 'campo'),
  ('fabio-nuernberg', 'Fabio Nuernberg', 'campo'),
  ('crhistian', 'Crhistian', 'campo'),
  ('ramalho', 'Ramalho', 'campo'),
  ('joares', 'Joares', 'campo'),
  ('kassandra-oliveira-coelho', 'Kassandra Oliveira Coelho', 'campo'),
  ('bruna-de-moraes', 'Bruna de Moraes', 'escritorio'),
  ('sandra-beatris-de-moraes', 'Sandra Beatris de Moraes', 'escritorio'),
  ('bianca-de-moraes', 'Bianca de Moraes', 'escritorio')
on conflict (nome) do nothing;
