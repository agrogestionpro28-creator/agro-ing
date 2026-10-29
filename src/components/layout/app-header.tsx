'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/(auth)/login/actions';

type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

const TABS = [
  { href: '/dashboard',    label: 'Productores',  icon: '⬡' },
  { href: '/cobranza',     label: 'Cobranza',     icon: '💰' },
  { href: '/recorrida',    label: 'Recorrida',     icon: '🗺' },
  { href: '/analisis',     label: 'Análisis',      icon: '🔬' },
  { href: '/recetas',      label: 'Recetas',       icon: '📋' },
  { href: '/bitacora',     label: 'Bitácora',      icon: '⬡' },
  { href: '/siembra',      label: 'Siembra',       icon: '🌾' },
  { href: '/aplicaciones', label: 'Aplicaciones',  icon: '🌱' },
  { href: '/informes',     label: 'Informes',      icon: '📝' },
] as const;

export function AppHeader({
  ingeniero,
  campanas,
  campanaActivaId,
  onCampanaChange,
}: {
  ingeniero: Ingeniero;
  campanas: Campana[];
  campanaActivaId: string;
  onCampanaChange: (id: string) => void;
}) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  const initials = [ingeniero.nombre[0], ingeniero.apellido?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'IA';

  const campanaActual = campanas.find(c => c.id === campanaActivaId);

  return (
    <header className="bg-[#0d0d0d] border-b border-base-4 sticky top-0 z-40">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-base-4/50">
        {/* Logo / Ingeniero */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 select-none"
            style={{ background: 'linear-gradient(135deg,#2EAA6E 0%,#1a6640 100%)', color: '#fff' }}
          >
            {initials}
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-ochre font-black text-xs uppercase tracking-wider leading-none truncate">
              {ingeniero.nombre}{ingeniero.apellido ? ' ' + ingeniero.apellido : ''}
            </p>
            <p className="text-lo text-[10px] leading-tight">
              Ing. Agrónomo{ingeniero.matricula ? ` · M.P. ${ingeniero.matricula}` : ''}
            </p>
          </div>
        </div>

        {/* Selector campaña */}
        <div className="flex items-center gap-1.5">
          <span className="text-lo text-[10px] font-bold tracking-wider uppercase hidden md:block">Campaña</span>
          <select
            value={campanaActivaId}
            onChange={e => onCampanaChange(e.target.value)}
            className="bg-base-3 border border-base-5 rounded-lg px-3 py-1.5 text-hi font-bold text-xs
                       focus:outline-none focus:border-ochre/60 focus:ring-2 focus:ring-ochre/15
                       cursor-pointer transition-all hover:border-base-6"
            style={{ minWidth: 120 }}
          >
            {campanas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Menú perfil */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-base-5
                       text-lo text-xs hover:text-mid hover:border-base-6 transition-all"
          >
            <span className="text-[11px]">⚙</span>
            <span className="hidden sm:inline">Perfil</span>
          </button>
          {showMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1.5 w-44 bg-base-2 border border-base-4 rounded-xl py-1 shadow-2xl z-50 animate-fade-in">
                <Link
                  href="/perfil"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-mid hover:text-hi hover:bg-base-3 transition-colors"
                >
                  <span className="text-base">👤</span> Editar perfil
                </Link>
                <div className="h-px bg-base-4 my-1" />
                <form action={logout}>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-base-3 transition-colors">
                    <span className="text-base">↩</span> Cerrar sesión
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs — scroll horizontal en mobile */}
      <nav className="flex overflow-x-auto scrollbar-none px-2 gap-0.5" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const active = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap
                ${active
                  ? 'border-ochre text-ochre'
                  : 'border-transparent text-mid hover:text-hi hover:border-base-5'}
              `}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
