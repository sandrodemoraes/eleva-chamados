do $$
declare
  nome text;
begin
  select con.conname into nome
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'usuarios' and con.contype = 'c'
  limit 1;
  if nome is not null then
    execute format('alter table usuarios drop constraint %I', nome);
  end if;
end $$;

alter table usuarios
  add constraint usuarios_papel_check
  check (papel in ('campo', 'escritorio', 'admin'));

update usuarios set papel = 'admin' where nome = 'Sandro de Moraes';
