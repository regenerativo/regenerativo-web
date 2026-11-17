-- Correos por encargo: solo los que tienen a alguien de afuera (no los internos de regenerativo ni del dominio de Microsoft)
update public.clientes set email = email || ', yherreno@atica.co' where nombre = 'Yonathan Herreño Duarte' and email not ilike '%yherreno@atica.co%';
create or replace function public.correo_externo() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.de, '') ~* '(@regenerativo\.co|\.onmicrosoft\.com)>?$'
     and not exists (select 1 from regexp_split_to_table(coalesce(new.para, ''), ',\s*') a where a <> '' and a !~* '(@regenerativo\.co|\.onmicrosoft\.com)$') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists t_correo_externo on public.correos_encargo;
create trigger t_correo_externo before insert on public.correos_encargo for each row execute function public.correo_externo();
revoke execute on function public.correo_externo() from public, anon, authenticated;
