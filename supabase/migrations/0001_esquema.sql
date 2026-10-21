-- ============================================================================
-- Bitácora ITO · Esquema de la base remota (Supabase / PostgreSQL)
-- Modelo: docs/01-estructura-datos.md, versión 2.
--
-- Criterios:
--  * Tablas en snake_case, equivalentes a los tipos de src/lib/types.ts.
--  * Los ids son uuid GENERADOS POR LA APP (crypto.randomUUID en el teléfono), no por la base:
--    así un registro creado sin señal conserva su id al sincronizarse. Por eso no hay DEFAULT.
--  * La app sube con «upsert» por id (src/lib/sync.ts), así que reintentar no duplica nada.
--  * Buckets de Storage: `fotos` (público, imágenes JPEG) y `reportes` (privado, PDF).
--
-- ⚠ RIESGO DE SEGURIDAD (aceptado por ser una maqueta académica):
--  La app no tiene inicio de sesión y sube con la clave pública «anon», que va dentro del APK y
--  de la web. Las políticas de abajo permiten a CUALQUIERA que tenga esa clave leer, insertar y
--  actualizar todas las tablas (y borrar áreas del turno, registros, alertas y fotografías, para
--  reflejar lo que el inspector quita en el teléfono). Las fotos son públicas por URL.
--  Antes de usarla con datos reales hay que: activar Supabase Auth, cambiar `to anon` por
--  `to authenticated`, filtrar por usuario/contrato (p. ej. `using (elaborado_por = auth.uid())`),
--  volver privado el bucket `fotos` y quitar las políticas de borrado.
--  La clave de servicio (SUPABASE_SERVICE_ROLE_KEY) ignora RLS: solo se usa en Vercel, nunca en la app.
-- ============================================================================

-- ───────────────────────── Catálogos del contrato ─────────────────────────

create table public.usuario (
  id            uuid primary key,
  nombre        text not null,
  correo        text not null,
  rol           text not null check (rol in ('inspector', 'jefatura', 'admin')),
  activo        boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create table public.contrato (
  id                    uuid primary key,
  nombre                text not null,
  numero                text,
  mandante              text not null,
  codigo_proyecto       text not null,
  codigo_interno        text,
  revision_formato      text not null,
  fecha_formato         text,
  prefijo_correlativo   text not null,
  ultimo_correlativo    integer not null default 0,
  destinatarios         text[] not null default '{}',
  hora_cierre_turno_dia text,
  actualizado_en        timestamptz not null default now()
);

create table public.empresa (
  id          uuid primary key,
  contrato_id uuid not null references public.contrato (id) on delete cascade,
  nombre      text not null,
  tipo        text not null check (tipo in ('contratista', 'laboratorio', 'topografia', 'obras_civiles', 'otro')),
  actualizado_en timestamptz not null default now()
);
create index empresa_contrato_idx on public.empresa (contrato_id);

-- `frente` = «área» en la aplicación (catálogo que carga la jefatura; el inspector solo elige).
create table public.frente (
  id              uuid primary key,
  contrato_id     uuid not null references public.contrato (id) on delete cascade,
  frente_padre_id uuid references public.frente (id) on delete set null,
  numero          text,
  nombre          text not null,
  empresa_id      uuid references public.empresa (id) on delete set null,
  orden           integer not null default 0,
  cargado_por     uuid references public.usuario (id) on delete set null,
  creado_en       timestamptz not null default now(),
  ultimo_uso      date,
  vigente         boolean not null default true,
  actualizado_en  timestamptz not null default now()
);
create index frente_contrato_idx on public.frente (contrato_id, orden);

create table public.rol_turno (
  id            uuid primary key,
  usuario_id    uuid not null references public.usuario (id) on delete cascade,
  contrato_id   uuid not null references public.contrato (id) on delete cascade,
  dias_trabajo  integer not null default 7 check (dias_trabajo > 0),
  dias_descanso integer not null default 7 check (dias_descanso >= 0),
  fecha_inicio  date not null,
  vigente_desde date,
  actualizado_en timestamptz not null default now()
);
create index rol_turno_usuario_idx on public.rol_turno (usuario_id);

-- ───────────────────────── Reporte del turno ─────────────────────────

create table public.reporte (
  id               uuid primary key,
  contrato_id      uuid not null references public.contrato (id),
  fecha            date not null,
  turno            text not null check (turno in ('dia', 'noche')),
  correlativo      text not null,
  elaborado_por    uuid not null references public.usuario (id),
  clima_turno      text not null check (clima_turno in ('despejado', 'nublado', 'lluvia')),
  clima_proyeccion text not null check (clima_proyeccion in ('despejado', 'nublado', 'lluvia')),
  estado           text not null check (estado in ('borrador', 'generado', 'aprobado', 'enviado')),
  resumen_turno    text,
  hora_generacion  timestamptz,
  hora_aprobacion  timestamptz,
  aprobado_por     uuid references public.usuario (id),
  url_pdf          text, -- ruta del PDF dentro del bucket `reportes` (privado)
  sincronizado_en  timestamptz,
  actualizado_en   timestamptz not null default now()
);
-- Regla 1 (un reporte por contrato, fecha y turno): se valida en la app. Aquí es un índice no único
-- para que reinstalar la maqueta (ids nuevos para el mismo día) no bloquee la sincronización.
create index reporte_contrato_fecha_idx on public.reporte (contrato_id, fecha, turno);

create table public.area_turno (
  id          uuid primary key,
  reporte_id  uuid not null references public.reporte (id) on delete cascade,
  frente_id   uuid not null references public.frente (id),
  empresa_id  uuid not null references public.empresa (id),
  orden       integer not null, -- numera el reporte: sección n.0 (área) y n.1 (empresa)
  agregada_en timestamptz not null,
  actualizado_en timestamptz not null default now()
);
create index area_turno_reporte_idx on public.area_turno (reporte_id, orden);

create table public.registro (
  id                 uuid primary key,
  reporte_id         uuid not null references public.reporte (id) on delete cascade,
  area_turno_id      uuid not null references public.area_turno (id) on delete cascade,
  sin_actividad      boolean not null default false,
  descripcion        text not null default '',
  origen_descripcion text not null check (origen_descripcion in ('dictado', 'escrito')),
  latitud            double precision,
  longitud           double precision,
  registrado_en      timestamptz not null, -- hora real en terreno (regla 6), aunque se suba después
  sincronizado_en    timestamptz,
  actualizado_en     timestamptz not null default now()
  -- La regla «descripción obligatoria si hay actividad» se valida en la app; aquí no se repite
  -- para que un registro a medio escribir no trabe la sincronización.
);
create index registro_reporte_idx on public.registro (reporte_id);
create index registro_area_turno_idx on public.registro (area_turno_id);

create table public.alerta (
  id              uuid primary key,
  reporte_id      uuid not null references public.reporte (id) on delete cascade,
  columna         text not null check (columna in ('construccion', 'laboratorio', 'topografia', 'interferencia')),
  empresa_id      uuid references public.empresa (id) on delete set null,
  area_turno_id   uuid references public.area_turno (id) on delete set null,
  descripcion     text not null,
  criticidad      text not null check (criticidad in ('baja', 'media', 'alta')),
  registrado_en   timestamptz not null,
  sincronizado_en timestamptz,
  actualizado_en  timestamptz not null default now()
);
create index alerta_reporte_idx on public.alerta (reporte_id);

create table public.fotografia (
  id              uuid primary key,
  reporte_id      uuid references public.reporte (id) on delete cascade, -- atajo para consultar por reporte
  registro_id     uuid references public.registro (id) on delete cascade,
  alerta_id       uuid references public.alerta (id) on delete cascade,
  ruta            text not null, -- ruta en el bucket `fotos`
  url             text,          -- URL pública de la imagen
  orden           integer not null default 1,
  pie_foto        text,
  capturada_en    timestamptz not null,
  latitud         double precision,
  longitud        double precision,
  sincronizado_en timestamptz,
  actualizado_en  timestamptz not null default now(),
  -- Cuelga de un registro o de una alerta, nunca de ambos ni de ninguno.
  check ((registro_id is null) <> (alerta_id is null))
);
create index fotografia_reporte_idx on public.fotografia (reporte_id);
create index fotografia_registro_idx on public.fotografia (registro_id);
create index fotografia_alerta_idx on public.fotografia (alerta_id);

create table public.envio (
  id              uuid primary key,
  reporte_id      uuid not null references public.reporte (id) on delete cascade,
  enviado_por     uuid references public.usuario (id),
  destinatarios   text[] not null default '{}',
  estado          text not null check (estado in ('en_cola', 'enviando', 'enviado', 'fallido')),
  creado_en       timestamptz not null,
  enviado_en      timestamptz,
  intentos        integer not null default 0,
  error           text,
  acuse_recibido  boolean,
  sincronizado_en timestamptz,
  actualizado_en  timestamptz not null default now()
);
create index envio_reporte_idx on public.envio (reporte_id);

-- ───────────────────────── Fecha de actualización automática ─────────────────────────

create or replace function public.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['usuario','contrato','empresa','frente','rol_turno','reporte','area_turno',
                           'registro','alerta','fotografia','envio'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.tocar_actualizado_en()',
                   t || '_actualizado_en', t);
  end loop;
end $$;

-- ───────────────────────── RLS y permisos (maqueta: rol anon) ─────────────────────────
-- Ver el aviso de RIESGO al inicio del archivo.

do $$
declare t text;
begin
  foreach t in array array['usuario','contrato','empresa','frente','rol_turno','reporte','area_turno',
                           'registro','alerta','fotografia','envio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on table public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'maqueta_leer_' || t, t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)', 'maqueta_insertar_' || t, t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', 'maqueta_actualizar_' || t, t);
  end loop;

  -- Borrado solo donde la app lo necesita: el inspector puede quitar áreas, registros, alertas y fotos
  -- de un borrador, y la sincronización refleja ese cambio en la nube.
  foreach t in array array['area_turno','registro','alerta','fotografia'] loop
    execute format('grant delete on table public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (true)', 'maqueta_borrar_' || t, t);
  end loop;
end $$;

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos',    'fotos',    true,  10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('reportes', 'reportes', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La app sube con upsert (sobrescribe si se reintenta): necesita insertar, leer y actualizar.
-- `reportes` es privado: el PDF se lee con la clave anon desde la app y con la de servicio en Vercel.
create policy maqueta_storage_leer on storage.objects
  for select to anon, authenticated using (bucket_id in ('fotos', 'reportes'));
create policy maqueta_storage_insertar on storage.objects
  for insert to anon, authenticated with check (bucket_id in ('fotos', 'reportes'));
create policy maqueta_storage_actualizar on storage.objects
  for update to anon, authenticated using (bucket_id in ('fotos', 'reportes')) with check (bucket_id in ('fotos', 'reportes'));
