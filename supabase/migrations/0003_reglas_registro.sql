-- 0003 · Reglas del registro de avance en la base de datos (robustecimiento, 27-11-2026).
--
-- Tercera capa de validación: la base rechaza lo que no cumpla, aunque alguien se salte la app.
-- Son las mismas reglas de src/lib/reglas.ts (navegador) y de repositorio.ts (antes de guardar).
-- Si se cambia un número aquí, se cambia también allá.
--
--   · Descripción: de 5 a 500 caracteres si hubo trabajos, contados sin los espacios del inicio y del final.
--   · Sin actividad: no lleva descripción.
--   · GPS: las dos coordenadas o ninguna, y dentro de rango (latitud −90 a 90, longitud −180 a 180).
--   · Hora del registro: no más de 10 minutos en el futuro (tolerancia para un reloj de teléfono adelantado).
--   · Fotos: máximo 10 por registro de avance (las alertas no tienen tope).
--
-- Se puede ejecutar más de una vez sin error. Solo agrega: no borra ni cambia datos. Los CHECK van con NOT VALID, así que se aplican a lo que se
-- inserte o modifique desde ahora y no hacen fallar la migración por registros antiguos.
-- La hora y el máximo de fotos dependen del momento actual o de otras filas, por eso son triggers
-- y no CHECK.

-- Descripción (largo en caracteres, como lo ve la persona) -------------------------------------------
alter table public.registro drop constraint if exists registro_descripcion_largo;
alter table public.registro
  add constraint registro_descripcion_largo check (
    (sin_actividad and btrim(descripcion) = '')
    or (not sin_actividad and char_length(btrim(descripcion)) between 5 and 500)
  ) not valid;

-- GPS: las dos coordenadas o ninguna, dentro de rango -------------------------------------------------
alter table public.registro drop constraint if exists registro_gps_rango;
alter table public.registro
  add constraint registro_gps_rango check (
    (latitud is null and longitud is null)
    or (latitud is not null and longitud is not null
        and latitud between -90 and 90 and longitud between -180 and 180)
  ) not valid;

-- Hora del registro: no más de 10 minutos en el futuro -----------------------------------------------
create or replace function public.validar_hora_registro() returns trigger
language plpgsql as $$
begin
  if new.registrado_en > now() + interval '10 minutes' then
    raise exception 'La hora del registro (%) está en el futuro. Revisa la fecha y hora del teléfono.', new.registrado_en
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists registro_hora_no_futura on public.registro;
create trigger registro_hora_no_futura
  before insert or update of registrado_en on public.registro
  for each row execute function public.validar_hora_registro();

-- Máximo 10 fotos por registro de avance ------------------------------------------------------------
create or replace function public.validar_max_fotos_registro() returns trigger
language plpgsql as $$
begin
  if new.registro_id is not null and (
    select count(*) from public.fotografia
    where registro_id = new.registro_id and id <> new.id
  ) >= 10 then
    raise exception 'Puedes adjuntar hasta 10 fotos por registro.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists fotografia_max_por_registro on public.fotografia;
create trigger fotografia_max_por_registro
  before insert or update of registro_id on public.fotografia
  for each row execute function public.validar_max_fotos_registro();
