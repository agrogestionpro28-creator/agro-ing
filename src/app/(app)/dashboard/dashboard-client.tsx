'use client';

import Link from 'next/link';
import { useCampana } from '@/components/layout/app-shell';
import { cn, fmtFecha } from '@/lib/utils';

type Productor = { id: string; razon_social: string; localidad: string | null; activo: boolean };
type Campana = { id: string; nombre: string };
type HasRow = { productor_id: string; campana_id: string; hectareas_total: number; cantidad_lotes: number; cultivos: string[] | null; cultivos_2: string[] | null };
type CobranzaRow = { productor_id: string; campana_id: string; estado: string; total_cobrado: number; monto_unitario: number | null; modalidad: string };

const CULTIVO_COLOR: Record<string, string> = {
  Soja:     'bg-[#1a3d24] text-afa',
  Maíz:     'bg-[#2a1f00] text-ochre',
  Trigo:    'bg-[#2a1500] text-amber-400',
  Girasol:  'bg-[#2a2800] text-yellow-300',
  Sorgo:    'bg-[#2a1a0a] text-orange-400',
  Cebada:   'bg-[#1a2a10] text-green-400',
};

const ESTADO_BADGE: Record<string, string> = {
  al_dia:       'badge-al-dia',
  parcial:      'badge-parcial',
  atrasado:     'badge-atrasado',
  sin_configurar: 'badge-sin-conf',
};
const ESTADO_LABEL: Record<string, string> = {
  al_dia: 'Al día',
  parcial: 'Parcial',
  atrasado: 'Atrasado',
  sin_configurar: 'Sin config',
};

export function DashboardClient({
  productores,
  campanas,
  hasData,
  cobranza,
}: {
  productores: Productor[];
  campanas: Campana[];
  hasData: HasRow[];
  cobranza: CobranzaRow[];
}) {
  const { campanaId } = useCampana();

  // Totales de la campaña
  const hasActual = hasData.filter((h) => h.campana_id === campanaId);
  const totalHas = hasActual.reduce((s, h) => s + Number(h.hectareas_total), 0);
  const totalLotes = hasActual.reduce((s, h) => s + h.cantidad_lotes, 0);

  // Maps rápidos por productor
  const hasMap = Object.fromEntries(
    hasActual.map((h) => [h.productor_id, h])
  );
  const cobranzaMap = Object.fromEntries(
    cobranza
      .filter((c) => c.campana_id === campanaId)
      .map((c) => [c.productor_id, c])
  );

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-baseline gap-4 mb-5 flex-wrap">
        <span className="text-ochre font-bold text-sm">
          {productores.length} productores
        </span>
        <span className="text-lo">·</span>
        <span className="text-afa font-bold text-sm">
          {totalHas.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ha totales
        </span>
        <span className="text-lo">·</span>
        <span className="text-mid text-sm">{totalLotes} lotes</span>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost text-xs py-1 px-3">Filtrar</button>
          <button className="btn-ghost text-xs py-1 px-3">Ordenar</button>
        </div>
      </div>

      {/* Grid de productores */}
      {productores.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-mid mb-4">Todavía no tenés productores cargados.</p>
          <Link href="/productores/nuevo" className="btn-primary">Cargar el primero</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {productores.map((p) => {
            const has = hasMap[p.id];
            const cob = cobranzaMap[p.id];
            const estado = cob?.estado ?? 'sin_configurar';
            const cultivos = [
              ...(has?.cultivos ?? []),
              ...(has?.cultivos_2 ?? []),
            ].filter(Boolean);

            return (
              <Link
                key={p.id}
                href={`/productores/${p.id}`}
                className={cn(
                  'card aspect-square p-3 flex flex-col justify-between',
                  'relative overflow-hidden group',
                  'hover:border-ochre transition-all duration-150 hover:-translate-y-0.5'
                )}
              >
                {/* Panal watermark */}
                <svg
                  className="absolute top-0 right-0 opacity-[0.12] w-14 h-12 pointer-events-none"
                  viewBox="0 0 60 52"
                  aria-hidden="true"
                >
                  <polygon
                    points="15,0 45,0 60,26 45,52 15,52 0,26"
                    fill="none" stroke="#f59e0b" strokeWidth="1.5"
                  />
                </svg>

                {/* Top: localidad + estado cobranza */}
                <div className="flex items-start justify-between gap-1">
                  <span className="eyebrow truncate leading-none">
                    {p.localidad ?? 'Sin loc.'}
                  </span>
                  <span className={cn(ESTADO_BADGE[estado], 'shrink-0 leading-none')}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </div>

                {/* Nombre */}
                <div className="text-hi font-bold text-sm leading-tight line-clamp-2">
                  {p.razon_social}
                </div>

                {/* Bottom: has + cultivos */}
                <div>
                  <div className="text-afa font-black text-3xl leading-none tabular-nums">
                    {has ? Math.round(Number(has.hectareas_total)) : '—'}
                  </div>
                  <div className="text-lo text-[10px] mb-2">ha totales</div>

                  {/* Cultivos badges */}
                  <div className="flex flex-wrap gap-1">
                    {cultivos.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          CULTIVO_COLOR[c] ?? 'bg-base-4 text-mid'
                        )}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Lotes count */}
                  <div className="font-mono text-[9px] text-faint tracking-[0.12em] mt-2 uppercase">
                    {has ? `${has.cantidad_lotes} lotes` : 'Sin lotes'} · Camp {campanas.find(c => c.id === campanaId)?.nombre?.replace('/','/') ?? '—'}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Card + nuevo productor */}
          <Link
            href="/productores/nuevo"
            className="card aspect-square flex items-center justify-center
                       border-dashed hover:border-ochre hover:text-ochre
                       text-lo transition-all group"
          >
            <div className="text-center">
              <div className="text-4xl font-thin mb-1 group-hover:scale-110 transition-transform">+</div>
              <div className="text-[10px] uppercase tracking-wider">Nuevo</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
