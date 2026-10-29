'use client';

import Link from 'next/link';
import { useCampana } from '@/components/layout/app-shell';
import { cn } from '@/lib/utils';

type Productor   = { id: string; razon_social: string; localidad: string | null; activo: boolean };
type Campana     = { id: string; nombre: string };
type HasRow      = { productor_id: string; campana_id: string; hectareas_total: number; cantidad_lotes: number; cultivos: string[] | null; cultivos_2: string[] | null };
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
  al_dia:         'badge-al-dia',
  parcial:        'badge-parcial',
  atrasado:       'badge-atrasado',
  sin_configurar: 'badge-sin-conf',
};
const ESTADO_LABEL: Record<string, string> = {
  al_dia:         'Al día',
  parcial:        'Parcial',
  atrasado:       'Atrasado',
  sin_configurar: 'Sin conf.',
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

  const hasActual   = hasData.filter(h => h.campana_id === campanaId);
  const totalHas    = hasActual.reduce((s, h) => s + Number(h.hectareas_total), 0);
  const totalLotes  = hasActual.reduce((s, h) => s + h.cantidad_lotes, 0);
  const cobActual   = cobranza.filter(c => c.campana_id === campanaId);
  const alDia       = cobActual.filter(c => c.estado === 'al_dia').length;
  const atrasados   = cobActual.filter(c => c.estado === 'atrasado').length;

  const hasMap      = Object.fromEntries(hasActual.map(h => [h.productor_id, h]));
  const cobranzaMap = Object.fromEntries(cobActual.map(c => [c.productor_id, c]));

  const campanaActual = campanas.find(c => c.id === campanaId);

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* ── Header de página ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-1">Campaña {campanaActual?.nombre ?? '—'}</p>
          <h1 className="text-2xl font-black text-hi tracking-tight">Mis Productores</h1>
        </div>
        <Link href="/productores/nuevo" className="btn-primary btn-sm">
          + Nuevo productor
        </Link>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            value: productores.length,
            label: 'Productores',
            sub: 'activos en esta campaña',
            color: 'text-hi',
            accent: '#f59e0b',
          },
          {
            value: totalHas > 0 ? totalHas.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—',
            label: 'Hectáreas',
            sub: 'bajo asesoramiento',
            color: 'text-afa',
            accent: '#2EAA6E',
          },
          {
            value: totalLotes,
            label: 'Lotes',
            sub: 'en la campaña actual',
            color: 'text-hi',
            accent: '#6b7280',
          },
          {
            value: atrasados > 0 ? atrasados : alDia,
            label: atrasados > 0 ? 'Atrasados' : 'Al día',
            sub: 'en cobranza',
            color: atrasados > 0 ? 'text-danger' : 'text-afa',
            accent: atrasados > 0 ? '#ef4444' : '#2EAA6E',
          },
        ].map(({ value, label, sub, color, accent }) => (
          <div key={label} className="card p-4 relative overflow-hidden">
            {/* Barra acento lateral */}
            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accent }} />
            <p className={`text-3xl font-black tabular-nums leading-none ${color}`}>{value}</p>
            <p className="text-hi text-sm font-bold mt-1.5">{label}</p>
            <p className="text-lo text-xs mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Grid de productores ── */}
      {productores.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-4xl">🌾</p>
          <p className="text-hi font-bold">Todavía no tenés productores cargados</p>
          <Link href="/productores/nuevo" className="btn-primary inline-flex">Cargar el primero</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {productores.map(p => {
            const has     = hasMap[p.id];
            const cob     = cobranzaMap[p.id];
            const estado  = cob?.estado ?? 'sin_configurar';
            const cultivos = [
              ...(has?.cultivos ?? []),
              ...(has?.cultivos_2 ?? []),
            ].filter(Boolean);

            return (
              <Link
                key={p.id}
                href={`/productores/${p.id}`}
                className={cn(
                  'card aspect-square p-3.5 flex flex-col justify-between',
                  'relative overflow-hidden group',
                  'hover:border-ochre/60 hover:bg-base-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30'
                )}
              >
                {/* Panal watermark */}
                <svg
                  className="absolute -top-1 -right-1 opacity-[0.08] w-16 h-14 pointer-events-none"
                  viewBox="0 0 60 52" aria-hidden="true"
                >
                  <polygon points="15,0 45,0 60,26 45,52 15,52 0,26" fill="none" stroke="#f59e0b" strokeWidth="2" />
                </svg>

                {/* Top: localidad + estado cobranza */}
                <div className="flex items-start justify-between gap-1">
                  <span className="eyebrow truncate leading-none text-ochre/80">
                    {p.localidad ?? ''}
                  </span>
                  <span className={cn(ESTADO_BADGE[estado], 'shrink-0 leading-none text-[9px]')}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </div>

                {/* Nombre */}
                <div className="text-hi font-bold text-sm leading-tight line-clamp-2">
                  {p.razon_social}
                </div>

                {/* Bottom: ha + cultivos */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-afa font-black text-2xl leading-none tabular-nums">
                      {has ? Math.round(Number(has.hectareas_total)) : '—'}
                    </span>
                    <span className="text-lo text-[10px]">ha</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {cultivos.slice(0, 3).map(c => (
                      <span
                        key={c}
                        className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', CULTIVO_COLOR[c] ?? 'bg-base-4 text-mid')}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  <p className="text-lo text-[9px] mt-1.5 tabular-nums">
                    {has ? `${has.cantidad_lotes} lotes` : 'Sin lotes'}
                  </p>
                </div>
              </Link>
            );
          })}

          {/* + Nuevo */}
          <Link
            href="/productores/nuevo"
            className="card aspect-square flex items-center justify-center
                       border-dashed hover:border-ochre/50 hover:bg-base-3
                       text-lo hover:text-ochre transition-all group"
          >
            <div className="text-center">
              <div className="text-3xl font-thin mb-1 group-hover:scale-110 transition-transform">+</div>
              <div className="text-[10px] uppercase tracking-wider">Nuevo</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
