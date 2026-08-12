-- Tabla de aplicaciones por lote
create table public.aplicaciones (
  id            uuid primary key default gen_random_uuid(),
  lote_id       uuid not null references public.lotes(id) on delete cascade,
  fecha         date not null default current_date,
  tipo          text not null, -- 'Herbicida', 'Fungicida', 'Insecticida', 'Fertilizante', 'Otro'
  productos     text,          -- descripción libre de productos y dosis
  maquinaria    text not null, -- 'M' mosquito, 'D' dron, 'A' avión
  propio_alq    text not null default 'Propio', -- 'Propio' o 'Alquilado'
  costo_ha      numeric(10,2), -- costo por ha
  hectareas_apl numeric(10,2), -- has aplicadas (por defecto las del lote)
  observaciones text,
  created_at    timestamptz not null default now()
);
create index on public.aplicaciones (lote_id);

alter table public.aplicaciones enable row level security;

create policy "aplicaciones_own" on public.aplicaciones for all
  using (exists (
    select 1 from public.lotes l
    join public.productores p on p.id = l.productor_id
    where l.id = lote_id and p.ingeniero_id = auth.uid()
  ));
