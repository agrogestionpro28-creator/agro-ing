'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/(auth)/login/actions';

type Campana   = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

const NAV = [
  { href: '/dashboard',    label: 'Productores',   icon: Icon_Productores },
  { href: '/siembra',      label: 'Siembra',        icon: Icon_Siembra },
  { href: '/aplicaciones', label: 'Aplicaciones',   icon: Icon_Aplicaciones },
  { href: '/recorrida',    label: 'Recorrida',       icon: Icon_Recorrida },
  { href: '/analisis',     label: 'Análisis',        icon: Icon_Analisis },
  { href: '/cobranza',     label: 'Cobranza',        icon: Icon_Cobranza },
  { href: '/recetas',      label: 'Recetas',         icon: Icon_Recetas },
  { href: '/bitacora',     label: 'Bitácora',        icon: Icon_Bitacora },
  { href: '/informes',     label: 'Informes',        icon: Icon_Informes },
] as const;

/* ─── Iconos SVG inline ────────────────────────────────── */
function Icon_Productores({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" />
    </svg>
  )
}
function Icon_Siembra({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.5 2a.5.5 0 0 1 .5.5V5h2V2.5a.5.5 0 0 1 1 0V5h2V2.5a.5.5 0 0 1 1 0V5h1.5A1.5 1.5 0 0 1 15 6.5v1A1.5 1.5 0 0 1 13.5 9H13v5.5a.5.5 0 0 1-1 0V9H8v5.5a.5.5 0 0 1-1 0V9h-.5A1.5 1.5 0 0 1 5 7.5v-1A1.5 1.5 0 0 1 6.5 5H5V2.5a.5.5 0 0 1 .5-.5z" clipRule="evenodd" />
    </svg>
  )
}
function Icon_Aplicaciones({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 2h14v2H3V6zm0 4h4v4H3v-4zm6 0h8v4H9v-4z" />
    </svg>
  )
}
function Icon_Recorrida({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9zM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" clipRule="evenodd" />
    </svg>
  )
}
function Icon_Analisis({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5zM8 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7zM14 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4z" />
    </svg>
  )
}
function Icon_Cobranza({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 0 0-2 2v1h16V6a2 2 0 0 0-2-2H4zM18 9H2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM4 13a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm5-1a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9z" />
    </svg>
  )
}
function Icon_Recetas({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7z" clipRule="evenodd" />
    </svg>
  )
}
function Icon_Bitacora({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z" />
    </svg>
  )
}
function Icon_Informes({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6zm2 10a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H8zm0-4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H8z" clipRule="evenodd" />
    </svg>
  )
}
/* ──────────────────────────────────────────────────────── */

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const initials = [ingeniero.nombre[0], ingeniero.apellido?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'IA';

  const nombreCompleto = `${ingeniero.nombre}${ingeniero.apellido ? ' ' + ingeniero.apellido : ''}`;

  return (
    <>
      {/* ── SIDEBAR ────────────────────────────────────────── */}
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-40 flex flex-col
        transition-transform duration-300 ease-out w-56
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen lg:shrink-0
      `}
      style={{ background: '#0a0a0a', borderRight: '1px solid #1f1f1f' }}>

        {/* Logo / Marca */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid #1f1f1f' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0"
              style={{ background: 'linear-gradient(135deg,#22d3a0 0%,#0284c7 100%)', color: '#0a0a0a' }}
            >
              AG
            </div>
            <div>
              <p className="font-black text-sm leading-none text-white">AgroGestión</p>
              <p className="text-[10px] leading-tight" style={{ color: '#6b7280' }}>Panel Ingeniero</p>
            </div>
          </div>
        </div>

        {/* Selector campaña */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #1f1f1f' }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>Campaña activa</p>
          <select
            value={campanaActivaId}
            onChange={e => onCampanaChange(e.target.value)}
            className="w-full rounded-lg px-3 py-1.5 font-bold text-xs cursor-pointer transition-all focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ffffff' }}
          >
            {campanas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider" style={{ color: '#404040' }}>Módulos</p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black transition-all duration-150 group"
                style={active
                  ? { background: 'rgba(34,211,160,0.12)', color: '#22d3a0' }
                  : { color: '#9ca3af' }
                }
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af'; } }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22d3a0' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer del sidebar — perfil */}
        <div className="p-3" style={{ borderTop: '1px solid #1f1f1f' }}>
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-left"
              style={{ color: '#ffffff' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0"
                style={{ background: 'linear-gradient(135deg,#22d3a0 0%,#0284c7 100%)', color: '#0a0a0a' }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black leading-tight truncate text-white">{nombreCompleto}</p>
                <p className="text-[10px] truncate" style={{ color: '#6b7280' }}>
                  {ingeniero.matricula ? `M.P. ${ingeniero.matricula}` : 'Ing. Agrónomo'}
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>⚙</span>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl py-1 shadow-2xl z-50 animate-fade-in"
                  style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
                  <Link
                    href="/perfil"
                    onClick={() => { setShowMenu(false); setSidebarOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors"
                    style={{ color: '#d1d5db' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1f1f1f'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#d1d5db'; }}
                  >
                    <span>👤</span> Editar perfil
                  </Link>
                  <div className="h-px my-1" style={{ background: '#2a2a2a' }} />
                  <form action={logout}>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors"
                      style={{ color: '#f87171' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1f1f1f'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span>↩</span> Cerrar sesión
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── TOP BAR (mobile) ────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1f1f1f" }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg hover:bg-base-3 text-mid hover:text-hi transition-all"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px]"
            style={{ background: 'linear-gradient(135deg,#22d3a0,#0284c7)', color: '#060a0e' }}
          >
            AG
          </div>
          <span className="text-hi font-black text-sm">AgroGestión</span>
        </div>
        <div className="ml-auto">
          <select
            value={campanaActivaId}
            onChange={e => onCampanaChange(e.target.value)}
            className="bg-base-3 border border-base-5 rounded-lg px-2.5 py-1 text-hi font-bold text-xs
                       focus:outline-none focus:border-ochre/60 cursor-pointer"
          >
            {campanas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </header>
    </>
  );
}
