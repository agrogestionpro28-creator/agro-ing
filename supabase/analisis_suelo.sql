-- ============================================================
-- ANÁLISIS DE SUELO (completo) — reemplaza a public.analisis
-- Ya ejecutado en Supabase el 07/10/2026.
-- ============================================================
create table if not exists public.analisis_suelo (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references public.lotes(id) on delete cascade,
  ingeniero_id uuid not null,
  laboratorio text, fecha_informe date, profundidad_cm text default '0-20',
  momento text,                 -- 'presiembra' | 'post_fertilizacion' | 'otro'
  cultivo text, estado_cultivo text,
  fert_aplicado jsonb,          -- [{"producto":"12-40-0-5-1Zn","kg_ha":80}]
  mo numeric, ph numeric, ce numeric, p_bray numeric, n_nitratos numeric, nan numeric,
  s_so4 numeric, ca numeric, mg numeric, k numeric, na numeric, cic numeric, sat_bases numeric,
  zn numeric, b numeric, cu numeric, fe numeric, mn numeric,
  observaciones text, created_at timestamptz default now()
);
create index if not exists analisis_suelo_lote_idx on public.analisis_suelo (lote_id);

alter table public.analisis_suelo enable row level security;
-- create policy "suelo_propio" on public.analisis_suelo
--   for all using (ingeniero_id = auth.uid()) with check (ingeniero_id = auth.uid());
