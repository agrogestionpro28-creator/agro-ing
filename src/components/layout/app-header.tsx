'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/(auth)/logout/actions';

type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

const TABS = [
  { href: '/dashboard',   label: 'Productores', icon: '⬡' },
  { href: '/cobranza',    label: 'Cobranza',    icon: '💰' },
  { href: '/recorrida',   label: 'Recorrida',   icon: '🗺' },
  { href: '/analisis',    label: 'Análisis',    icon: '🔬' },
  { href: '/recetas',     label: 'Recetas',     icon: '📋' },
  { href: '/bitacora',    label: 'Bitácora',    icon: '⬡' },
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

  return (
    <header className="bg-base-2 border-b border-base-5 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        {/* Ingeniero */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg,#2EAA6E,#1d7a4d)', color: '#fff' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-ochre font-black text-sm uppercase tracking-wide leading-none truncate">
              {ingeniero.nombre}{ingeniero.apellido ? ' ' + ingeniero.apellido : ''}
            </p>
            <p className="text-lo text-[10px] uppercase tracking-wider">
              Ing. Agrónomo{ingeniero.matricula ? ` · M.P. ${ingeniero.matricula}` : ''}
            </p>
          </div>
        </div>

        {/* Selector de campaña — dropdown */}
        <div className="flex items-center">
          <select
            value={campanaActivaId}
            onChange={e => onCampanaChange(e.target.value)}
            className="bg-base-3 border border-base-5 rounded-full px-4 py-2 text-hi font-bold text-sm focus:outline-none focus:border-ochre cursor-pointer"
            style={{ minWidth: 160 }}
          >
            {campanas.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#111' }}>
                Campaña {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Perfil */}
        <div className="relative shrink-0">
          <button onClick={() => setShowMenu(v => !v)}
            className="btn-ghost text-xs py-1.5 px-3">⚙ Perfil</button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 card py-1 shadow-xl z-50">
              <Link href="/perfil" onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-mid hover:text-hi hover:bg-base-4">
                Editar perfil
              </Link>
              <form action={logout}>
                <button className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-base-4 border-t border-base-5">
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 px-6 border-t border-base-5">
        {TABS.map(tab => {
          const active = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                active
                  ? 'border-ochre text-ochre'
                  : 'border-transparent text-mid hover:text-hi hover:border-base-5'
              }`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
