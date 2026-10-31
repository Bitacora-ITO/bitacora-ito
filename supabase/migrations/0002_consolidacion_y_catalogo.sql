-- 0002 · Consolidación del reporte por el jefe de turno y catálogo versionado (semana 8).
--
-- Cambios pedidos por el profesor guía: varios inspectores entregan su parte del turno y
-- el jefe de turno la consolida en un solo reporte, que es el único que se envía al mandante.
-- El catálogo (áreas, empresas, usuarios) lo carga un administrador desde un Excel y los
-- teléfonos lo descargan cuando cambia de versión.
--
-- Solo agrega: no borra ni cambia nada existente (aplicada así el 30-10-2026 en el proyecto del equipo).
-- «Entregado al jefe de turno» no es un estado nuevo de `reporte`: se marca con `entregado_en`
-- (el estado remoto sigue en 'aprobado'), para no tener que reemplazar la regla de estados.
-- Mismo modelo de acceso de maqueta que 0001 (rol anon con lectura y escritura; riesgo documentado allí).

alter table public.reporte add column if not exists entregado_en timestamptz;
alter table public.usuario add column if not exists contrato_id uuid references public.contrato (id) on delete set null;

-- Reporte consolidado del turno (uno por contrato, fecha y turno).
create table if not exists public.consolidado (
  id                  uuid primary key,
  contrato_id         uuid not null references public.contrato (id),
  fecha               date not null,
  turno               text not null check (turno in ('dia', 'noche')),
  correlativo         text not null,
  consolidado_por     uuid references public.usuario (id),
  partes              uuid[] not null default '{}', -- ids de `reporte` incluidos
  elaborado_por_texto text,                          -- «Jorge Orellana S. / Alberto Castillo»
  clima_turno         text check (clima_turno in ('despejado', 'nublado', 'lluvia')),
  clima_proyeccion    text check (clima_proyeccion in ('despejado', 'nublado', 'lluvia')),
  estado              text not null check (estado in ('borrador', 'generado', 'aprobado', 'enviado')),
  ruta_pdf            text,                          -- en el bucket `reportes`
  enviado_en          timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index if not exists consolidado_contrato_fecha on public.consolidado (contrato_id, fecha, turno);
create index if not exists reporte_contrato_fecha on public.reporte (contrato_id, fecha, turno);

-- Versión del catálogo por contrato: los teléfonos comparan y ofrecen «Actualizar».
create table if not exists public.catalogo_version (
  contrato_id    uuid primary key references public.contrato (id) on delete cascade,
  version        integer not null default 1,
  cargado_por    uuid references public.usuario (id) on delete set null,
  cargado_en     timestamptz not null default now(),
  nota           text,
  actualizado_en timestamptz not null default now()
);

alter table public.consolidado enable row level security;
alter table public.catalogo_version enable row level security;
grant select, insert, update on table public.consolidado to anon, authenticated;
grant select, insert, update on table public.catalogo_version to anon, authenticated;

do $$
declare t text; p text; c text; expr text;
begin
  foreach t in array array['consolidado', 'catalogo_version'] loop
    foreach c in array array['leer', 'insertar', 'actualizar'] loop
      p := 'maqueta_' || c || '_' || t;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = p) then
        expr := case c
          when 'leer' then format('create policy %I on public.%I for select to anon, authenticated using (true)', p, t)
          when 'insertar' then format('create policy %I on public.%I for insert to anon, authenticated with check (true)', p, t)
          else format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', p, t)
        end;
        execute expr;
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
