-- ============================================================
--  AGRO-ING — SCHEMA
--  Ejecutar completo en SQL Editor de Supabase (proyecto nuevo)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- INGENIEROS
-- ------------------------------------------------------------
create table public.ingenieros (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  apellido    text,
  matricula   text,
  telefono    text,
  email       text,
  logo_url    text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CAMPAÑAS  (20/5 → 19/5 del año siguiente)
-- ------------------------------------------------------------
create table public.campanas (
  id            uuid primary key default gen_random_uuid(),
  ingeniero_id  uuid not null references public.ingenieros(id) on delete cascade,
  nombre        text not null,          -- '2026/2027'
  fecha_inicio  date not null,          -- '2026-05-20'
  fecha_fin     date not null,          -- '2027-05-19'
  activa        boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (ingeniero_id, nombre)
);
create index on public.campanas (ingeniero_id);

-- Función: campaña activa = la que contiene today()
create or replace function public.campana_activa(ing_id uuid)
returns uuid
language sql stable
as $$
  select id from public.campanas
  where ingeniero_id = ing_id
    and current_date between fecha_inicio and fecha_fin
  order by fecha_inicio desc
  limit 1;
$$;

-- Función: crear campaña desde año de inicio
create or replace function public.crear_campana(ing_id uuid, anio_inicio int)
returns uuid
language plpgsql
as $$
declare
  nuevo_id uuid;
  f_inicio date := make_date(anio_inicio, 5, 20);
  f_fin    date := make_date(anio_inicio + 1, 5, 19);
  nombre   text := anio_inicio::text || '/' || (anio_inicio + 1)::text;
begin
  insert into public.campanas (ingeniero_id, nombre, fecha_inicio, fecha_fin)
  values (ing_id, nombre, f_inicio, f_fin)
  on conflict (ingeniero_id, nombre) do nothing
  returning id into nuevo_id;

  if nuevo_id is null then
    select id into nuevo_id from public.campanas
    where ingeniero_id = ing_id and nombre = nombre;
  end if;
  return nuevo_id;
end;
$$;

-- ------------------------------------------------------------
-- PRODUCTORES
-- ------------------------------------------------------------
create table public.productores (
  id            uuid primary key default gen_random_uuid(),
  ingeniero_id  uuid not null references public.ingenieros(id) on delete cascade,
  razon_social  text not null,
  cuit          text,
  telefono      text,
  email         text,
  localidad     text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on public.productores (ingeniero_id);

-- ------------------------------------------------------------
-- LOTES  (cada lote pertenece a un productor + campaña)
-- ------------------------------------------------------------
create table public.lotes (
  id              uuid primary key default gen_random_uuid(),
  productor_id    uuid not null references public.productores(id) on delete cascade,
  campana_id      uuid not null references public.campanas(id) on delete cascade,
  nombre          text not null,
  hectareas       numeric(10,2) not null default 0,
  cultivo         text,
  -- doble cultivo: trigo/soja, cebada/soja, etc.
  -- las has se cuentan UNA SOLA VEZ por lote independientemente del cultivo
  cultivo_2       text,
  variedad        text,
  fecha_siembra   date,
  notas           text,
  created_at      timestamptz not null default now()
);
create index on public.lotes (productor_id);
create index on public.lotes (campana_id);

-- Vista: hectáreas por productor x campaña SIN duplicar doble cultivo
create or replace view public.vw_productor_has as
select
  l.productor_id,
  l.campana_id,
  sum(l.hectareas) as hectareas_total,
  count(*)         as cantidad_lotes,
  -- cultivos únicos (puede haber doble cultivo por lote)
  array_agg(distinct l.cultivo)   filter (where l.cultivo is not null)   as cultivos,
  array_agg(distinct l.cultivo_2) filter (where l.cultivo_2 is not null) as cultivos_2
from public.lotes l
group by l.productor_id, l.campana_id;

-- ------------------------------------------------------------
-- COBRANZA DE HONORARIOS
-- ------------------------------------------------------------
create type public.modalidad_honorario as enum (
  'usd_mensual',
  'usd_anual',
  'kg_soja_ha',
  'kg_cultivo_ha',
  'otro'
);

create type public.estado_cobranza as enum (
  'al_dia',
  'parcial',
  'atrasado',
  'sin_configurar'
);

create table public.acuerdos (
  id              uuid primary key default gen_random_uuid(),
  productor_id    uuid not null references public.productores(id) on delete cascade,
  campana_id      uuid not null references public.campanas(id) on delete cascade,
  modalidad       public.modalidad_honorario not null default 'usd_mensual',
  monto_unitario  numeric(12,4),   -- USD/mes o kg/ha según modalidad
  descripcion     text,
  created_at      timestamptz not null default now(),
  unique (productor_id, campana_id)
);

create table public.pagos (
  id            uuid primary key default gen_random_uuid(),
  acuerdo_id    uuid not null references public.acuerdos(id) on delete cascade,
  fecha         date not null default current_date,
  monto         numeric(12,2) not null,
  medio         text,             -- 'efectivo', 'transferencia', 'cheque'
  observaciones text,
  created_at    timestamptz not null default now()
);
create index on public.pagos (acuerdo_id);

-- Vista: estado de cobranza por productor/campaña
create or replace view public.vw_cobranza as
select
  a.productor_id,
  a.campana_id,
  a.modalidad,
  a.monto_unitario,
  coalesce(sum(p.monto), 0) as total_cobrado,
  case
    when a.monto_unitario is null then 'sin_configurar'
    when coalesce(sum(p.monto), 0) = 0 then 'atrasado'
    when coalesce(sum(p.monto), 0) >= a.monto_unitario then 'al_dia'
    else 'parcial'
  end::public.estado_cobranza as estado
from public.acuerdos a
left join public.pagos p on p.acuerdo_id = a.id
group by a.id, a.productor_id, a.campana_id, a.modalidad, a.monto_unitario;

-- ------------------------------------------------------------
-- RECORRIDAS (planilla de visitas)
-- ------------------------------------------------------------
create table public.recorridas (
  id            uuid primary key default gen_random_uuid(),
  productor_id  uuid not null references public.productores(id) on delete cascade,
  campana_id    uuid not null references public.campanas(id) on delete cascade,
  lote_id       uuid references public.lotes(id) on delete set null,
  fecha         date not null default current_date,
  cultivo       text,
  estado_cultivo text,
  observaciones text,
  recomendacion text,
  created_at    timestamptz not null default now()
);
create index on public.recorridas (productor_id);

-- ------------------------------------------------------------
-- RECETAS FITOSANITARIAS
-- ------------------------------------------------------------
create table public.recetas (
  id               uuid primary key default gen_random_uuid(),
  ingeniero_id     uuid not null references public.ingenieros(id) on delete cascade,
  lote_id          uuid not null references public.lotes(id) on delete cascade,
  fecha_emision    date not null default current_date,
  fecha_aplicacion date,
  cultivo          text,
  estado_cultivo   text,
  objetivo         text,
  volumen_caldo    numeric(10,2),
  observaciones    text,
  created_at       timestamptz not null default now()
);

create table public.receta_items (
  id               uuid primary key default gen_random_uuid(),
  receta_id        uuid not null references public.recetas(id) on delete cascade,
  producto_nombre  text not null,
  principio_activo text,
  dosis            numeric(10,3) not null,
  unidad           text not null default 'cc/ha',
  orden            int not null default 0
);

-- ------------------------------------------------------------
-- ANÁLISIS DE SUELO
-- ------------------------------------------------------------
create table public.analisis (
  id            uuid primary key default gen_random_uuid(),
  lote_id       uuid not null references public.lotes(id) on delete cascade,
  fecha         date not null default current_date,
  laboratorio   text,
  ph            numeric(4,2),
  mo            numeric(5,2),  -- materia orgánica %
  p_bray        numeric(8,2),  -- fósforo ppm
  n_total       numeric(8,2),
  s_sulfatos    numeric(8,2),
  observaciones text,
  created_at    timestamptz not null default now()
);
create index on public.analisis (lote_id);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.ingenieros   enable row level security;
alter table public.campanas     enable row level security;
alter table public.productores  enable row level security;
alter table public.lotes        enable row level security;
alter table public.acuerdos     enable row level security;
alter table public.pagos        enable row level security;
alter table public.recorridas   enable row level security;
alter table public.recetas      enable row level security;
alter table public.receta_items enable row level security;
alter table public.analisis     enable row level security;

-- Ingeniero: su propio perfil
create policy "ing_own" on public.ingenieros for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Campañas: propias
create policy "camp_own" on public.campanas for all
  using (ingeniero_id = auth.uid()) with check (ingeniero_id = auth.uid());

-- Productores: propios
create policy "prod_own" on public.productores for all
  using (ingeniero_id = auth.uid()) with check (ingeniero_id = auth.uid());

-- Lotes: vía productor
create policy "lotes_own" on public.lotes for all
  using (exists (
    select 1 from public.productores p
    where p.id = productor_id and p.ingeniero_id = auth.uid()
  ));

-- Acuerdos: vía productor
create policy "acuerdos_own" on public.acuerdos for all
  using (exists (
    select 1 from public.productores p
    where p.id = productor_id and p.ingeniero_id = auth.uid()
  ));

-- Pagos: vía acuerdo → productor
create policy "pagos_own" on public.pagos for all
  using (exists (
    select 1 from public.acuerdos a
    join public.productores p on p.id = a.productor_id
    where a.id = acuerdo_id and p.ingeniero_id = auth.uid()
  ));

-- Recorridas: vía productor
create policy "recorridas_own" on public.recorridas for all
  using (exists (
    select 1 from public.productores p
    where p.id = productor_id and p.ingeniero_id = auth.uid()
  ));

-- Recetas: propias del ingeniero
create policy "recetas_own" on public.recetas for all
  using (ingeniero_id = auth.uid()) with check (ingeniero_id = auth.uid());

-- Items: vía receta
create policy "items_own" on public.receta_items for all
  using (exists (
    select 1 from public.recetas r
    where r.id = receta_id and r.ingeniero_id = auth.uid()
  ));

-- Análisis: vía lote → productor
create policy "analisis_own" on public.analisis for all
  using (exists (
    select 1 from public.lotes l
    join public.productores p on p.id = l.productor_id
    where l.id = lote_id and p.ingeniero_id = auth.uid()
  ));

-- ============================================================
--  TRIGGER: crear perfil + campaña activa al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anio_actual int := extract(year from current_date);
  mes_actual  int := extract(month from current_date);
  anio_camp   int;
  f_inicio    date;
  f_fin       date;
begin
  -- Insertar perfil de ingeniero
  insert into public.ingenieros (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.email
  );

  -- Determinar campaña activa según fecha de registro
  -- Si estamos entre 1/1 y 19/5 la campaña empezó el año anterior
  if mes_actual < 5 or (mes_actual = 5 and extract(day from current_date)::int < 20) then
    anio_camp := anio_actual - 1;
  else
    anio_camp := anio_actual;
  end if;

  f_inicio := make_date(anio_camp, 5, 20);
  f_fin    := make_date(anio_camp + 1, 5, 19);

  insert into public.campanas (ingeniero_id, nombre, fecha_inicio, fecha_fin, activa)
  values (
    new.id,
    anio_camp::text || '/' || (anio_camp+1)::text,
    f_inicio, f_fin, true
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket para logos del ingeniero
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_upload" on storage.objects for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

create policy "logos_read" on storage.objects for select
  using (bucket_id = 'logos');
