'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { logout } from '@/app/(auth)/login/actions';

type Campana = { id: string; nombre: string; fecha_inicio: string; fecha_fin: string };
type Ingeniero = { nombre: string; apellido: string | null; matricula: string | null; logo_url: string | null };

const TABS = [
  { href: '/dashboard', label: 'Productores', icon: '⬡' },
  { href: '/cobranza',  label: 'Cobranza',    icon: '₿' },
  { href: '/recorrida', label: 'Recorrida',   icon: '◎' },
  { href: '/analisis',  label: 'Análisis',    icon: '⬡' },
  { href: '/recetas',   label: 'Recetas',     icon: '⬡' },
  { href: '/bitacora',  label: 'Bitácora',    icon: '⬡' },
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
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const campanaActual = campanas.find((c) => c.id === campanaActivaId);
  const idx = campanas.findIndex((c) => c.id === campanaActivaId);

  const initials = [ingeniero.nombre[0], ingeniero.apellido?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'IA';

  function navCampana(dir: -1 | 1) {
    const next = campanas[idx + dir];
    if (next) onCampanaChange(next.id);
  }

  return (
    <header className="relative z-10 bg-gradient-to-r from-[#0f2818] via-[#1a3d24] to-[#0a0a0a] border-b border-base-5">
      {/* Honeycomb strip */}
      <div className="absolute inset-0 honeycomb-bg opacity-100 pointer-events-none" />

      <div className="relative px-5 pt-4 pb-0">
        {/* Top row */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4">
          {/* Identidad */}
          <div className="flex items-center gap-3">
            {ingeniero.logo_url ? (
              <img
                src={ingeniero.logo_url}
                alt="Logo"
                className="w-12 h-12 rounded-xl border-2 border-ochre object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-base-3 border-2 border-ochre rounded-xl flex items-center justify-center text-ochre font-black text-lg select-none">
                {initials}
              </div>
            )}
            <div>
              <div className="text-ochre font-black text-lg leading-none tracking-wide uppercase">
                {ingeniero.nombre}{ingeniero.apellido ? ` ${ingeniero.apellido}` : ''}
              </div>
              <div className="text-mid text-[10px] tracking-[0.18em] mt-1 uppercase">
                Ing. Agrónomo{ingeniero.matricula ? ` · M.P. ${ingeniero.matricula}` : ''}
              </div>
            </div>
          </div>

                    {/* Selector de campaña — dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={campanaActivaId}
              onChange={e => onCampanaChange(e.target.value)}
              className="bg-base-3 border border-base-5 rounded-full px-4 py-2 text-hi font-bold text-sm focus:outline-none focus:border-ochre cursor-pointer"
              style={{minWidth: 150}}
            >
              {campanas.map(c => (
                <option key={c.id} value={c.id} style={{background:'#111'}}>
                  Campaña {c.nombre}
                </option>
              ))}
            </select>
          </div>

          
