-- ── Tabla cosechas ────────────────────────────────────────────────────────────
-- Registra el rinde de cosecha por lote y cultivo.
-- Un lote doble cultivo (trigo/soja) puede tener dos filas: una por cultivo.

create table public.cosechas (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.lotes(id) on delete cascade,
  ingeniero_id    uuid not null references public.ingenieros(id) on delete cascade,
  cultivo         text not null,          -- el cultivo cosechado (puede ser cultivo o cultivo_2 del lote)
  fecha_cosecha   date,
  rinde_kg_ha     numeric(10,2),          -- kg por hectárea
  humedad_pct     numeric(5,2),           -- humedad al momento de cosecha
  rinde_std_kg_ha numeric(10,2),          -- rinde corregido a humedad estándar (calculable)
  proteina_pct    numeric(5,2),           -- para trigo/soja
  aceite_pct      numeric(5,2),           -- para girasol/soja
  peso_hecto      numeric(5,2),           -- kg/hl
  observaciones   text,
  created_at      timestamptz not null default now()
);

create index on public.cosechas (lote_id);
create index on public.cosechas (ingeniero_id);
create index on public.cosechas (cultivo);
create index on public.cosechas (fecha_cosecha);

-- RLS
alter table public.cosechas enable row level security;

create policy "cosechas_own" on public.cosechas for all
  using (ingeniero_id = auth.uid());

-- Columna fecha_cosecha en lotes (si no existe ya)
alter table public.lotes
  add column if not exists fecha_cosecha date;
